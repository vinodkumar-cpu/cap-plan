import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserMinus, TrendingDown, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Attrition() {
  const {
    forecastData,
    queues,
    weeks,
    attritionData,
    updateAttrition,
    plannedAttrition,
    setPlannedAttrition,
    currentHC
  } = useApp()

  const [selectedQueue, setSelectedQueue] = useState('')
  const [selectedType, setSelectedType] = useState('external')

  if (!forecastData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <Card>
          <CardContent className="p-12 text-center">
            <UserMinus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No Data Loaded</h2>
            <p className="text-slate-500">Upload forecast data from the Dashboard first.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate total HC for percentage calculation
  const getTotalHC = () => {
    let total = 0
    Object.values(currentHC).forEach(hc => {
      total += (hc.internal || 0) + (hc.external || 0)
    })
    return total
  }

  const totalHC = getTotalHC()

  const getAttritionValue = (queue, type, week) => {
    return attritionData[queue]?.[type]?.[week] ?? 0
  }

  // Calculate totals per type
  const calculateTotals = (type) => {
    let total = 0
    queues.forEach(queue => {
      weeks.forEach(week => {
        total += getAttritionValue(queue, type, week)
      })
    })
    // Add planned flat attrition as percentage of total HC
    const plannedPct = plannedAttrition[type] || 0
    total += (totalHC * plannedPct / 100) * weeks.length
    return Math.round(total)
  }

  const allWeeks = Array.from({ length: 52 }, (_, i) => (i + 1).toString())

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Attrition Planning</h1>
        <p className="text-slate-500 mt-1">Configure weekly attrition in HC numbers per queue</p>
      </div>

      {/* Planned Flat Attrition & Summary - Single Line */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Planned Flat Attrition & Summary
          </CardTitle>
          <CardDescription>Weekly attrition as % of total HC ({totalHC}) • Totals across all queues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* External */}
            <div className="flex items-center gap-4 p-4 bg-emerald-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-emerald-700 flex items-center gap-2 mb-2">
                  🌐 External (per week)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={plannedAttrition.external}
                    onChange={(e) => setPlannedAttrition(prev => ({ ...prev, external: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.0"
                    step="0.1"
                    className="w-24"
                  />
                  <span className="text-sm text-slate-500">%</span>
                  <span className="text-xs text-emerald-600 ml-2">
                    ≈ {Math.round(totalHC * (plannedAttrition.external / 100))} HC/week
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-500 mb-1">Total Attrition</span>
                <Badge variant="destructive" className="text-sm px-3 py-1">{calculateTotals('external')} HC</Badge>
              </div>
            </div>

            {/* Internal */}
            <div className="flex items-center gap-4 p-4 bg-violet-50 rounded-lg">
              <div className="flex-1">
                <label className="text-sm font-medium text-violet-700 flex items-center gap-2 mb-2">
                  🏢 Internal (per week)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={plannedAttrition.internal}
                    onChange={(e) => setPlannedAttrition(prev => ({ ...prev, internal: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.0"
                    step="0.1"
                    className="w-24"
                  />
                  <span className="text-sm text-slate-500">%</span>
                  <span className="text-xs text-violet-600 ml-2">
                    ≈ {Math.round(totalHC * (plannedAttrition.internal / 100))} HC/week
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-500 mb-1">Total Attrition</span>
                <Badge variant="destructive" className="text-sm px-3 py-1">{calculateTotals('internal')} HC</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800 text-sm">How it works</h4>
              <p className="text-xs text-amber-700 mt-1">
                Queue-level attrition is entered as HC numbers.
                Planned flat attrition is entered as a percentage of overall HC and is applied weekly across all queues.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Queue-Level Attrition - Single Line Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserMinus className="w-5 h-5 text-red-500" />
                Queue-Level Attrition
              </CardTitle>
              <CardDescription>Weekly attrition in HC numbers per queue</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={selectedQueue} onChange={(e) => setSelectedQueue(e.target.value)} className="w-48">
                <option value="">All Queues</option>
                {queues.map(q => <option key={q} value={q}>{q}</option>)}
              </Select>
              <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-32">
                <option value="external">External</option>
                <option value="internal">Internal</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white z-20 min-w-[120px]">Queue</TableHead>
                      {allWeeks.slice(0, 26).map(week => (
                        <TableHead key={week} className="text-center min-w-[60px]">W{week}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedQueue ? [selectedQueue] : queues).map(queue => (
                      <TableRow key={queue}>
                        <TableCell className="sticky left-0 bg-white font-medium border-r">
                          <div>{queue}</div>
                          <div className="text-xs text-slate-400">
                            {selectedType === 'external' ? '🌐 Ext' : '🏢 Int'}
                          </div>
                        </TableCell>
                        {allWeeks.slice(0, 26).map(week => {
                          const value = getAttritionValue(queue, selectedType, week)
                          return (
                            <TableCell key={week} className="p-1">
                              <Input
                                type="number"
                                value={value || ''}
                                onChange={(e) => updateAttrition(queue, selectedType, week, e.target.value)}
                                className={cn(
                                  "w-full h-8 text-center text-sm",
                                  value > 0 && "bg-amber-50 border-amber-200"
                                )}
                                placeholder="0"
                                min="0"
                              />
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

          {/* Second half of weeks */}
          <div className="mt-4 overflow-x-auto max-h-[600px] overflow-y-auto border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-20 min-w-[120px]">Queue</TableHead>
                  {allWeeks.slice(26).map(week => (
                    <TableHead key={week} className="text-center min-w-[60px]">W{week}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedQueue ? [selectedQueue] : queues).map(queue => (
                  <TableRow key={queue}>
                    <TableCell className="sticky left-0 bg-white font-medium border-r">
                      <div>{queue}</div>
                      <div className="text-xs text-slate-400">
                        {selectedType === 'external' ? '🌐 Ext' : '🏢 Int'}
                      </div>
                    </TableCell>
                    {allWeeks.slice(26).map(week => {
                      const value = getAttritionValue(queue, selectedType, week)
                      return (
                        <TableCell key={week} className="p-1">
                          <Input
                            type="number"
                            value={value || ''}
                            onChange={(e) => updateAttrition(queue, selectedType, week, e.target.value)}
                            className={cn(
                              "w-full h-8 text-center text-sm",
                              value > 0 && "bg-amber-50 border-amber-200"
                            )}
                            placeholder="0"
                            min="0"
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
    </div>
  )
}
