import { useMemo, Fragment } from 'react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileCheck, Download, FileSpreadsheet, Globe, Building2, Users, TrendingUp, AlertCircle, RotateCcw } from 'lucide-react'
import { formatNumber, groupWeeksByMonth, getShortMonth } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function DemandPlan() {
  const {
    forecastData,
    queues,
    weeks,
    getQueueSplit,
    baseAssumptions,
    getQueueBuffer,
    getAHT,
    calculateRequiredHC,
    currentHC,
    getCurrentHC,
    demandPlan,
    batches,
    simulations,
    activeSimulationId,
    getBatchHCForWeek,
    getTrainingHCForWeek,
    queueAssumptions,
    getQueueAssumption,
    resetSimulation
  } = useApp()

  // Group weeks by month for monthly view
  const monthlyGroups = useMemo(() => groupWeeksByMonth(weeks), [weeks])

  // Helper to check if a specific queue/type should use simulation assumptions
  const shouldUseSimulation = (queue, type) => {
    if (!activeSimulationId) return false
    const activeSim = simulations.find(s => s.id === activeSimulationId)
    if (!activeSim) return false
    // Only apply simulation if it matches EXACTLY this queue and type
    return activeSim.queue === queue && activeSim.type === type
  }

  // Calculate overall and queue-wise demand
  const demandData = useMemo(() => {
    if (!forecastData) return null

    const overall = {
      internal: { volume: 0, requiredHC: 0, actualHC: 0, batchHC: 0, trainingHC: 0, gap: 0 },
      external: { volume: 0, requiredHC: 0, actualHC: 0, batchHC: 0, trainingHC: 0, gap: 0 }
    }

    const byQueue = {}
    const byQueueByMonth = {}

    queues.forEach(queue => {
      byQueue[queue] = {
        internal: { volume: 0, requiredHC: 0, actualHC: 0, batchHC: 0, trainingHC: 0, gap: 0 },
        external: { volume: 0, requiredHC: 0, actualHC: 0, batchHC: 0, trainingHC: 0, gap: 0 }
      }

      byQueueByMonth[queue] = {}

      // Calculate monthly data for each queue
      monthlyGroups.forEach(monthGroup => {
        byQueueByMonth[queue][monthGroup.month] = {
          internal: { volume: 0, requiredHC: 0, requiredHCWithoutBuffer: 0, actualHC: 0, productionHC: 0, trainingHC: 0, gap: 0, gapPct: 0, assumptions: {}, isSimulated: false },
          external: { volume: 0, requiredHC: 0, requiredHCWithoutBuffer: 0, actualHC: 0, productionHC: 0, trainingHC: 0, gap: 0, gapPct: 0, assumptions: {}, isSimulated: false }
        }

        // Get all rows for this queue (all timezones)
        const queueRows = forecastData.filter(r => r.queue === queue)
        if (queueRows.length === 0) return

        ;['internal', 'external'].forEach(type => {
          const queueSplit = getQueueSplit(queue)
          const splitPct = type === 'external' ? queueSplit.external / 100 : queueSplit.internal / 100

          let monthTotalVolume = 0
          let monthTotalRequiredHC = 0
          let monthTotalRequiredHCWithoutBuffer = 0
          let monthTotalActualHC = 0
          let monthTotalTrainingHC = 0
          let hasQueueAssumptions = false

          // Check if using queue-level assumptions (only for this specific queue/type if simulation is active)
          if (shouldUseSimulation(queue, type)) {
            hasQueueAssumptions = true
          } else if (queueAssumptions[queue]?.[type] && !activeSimulationId) {
            // Only use queue assumptions if no simulation is active
            hasQueueAssumptions = true
          }

          // Calculate assumption averages across weeks (not multiplied by timezone rows)
          let totalNPT = 0
          let totalShrinkage = 0
          let totalOccupancy = 0
          let totalAHT = 0

          let weeksWithAHT = 0
          monthGroup.weeks.forEach(week => {
            // Get queue-specific assumptions only if this queue/type matches the active simulation
            let npt, shrinkage, occupancy, aht

            if (shouldUseSimulation(queue, type)) {
              // Use simulation assumptions
              npt = getQueueAssumption(queue, type, 'npt', week)
              shrinkage = getQueueAssumption(queue, type, 'shrinkage', week)
              occupancy = getQueueAssumption(queue, type, 'occupancy', week)
              aht = getAHT(queue, type, week)
            } else {
              // Use weekly global assumptions (falls back to base if not set)
              npt = getQueueAssumption(queue, type, 'npt', week)
              shrinkage = getQueueAssumption(queue, type, 'shrinkage', week)
              occupancy = baseAssumptions[type].occupancy
              aht = getAHT(queue, type, week) // Use uploaded AHT, may be null
            }

            totalNPT += npt
            totalShrinkage += shrinkage
            totalOccupancy += occupancy
            if (aht !== null) {
              totalAHT += aht
              weeksWithAHT++
            }
          })

          const weeksCount = monthGroup.weeks.length

          let monthWeeksWithAHT = 0
          // Aggregate volume and HC across all timezones for this queue and month
          queueRows.forEach(row => {
            monthGroup.weeks.forEach(week => {
              const volume = (row.volumes[week] || 0) * splitPct

              // Get queue-specific assumptions only if this queue/type matches the active simulation
              let npt, shrinkage, occupancy, aht

              if (shouldUseSimulation(queue, type)) {
                // Use simulation assumptions
                npt = getQueueAssumption(queue, type, 'npt', week)
                shrinkage = getQueueAssumption(queue, type, 'shrinkage', week)
                occupancy = getQueueAssumption(queue, type, 'occupancy', week)
                aht = getAHT(queue, type, week)
              } else {
                // Use weekly global assumptions (falls back to base if not set)
                npt = getQueueAssumption(queue, type, 'npt', week)
                shrinkage = getQueueAssumption(queue, type, 'shrinkage', week)
                occupancy = baseAssumptions[type].occupancy
                aht = getAHT(queue, type, week) // Use uploaded AHT, may be null
              }

              monthTotalVolume += volume
              monthTotalTrainingHC += getTrainingHCForWeek(queue, type, week)

              // Only calculate HC if AHT data exists
              if (aht !== null) {
                const reqHC = calculateRequiredHC(volume, aht, npt, shrinkage, occupancy)
                monthTotalRequiredHCWithoutBuffer += reqHC
                const queueBuffer = getQueueBuffer(queue)
                monthTotalRequiredHC += reqHC * (1 + queueBuffer / 100)
                monthWeeksWithAHT++
              }
            })

            // Sum actual HC across all timezones
            monthTotalActualHC += getCurrentHC(queue, row.timezone, type)
          })

          // Average required HC across weeks in the month (only weeks with AHT data)
          const avgRequiredHC = monthWeeksWithAHT > 0 ? monthTotalRequiredHC / monthWeeksWithAHT : null
          const avgRequiredHCWithoutBuffer = monthWeeksWithAHT > 0 ? monthTotalRequiredHCWithoutBuffer / monthWeeksWithAHT : null
          const avgTrainingHC = monthTotalTrainingHC / weeksCount
          const productionHC = monthTotalActualHC - avgTrainingHC
          const gap = avgRequiredHC !== null ? monthTotalActualHC - avgRequiredHC : null
          const gapPct = avgRequiredHC !== null && avgRequiredHC > 0 ? (gap / avgRequiredHC) * 100 : null

          byQueueByMonth[queue][monthGroup.month][type] = {
            volume: monthTotalVolume,
            requiredHC: avgRequiredHC,
            requiredHCWithoutBuffer: avgRequiredHCWithoutBuffer,
            actualHC: monthTotalActualHC,
            productionHC: productionHC,
            trainingHC: avgTrainingHC,
            gap,
            gapPct,
            assumptions: {
              npt: totalNPT / weeksCount,
              shrinkage: totalShrinkage / weeksCount,
              occupancy: totalOccupancy / weeksCount,
              aht: weeksWithAHT > 0 ? totalAHT / weeksWithAHT : null
            },
            isSimulated: hasQueueAssumptions
          }
        })
      })

      // Get all rows for this queue (all timezones)
      const queueRows = forecastData.filter(r => r.queue === queue)
      if (queueRows.length === 0) return

      ;['internal', 'external'].forEach(type => {
        const queueSplit = getQueueSplit(queue)
        const splitPct = type === 'external' ? queueSplit.external / 100 : queueSplit.internal / 100
        const assumptions = baseAssumptions[type]

        let totalVolume = 0
        let totalRequiredHC = 0
        let totalBatchHC = 0
        let totalTrainingHC = 0
        let totalActualHC = 0
        let weeksWithAHTData = 0

        // Aggregate across all timezones for this queue
        queueRows.forEach(row => {
          weeks.forEach(week => {
            const volume = (row.volumes[week] || 0) * splitPct
            const aht = getAHT(queue, type, week)

            totalVolume += volume
            totalBatchHC += getBatchHCForWeek(queue, type, week)
            totalTrainingHC += getTrainingHCForWeek(queue, type, week)

            // Only calculate HC if AHT data exists
            if (aht !== null) {
              const reqHC = calculateRequiredHC(volume, aht, assumptions.npt, assumptions.shrinkage, assumptions.occupancy)
              const queueBuffer = getQueueBuffer(queue)
              totalRequiredHC += reqHC * (1 + queueBuffer / 100)
              weeksWithAHTData++
            }
          })

          // Sum actual HC across all timezones
          totalActualHC += getCurrentHC(queue, row.timezone, type)
        })

        const avgRequiredHC = weeksWithAHTData > 0 ? totalRequiredHC / weeksWithAHTData : null
        const gap = avgRequiredHC !== null ? totalActualHC - avgRequiredHC : null

        byQueue[queue][type] = {
          volume: totalVolume,
          requiredHC: avgRequiredHC,
          actualHC: totalActualHC,
          batchHC: totalBatchHC / weeks.length,
          trainingHC: totalTrainingHC / weeks.length,
          gap
        }

        if (avgRequiredHC !== null) {
          overall[type].volume += totalVolume
          overall[type].requiredHC += avgRequiredHC
          overall[type].actualHC += totalActualHC
          overall[type].batchHC += totalBatchHC / weeks.length
          overall[type].trainingHC += totalTrainingHC / weeks.length
        }
      })
    })

    overall.internal.gap = overall.internal.actualHC - overall.internal.requiredHC
    overall.external.gap = overall.external.actualHC - overall.external.requiredHC

    // Calculate monthly data by type (internal, external, overall)
    const internalByMonth = {}
    const externalByMonth = {}
    const overallByMonth = {}

    monthlyGroups.forEach(monthGroup => {
      // Initialize data for each type
      const createMonthData = () => ({
        forecastedVolume: 0,
        actualVolume: 0,
        hc: 0,
        requiredHCWithBuffer: 0,
        requiredHCWithoutBuffer: 0,
        actualHC: 0,
        productionHC: 0,
        trainingHC: 0,
        overUnder: 0,
        overUnderPct: 0
      })

      const internalData = createMonthData()
      const externalData = createMonthData()
      const overallData = createMonthData()

      // Sum across all queues
      queues.forEach(queue => {
        const queueMonthData = byQueueByMonth[queue]?.[monthGroup.month]
        if (queueMonthData) {
          // Internal
          const intData = queueMonthData.internal
          if (intData) {
            internalData.forecastedVolume += intData.volume || 0
            internalData.requiredHCWithBuffer += intData.requiredHC || 0
            internalData.requiredHCWithoutBuffer += intData.requiredHCWithoutBuffer || 0
            internalData.actualHC += intData.actualHC || 0
            internalData.productionHC += intData.productionHC || 0
            internalData.trainingHC += intData.trainingHC || 0
          }

          // External
          const extData = queueMonthData.external
          if (extData) {
            externalData.forecastedVolume += extData.volume || 0
            externalData.requiredHCWithBuffer += extData.requiredHC || 0
            externalData.requiredHCWithoutBuffer += extData.requiredHCWithoutBuffer || 0
            externalData.actualHC += extData.actualHC || 0
            externalData.productionHC += extData.productionHC || 0
            externalData.trainingHC += extData.trainingHC || 0
          }
        }
      })

      // Calculate derived metrics for Internal
      internalData.hc = internalData.actualHC
      internalData.actualVolume = internalData.forecastedVolume
      internalData.overUnder = internalData.actualHC - internalData.requiredHCWithBuffer
      internalData.overUnderPct = internalData.requiredHCWithBuffer > 0
        ? (internalData.overUnder / internalData.requiredHCWithBuffer) * 100
        : 0

      // Calculate derived metrics for External
      externalData.hc = externalData.actualHC
      externalData.actualVolume = externalData.forecastedVolume
      externalData.overUnder = externalData.actualHC - externalData.requiredHCWithBuffer
      externalData.overUnderPct = externalData.requiredHCWithBuffer > 0
        ? (externalData.overUnder / externalData.requiredHCWithBuffer) * 100
        : 0

      // Calculate Overall (sum of internal + external)
      overallData.forecastedVolume = internalData.forecastedVolume + externalData.forecastedVolume
      overallData.actualVolume = internalData.actualVolume + externalData.actualVolume
      overallData.requiredHCWithBuffer = internalData.requiredHCWithBuffer + externalData.requiredHCWithBuffer
      overallData.requiredHCWithoutBuffer = internalData.requiredHCWithoutBuffer + externalData.requiredHCWithoutBuffer
      overallData.actualHC = internalData.actualHC + externalData.actualHC
      overallData.productionHC = internalData.productionHC + externalData.productionHC
      overallData.trainingHC = internalData.trainingHC + externalData.trainingHC
      overallData.hc = overallData.actualHC
      overallData.overUnder = overallData.actualHC - overallData.requiredHCWithBuffer
      overallData.overUnderPct = overallData.requiredHCWithBuffer > 0
        ? (overallData.overUnder / overallData.requiredHCWithBuffer) * 100
        : 0

      internalByMonth[monthGroup.month] = internalData
      externalByMonth[monthGroup.month] = externalData
      overallByMonth[monthGroup.month] = overallData
    })

    return { overall, byQueue, byQueueByMonth, overallByMonth, internalByMonth, externalByMonth }
  }, [forecastData, queues, weeks, monthlyGroups, getQueueSplit, baseAssumptions, getQueueBuffer, getAHT, calculateRequiredHC, getCurrentHC, getBatchHCForWeek, getTrainingHCForWeek, queueAssumptions, getQueueAssumption, activeSimulationId, simulations, shouldUseSimulation])

  // Check for active batches and simulations
  const hasBatches = batches.length > 0
  const hasSimulations = simulations.length > 0 || demandPlan.length > 0

  const exportToCSV = () => {
    if (!demandData) return

    let csv = 'Demand Assessment Plan\n'
    csv += `Generated: ${new Date().toLocaleString()}\n\n`
    
    csv += 'OVERALL SUMMARY\n'
    csv += 'Type,Volume,Avg Weekly Required HC,Actual HC,Gap\n'
    csv += `External,${formatNumber(demandData.overall.external.volume)},${formatNumber(demandData.overall.external.requiredHC, 1)},${formatNumber(demandData.overall.external.actualHC)},${formatNumber(demandData.overall.external.gap, 1)}\n`
    csv += `Internal,${formatNumber(demandData.overall.internal.volume)},${formatNumber(demandData.overall.internal.requiredHC, 1)},${formatNumber(demandData.overall.internal.actualHC)},${formatNumber(demandData.overall.internal.gap, 1)}\n\n`

    csv += 'QUEUE-WISE BREAKDOWN\n'
    csv += 'Queue,Type,Volume,Avg Weekly Required HC,Actual HC,Gap\n'
    queues.forEach(queue => {
      ;['external', 'internal'].forEach(type => {
        const data = demandData.byQueue[queue][type]
        csv += `${queue},${type},${formatNumber(data.volume)},${formatNumber(data.requiredHC, 1)},${formatNumber(data.actualHC)},${formatNumber(data.gap, 1)}\n`
      })
    })

    if (batches.length > 0) {
      csv += '\nPLANNED BATCHES\n'
      csv += 'Name,Type,Batch Type,Queue,Site,Start Week,HC Count,Training Duration\n'
      batches.forEach(b => {
        csv += `${b.name},${b.type},${b.batchType},${b.queue},${b.site || '-'},W${b.startWeek},${b.hcCount},${b.trainingDuration}w\n`
      })
    }

    if (demandPlan.length > 0) {
      csv += '\nFINALIZED SIMULATIONS\n'
      csv += 'Name,Queue,Week,Type,HC Impact\n'
      demandPlan.forEach(s => {
        csv += `${s.name},${s.queue},W${s.week},${s.type},${formatNumber(s.analysis?.hcDifference, 1)}\n`
      })
    }

    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `demand-plan-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (!forecastData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <Card>
          <CardContent className="p-12 text-center">
            <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No Data Loaded</h2>
            <p className="text-slate-500">Upload forecast data from the Dashboard first.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Demand Assessment Plan</h1>
          <p className="text-slate-500 mt-1">Overall and queue-wise capacity summary</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Notes about batches and simulations */}
      {(hasBatches || hasSimulations) && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-800 text-sm">Active Adjustments</h4>
                <div className="text-xs text-blue-700 mt-1 space-y-1">
                  {hasBatches && (
                    <p>• {batches.length} batch(es) planned with {batches.reduce((s, b) => s + b.hcCount, 0)} total HC</p>
                  )}
                  {hasSimulations && (
                    <p>• {demandPlan.length} finalized simulation(s) affecting capacity calculations</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Overall Summary (Combined) */}
        <Card>
          <CardHeader className="bg-blue-50 rounded-t-xl">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" />
              Overall Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Total Volume</div>
                <div className="text-xl font-bold">{formatNumber((demandData?.overall.external.volume || 0) + (demandData?.overall.internal.volume || 0))}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Avg Weekly Required HC</div>
                <div className="text-xl font-bold">{formatNumber((demandData?.overall.external.requiredHC || 0) + (demandData?.overall.internal.requiredHC || 0), 1)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Actual HC</div>
                <div className="text-xl font-bold text-blue-700">{formatNumber((demandData?.overall.external.actualHC || 0) + (demandData?.overall.internal.actualHC || 0))}</div>
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg",
                  ((demandData?.overall.external.gap || 0) + (demandData?.overall.internal.gap || 0)) >= 0 ? "bg-emerald-50" : "bg-amber-50"
                )}
              >
                <div className="text-xs text-slate-500">Gap</div>
                <div
                  className={cn(
                    "text-xl font-bold",
                    ((demandData?.overall.external.gap || 0) + (demandData?.overall.internal.gap || 0)) >= 0 ? "text-emerald-700" : "text-amber-700"
                  )}
                >
                  {((demandData?.overall.external.gap || 0) + (demandData?.overall.internal.gap || 0)) < 0
                    ? `(${formatNumber(Math.abs((demandData?.overall.external.gap || 0) + (demandData?.overall.internal.gap || 0)), 1)})`
                    : formatNumber((demandData?.overall.external.gap || 0) + (demandData?.overall.internal.gap || 0), 1)
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* External Summary */}
        <Card>
          <CardHeader className="bg-emerald-50 rounded-t-xl">
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-700" />
              External Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Total Volume</div>
                <div className="text-xl font-bold">{formatNumber(demandData?.overall.external.volume)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Avg Weekly Required HC</div>
                <div className="text-xl font-bold">{formatNumber(demandData?.overall.external.requiredHC, 1)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Actual HC</div>
                <div className="text-xl font-bold text-emerald-700">{formatNumber(demandData?.overall.external.actualHC)}</div>
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg",
                  demandData?.overall.external.gap >= 0 ? "bg-emerald-50" : "bg-amber-50"
                )}
              >
                <div className="text-xs text-slate-500">Gap</div>
                <div
                  className={cn(
                    "text-xl font-bold",
                    demandData?.overall.external.gap >= 0 ? "text-emerald-700" : "text-amber-700"
                  )}
                >
                  {demandData?.overall.external.gap < 0
                    ? `(${formatNumber(Math.abs(demandData?.overall.external.gap), 1)})`
                    : formatNumber(demandData?.overall.external.gap, 1)
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Internal Summary */}
        <Card>
          <CardHeader className="bg-slate-50 rounded-t-xl">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-slate-700" />
              Internal Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Total Volume</div>
                <div className="text-xl font-bold">{formatNumber(demandData?.overall.internal.volume)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Avg Weekly Required HC</div>
                <div className="text-xl font-bold">{formatNumber(demandData?.overall.internal.requiredHC, 1)}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs text-slate-500">Actual HC</div>
                <div className="text-xl font-bold text-slate-700">{formatNumber(demandData?.overall.internal.actualHC)}</div>
              </div>
              <div
                className={cn(
                  "p-3 rounded-lg",
                  demandData?.overall.internal.gap >= 0 ? "bg-emerald-50" : "bg-amber-50"
                )}
              >
                <div className="text-xs text-slate-500">Gap</div>
                <div
                  className={cn(
                    "text-xl font-bold",
                    demandData?.overall.internal.gap >= 0 ? "text-emerald-700" : "text-amber-700"
                  )}
                >
                  {demandData?.overall.internal.gap < 0
                    ? `(${formatNumber(Math.abs(demandData?.overall.internal.gap), 1)})`
                    : formatNumber(demandData?.overall.internal.gap, 1)
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Summary - Monthly Breakdown */}
      <Card>
        <CardHeader className="bg-blue-50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-700" />
                Overall Summary - Monthly Breakdown
              </CardTitle>
              <CardDescription>Combined internal and external capacity metrics by month</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50">
                  <TableHead className="sticky left-0 z-10 bg-blue-50 border-r-2 border-slate-300 min-w-[180px]">Metric</TableHead>
                  {monthlyGroups.map(monthGroup => (
                    <TableHead key={monthGroup.month} className="text-center min-w-[100px] border-r border-slate-200">
                      {getShortMonth(monthGroup.monthNum)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Forecasted Volume */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Forecasted Volume
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.forecastedVolume)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Actual Volume (Including Temp) */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Actual Volume (Including Temp)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.actualVolume)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* HC */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm font-semibold border-r border-slate-200">
                        {formatNumber(data?.hc)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Required HC (with buffer) */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Required HC (with buffer)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.requiredHCWithBuffer, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Required HC (without buffer) */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Required HC (without buffer)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.requiredHCWithoutBuffer, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Actual HC */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Actual HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm font-semibold text-blue-700 border-r border-slate-200">
                        {formatNumber(data?.actualHC)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* 100% Production HC */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    100% Production HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.productionHC, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Training */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Training
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.trainingHC, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Over/Under */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Over/Under
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell
                        key={monthGroup.month}
                        className={cn(
                          "text-center text-sm font-semibold border-r border-slate-200",
                          (data?.overUnder || 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                        )}
                      >
                        {(data?.overUnder || 0) < 0
                          ? `(${formatNumber(Math.abs(data?.overUnder || 0), 1)})`
                          : formatNumber(data?.overUnder, 1)
                        }
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Over/Under % */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Over/Under %
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.overallByMonth?.[monthGroup.month]
                    return (
                      <TableCell
                        key={monthGroup.month}
                        className={cn(
                          "text-center text-sm font-semibold border-r border-slate-200",
                          (data?.overUnderPct || 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                        )}
                      >
                        {formatNumber(data?.overUnderPct, 1)}%
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Internal Summary - Monthly Breakdown */}
      <Card>
        <CardHeader className="bg-slate-100 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-700" />
                Internal Summary - Monthly Breakdown
              </CardTitle>
              <CardDescription>Aggregated internal capacity metrics by month</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100">
                  <TableHead className="sticky left-0 z-10 bg-slate-100 border-r-2 border-slate-300 min-w-[180px]">Metric</TableHead>
                  {monthlyGroups.map(monthGroup => (
                    <TableHead key={monthGroup.month} className="text-center min-w-[100px] border-r border-slate-200">
                      {getShortMonth(monthGroup.monthNum)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Forecasted Volume */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Forecasted Volume
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.forecastedVolume)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Actual Volume (Including Temp) */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Actual Volume (Including Temp)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.actualVolume)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* HC */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm font-semibold border-r border-slate-200">
                        {formatNumber(data?.hc)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Required HC (with buffer) */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Required HC (with buffer)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.requiredHCWithBuffer, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Required HC (without buffer) */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Required HC (without buffer)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.requiredHCWithoutBuffer, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Actual HC */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Actual HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm font-semibold text-slate-700 border-r border-slate-200">
                        {formatNumber(data?.actualHC)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* 100% Production HC */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    100% Production HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.productionHC, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Training */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Training
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.trainingHC, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Over/Under */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Over/Under
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell
                        key={monthGroup.month}
                        className={cn(
                          "text-center text-sm font-semibold border-r border-slate-200",
                          (data?.overUnder || 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                        )}
                      >
                        {(data?.overUnder || 0) < 0
                          ? `(${formatNumber(Math.abs(data?.overUnder || 0), 1)})`
                          : formatNumber(data?.overUnder, 1)
                        }
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Over/Under % */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Over/Under %
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.internalByMonth?.[monthGroup.month]
                    return (
                      <TableCell
                        key={monthGroup.month}
                        className={cn(
                          "text-center text-sm font-semibold border-r border-slate-200",
                          (data?.overUnderPct || 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                        )}
                      >
                        {formatNumber(data?.overUnderPct, 1)}%
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* External Summary - Monthly Breakdown */}
      <Card>
        <CardHeader className="bg-emerald-50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-700" />
                External Summary - Monthly Breakdown
              </CardTitle>
              <CardDescription>Aggregated external capacity metrics by month</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50">
                  <TableHead className="sticky left-0 z-10 bg-emerald-50 border-r-2 border-slate-300 min-w-[180px]">Metric</TableHead>
                  {monthlyGroups.map(monthGroup => (
                    <TableHead key={monthGroup.month} className="text-center min-w-[100px] border-r border-slate-200">
                      {getShortMonth(monthGroup.monthNum)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Forecasted Volume */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Forecasted Volume
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.forecastedVolume)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Actual Volume (Including Temp) */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Actual Volume (Including Temp)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.actualVolume)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* HC */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm font-semibold border-r border-slate-200">
                        {formatNumber(data?.hc)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Required HC (with buffer) */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Required HC (with buffer)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.requiredHCWithBuffer, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Required HC (without buffer) */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Required HC (without buffer)
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.requiredHCWithoutBuffer, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Actual HC */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Actual HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm font-semibold text-emerald-700 border-r border-slate-200">
                        {formatNumber(data?.actualHC)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* 100% Production HC */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    100% Production HC
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.productionHC, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Training */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Training
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                        {formatNumber(data?.trainingHC, 1)}
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Over/Under */}
                <TableRow>
                  <TableCell className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium">
                    Over/Under
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell
                        key={monthGroup.month}
                        className={cn(
                          "text-center text-sm font-semibold border-r border-slate-200",
                          (data?.overUnder || 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                        )}
                      >
                        {(data?.overUnder || 0) < 0
                          ? `(${formatNumber(Math.abs(data?.overUnder || 0), 1)})`
                          : formatNumber(data?.overUnder, 1)
                        }
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Over/Under % */}
                <TableRow className="bg-slate-50">
                  <TableCell className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300 font-medium">
                    Over/Under %
                  </TableCell>
                  {monthlyGroups.map(monthGroup => {
                    const data = demandData?.externalByMonth?.[monthGroup.month]
                    return (
                      <TableCell
                        key={monthGroup.month}
                        className={cn(
                          "text-center text-sm font-semibold border-r border-slate-200",
                          (data?.overUnderPct || 0) >= 0 ? "text-emerald-700" : "text-amber-700"
                        )}
                      >
                        {formatNumber(data?.overUnderPct, 1)}%
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Internal Monthly Breakdown */}
      <Card>
        <CardHeader className="bg-slate-50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-slate-700" />
                Internal - Monthly Breakdown
              </CardTitle>
              <CardDescription>Queue-wise internal capacity and assumptions by month</CardDescription>
            </div>
            {queues.some(q => queueAssumptions[q]?.internal) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queues.forEach(q => {
                    if (queueAssumptions[q]?.internal) {
                      resetSimulation(q, 'internal')
                    }
                  })
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All to Base
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="sticky left-0 z-10 bg-slate-50 border-r-2 border-slate-300">Queue</TableHead>
                  <TableHead className="border-r-2 border-slate-300">Metric</TableHead>
                  {monthlyGroups.map(monthGroup => (
                    <TableHead key={monthGroup.month} className="text-center min-w-[100px] border-r border-slate-200">
                      {getShortMonth(monthGroup.monthNum)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map(queue => {
                  const queueBatches = batches.filter(b => b.queue === queue && b.type === 'internal')
                  const queueSims = demandPlan.filter(s => s.queue === queue && s.type === 'internal')
                  const isSimulated = shouldUseSimulation(queue, 'internal')

                  return (
                    <Fragment key={queue}>
                      <TableRow key={`${queue}-vol`}>
                        <TableCell rowSpan={8} className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium align-top pt-4">
                          <div className="flex items-center gap-2">
                            {queue}
                            {isSimulated && (
                              <Badge variant="warning" className="text-xs">
                                Simulated
                              </Badge>
                            )}
                          </div>
                          {(queueBatches.length > 0 || queueSims.length > 0) && (
                            <div className="flex flex-col gap-1 mt-2">
                              {queueBatches.length > 0 && (
                                <Badge variant="info" className="text-xs">
                                  +{queueBatches.reduce((s, b) => s + b.hcCount, 0)} batch
                                </Badge>
                              )}
                              {queueSims.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {queueSims.length} sim
                                </Badge>
                              )}
                            </div>
                          )}
                          {isSimulated && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-xs h-6"
                              onClick={() => resetSimulation(queue, 'internal')}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Reset
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Volume</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.internal || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                              {formatNumber(data.volume)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-npt`} className="bg-slate-50">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">NPT %</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.internal || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm text-slate-700 border-r border-slate-200">
                              {formatNumber(data.assumptions?.npt, 1)}%
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-shrinkage`} className="bg-slate-50">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Shrinkage %</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.internal || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm text-slate-700 border-r border-slate-200">
                              {formatNumber(data.assumptions?.shrinkage, 1)}%
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-occupancy`} className="bg-slate-50">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Occupancy %</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.internal || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm text-slate-700 border-r border-slate-200">
                              {formatNumber(data.assumptions?.occupancy, 1)}%
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-aht`} className="bg-slate-50">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">AHT (mins)</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.internal || {}
                          const aht = data.assumptions?.aht
                          return (
                            <TableCell key={monthGroup.month} className={cn(
                              "text-center text-sm border-r border-slate-200",
                              aht === null ? "text-amber-600 bg-amber-50" : "text-slate-700"
                            )}>
                              {aht === null ? '-' : formatNumber(aht, 1)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-req`}>
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Avg Req HC</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.internal || {}
                          return (
                            <TableCell key={monthGroup.month} className={cn(
                              "text-center text-sm font-medium border-r border-slate-200",
                              data.requiredHC === null && "text-amber-600 bg-amber-50"
                            )}>
                              {data.requiredHC === null ? '-' : formatNumber(data.requiredHC, 1)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-actual`}>
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Actual HC</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.internal || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm font-semibold text-slate-700 border-r border-slate-200">
                              {formatNumber(data.actualHC)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-gap`} className="border-b-2 border-slate-200">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Gap</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.internal || {}
                          return (
                            <TableCell
                              key={monthGroup.month}
                              className={cn(
                                "text-center text-sm font-semibold border-r border-slate-200",
                                data.gap === null ? "text-amber-600 bg-amber-50" :
                                data.gap >= 0 ? "text-emerald-700" : "text-amber-700"
                              )}
                            >
                              {data.gap === null ? '-' : data.gap < 0 ? `(${formatNumber(Math.abs(data.gap), 1)})` : formatNumber(data.gap, 1)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* External Monthly Breakdown */}
      <Card>
        <CardHeader className="bg-emerald-50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-700" />
                External - Monthly Breakdown
              </CardTitle>
              <CardDescription>Queue-wise external capacity and assumptions by month</CardDescription>
            </div>
            {queues.some(q => queueAssumptions[q]?.external) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  queues.forEach(q => {
                    if (queueAssumptions[q]?.external) {
                      resetSimulation(q, 'external')
                    }
                  })
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset All to Base
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-emerald-50">
                  <TableHead className="sticky left-0 z-10 border-r-2 border-slate-300 bg-emerald-50">Queue</TableHead>
                  <TableHead className="border-r-2 border-slate-300">Metric</TableHead>
                  {monthlyGroups.map(monthGroup => (
                    <TableHead key={monthGroup.month} className="text-center min-w-[100px] border-r border-slate-200">
                      {getShortMonth(monthGroup.monthNum)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {queues.map(queue => {
                  const queueBatches = batches.filter(b => b.queue === queue && b.type === 'external')
                  const queueSims = demandPlan.filter(s => s.queue === queue && s.type === 'external')
                  const isSimulated = shouldUseSimulation(queue, 'external')

                  return (
                    <Fragment key={queue}>
                      <TableRow key={`${queue}-vol`}>
                        <TableCell rowSpan={8} className="sticky left-0 z-10 bg-white border-r-2 border-slate-300 font-medium align-top pt-4">
                          <div className="flex items-center gap-2">
                            {queue}
                            {isSimulated && (
                              <Badge variant="warning" className="text-xs">
                                Simulated
                              </Badge>
                            )}
                          </div>
                          {(queueBatches.length > 0 || queueSims.length > 0) && (
                            <div className="flex flex-col gap-1 mt-2">
                              {queueBatches.length > 0 && (
                                <Badge variant="info" className="text-xs">
                                  +{queueBatches.reduce((s, b) => s + b.hcCount, 0)} batch
                                </Badge>
                              )}
                              {queueSims.length > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {queueSims.length} sim
                                </Badge>
                              )}
                            </div>
                          )}
                          {isSimulated && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2 text-xs h-6"
                              onClick={() => resetSimulation(queue, 'external')}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Reset
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Volume</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.external || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm border-r border-slate-200">
                              {formatNumber(data.volume)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-npt`} className="bg-slate-50">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">NPT %</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.external || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm text-slate-700 border-r border-slate-200">
                              {formatNumber(data.assumptions?.npt, 1)}%
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-shrinkage`} className="bg-slate-50">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Shrinkage %</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.external || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm text-slate-700 border-r border-slate-200">
                              {formatNumber(data.assumptions?.shrinkage, 1)}%
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-occupancy`} className="bg-slate-50">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Occupancy %</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.external || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm text-slate-700 border-r border-slate-200">
                              {formatNumber(data.assumptions?.occupancy, 1)}%
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-aht`} className="bg-slate-50">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">AHT (mins)</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.external || {}
                          const aht = data.assumptions?.aht
                          return (
                            <TableCell key={monthGroup.month} className={cn(
                              "text-center text-sm border-r border-slate-200",
                              aht === null ? "text-amber-600 bg-amber-50" : "text-slate-700"
                            )}>
                              {aht === null ? '-' : formatNumber(aht, 1)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-req`}>
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Avg Req HC</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.external || {}
                          return (
                            <TableCell key={monthGroup.month} className={cn(
                              "text-center text-sm font-medium border-r border-slate-200",
                              data.requiredHC === null && "text-amber-600 bg-amber-50"
                            )}>
                              {data.requiredHC === null ? '-' : formatNumber(data.requiredHC, 1)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-actual`}>
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Actual HC</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.external || {}
                          return (
                            <TableCell key={monthGroup.month} className="text-center text-sm font-semibold text-emerald-700 border-r border-slate-200">
                              {formatNumber(data.actualHC)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                      <TableRow key={`${queue}-gap`} className="border-b-2 border-slate-200">
                        <TableCell className="text-xs text-slate-600 border-r-2 border-slate-300">Gap</TableCell>
                        {monthlyGroups.map(monthGroup => {
                          const data = demandData?.byQueueByMonth[queue]?.[monthGroup.month]?.external || {}
                          return (
                            <TableCell
                              key={monthGroup.month}
                              className={cn(
                                "text-center text-sm font-semibold border-r border-slate-200",
                                data.gap === null ? "text-amber-600 bg-amber-50" :
                                data.gap >= 0 ? "text-emerald-700" : "text-amber-700"
                              )}
                            >
                              {data.gap === null ? '-' : data.gap < 0 ? `(${formatNumber(Math.abs(data.gap), 1)})` : formatNumber(data.gap, 1)}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Planned Batches */}
      {batches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
              Planned Batches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Batch Type</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-center">Start</TableHead>
                    <TableHead className="text-center">HC</TableHead>
                    <TableHead className="text-center">Training</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map(batch => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">{batch.name}</TableCell>
                      <TableCell>
                        <Badge variant={batch.batchType === 'new' ? 'success' : 'info'}>
                          {batch.batchType === 'new' ? '🆕 New' : '⬆️ Upskill'}
                        </Badge>
                      </TableCell>
                      <TableCell>{batch.queue}</TableCell>
                      <TableCell>
                        <Badge variant={batch.type === 'external' ? 'success' : 'secondary'}>
                          {batch.type === 'external' ? '🌐' : '🏢'}
                        </Badge>
                      </TableCell>
                      <TableCell>{batch.site || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">W{batch.startWeek}</Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600">
                        {batch.hcCount}
                      </TableCell>
                      <TableCell className="text-center">{batch.trainingDuration}w</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finalized Simulations */}
      {demandPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-blue-500" />
              Finalized Simulations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Queue</TableHead>
                    <TableHead>Week</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">HC Impact</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {demandPlan.map((sim, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{sim.name}</TableCell>
                      <TableCell>{sim.queue}</TableCell>
                      <TableCell>
                        <Badge variant="outline">W{sim.week}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={sim.type === 'external' ? 'success' : 'secondary'}>
                          {sim.type === 'external' ? '🌐' : '🏢'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={sim.analysis?.hcDifference >= 0 ? 'success' : 'destructive'}>
                          {sim.analysis?.hcDifference >= 0 ? '+' : ''}
                          {formatNumber(sim.analysis?.hcDifference, 1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {sim.description || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
