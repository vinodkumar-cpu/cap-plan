import { useState } from 'react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, Plus, Trash2, TrendingUp, GraduationCap, ArrowUpCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Batches() {
  const { forecastData, queues, weeks, batches, addBatch, updateBatch, deleteBatch } = useApp()
  
  const [newBatch, setNewBatch] = useState({
    name: '',
    queue: '',
    type: 'external',
    batchType: 'new', // 'new' or 'upskilling'
    timezone: 'CENTRAL', // Add timezone field
    site: '',
    startWeek: '',
    hcCount: '',
    trainingDuration: '4',
    rampGranularity: 'month', // 'month' or 'week'
    rampWeeks: '4',
    rampCurve: [25, 50, 75, 100]
  })

  if (!forecastData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No Data Loaded</h2>
            <p className="text-slate-500">Upload forecast data from the Dashboard first.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleAddBatch = () => {
    if (newBatch.name && newBatch.queue && newBatch.startWeek && newBatch.hcCount) {
      addBatch({
        ...newBatch,
        hcCount: parseInt(newBatch.hcCount),
        trainingDuration: parseInt(newBatch.trainingDuration),
        rampWeeks: parseInt(newBatch.rampWeeks)
      })
      setNewBatch({
        name: '',
        queue: '',
        type: 'external',
        batchType: 'new',
        timezone: 'CENTRAL',
        site: '',
        startWeek: '',
        hcCount: '',
        trainingDuration: '4',
        rampGranularity: 'month',
        rampWeeks: '4',
        rampCurve: [25, 50, 75, 100]
      })
    }
  }

  const handleRampChange = (index, value) => {
    const newCurve = [...newBatch.rampCurve]
    newCurve[index] = parseInt(value) || 0
    setNewBatch(prev => ({ ...prev, rampCurve: newCurve }))
  }

  const handleRampWeeksChange = (value) => {
    const w = parseInt(value)
    const granularity = newBatch.rampGranularity

    // Week-level curves (for upskilling)
    const weekCurves = {
      2: [50, 100],
      3: [33, 66, 100],
      4: [25, 50, 75, 100],
      6: [17, 33, 50, 67, 83, 100],
      8: [12, 25, 37, 50, 62, 75, 87, 100]
    }

    // Month-level curves (for new hires)
    const monthCurves = {
      2: [50, 100],
      3: [33, 66, 100],
      4: [25, 50, 75, 100],
      6: [17, 33, 50, 67, 83, 100]
    }

    const curves = granularity === 'month' ? monthCurves : weekCurves

    setNewBatch(prev => ({
      ...prev,
      rampWeeks: value,
      rampCurve: curves[w] || [25, 50, 75, 100]
    }))
  }

  const handleRampGranularityChange = (value) => {
    const w = parseInt(newBatch.rampWeeks)

    // Default curves based on granularity
    const weekCurves = {
      2: [50, 100],
      3: [33, 66, 100],
      4: [25, 50, 75, 100],
      6: [17, 33, 50, 67, 83, 100],
      8: [12, 25, 37, 50, 62, 75, 87, 100]
    }

    const monthCurves = {
      2: [50, 100],
      3: [33, 66, 100],
      4: [25, 50, 75, 100],
      6: [17, 33, 50, 67, 83, 100]
    }

    const curves = value === 'month' ? monthCurves : weekCurves

    setNewBatch(prev => ({
      ...prev,
      rampGranularity: value,
      rampCurve: curves[w] || [25, 50, 75, 100]
    }))
  }

  // Calculate totals
  const totalNewHC = batches.filter(b => b.batchType === 'new').reduce((sum, b) => sum + b.hcCount, 0)
  const totalUpskillHC = batches.filter(b => b.batchType === 'upskilling').reduce((sum, b) => sum + b.hcCount, 0)

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Batch Planning</h1>
        <p className="text-slate-500 mt-1">Plan new hire and upskilling batches with training and ramp curves</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <Plus className="w-4 h-4" />
              <span className="text-sm">New Hire HC</span>
            </div>
            <div className="text-3xl font-bold">{totalNewHC}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <ArrowUpCircle className="w-4 h-4" />
              <span className="text-sm">Upskilling HC</span>
            </div>
            <div className="text-3xl font-bold">{totalUpskillHC}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2 opacity-80">
              <Users className="w-4 h-4" />
              <span className="text-sm">Total Batches</span>
            </div>
            <div className="text-3xl font-bold">{batches.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Add Batch Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" />
                Add New Batch
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Batch Name (e.g., Jan 2024 Cohort)"
                value={newBatch.name}
                onChange={(e) => setNewBatch(prev => ({ ...prev, name: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={newBatch.batchType}
                  onChange={(e) => setNewBatch(prev => ({
                    ...prev,
                    batchType: e.target.value,
                    // Auto-set granularity to week for upskilling
                    rampGranularity: e.target.value === 'upskilling' ? 'week' : prev.rampGranularity
                  }))}
                >
                  <option value="new">🆕 New Hire</option>
                  <option value="upskilling">⬆️ Upskilling</option>
                </Select>
                <Select
                  value={newBatch.queue}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, queue: e.target.value }))}
                >
                  <option value="">Select Queue</option>
                  {queues.map(q => <option key={q} value={q}>{q}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={newBatch.type}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, type: e.target.value }))}
                >
                  <option value="external">🌐 External</option>
                  <option value="internal">🏢 Internal</option>
                </Select>
                <Select
                  value={newBatch.timezone}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, timezone: e.target.value }))}
                >
                  <option value="CENTRAL">CENTRAL</option>
                  <option value="EAST">EAST</option>
                  <option value="WEST">WEST</option>
                </Select>
              </div>

              <Select
                value={newBatch.startWeek}
                onChange={(e) => setNewBatch(prev => ({ ...prev, startWeek: e.target.value }))}
              >
                <option value="">Start Week</option>
                {Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
                  <option key={w} value={w}>Week {w}</option>
                ))}
              </Select>

              <Input
                placeholder="Site (e.g., Manila, US)"
                value={newBatch.site}
                onChange={(e) => setNewBatch(prev => ({ ...prev, site: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">HC Count</label>
                  <Input
                    type="number"
                    placeholder="20"
                    value={newBatch.hcCount}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, hcCount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Training (weeks)</label>
                  <Input
                    type="number"
                    placeholder="4"
                    value={newBatch.trainingDuration}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, trainingDuration: e.target.value }))}
                  />
                </div>
              </div>

              {/* Ramp Granularity - only show for new hire batches */}
              {newBatch.batchType === 'new' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Ramp Granularity</label>
                  <Select
                    value={newBatch.rampGranularity}
                    onChange={(e) => handleRampGranularityChange(e.target.value)}
                  >
                    <option value="month">📅 Month Level</option>
                    <option value="week">📊 Week Level</option>
                  </Select>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Ramp Period</label>
                <Select
                  value={newBatch.rampWeeks}
                  onChange={(e) => handleRampWeeksChange(e.target.value)}
                >
                  {newBatch.rampGranularity === 'month' ? (
                    <>
                      <option value="2">2 Month Ramp</option>
                      <option value="3">3 Month Ramp</option>
                      <option value="4">4 Month Ramp</option>
                      <option value="6">6 Month Ramp</option>
                    </>
                  ) : (
                    <>
                      <option value="2">2 Week Ramp</option>
                      <option value="3">3 Week Ramp</option>
                      <option value="4">4 Week Ramp</option>
                      <option value="6">6 Week Ramp</option>
                      <option value="8">8 Week Ramp</option>
                    </>
                  )}
                </Select>
              </div>

              {/* Ramp Curve */}
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-sm font-medium mb-2">Ramp Curve (% productivity)</div>
                <div className="grid grid-cols-4 gap-2">
                  {newBatch.rampCurve.map((pct, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xs text-slate-500 mb-1">
                        {newBatch.rampGranularity === 'month' ? `M${i + 1}` : `W${i + 1}`}
                      </div>
                      <Input
                        type="number"
                        value={pct}
                        onChange={(e) => handleRampChange(i, e.target.value)}
                        className="h-8 text-center text-sm"
                        min="0"
                        max="100"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleAddBatch} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Batch
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800 text-sm">How Capacity is Calculated</h4>
                  <p className="text-xs text-blue-700 mt-1">
                    During training period, HC is counted as "Training" (not productive).
                    After training, HC ramps up based on the ramp curve percentages.
                    For new hires, ramp can be month-level (spread across months) or week-level.
                    For upskilling, ramp remains week-level.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Batches List */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Planned Batches
              </CardTitle>
              <CardDescription>All batches with their training and ramp schedules</CardDescription>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>No batches planned yet. Add your first batch!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Queue</TableHead>
                        <TableHead>Timezone</TableHead>
                        <TableHead>Site</TableHead>
                        <TableHead className="text-center">Start</TableHead>
                        <TableHead className="text-center">HC</TableHead>
                        <TableHead className="text-center">Training</TableHead>
                        <TableHead className="text-center">Ramp</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map(batch => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">
                            <div>{batch.name}</div>
                            <Badge
                              variant={batch.batchType === 'new' ? 'success' : 'info'}
                              className="mt-1"
                            >
                              {batch.batchType === 'new' ? '🆕 New' : '⬆️ Upskill'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={batch.type === 'external' ? 'success' : 'secondary'}>
                              {batch.type === 'external' ? '🌐' : '🏢'}
                            </Badge>
                          </TableCell>
                          <TableCell>{batch.queue}</TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-600">{batch.timezone || 'CENTRAL'}</span>
                          </TableCell>
                          <TableCell>{batch.site || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">W{batch.startWeek}</Badge>
                          </TableCell>
                          <TableCell className="text-center font-semibold text-emerald-600">
                            {batch.hcCount}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <GraduationCap className="w-4 h-4 text-amber-500" />
                              <span>{batch.trainingDuration}w</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-xs text-slate-500">
                              {batch.rampWeeks}{batch.rampGranularity === 'month' ? 'm' : 'w'}
                              <div className="text-xs text-slate-400">
                                {batch.rampCurve.join('→')}%
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteBatch(batch.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
