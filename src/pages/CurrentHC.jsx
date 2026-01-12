import { useState, useRef, useMemo, Fragment } from 'react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserCheck, Upload, Download, Plus, Trash2, Edit2, Save, X, TrendingDown } from 'lucide-react'
import { formatNumber, downloadCSV } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function CurrentHC() {
  const {
    forecastData,
    queues,
    weeks,
    currentHC,
    setCurrentHC,
    loadCurrentHC,
    attritionRate
  } = useApp()

  const fileInputRef = useRef(null)
  const [editingKey, setEditingKey] = useState(null)
  const [editValues, setEditValues] = useState({ internal: 0, external: 0 })
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEntry, setNewEntry] = useState({ queue: '', timezone: '', site: '', internal: '', external: '' })
  const [viewMode, setViewMode] = useState('summary') // 'summary' or 'weekly'
  const [displayWeeks, setDisplayWeeks] = useState(12)
  const [projectionView, setProjectionView] = useState('total') // 'total' or 'queue'

  // Get all queue-timezone-site combinations from currentHC data
  const queueTimezones = useMemo(() => {
    return Object.keys(currentHC).map(key => {
      const parts = key.split('-')
      // Handle both old format (queue-timezone) and new format (queue-timezone-site)
      if (parts.length === 3) {
        return {
          queue: parts[0],
          timezone: parts[1],
          site: parts[2],
          key: key
        }
      } else {
        return {
          queue: parts[0],
          timezone: parts[1],
          site: 'N/A',
          key: key
        }
      }
    })
  }, [currentHC])

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => loadCurrentHC(e.target.result)
      reader.readAsText(file)
    }
  }

  const handleDownloadTemplate = () => {
    let csv = 'queue,timezone,site,internal,external\n'
    // Generate template with common sites
    const commonSites = ['Manila', 'Bangalore', 'Austin', 'Remote']
    if (queueTimezones.length > 0) {
      queueTimezones.forEach(qt => {
        csv += `${qt.queue},${qt.timezone},${qt.site !== 'N/A' ? qt.site : 'Manila'},0,0\n`
      })
    } else {
      // If no current HC data, generate sample template
      csv += 'Queue1,CENTRAL,Manila,0,0\n'
      csv += 'Queue1,EAST,Bangalore,0,0\n'
    }
    downloadCSV(csv, 'current-hc-template.csv')
  }

  const handleStartEdit = (key) => {
    setEditingKey(key)
    setEditValues({
      internal: currentHC[key]?.internal || 0,
      external: currentHC[key]?.external || 0
    })
  }

  const handleSaveEdit = () => {
    if (editingKey) {
      setCurrentHC(prev => ({
        ...prev,
        [editingKey]: {
          internal: parseInt(editValues.internal) || 0,
          external: parseInt(editValues.external) || 0
        }
      }))
      setEditingKey(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingKey(null)
  }

  const handleAddEntry = () => {
    if (newEntry.queue && newEntry.timezone && newEntry.site) {
      const key = `${newEntry.queue}-${newEntry.timezone}-${newEntry.site}`
      setCurrentHC(prev => ({
        ...prev,
        [key]: {
          internal: parseInt(newEntry.internal) || 0,
          external: parseInt(newEntry.external) || 0
        }
      }))
      setNewEntry({ queue: '', timezone: '', site: '', internal: '', external: '' })
      setShowAddForm(false)
    }
  }

  const handleDeleteEntry = (key) => {
    setCurrentHC(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
  }

  // Calculate HC with compound attrition for a given week
  const calculateHCWithAttrition = (startingHC, type, weekNumber) => {
    const weeklyAttritionRate = attritionRate[type] / 100
    let currentHC = startingHC
    for (let i = 1; i < weekNumber; i++) {
      currentHC = currentHC * (1 - weeklyAttritionRate)
    }
    return currentHC
  }

  // Calculate weekly HC projection with attrition for all queues
  const weeklyProjections = useMemo(() => {
    const projections = { internal: [], external: [], combined: [], byQueue: {} }

    const displayWeeksList = weeks.slice(0, displayWeeks)

    displayWeeksList.forEach((week, idx) => {
      const weekNum = idx + 1

      let totalInternal = 0
      let totalExternal = 0

      queueTimezones.forEach(qt => {
        const hc = currentHC[qt.key] || { internal: 0, external: 0 }
        const internalHC = calculateHCWithAttrition(hc.internal, 'internal', weekNum)
        const externalHC = calculateHCWithAttrition(hc.external, 'external', weekNum)

        totalInternal += internalHC
        totalExternal += externalHC

        // Track by queue for queue-level view
        if (!projections.byQueue[qt.key]) {
          projections.byQueue[qt.key] = { internal: [], external: [], combined: [], queue: qt.queue, timezone: qt.timezone, site: qt.site }
        }
        projections.byQueue[qt.key].internal.push(internalHC)
        projections.byQueue[qt.key].external.push(externalHC)
        projections.byQueue[qt.key].combined.push(internalHC + externalHC)
      })

      projections.internal.push(totalInternal)
      projections.external.push(totalExternal)
      projections.combined.push(totalInternal + totalExternal)
    })

    return projections
  }, [currentHC, queueTimezones, weeks, displayWeeks, attritionRate])

  const totals = Object.values(currentHC).reduce(
    (acc, hc) => ({
      internal: acc.internal + (hc.internal || 0),
      external: acc.external + (hc.external || 0)
    }),
    { internal: 0, external: 0 }
  )

  if (!forecastData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <Card>
          <CardContent className="p-12 text-center">
            <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
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
          <h1 className="text-2xl font-bold text-slate-800">Current Headcount</h1>
          <p className="text-slate-500 mt-1">Manage actual headcount per queue</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Template
          </Button>
          <input type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white border-0">
          <CardContent className="p-4">
            <div className="text-sm opacity-80 mb-1">Total External HC</div>
            <div className="text-3xl font-bold">{formatNumber(totals.external)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0">
          <CardContent className="p-4">
            <div className="text-sm opacity-80 mb-1">Total Internal HC</div>
            <div className="text-3xl font-bold">{formatNumber(totals.internal)}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white border-0">
          <CardContent className="p-4">
            <div className="text-sm opacity-80 mb-1">Combined HC</div>
            <div className="text-3xl font-bold">{formatNumber(totals.external + totals.internal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Toggle */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Headcount View</CardTitle>
              <CardDescription>View current HC or week-over-week projections with attrition</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'summary' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('summary')}
              >
                Summary View
              </Button>
              <Button
                variant={viewMode === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('weekly')}
              >
                Weekly Projection
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary View - Current HC by Queue */}
      {viewMode === 'summary' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-700" />
                  Headcount by Queue
                </CardTitle>
                <CardDescription>Current headcount allocation per queue and type</CardDescription>
              </div>
            <Button onClick={() => setShowAddForm(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <div className="mb-4 p-4 bg-slate-50 rounded-lg border">
              <h4 className="font-medium mb-3">Add New Entry</h4>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                <Select value={newEntry.queue} onChange={(e) => setNewEntry(prev => ({ ...prev, queue: e.target.value }))}>
                  <option value="">Select Queue</option>
                  {queues.map(q => <option key={q} value={q}>{q}</option>)}
                </Select>
                <Select value={newEntry.timezone} onChange={(e) => setNewEntry(prev => ({ ...prev, timezone: e.target.value }))}>
                  <option value="">Select Timezone</option>
                  <option value="CENTRAL">CENTRAL</option>
                  <option value="EAST">EAST</option>
                  <option value="WEST">WEST</option>
                </Select>
                <Select value={newEntry.site} onChange={(e) => setNewEntry(prev => ({ ...prev, site: e.target.value }))}>
                  <option value="">Select Site</option>
                  <option value="Manila">Manila</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Austin">Austin</option>
                  <option value="Remote">Remote</option>
                  <option value="Other">Other</option>
                </Select>
                <Input type="number" placeholder="Internal HC" value={newEntry.internal} onChange={(e) => setNewEntry(prev => ({ ...prev, internal: e.target.value }))} />
                <Input type="number" placeholder="External HC" value={newEntry.external} onChange={(e) => setNewEntry(prev => ({ ...prev, external: e.target.value }))} />
                <div className="flex gap-2">
                  <Button onClick={handleAddEntry} className="flex-1"><Save className="w-4 h-4 mr-1" /> Save</Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Queue</TableHead>
                  <TableHead className="min-w-[100px]">Timezone</TableHead>
                  <TableHead className="min-w-[100px]">Site</TableHead>
                  <TableHead className="text-center"><Badge variant="info">🏢 Internal</Badge></TableHead>
                  <TableHead className="text-center"><Badge variant="success">🌐 External</Badge></TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queueTimezones.map(qt => {
                  const hc = currentHC[qt.key] || { internal: 0, external: 0 }
                  const isEditing = editingKey === qt.key
                  return (
                    <TableRow key={qt.key}>
                      <TableCell className="font-medium">{qt.queue}</TableCell>
                      <TableCell>
                        <span className="text-slate-600 text-sm">{qt.timezone}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{qt.site}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input type="number" value={editValues.internal} onChange={(e) => setEditValues(prev => ({ ...prev, internal: e.target.value }))} className="w-24 mx-auto text-center" />
                        ) : (
                          <span className={cn("font-semibold", hc.internal > 0 ? "text-slate-700" : "text-slate-400")}>{formatNumber(hc.internal)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Input type="number" value={editValues.external} onChange={(e) => setEditValues(prev => ({ ...prev, external: e.target.value }))} className="w-24 mx-auto text-center" />
                        ) : (
                          <span className={cn("font-semibold", hc.external > 0 ? "text-emerald-700" : "text-slate-400")}>{formatNumber(hc.external)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold">{formatNumber(hc.internal + hc.external)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          {isEditing ? (
                            <Fragment key="editing">
                              <Button size="sm" variant="ghost" onClick={handleSaveEdit}><Save className="w-4 h-4 text-emerald-700" /></Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelEdit}><X className="w-4 h-4 text-slate-400" /></Button>
                            </Fragment>
                          ) : (
                            <Fragment key="actions">
                              <Button size="sm" variant="ghost" onClick={() => handleStartEdit(qt.key)}><Edit2 className="w-4 h-4 text-slate-400" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDeleteEntry(qt.key)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                            </Fragment>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                <TableRow className="bg-slate-50 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell className="text-center text-slate-700">{formatNumber(totals.internal)}</TableCell>
                  <TableCell className="text-center text-emerald-700">{formatNumber(totals.external)}</TableCell>
                  <TableCell className="text-center">{formatNumber(totals.internal + totals.external)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Weekly Projection View - HC with Attrition */}
      {viewMode === 'weekly' && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-emerald-700" />
                  Weekly HC Projection with Attrition
                </CardTitle>
                <CardDescription>
                  Declining headcount over time with {attritionRate.external}% (Ext) and {attritionRate.internal}% (Int) weekly attrition
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select
                  value={projectionView}
                  onChange={(e) => setProjectionView(e.target.value)}
                  className="w-32"
                >
                  <option value="total">Total View</option>
                  <option value="queue">Queue View</option>
                </Select>
                <Select
                  value={displayWeeks.toString()}
                  onChange={(e) => setDisplayWeeks(parseInt(e.target.value))}
                  className="w-32"
                >
                  <option value="12">12 Weeks</option>
                  <option value="26">26 Weeks</option>
                  <option value="52">52 Weeks</option>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {projectionView === 'total' ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-50">
                      <TableHead className="sticky left-0 z-10 border-r-2 border-slate-300 bg-emerald-50">
                        Week
                      </TableHead>
                      {weeks.slice(0, displayWeeks).map(week => (
                        <TableHead key={week} className="text-center min-w-[80px] border-r border-slate-200">
                          W{week}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-emerald-50">
                      <TableCell className="sticky left-0 z-10 font-semibold border-r-2 border-slate-300 bg-emerald-50">
                        <div className="flex items-center gap-2">
                          <Badge variant="success">🌐 External HC</Badge>
                        </div>
                      </TableCell>
                      {weeklyProjections.external.map((hc, idx) => (
                        <TableCell key={idx} className="text-center text-sm text-emerald-700 border-r border-slate-200">
                          {formatNumber(hc, 1)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-slate-50">
                      <TableCell className="sticky left-0 z-10 font-semibold border-r-2 border-slate-300 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Badge variant="info">🏢 Internal HC</Badge>
                        </div>
                      </TableCell>
                      {weeklyProjections.internal.map((hc, idx) => (
                        <TableCell key={idx} className="text-center text-sm text-slate-700 border-r border-slate-200">
                          {formatNumber(hc, 1)}
                        </TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-slate-50 font-bold">
                      <TableCell className="sticky left-0 z-10 border-r-2 border-slate-300 bg-slate-50">
                        Total HC
                      </TableCell>
                      {weeklyProjections.combined.map((hc, idx) => (
                        <TableCell key={idx} className="text-center text-sm border-r border-slate-200">
                          {formatNumber(hc, 1)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-50">
                      <TableHead className="sticky left-0 z-10 border-r-2 border-slate-300 min-w-[200px] bg-emerald-50">
                        Queue / Site
                      </TableHead>
                      <TableHead className="border-r-2 border-slate-300 text-center min-w-[60px] bg-emerald-50">
                        Type
                      </TableHead>
                      {weeks.slice(0, displayWeeks).map(week => (
                        <TableHead key={week} className="text-center min-w-[70px] border-r border-slate-200">
                          W{week}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.values(weeklyProjections.byQueue).map((queueData, idx) => (
                      <Fragment key={`${queueData.queue}-${queueData.site}-${idx}`}>
                        <TableRow key={`${queueData.queue}-ext-${idx}`} className="bg-emerald-50">
                          <TableCell className="sticky left-0 z-10 border-r-2 border-slate-300 bg-emerald-50">
                            <div className="font-medium text-sm">{queueData.queue}</div>
                            <div className="text-xs text-slate-500">{queueData.site} • {queueData.timezone}</div>
                          </TableCell>
                          <TableCell className="border-r-2 border-slate-300 text-center bg-emerald-50">
                            <Badge variant="success" className="text-xs">Ext</Badge>
                          </TableCell>
                          {queueData.external.map((hc, wIdx) => (
                            <TableCell key={wIdx} className="text-center text-xs text-emerald-700 border-r border-slate-200">
                              {formatNumber(hc, 1)}
                            </TableCell>
                          ))}
                        </TableRow>
                        <TableRow key={`${queueData.queue}-int-${idx}`} className="bg-slate-50">
                          <TableCell className="sticky left-0 z-10 border-r-2 border-slate-300 bg-slate-50">
                            <div className="font-medium text-sm">{queueData.queue}</div>
                            <div className="text-xs text-slate-500">{queueData.site} • {queueData.timezone}</div>
                          </TableCell>
                          <TableCell className="border-r-2 border-slate-300 text-center bg-slate-50">
                            <Badge variant="info" className="text-xs">Int</Badge>
                          </TableCell>
                          {queueData.internal.map((hc, wIdx) => (
                            <TableCell key={wIdx} className="text-center text-xs text-slate-700 border-r border-slate-200">
                              {formatNumber(hc, 1)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </Fragment>
                    ))}
                    <TableRow className="bg-slate-50 font-bold">
                      <TableCell className="sticky left-0 z-10 border-r-2 border-slate-300 bg-slate-50">
                        Total HC
                      </TableCell>
                      <TableCell className="border-r-2 border-slate-300 bg-slate-50">-</TableCell>
                      {weeklyProjections.combined.map((hc, idx) => (
                        <TableCell key={idx} className="text-center text-sm border-r border-slate-200">
                          {formatNumber(hc, 1)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> HC decreases compound weekly. For example, if starting with 100 HC at 0.3% attrition:
                Week 1 = 100, Week 2 = 100 × 0.997 = 99.7, Week 3 = 99.7 × 0.997 = 99.4, and so on.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
