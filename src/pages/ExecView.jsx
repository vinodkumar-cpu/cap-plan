import { useState, useMemo, Fragment } from 'react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronDown, ChevronRight, Building2, Users, Globe, TrendingUp } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function ExecView() {
  const {
    forecastData,
    weeks,
    getSites,
    getTimezones,
    getSiteWiseHC,
    getQueueTimezoneSites,
    getQueueSplit,
    getAHT,
    getQueueAssumption,
    getQueueBuffer,
    getCurrentHC,
    getBatchHCForWeek,
    getTrainingHCForWeek,
    calculateRequiredHC
  } = useApp()

  const [expandedSites, setExpandedSites] = useState(new Set())
  const [expandedQueues, setExpandedQueues] = useState(new Set())

  const sites = useMemo(() => getSites(), [getSites])
  const siteWiseHC = useMemo(() => getSiteWiseHC(), [getSiteWiseHC])
  const queueTimezoneSites = useMemo(() => getQueueTimezoneSites(), [getQueueTimezoneSites])

  // Toggle site expansion
  const toggleSite = (site) => {
    const newExpanded = new Set(expandedSites)
    if (newExpanded.has(site)) {
      newExpanded.delete(site)
    } else {
      newExpanded.add(site)
    }
    setExpandedSites(newExpanded)
  }

  // Toggle queue expansion
  const toggleQueue = (key) => {
    const newExpanded = new Set(expandedQueues)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedQueues(newExpanded)
  }

  // Calculate metrics for a queue/timezone/type across all weeks
  const calculateQueueTimezoneMetrics = (queue, timezone, type) => {
    const queueSplit = getQueueSplit(queue)
    const splitPct = type === 'external' ? queueSplit.external / 100 : queueSplit.internal / 100

    let totalVolume = 0
    let totalRequiredHCNoBuffer = 0
    let totalBatchHC = 0
    let totalTrainingHC = 0
    let weeksWithAHT = 0

    const row = forecastData?.find(r => r.queue === queue && r.timezone === timezone)
    if (!row) return null

    weeks.forEach(week => {
      const volume = (row.volumes[week] || 0) * splitPct
      const aht = getAHT(queue, type, week)
      const npt = getQueueAssumption(queue, type, 'npt', week)
      const shrinkage = getQueueAssumption(queue, type, 'shrinkage', week)
      const occupancy = getQueueAssumption(queue, type, 'occupancy', week)

      totalVolume += volume
      totalBatchHC += getBatchHCForWeek(queue, type, timezone, week)
      totalTrainingHC += getTrainingHCForWeek(queue, type, timezone, week)

      // Only calculate HC if AHT data exists
      if (aht !== null) {
        const requiredHC = calculateRequiredHC(volume, aht, npt, shrinkage, occupancy)
        totalRequiredHCNoBuffer += requiredHC
        weeksWithAHT++
      }
    })

    // Average required HC across weeks with valid AHT data
    const avgRequiredHCNoBuffer = weeksWithAHT > 0 ? totalRequiredHCNoBuffer / weeksWithAHT : null
    const queueBuffer = getQueueBuffer(queue)
    const avgRequiredHCWithBuffer = avgRequiredHCNoBuffer !== null ? avgRequiredHCNoBuffer * (1 + queueBuffer / 100) : null

    return {
      totalVolume,
      totalRequiredHCNoBuffer: avgRequiredHCNoBuffer,
      totalRequiredHCWithBuffer: avgRequiredHCWithBuffer,
      totalBatchHC,
      totalTrainingHC,
      hasAHTData: weeksWithAHT > 0
    }
  }

  // Get actual HC for a queue-timezone-site
  const getActualHC = (queue, timezone, site, type) => {
    const key = `${queue}-${timezone}-${site}`
    return getCurrentHC(key, type)
  }

  // Calculate aggregated actual HC for a queue-timezone across all sites
  const getAggregatedActualHC = (queue, timezone, type) => {
    const qtzData = queueTimezoneSites[`${queue}-${timezone}`]
    if (!qtzData) return 0

    return Object.values(qtzData.sites).reduce((sum, siteHC) => {
      return sum + (siteHC[type] || 0)
    }, 0)
  }

  // Calculate site-level required HC (sum across all queues/timezones served by that site)
  const getSiteRequiredHC = (site) => {
    let internalRequired = 0
    let externalRequired = 0
    let hasInternalAHT = false
    let hasExternalAHT = false

    Object.entries(queueTimezoneSites).forEach(([qtzKey, qtzData]) => {
      const { queue, timezone, sites } = qtzData

      if (sites[site]) {
        const internalMetrics = calculateQueueTimezoneMetrics(queue, timezone, 'internal')
        const externalMetrics = calculateQueueTimezoneMetrics(queue, timezone, 'external')

        if (internalMetrics && internalMetrics.totalRequiredHCWithBuffer !== null) {
          // Proportionally allocate required HC based on site's share of actual HC
          const totalInternalActual = Object.values(sites).reduce((sum, s) => sum + (s.internal || 0), 0)
          const siteShare = totalInternalActual > 0 ? (sites[site].internal || 0) / totalInternalActual : 0
          internalRequired += internalMetrics.totalRequiredHCWithBuffer * siteShare
          hasInternalAHT = true
        }

        if (externalMetrics && externalMetrics.totalRequiredHCWithBuffer !== null) {
          const totalExternalActual = Object.values(sites).reduce((sum, s) => sum + (s.external || 0), 0)
          const siteShare = totalExternalActual > 0 ? (sites[site].external || 0) / totalExternalActual : 0
          externalRequired += externalMetrics.totalRequiredHCWithBuffer * siteShare
          hasExternalAHT = true
        }
      }
    })

    return {
      internal: hasInternalAHT ? internalRequired : null,
      external: hasExternalAHT ? externalRequired : null
    }
  }

  // Calculate totals across all sites
  const totalSummary = useMemo(() => {
    let totalInternalActual = 0
    let totalExternalActual = 0
    let totalInternalRequired = 0
    let totalExternalRequired = 0
    let hasInternalAHT = false
    let hasExternalAHT = false

    sites.forEach(site => {
      const siteHC = siteWiseHC[site] || { internal: 0, external: 0 }
      const siteRequired = getSiteRequiredHC(site)

      totalInternalActual += siteHC.internal
      totalExternalActual += siteHC.external
      if (siteRequired.internal !== null) {
        totalInternalRequired += siteRequired.internal
        hasInternalAHT = true
      }
      if (siteRequired.external !== null) {
        totalExternalRequired += siteRequired.external
        hasExternalAHT = true
      }
    })

    const internalReq = hasInternalAHT ? totalInternalRequired : null
    const externalReq = hasExternalAHT ? totalExternalRequired : null
    const totalReq = (internalReq !== null || externalReq !== null)
      ? (internalReq || 0) + (externalReq || 0)
      : null

    return {
      totalInternalActual,
      totalExternalActual,
      totalInternalRequired: internalReq,
      totalExternalRequired: externalReq,
      totalActual: totalInternalActual + totalExternalActual,
      totalRequired: totalReq,
      internalGap: internalReq !== null ? totalInternalActual - internalReq : null,
      externalGap: externalReq !== null ? totalExternalActual - externalReq : null,
      totalGap: totalReq !== null ? (totalInternalActual + totalExternalActual) - totalReq : null
    }
  }, [sites, siteWiseHC, getSiteRequiredHC])

  if (!forecastData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <h1 className="text-2xl font-bold text-slate-800">Executive View</h1>
        <div className="mt-8 text-center py-12">
          <p className="text-slate-500">Please upload forecast data first to view executive summary.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Executive View</h1>
        <p className="text-slate-500 mt-1">Site-wise and queue-wise HC breakdown by timezone</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total HC (Actual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalSummary.totalActual)}</div>
            <div className="text-xs text-slate-500 mt-1">
              Internal: {formatNumber(totalSummary.totalInternalActual)} | External: {formatNumber(totalSummary.totalExternalActual)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total HC (Required)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn("text-2xl font-bold", totalSummary.totalRequired === null && "text-amber-600")}>
              {totalSummary.totalRequired !== null ? formatNumber(totalSummary.totalRequired, 1) : '-'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Internal: {totalSummary.totalInternalRequired !== null ? formatNumber(totalSummary.totalInternalRequired, 1) : '-'} |
              External: {totalSummary.totalExternalRequired !== null ? formatNumber(totalSummary.totalExternalRequired, 1) : '-'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Total Sites
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sites.length}</div>
            <div className="text-xs text-slate-500 mt-1">
              Active locations
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Overall Gap
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              totalSummary.totalGap === null ? "text-amber-600" :
              totalSummary.totalGap >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {totalSummary.totalGap !== null
                ? `${totalSummary.totalGap >= 0 ? '+' : ''}${formatNumber(totalSummary.totalGap, 1)}`
                : '-'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Internal: {totalSummary.internalGap !== null ? `${totalSummary.internalGap >= 0 ? '+' : ''}${formatNumber(totalSummary.internalGap, 1)}` : '-'} |
              External: {totalSummary.externalGap !== null ? `${totalSummary.externalGap >= 0 ? '+' : ''}${formatNumber(totalSummary.externalGap, 1)}` : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site-wise Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Site-wise Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead className="text-right">Internal Actual</TableHead>
                  <TableHead className="text-right">Internal Required</TableHead>
                  <TableHead className="text-right">Internal Gap</TableHead>
                  <TableHead className="text-right">External Actual</TableHead>
                  <TableHead className="text-right">External Required</TableHead>
                  <TableHead className="text-right">External Gap</TableHead>
                  <TableHead className="text-right">Total Actual</TableHead>
                  <TableHead className="text-right">Total Required</TableHead>
                  <TableHead className="text-right">Total Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map(site => {
                  const siteHC = siteWiseHC[site] || { internal: 0, external: 0 }
                  const siteRequired = getSiteRequiredHC(site)
                  const internalGap = siteRequired.internal !== null ? siteHC.internal - siteRequired.internal : null
                  const externalGap = siteRequired.external !== null ? siteHC.external - siteRequired.external : null
                  const totalReq = (siteRequired.internal !== null || siteRequired.external !== null)
                    ? (siteRequired.internal || 0) + (siteRequired.external || 0)
                    : null
                  const totalGap = totalReq !== null ? (siteHC.internal + siteHC.external) - totalReq : null
                  const isExpanded = expandedSites.has(site)

                  return (
                    <Fragment key={site}>
                      <TableRow className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleSite(site)}>
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{site}</TableCell>
                        <TableCell className="text-right">{formatNumber(siteHC.internal)}</TableCell>
                        <TableCell className={cn("text-right", siteRequired.internal === null && "text-amber-600")}>
                          {siteRequired.internal !== null ? formatNumber(siteRequired.internal, 1) : '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          internalGap === null ? "text-amber-600" : internalGap >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {internalGap !== null ? `${internalGap >= 0 ? '+' : ''}${formatNumber(internalGap, 1)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(siteHC.external)}</TableCell>
                        <TableCell className={cn("text-right", siteRequired.external === null && "text-amber-600")}>
                          {siteRequired.external !== null ? formatNumber(siteRequired.external, 1) : '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          externalGap === null ? "text-amber-600" : externalGap >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {externalGap !== null ? `${externalGap >= 0 ? '+' : ''}${formatNumber(externalGap, 1)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(siteHC.internal + siteHC.external)}</TableCell>
                        <TableCell className={cn("text-right", totalReq === null && "text-amber-600")}>
                          {totalReq !== null ? formatNumber(totalReq, 1) : '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-bold",
                          totalGap === null ? "text-amber-600" : totalGap >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {totalGap !== null ? `${totalGap >= 0 ? '+' : ''}${formatNumber(totalGap, 1)}` : '-'}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Queue-Timezone Details for this Site */}
                      {isExpanded && Object.entries(queueTimezoneSites)
                        .filter(([, qtzData]) => qtzData.sites[site])
                        .map(([qtzKey, qtzData]) => {
                          const { queue, timezone, sites: qtzSites } = qtzData
                          const siteData = qtzSites[site]
                          const internalMetrics = calculateQueueTimezoneMetrics(queue, timezone, 'internal')
                          const externalMetrics = calculateQueueTimezoneMetrics(queue, timezone, 'external')

                          // Calculate site's share of required HC
                          const totalInternalActual = Object.values(qtzSites).reduce((sum, s) => sum + (s.internal || 0), 0)
                          const totalExternalActual = Object.values(qtzSites).reduce((sum, s) => sum + (s.external || 0), 0)

                          const internalShare = totalInternalActual > 0 ? (siteData.internal || 0) / totalInternalActual : 0
                          const externalShare = totalExternalActual > 0 ? (siteData.external || 0) / totalExternalActual : 0

                          const internalReq = (internalMetrics && internalMetrics.totalRequiredHCWithBuffer !== null)
                            ? internalMetrics.totalRequiredHCWithBuffer * internalShare
                            : null
                          const externalReq = (externalMetrics && externalMetrics.totalRequiredHCWithBuffer !== null)
                            ? externalMetrics.totalRequiredHCWithBuffer * externalShare
                            : null

                          const intGap = internalReq !== null ? (siteData.internal || 0) - internalReq : null
                          const extGap = externalReq !== null ? (siteData.external || 0) - externalReq : null
                          const totReq = (internalReq !== null || externalReq !== null)
                            ? (internalReq || 0) + (externalReq || 0)
                            : null
                          const totGap = totReq !== null
                            ? ((siteData.internal || 0) + (siteData.external || 0)) - totReq
                            : null

                          return (
                            <TableRow key={`${site}-${qtzKey}`} className="bg-slate-50">
                              <TableCell></TableCell>
                              <TableCell className="pl-8 text-sm text-slate-600">
                                {queue} - {timezone}
                              </TableCell>
                              <TableCell className="text-right text-sm">{formatNumber(siteData.internal || 0)}</TableCell>
                              <TableCell className={cn("text-right text-sm", internalReq === null && "text-amber-600")}>
                                {internalReq !== null ? formatNumber(internalReq, 1) : '-'}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right text-sm",
                                intGap === null ? "text-amber-600" : intGap >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {intGap !== null ? `${intGap >= 0 ? '+' : ''}${formatNumber(intGap, 1)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right text-sm">{formatNumber(siteData.external || 0)}</TableCell>
                              <TableCell className={cn("text-right text-sm", externalReq === null && "text-amber-600")}>
                                {externalReq !== null ? formatNumber(externalReq, 1) : '-'}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right text-sm",
                                extGap === null ? "text-amber-600" : extGap >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {extGap !== null ? `${extGap >= 0 ? '+' : ''}${formatNumber(extGap, 1)}` : '-'}
                              </TableCell>
                              <TableCell className="text-right text-sm">{formatNumber((siteData.internal || 0) + (siteData.external || 0))}</TableCell>
                              <TableCell className={cn("text-right text-sm", totReq === null && "text-amber-600")}>
                                {totReq !== null ? formatNumber(totReq, 1) : '-'}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right text-sm font-medium",
                                totGap === null ? "text-amber-600" : totGap >= 0 ? "text-green-600" : "text-red-600"
                              )}>
                                {totGap !== null ? `${totGap >= 0 ? '+' : ''}${formatNumber(totGap, 1)}` : '-'}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Queue-Timezone Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Queue-Timezone Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Queue - Timezone</TableHead>
                  <TableHead className="text-right">Internal Actual</TableHead>
                  <TableHead className="text-right">Internal Required</TableHead>
                  <TableHead className="text-right">Internal Gap</TableHead>
                  <TableHead className="text-right">External Actual</TableHead>
                  <TableHead className="text-right">External Required</TableHead>
                  <TableHead className="text-right">External Gap</TableHead>
                  <TableHead className="text-right">Total Actual</TableHead>
                  <TableHead className="text-right">Total Required</TableHead>
                  <TableHead className="text-right">Total Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(queueTimezoneSites).map(([qtzKey, qtzData]) => {
                  const { queue, timezone, sites: qtzSites } = qtzData
                  const internalMetrics = calculateQueueTimezoneMetrics(queue, timezone, 'internal')
                  const externalMetrics = calculateQueueTimezoneMetrics(queue, timezone, 'external')

                  const internalActual = Object.values(qtzSites).reduce((sum, s) => sum + (s.internal || 0), 0)
                  const externalActual = Object.values(qtzSites).reduce((sum, s) => sum + (s.external || 0), 0)

                  const internalReq = (internalMetrics && internalMetrics.totalRequiredHCWithBuffer !== null)
                    ? internalMetrics.totalRequiredHCWithBuffer
                    : null
                  const externalReq = (externalMetrics && externalMetrics.totalRequiredHCWithBuffer !== null)
                    ? externalMetrics.totalRequiredHCWithBuffer
                    : null

                  const intGap = internalReq !== null ? internalActual - internalReq : null
                  const extGap = externalReq !== null ? externalActual - externalReq : null
                  const totReq = (internalReq !== null || externalReq !== null)
                    ? (internalReq || 0) + (externalReq || 0)
                    : null
                  const totGap = totReq !== null ? (internalActual + externalActual) - totReq : null

                  const isExpanded = expandedQueues.has(qtzKey)

                  return (
                    <Fragment key={qtzKey}>
                      <TableRow className="hover:bg-slate-50 cursor-pointer" onClick={() => toggleQueue(qtzKey)}>
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{queue} - {timezone}</TableCell>
                        <TableCell className="text-right">{formatNumber(internalActual)}</TableCell>
                        <TableCell className={cn("text-right", internalReq === null && "text-amber-600")}>
                          {internalReq !== null ? formatNumber(internalReq, 1) : '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          intGap === null ? "text-amber-600" : intGap >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {intGap !== null ? `${intGap >= 0 ? '+' : ''}${formatNumber(intGap, 1)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(externalActual)}</TableCell>
                        <TableCell className={cn("text-right", externalReq === null && "text-amber-600")}>
                          {externalReq !== null ? formatNumber(externalReq, 1) : '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          extGap === null ? "text-amber-600" : extGap >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {extGap !== null ? `${extGap >= 0 ? '+' : ''}${formatNumber(extGap, 1)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatNumber(internalActual + externalActual)}</TableCell>
                        <TableCell className={cn("text-right", totReq === null && "text-amber-600")}>
                          {totReq !== null ? formatNumber(totReq, 1) : '-'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-bold",
                          totGap === null ? "text-amber-600" : totGap >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {totGap !== null ? `${totGap >= 0 ? '+' : ''}${formatNumber(totGap, 1)}` : '-'}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Site Details for this Queue-Timezone */}
                      {isExpanded && Object.entries(qtzSites).map(([siteName, siteData]) => {
                        const totalInternalActual = Object.values(qtzSites).reduce((sum, s) => sum + (s.internal || 0), 0)
                        const totalExternalActual = Object.values(qtzSites).reduce((sum, s) => sum + (s.external || 0), 0)

                        const internalShare = totalInternalActual > 0 ? (siteData.internal || 0) / totalInternalActual : 0
                        const externalShare = totalExternalActual > 0 ? (siteData.external || 0) / totalExternalActual : 0

                        const intReq = (internalMetrics && internalMetrics.totalRequiredHCWithBuffer !== null)
                          ? internalMetrics.totalRequiredHCWithBuffer * internalShare
                          : null
                        const extReq = (externalMetrics && externalMetrics.totalRequiredHCWithBuffer !== null)
                          ? externalMetrics.totalRequiredHCWithBuffer * externalShare
                          : null

                        const intGapSite = intReq !== null ? (siteData.internal || 0) - intReq : null
                        const extGapSite = extReq !== null ? (siteData.external || 0) - extReq : null
                        const totReqSite = (intReq !== null || extReq !== null)
                          ? (intReq || 0) + (extReq || 0)
                          : null
                        const totGapSite = totReqSite !== null
                          ? ((siteData.internal || 0) + (siteData.external || 0)) - totReqSite
                          : null

                        return (
                          <TableRow key={`${qtzKey}-${siteName}`} className="bg-slate-50">
                            <TableCell></TableCell>
                            <TableCell className="pl-8 text-sm text-slate-600">{siteName}</TableCell>
                            <TableCell className="text-right text-sm">{formatNumber(siteData.internal || 0)}</TableCell>
                            <TableCell className={cn("text-right text-sm", intReq === null && "text-amber-600")}>
                              {intReq !== null ? formatNumber(intReq, 1) : '-'}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right text-sm",
                              intGapSite === null ? "text-amber-600" : intGapSite >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {intGapSite !== null ? `${intGapSite >= 0 ? '+' : ''}${formatNumber(intGapSite, 1)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right text-sm">{formatNumber(siteData.external || 0)}</TableCell>
                            <TableCell className={cn("text-right text-sm", extReq === null && "text-amber-600")}>
                              {extReq !== null ? formatNumber(extReq, 1) : '-'}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right text-sm",
                              extGapSite === null ? "text-amber-600" : extGapSite >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {extGapSite !== null ? `${extGapSite >= 0 ? '+' : ''}${formatNumber(extGapSite, 1)}` : '-'}
                            </TableCell>
                            <TableCell className="text-right text-sm">{formatNumber((siteData.internal || 0) + (siteData.external || 0))}</TableCell>
                            <TableCell className={cn("text-right text-sm", totReqSite === null && "text-amber-600")}>
                              {totReqSite !== null ? formatNumber(totReqSite, 1) : '-'}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right text-sm font-medium",
                              totGapSite === null ? "text-amber-600" : totGapSite >= 0 ? "text-green-600" : "text-red-600"
                            )}>
                              {totGapSite !== null ? `${totGapSite >= 0 ? '+' : ''}${formatNumber(totGapSite, 1)}` : '-'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
