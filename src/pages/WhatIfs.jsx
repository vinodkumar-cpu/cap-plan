import { useState, useMemo } from 'react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FlaskConical, RotateCcw, TrendingDown, TrendingUp, Save, Trash2, CheckCircle2, Pencil, X } from 'lucide-react'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function WhatIfs() {
  const {
    forecastData,
    queues,
    getQueueSplit,
    getAHT,
    updateAHT,
    baseAssumptions,
    getQueueAssumption,
    updateQueueAssumption,
    queueAssumptions,
    setQueueAssumptions,
    weeklyAHT,
    setWeeklyAHT,
    copyBaseToQueue,
    getQueueBuffer,
    calculateRequiredHC,
    simulations,
    addSimulation,
    updateSimulation,
    deleteSimulation,
    activeSimulationId,
    setActiveSimulationId,
    baselineAHTData,
    setBaselineAHTData,
    whatIfsSelection,
    setWhatIfsSelection
  } = useApp()

  // Use persisted selection from context
  const selectedQueue = whatIfsSelection.queue
  const selectedType = whatIfsSelection.type
  const setSelectedQueue = (queue) => setWhatIfsSelection(prev => ({ ...prev, queue }))
  const setSelectedType = (type) => setWhatIfsSelection(prev => ({ ...prev, type }))
  const [simulationName, setSimulationName] = useState('')
  const [editingSimulationId, setEditingSimulationId] = useState(null)

  if (!forecastData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <Card>
          <CardContent className="p-12 text-center">
            <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No Data Loaded</h2>
            <p className="text-slate-500">Upload forecast data from the Dashboard first.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const allWeeks = Array.from({ length: 52 }, (_, i) => (i + 1).toString())

  // Reset to base assumptions for this queue
  const handleResetToBase = () => {
    if (selectedQueue) {
      copyBaseToQueue(selectedQueue, selectedType)
      // Also reset AHT to base values
      const updatedWeeklyAHT = { ...weeklyAHT }
      if (!updatedWeeklyAHT[selectedQueue]) {
        updatedWeeklyAHT[selectedQueue] = {}
      }
      if (!updatedWeeklyAHT[selectedQueue][selectedType]) {
        updatedWeeklyAHT[selectedQueue][selectedType] = {}
      }
      // Clear all week-specific AHT overrides
      allWeeks.forEach(week => {
        delete updatedWeeklyAHT[selectedQueue][selectedType][week]
      })
      setWeeklyAHT(updatedWeeklyAHT)
    }
  }

  // Save current simulation (queue assumptions + AHT snapshot)
  const handleSaveSimulation = () => {
    if (!simulationName.trim() || !selectedQueue) return

    const simulationData = {
      name: simulationName.trim(),
      queue: selectedQueue,
      type: selectedType,
      assumptions: JSON.parse(JSON.stringify(queueAssumptions[selectedQueue]?.[selectedType] || {})),
      aht: JSON.parse(JSON.stringify(weeklyAHT[selectedQueue]?.[selectedType] || {}))
    }

    if (editingSimulationId) {
      // Update existing simulation
      updateSimulation(editingSimulationId, simulationData)
      setEditingSimulationId(null)
    } else {
      // Create new simulation
      addSimulation(simulationData)
    }
    setSimulationName('')
  }

  // Load simulation data for editing
  const handleEditSimulation = (simulation) => {
    // Set the queue and type to match the simulation
    setSelectedQueue(simulation.queue)
    setSelectedType(simulation.type)

    // Load the simulation's assumptions into current state
    setQueueAssumptions(prev => ({
      ...prev,
      [simulation.queue]: {
        ...prev[simulation.queue],
        [simulation.type]: simulation.assumptions || {}
      }
    }))

    // Load the simulation's AHT values
    if (simulation.aht) {
      setWeeklyAHT(prev => ({
        ...prev,
        [simulation.queue]: {
          ...prev[simulation.queue],
          [simulation.type]: simulation.aht
        }
      }))
    }

    // Set editing state
    setSimulationName(simulation.name)
    setEditingSimulationId(simulation.id)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingSimulationId(null)
    setSimulationName('')
  }

  // Load and activate saved simulation
  const handleToggleSimulation = (simulation) => {
    if (activeSimulationId === simulation.id) {
      // Deactivate - restore baseline AHT and clear queue assumptions
      setActiveSimulationId(null)

      // Clear the queue assumptions for this specific queue/type
      setQueueAssumptions(prev => {
        const updated = { ...prev }
        if (updated[simulation.queue]?.[simulation.type]) {
          delete updated[simulation.queue][simulation.type]
          // If no types left for this queue, remove the queue entirely
          if (Object.keys(updated[simulation.queue]).length === 0) {
            delete updated[simulation.queue]
          }
        }
        return updated
      })

      // Restore the baseline AHT data that was saved before activation
      if (baselineAHTData && baselineAHTData.queue === simulation.queue && baselineAHTData.type === simulation.type) {
        setWeeklyAHT(prev => ({
          ...prev,
          [simulation.queue]: {
            ...prev[simulation.queue],
            [simulation.type]: baselineAHTData.aht
          }
        }))
        setBaselineAHTData(null)
      }
    } else {
      // Activate - load the simulation data
      setSelectedQueue(simulation.queue)
      setSelectedType(simulation.type)

      // First, if there's an active simulation, restore its baseline before switching
      if (activeSimulationId && baselineAHTData) {
        const currentSim = simulations.find(s => s.id === activeSimulationId)
        if (currentSim && baselineAHTData.queue === currentSim.queue && baselineAHTData.type === currentSim.type) {
          // Restore the baseline AHT for the previous simulation
          setWeeklyAHT(prev => ({
            ...prev,
            [currentSim.queue]: {
              ...prev[currentSim.queue],
              [currentSim.type]: baselineAHTData.aht
            }
          }))

          // Clear queue assumptions for the previous simulation
          setQueueAssumptions(prev => {
            const updated = { ...prev }
            if (updated[currentSim.queue]?.[currentSim.type]) {
              delete updated[currentSim.queue][currentSim.type]
              if (Object.keys(updated[currentSim.queue]).length === 0) {
                delete updated[currentSim.queue]
              }
            }
            return updated
          })
        }
      }

      // Save the current (baseline) AHT data before applying simulation overrides
      const currentAHT = weeklyAHT[simulation.queue]?.[simulation.type] || {}
      setBaselineAHTData({
        queue: simulation.queue,
        type: simulation.type,
        aht: JSON.parse(JSON.stringify(currentAHT))
      })

      // Restore the saved assumptions
      setQueueAssumptions(prev => ({
        ...prev,
        [simulation.queue]: {
          ...prev[simulation.queue],
          [simulation.type]: simulation.assumptions || {}
        }
      }))

      // Apply the simulation's AHT values
      if (simulation.aht) {
        setWeeklyAHT(prev => ({
          ...prev,
          [simulation.queue]: {
            ...prev[simulation.queue],
            [simulation.type]: simulation.aht
          }
        }))
      }

      // Set as active simulation for demand plan
      setActiveSimulationId(simulation.id)
    }
  }

  // Calculate simulation results for all 52 weeks
  const simulationResults = useMemo(() => {
    if (!selectedQueue) return null

    const row = forecastData.find(r => r.queue === selectedQueue)
    if (!row) return null

    const queueSplit = getQueueSplit(selectedQueue)
    const splitPct = selectedType === 'external' ? queueSplit.external / 100 : queueSplit.internal / 100
    const results = {
      baseline: [],
      simulated: [],
      savings: []
    }

    allWeeks.forEach(week => {
      const volume = (row.volumes[week] || 0) * splitPct
      const simAHT = getAHT(selectedQueue, selectedType, week)

      // If no AHT data for this week, show null for HC values
      if (simAHT === null) {
        results.baseline.push(null)
        results.simulated.push(null)
        results.savings.push(null)
        return
      }

      // Baseline (using weekly global assumptions and base AHT from uploaded data)
      // For baseline, we don't use queue-specific overrides, but we DO use weekly NPT/Shrinkage
      const baseNPT = getQueueAssumption(selectedQueue, selectedType, 'npt', week)
      const baseShrinkage = getQueueAssumption(selectedQueue, selectedType, 'shrinkage', week)
      const baseOccupancy = baseAssumptions[selectedType].occupancy
      // Use the uploaded AHT as baseline (not hardcoded 8/10)
      const baseAHT = simAHT
      const baselineHC = calculateRequiredHC(volume, baseAHT, baseNPT, baseShrinkage, baseOccupancy)
      const queueBuffer = getQueueBuffer(selectedQueue)
      const baselineWithBuffer = baselineHC * (1 + queueBuffer / 100)

      // Simulated (using queue-level assumptions and custom AHT)
      const simNPT = getQueueAssumption(selectedQueue, selectedType, 'npt', week)
      const simShrinkage = getQueueAssumption(selectedQueue, selectedType, 'shrinkage', week)
      const simOccupancy = getQueueAssumption(selectedQueue, selectedType, 'occupancy', week)
      const simulatedHC = calculateRequiredHC(volume, simAHT, simNPT, simShrinkage, simOccupancy)
      const simulatedWithBuffer = simulatedHC * (1 + queueBuffer / 100)

      // Savings (positive = HC reduction)
      const hcSavings = baselineWithBuffer - simulatedWithBuffer

      results.baseline.push(baselineWithBuffer)
      results.simulated.push(simulatedWithBuffer)
      results.savings.push(hcSavings)
    })

    return results
  }, [selectedQueue, selectedType, forecastData, getQueueSplit, getAHT, baseAssumptions, getQueueAssumption, getQueueBuffer, calculateRequiredHC, allWeeks])

  const metrics = [
    { key: 'aht', label: 'AHT (mins)', icon: '⏱️' },
    { key: 'npt', label: 'NPT %', icon: '📋' },
    { key: 'shrinkage', label: 'Shrinkage %', icon: '📉' },
    { key: 'occupancy', label: 'Occupancy %', icon: '📊' }
  ]

  // Get active simulation details
  const activeSimulation = activeSimulationId ? simulations.find(s => s.id === activeSimulationId) : null

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-purple-600" />
          What-If Scenario Simulator
        </h1>
        <p className="text-slate-500 mt-1">Adjust assumptions and AHT week-by-week and see immediate HC impact vs baseline</p>
      </div>

      {/* Active Simulation Banner */}
      {activeSimulation && (
        <Card className="border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-full">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Active Simulation</div>
                  <div className="text-sm text-blue-700">
                    {activeSimulation.name} • {activeSimulation.queue} • {activeSimulation.type}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveSimulationId(null)}
                className="border-slate-300 hover:bg-slate-50"
              >
                Deactivate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card className="border-slate-200 bg-gradient-to-br from-slate-50 to-blue-50">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Simulation Controls</CardTitle>
              <CardDescription>Select queue and type to run what-if scenarios</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedQueue}
                onChange={(e) => setSelectedQueue(e.target.value)}
                className="w-full sm:w-56"
              >
                <option value="">Select Queue</option>
                {queues.map(q => <option key={q} value={q}>{q}</option>)}
              </Select>
              <Select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full sm:w-32"
              >
                <option value="external">External</option>
                <option value="internal">Internal</option>
              </Select>
              <Button variant="outline" onClick={handleResetToBase} size="sm" disabled={!selectedQueue}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset to Base
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!selectedQueue ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Select a Queue to Begin</h2>
            <p className="text-slate-500">Choose a queue from the dropdown above to start simulating</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Assumption Adjustments - Excel-like compact view */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Adjust Assumptions (All 52 Weeks)</CardTitle>
              <CardDescription>Modify AHT, NPT, Shrinkage, and Occupancy week-by-week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white min-w-[100px] p-1 text-xs">Metric</TableHead>
                      {allWeeks.map(week => (
                        <TableHead key={week} className="text-center min-w-[50px] p-1 text-xs">W{week}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map(metric => (
                      <TableRow key={metric.key}>
                        <TableCell className="sticky left-0 bg-white font-medium border-r p-1">
                          <div className="flex items-center gap-1 text-xs">
                            <span>{metric.icon}</span>
                            <span>{metric.label}</span>
                          </div>
                        </TableCell>
                        {allWeeks.map(week => {
                          let value, baseValue, isDifferent

                          if (metric.key === 'aht') {
                            value = getAHT(selectedQueue, selectedType, week)
                            baseValue = selectedType === 'external' ? 8 : 10
                            isDifferent = value !== null && value !== baseValue
                          } else {
                            value = getQueueAssumption(selectedQueue, selectedType, metric.key, week)
                            baseValue = baseAssumptions[selectedType][metric.key]
                            isDifferent = value !== baseValue
                          }

                          return (
                            <TableCell key={week} className="p-0.5">
                              <Input
                                type="number"
                                value={value ?? ''}
                                onChange={(e) => {
                                  const newValue = parseFloat(e.target.value) || 0
                                  if (metric.key === 'aht') {
                                    updateAHT(selectedQueue, selectedType, week, newValue)
                                  } else {
                                    updateQueueAssumption(selectedQueue, selectedType, metric.key, week, newValue)
                                  }
                                }}
                                className={cn(
                                  "w-full h-7 text-center text-xs p-0 border-0",
                                  isDifferent && "bg-slate-50 font-semibold",
                                  metric.key === 'aht' && value === null && "bg-amber-50 text-amber-600"
                                )}
                                placeholder={metric.key === 'aht' && value === null ? '-' : baseValue.toString()}
                                step={metric.key === 'aht' ? '0.1' : '1'}
                                min="0"
                                max={metric.key === 'aht' ? '999' : '100'}
                              />
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Results Comparison */}
          {simulationResults && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-lg">Baseline vs Simulated HC (All 52 Weeks)</CardTitle>
                <CardDescription>Compare required HC with base assumptions vs your adjusted assumptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-white min-w-[100px] p-1 text-xs">Scenario</TableHead>
                        {allWeeks.map(week => (
                          <TableHead key={week} className="text-center min-w-[50px] p-1 text-xs">W{week}</TableHead>
                        ))}
                        <TableHead className="text-center min-w-[80px] bg-slate-50 font-bold p-1 text-xs">Peak</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="sticky left-0 bg-slate-50 font-medium border-r p-1 text-xs">
                          Baseline
                        </TableCell>
                        {simulationResults.baseline.map((hc, idx) => (
                          <TableCell key={idx} className={cn(
                            "text-center p-0.5 text-xs",
                            hc === null ? "bg-amber-50 text-amber-600" : "bg-slate-50"
                          )}>
                            {hc === null ? '-' : formatNumber(hc, 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-center bg-slate-100 font-bold p-1 text-xs">
                          {(() => {
                            const validValues = simulationResults.baseline.filter(v => v !== null)
                            return validValues.length > 0 ? formatNumber(Math.max(...validValues), 0) : '-'
                          })()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="sticky left-0 bg-blue-50 font-medium border-r p-1 text-xs">
                          Simulated
                        </TableCell>
                        {simulationResults.simulated.map((hc, idx) => (
                          <TableCell key={idx} className={cn(
                            "text-center p-0.5 text-xs",
                            hc === null ? "bg-amber-50 text-amber-600" : "bg-blue-50"
                          )}>
                            {hc === null ? '-' : formatNumber(hc, 0)}
                          </TableCell>
                        ))}
                        <TableCell className="text-center bg-blue-100 font-bold p-1 text-xs">
                          {(() => {
                            const validValues = simulationResults.simulated.filter(v => v !== null)
                            return validValues.length > 0 ? formatNumber(Math.max(...validValues), 0) : '-'
                          })()}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="sticky left-0 bg-emerald-50 font-medium border-r p-1 text-xs">
                          Savings
                        </TableCell>
                        {simulationResults.savings.map((saving, idx) => (
                          <TableCell key={idx} className={cn(
                            "text-center font-semibold p-0.5 text-xs",
                            saving === null ? "bg-amber-50 text-amber-600" : saving > 0 ? "text-emerald-700 bg-emerald-50" : saving < 0 ? "text-amber-700 bg-amber-50" : "bg-slate-50"
                          )}>
                            {saving === null ? '-' : `${saving > 0 ? '+' : ''}${formatNumber(saving, 0)}`}
                          </TableCell>
                        ))}
                        <TableCell className={cn(
                          "text-center font-bold p-1 text-xs",
                          (() => {
                            const validBaseline = simulationResults.baseline.filter(v => v !== null)
                            const validSimulated = simulationResults.simulated.filter(v => v !== null)
                            if (validBaseline.length === 0 || validSimulated.length === 0) return "bg-slate-100"
                            return Math.max(...validBaseline) - Math.max(...validSimulated) > 0 ? "text-emerald-700 bg-emerald-100" : "text-amber-700 bg-amber-100"
                          })()
                        )}>
                          {(() => {
                            const validBaseline = simulationResults.baseline.filter(v => v !== null)
                            const validSimulated = simulationResults.simulated.filter(v => v !== null)
                            if (validBaseline.length === 0 || validSimulated.length === 0) return '-'
                            const diff = Math.max(...validBaseline) - Math.max(...validSimulated)
                            return `${diff > 0 ? '+' : ''}${formatNumber(diff, 0)}`
                          })()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(() => {
                    const validBaseline = simulationResults.baseline.filter(v => v !== null)
                    const validSimulated = simulationResults.simulated.filter(v => v !== null)
                    const peakBaseline = validBaseline.length > 0 ? Math.max(...validBaseline) : null
                    const peakSimulated = validSimulated.length > 0 ? Math.max(...validSimulated) : null
                    const peakSavings = peakBaseline !== null && peakSimulated !== null ? peakBaseline - peakSimulated : null

                    return (
                      <>
                        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-xs text-slate-500 mb-1">Peak Baseline HC</div>
                          <div className="text-2xl font-bold text-slate-800">
                            {peakBaseline !== null ? formatNumber(peakBaseline, 0) : '-'}
                          </div>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="text-xs text-purple-600 mb-1">Peak Simulated HC</div>
                          <div className="text-2xl font-bold text-purple-700">
                            {peakSimulated !== null ? formatNumber(peakSimulated, 0) : '-'}
                          </div>
                        </div>
                        <div className={cn(
                          "p-4 rounded-lg border",
                          peakSavings === null ? "bg-slate-50 border-slate-200" :
                          peakSavings > 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                        )}>
                          <div className="text-xs text-slate-600 mb-1">Peak HC Savings</div>
                          <div className={cn(
                            "text-2xl font-bold flex items-center gap-2",
                            peakSavings === null ? "text-slate-500" :
                            peakSavings > 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {peakSavings !== null && (
                              peakSavings > 0 ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />
                            )}
                            {peakSavings !== null ? `${peakSavings > 0 ? '+' : ''}${formatNumber(peakSavings, 0)}` : '-'}
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Save Simulation */}
          <Card className={cn(
            "border-blue-200 bg-gradient-to-br",
            editingSimulationId ? "from-amber-50 to-orange-50 border-amber-300" : "from-blue-50 to-indigo-50"
          )}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {editingSimulationId ? (
                  <>
                    <Pencil className="w-5 h-5 text-amber-600" />
                    Edit Simulation
                  </>
                ) : (
                  'Save Simulation'
                )}
              </CardTitle>
              <CardDescription>
                {editingSimulationId
                  ? 'Modify the simulation settings and save your changes'
                  : 'Save these assumption and AHT changes for later use in demand planning'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={simulationName}
                  onChange={(e) => setSimulationName(e.target.value)}
                  placeholder="Simulation name (e.g., Improved Occupancy Q1)"
                  className="flex-1"
                />
                {editingSimulationId && (
                  <Button variant="outline" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                )}
                <Button onClick={handleSaveSimulation} disabled={!simulationName.trim()}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingSimulationId ? 'Update' : 'Save'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Saved Simulations with On/Off Toggle */}
      {simulations && simulations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Saved Simulations</CardTitle>
            <CardDescription>Toggle simulations on/off to apply them in demand planning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {simulations.map(sim => {
                const isActive = activeSimulationId === sim.id
                return (
                  <div key={sim.id} className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all",
                    isActive
                      ? "bg-purple-50 border-purple-300"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  )}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{sim.name}</span>
                        {isActive && (
                          <Badge className="bg-purple-600">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {sim.queue} • {sim.type} • Created {new Date(sim.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Toggle Switch */}
                      <button
                        onClick={() => handleToggleSimulation(sim)}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2",
                          isActive ? "bg-purple-600" : "bg-slate-300"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            isActive ? "translate-x-6" : "translate-x-1"
                          )}
                        />
                      </button>
                      <span className="text-sm font-medium text-slate-700 min-w-[40px]">
                        {isActive ? "Active" : "Inactive"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditSimulation(sim)}
                        className={cn(
                          editingSimulationId === sim.id && "bg-amber-100 border-amber-400"
                        )}
                      >
                        <Pencil className="w-4 h-4 text-amber-600" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteSimulation(sim.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
