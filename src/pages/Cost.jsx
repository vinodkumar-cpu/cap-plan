import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { DollarSign, Building2, Package, TrendingUp } from 'lucide-react'

export default function Cost() {
  const {
    forecastData,
    weeks,
    queues,
    planningGranularity,
    locationCosts,
    setLocationCosts,
    getSites,
    getQueueTimezoneSites,
    getCurrentHC,
    calculateRequiredHC,
    getAHT,
    getQueueAssumption,
    getQueueSplit,
    getQueueBuffer,
    getBatchHCForWeek,
    getAttrition
  } = useApp()

  const [editMode, setEditMode] = useState(false)
  const sites = useMemo(() => getSites(), [getSites])

  // Handle cost input change
  const handleCostChange = (site, type, value) => {
    setLocationCosts(prev => ({
      ...prev,
      [site]: {
        ...prev[site],
        [type]: parseFloat(value) || 0
      }
    }))
  }

  // Calculate weekly cost from annual cost
  const getWeeklyCost = (annualCost) => {
    if (!weeks || weeks.length === 0) return 0
    return annualCost / weeks.length
  }

  // Calculate required HC with buffer for a queue-timezone-week
  const calculateRequiredHCWithBuffer = (queue, timezone, week) => {
    if (!forecastData) return { internal: 0, external: 0 }

    // Get volume for this queue-timezone-week
    const volumeRow = forecastData.find(d => d.queue === queue && d.timezone === timezone)
    const volume = volumeRow?.volumes?.[week] || 0

    // Get split
    const split = getQueueSplit(queue)

    // Get buffer
    const buffer = getQueueBuffer(queue)

    // Calculate for internal
    const internalVolume = volume * (split.internal / 100)
    const internalAHT = getAHT(queue, 'internal', week)
    const internalNPT = getQueueAssumption(queue, 'internal', 'npt', week)
    const internalShrinkage = getQueueAssumption(queue, 'internal', 'shrinkage', week)
    const internalOccupancy = getQueueAssumption(queue, 'internal', 'occupancy', week)

    let requiredInternal = 0
    if (internalAHT !== null) {
      requiredInternal = calculateRequiredHC(internalVolume, internalAHT, internalNPT, internalShrinkage, internalOccupancy)
      requiredInternal = requiredInternal * (1 + buffer / 100)
    }

    // Calculate for external
    const externalVolume = volume * (split.external / 100)
    const externalAHT = getAHT(queue, 'external', week)
    const externalNPT = getQueueAssumption(queue, 'external', 'npt', week)
    const externalShrinkage = getQueueAssumption(queue, 'external', 'shrinkage', week)
    const externalOccupancy = getQueueAssumption(queue, 'external', 'occupancy', week)

    let requiredExternal = 0
    if (externalAHT !== null) {
      requiredExternal = calculateRequiredHC(externalVolume, externalAHT, externalNPT, externalShrinkage, externalOccupancy)
      requiredExternal = requiredExternal * (1 + buffer / 100)
    }

    return { internal: requiredInternal, external: requiredExternal }
  }

  // Calculate total cost by location (site)
  const costByLocation = useMemo(() => {
    if (!forecastData || !weeks || weeks.length === 0) return []

    const qtzData = getQueueTimezoneSites()
    const locationData = {}

    // For each site, calculate total required HC and cost
    sites.forEach(site => {
      const siteCost = locationCosts[site] || { internal: 0, external: 0 }
      const weeklyInternalCost = getWeeklyCost(siteCost.internal)
      const weeklyExternalCost = getWeeklyCost(siteCost.external)

      let totalRequiredInternal = 0
      let totalRequiredExternal = 0
      let totalCurrentInternal = 0
      let totalCurrentExternal = 0
      let totalCostRequired = 0
      let totalCostActual = 0

      // Aggregate required HC across all queue-timezone pairs for this site
      Object.entries(qtzData).forEach(([qtzKey, qtzInfo]) => {
        const { queue, timezone, sites: qtzSites } = qtzInfo

        // Check if this site exists for this queue-timezone
        if (qtzSites[site]) {
          const currentInternal = qtzSites[site].internal
          const currentExternal = qtzSites[site].external

          totalCurrentInternal += currentInternal
          totalCurrentExternal += currentExternal

          // Calculate required HC for all weeks and average
          let weeklyRequiredInternal = 0
          let weeklyRequiredExternal = 0

          weeks.forEach(week => {
            const required = calculateRequiredHCWithBuffer(queue, timezone, week)
            weeklyRequiredInternal += required.internal
            weeklyRequiredExternal += required.external
          })

          // Average over weeks and add to total
          totalRequiredInternal += weeklyRequiredInternal / weeks.length
          totalRequiredExternal += weeklyRequiredExternal / weeks.length
        }
      })

      // Calculate costs
      totalCostRequired = (totalRequiredInternal * weeklyInternalCost + totalRequiredExternal * weeklyExternalCost) * weeks.length
      totalCostActual = (totalCurrentInternal * weeklyInternalCost + totalCurrentExternal * weeklyExternalCost) * weeks.length

      locationData[site] = {
        site,
        requiredInternal: totalRequiredInternal,
        requiredExternal: totalRequiredExternal,
        currentInternal: totalCurrentInternal,
        currentExternal: totalCurrentExternal,
        costRequired: totalCostRequired,
        costActual: totalCostActual,
        costDiff: totalCostRequired - totalCostActual
      }
    })

    return Object.values(locationData)
  }, [forecastData, weeks, sites, locationCosts, getQueueTimezoneSites, getWeeklyCost, calculateRequiredHCWithBuffer])

  // Calculate total cost by queue
  const costByQueue = useMemo(() => {
    if (!forecastData || !weeks || weeks.length === 0) return []

    const qtzData = getQueueTimezoneSites()
    const queueData = {}

    Object.entries(qtzData).forEach(([qtzKey, qtzInfo]) => {
      const { queue, timezone, sites: qtzSites } = qtzInfo

      if (!queueData[queue]) {
        queueData[queue] = {
          queue,
          requiredInternal: 0,
          requiredExternal: 0,
          currentInternal: 0,
          currentExternal: 0,
          costRequired: 0,
          costActual: 0
        }
      }

      // Sum current HC across all sites for this queue-timezone
      Object.entries(qtzSites).forEach(([site, hc]) => {
        queueData[queue].currentInternal += hc.internal
        queueData[queue].currentExternal += hc.external

        const siteCost = locationCosts[site] || { internal: 0, external: 0 }
        const weeklyInternalCost = getWeeklyCost(siteCost.internal)
        const weeklyExternalCost = getWeeklyCost(siteCost.external)

        // Add to actual cost
        queueData[queue].costActual += (hc.internal * weeklyInternalCost + hc.external * weeklyExternalCost) * weeks.length
      })

      // Calculate required HC and cost for all weeks
      weeks.forEach(week => {
        const required = calculateRequiredHCWithBuffer(queue, timezone, week)

        // Distribute required HC across sites proportionally (for cost calculation)
        Object.entries(qtzSites).forEach(([site, hc]) => {
          const totalCurrentForType = {
            internal: queueData[queue].currentInternal,
            external: queueData[queue].currentExternal
          }

          const siteCost = locationCosts[site] || { internal: 0, external: 0 }
          const weeklyInternalCost = getWeeklyCost(siteCost.internal)
          const weeklyExternalCost = getWeeklyCost(siteCost.external)

          // Proportional allocation based on current HC distribution
          const internalProportion = totalCurrentForType.internal > 0 ? hc.internal / totalCurrentForType.internal : 1 / Object.keys(qtzSites).length
          const externalProportion = totalCurrentForType.external > 0 ? hc.external / totalCurrentForType.external : 1 / Object.keys(qtzSites).length

          const siteRequiredInternal = required.internal * internalProportion
          const siteRequiredExternal = required.external * externalProportion

          queueData[queue].costRequired += siteRequiredInternal * weeklyInternalCost + siteRequiredExternal * weeklyExternalCost
        })
      })

      // Average required HC over weeks for display
      weeks.forEach(week => {
        const required = calculateRequiredHCWithBuffer(queue, timezone, week)
        queueData[queue].requiredInternal += required.internal / weeks.length
        queueData[queue].requiredExternal += required.external / weeks.length
      })
    })

    return Object.values(queueData).map(q => ({
      ...q,
      costDiff: q.costRequired - q.costActual
    }))
  }, [forecastData, weeks, queues, locationCosts, getQueueTimezoneSites, getWeeklyCost, calculateRequiredHCWithBuffer])

  // Overall summary
  const summary = useMemo(() => {
    const totalCostRequired = costByLocation.reduce((sum, loc) => sum + loc.costRequired, 0)
    const totalCostActual = costByLocation.reduce((sum, loc) => sum + loc.costActual, 0)

    return {
      totalCostRequired,
      totalCostActual,
      costDiff: totalCostRequired - totalCostActual,
      totalRequiredHC: costByLocation.reduce((sum, loc) => sum + loc.requiredInternal + loc.requiredExternal, 0),
      totalCurrentHC: costByLocation.reduce((sum, loc) => sum + loc.currentInternal + loc.currentExternal, 0)
    }
  }, [costByLocation])

  if (!forecastData) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-slate-500">Please upload forecast data first to use Cost Analysis.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Cost Analysis</h1>
          <p className="text-slate-600 mt-1">Location-based cost analysis for required vs actual HC</p>
        </div>
        <Button onClick={() => setEditMode(!editMode)} variant={editMode ? 'default' : 'outline'}>
          {editMode ? 'Done Editing' : 'Edit Costs'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Required Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${summary.totalCostRequired.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              For {summary.totalRequiredHC.toFixed(1)} HC
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${summary.totalCostActual.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              For {summary.totalCurrentHC} HC
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Difference</CardTitle>
            <TrendingUp className={`h-4 w-4 ${summary.costDiff > 0 ? 'text-red-600' : 'text-green-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.costDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {summary.costDiff > 0 ? '+' : ''}${summary.costDiff.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {((summary.costDiff / summary.totalCostActual) * 100).toFixed(1)}% vs current
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <Building2 className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">
              {sites.length}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Active sites
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Location Cost Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Location Cost Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-600 mb-4">
            Configure annual cost per HC for each location. Weekly costs are calculated as: Annual Cost ÷ {weeks.length} weeks
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Internal (Annual)</TableHead>
                <TableHead>External (Annual)</TableHead>
                <TableHead>Internal (Weekly)</TableHead>
                <TableHead>External (Weekly)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map(site => {
                const costs = locationCosts[site] || { internal: 0, external: 0 }
                return (
                  <TableRow key={site}>
                    <TableCell className="font-medium">{site}</TableCell>
                    <TableCell>
                      {editMode ? (
                        <Input
                          type="number"
                          value={costs.internal || ''}
                          onChange={(e) => handleCostChange(site, 'internal', e.target.value)}
                          placeholder="0"
                          className="w-32"
                        />
                      ) : (
                        <span>${costs.internal.toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editMode ? (
                        <Input
                          type="number"
                          value={costs.external || ''}
                          onChange={(e) => handleCostChange(site, 'external', e.target.value)}
                          placeholder="0"
                          className="w-32"
                        />
                      ) : (
                        <span>${costs.external.toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      ${getWeeklyCost(costs.internal).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      ${getWeeklyCost(costs.external).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cost by Location */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Cost by Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location</TableHead>
                <TableHead>Required HC (Int)</TableHead>
                <TableHead>Required HC (Ext)</TableHead>
                <TableHead>Current HC (Int)</TableHead>
                <TableHead>Current HC (Ext)</TableHead>
                <TableHead>Required Cost</TableHead>
                <TableHead>Current Cost</TableHead>
                <TableHead>Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costByLocation.map(loc => (
                <TableRow key={loc.site}>
                  <TableCell className="font-medium">{loc.site}</TableCell>
                  <TableCell>{loc.requiredInternal.toFixed(1)}</TableCell>
                  <TableCell>{loc.requiredExternal.toFixed(1)}</TableCell>
                  <TableCell>{loc.currentInternal}</TableCell>
                  <TableCell>{loc.currentExternal}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    ${loc.costRequired.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-blue-600 font-medium">
                    ${loc.costActual.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className={loc.costDiff > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                    {loc.costDiff > 0 ? '+' : ''}${loc.costDiff.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell>{costByLocation.reduce((sum, loc) => sum + loc.requiredInternal, 0).toFixed(1)}</TableCell>
                <TableCell>{costByLocation.reduce((sum, loc) => sum + loc.requiredExternal, 0).toFixed(1)}</TableCell>
                <TableCell>{costByLocation.reduce((sum, loc) => sum + loc.currentInternal, 0)}</TableCell>
                <TableCell>{costByLocation.reduce((sum, loc) => sum + loc.currentExternal, 0)}</TableCell>
                <TableCell className="text-green-600">
                  ${summary.totalCostRequired.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="text-blue-600">
                  ${summary.totalCostActual.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className={summary.costDiff > 0 ? 'text-red-600' : 'text-green-600'}>
                  {summary.costDiff > 0 ? '+' : ''}${summary.costDiff.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cost by Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Cost by Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue</TableHead>
                <TableHead>Required HC (Int)</TableHead>
                <TableHead>Required HC (Ext)</TableHead>
                <TableHead>Current HC (Int)</TableHead>
                <TableHead>Current HC (Ext)</TableHead>
                <TableHead>Required Cost</TableHead>
                <TableHead>Current Cost</TableHead>
                <TableHead>Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costByQueue.map(q => (
                <TableRow key={q.queue}>
                  <TableCell className="font-medium">{q.queue}</TableCell>
                  <TableCell>{q.requiredInternal.toFixed(1)}</TableCell>
                  <TableCell>{q.requiredExternal.toFixed(1)}</TableCell>
                  <TableCell>{q.currentInternal}</TableCell>
                  <TableCell>{q.currentExternal}</TableCell>
                  <TableCell className="text-green-600 font-medium">
                    ${q.costRequired.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className="text-blue-600 font-medium">
                    ${q.costActual.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </TableCell>
                  <TableCell className={q.costDiff > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                    {q.costDiff > 0 ? '+' : ''}${q.costDiff.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-50 font-bold">
                <TableCell>Total</TableCell>
                <TableCell>{costByQueue.reduce((sum, q) => sum + q.requiredInternal, 0).toFixed(1)}</TableCell>
                <TableCell>{costByQueue.reduce((sum, q) => sum + q.requiredExternal, 0).toFixed(1)}</TableCell>
                <TableCell>{costByQueue.reduce((sum, q) => sum + q.currentInternal, 0)}</TableCell>
                <TableCell>{costByQueue.reduce((sum, q) => sum + q.currentExternal, 0)}</TableCell>
                <TableCell className="text-green-600">
                  ${costByQueue.reduce((sum, q) => sum + q.costRequired, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className="text-blue-600">
                  ${costByQueue.reduce((sum, q) => sum + q.costActual, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </TableCell>
                <TableCell className={costByQueue.reduce((sum, q) => sum + q.costDiff, 0) > 0 ? 'text-red-600' : 'text-green-600'}>
                  {costByQueue.reduce((sum, q) => sum + q.costDiff, 0) > 0 ? '+' : ''}${costByQueue.reduce((sum, q) => sum + q.costDiff, 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
