import { useState, useRef, useEffect } from 'react'
import { useApp } from '@/context/AppContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Settings, Globe, Building2, Percent, Upload, Download } from 'lucide-react'
import { downloadCSV } from '@/lib/utils'

export default function Assumptions() {
  const {
    forecastData, queues, weeks,
    globalSplit, updateGlobalSplit,
    queueSplits, getQueueSplit, updateQueueSplit, resetQueueSplit,
    baseAssumptions, setBaseAssumptions,
    weeklyNPT, getNPT, updateNPT, setWeeklyNPT,
    weeklyShrinkage, getShrinkage, updateShrinkage, setWeeklyShrinkage,
    weeklyOccupancy, getOccupancy, updateOccupancy, setWeeklyOccupancy,
    weeklyAHT, updateAHT, loadWeeklyAHT,
    bufferHC, setBufferHC,
    queueBuffers, getQueueBuffer, updateQueueBuffer, resetQueueBuffer
  } = useApp()

  const [selectedType, setSelectedType] = useState('external')
  const fileInputRef = useRef(null)
  const assumptionsFileInputRef = useRef(null)

  // Debug: Monitor weeklyAHT changes
  useEffect(() => {
    console.log('[Assumptions] weeklyAHT state updated:', weeklyAHT)
    console.log('[Assumptions] Number of queues with AHT data:', Object.keys(weeklyAHT).length)
    if (Object.keys(weeklyAHT).length > 0) {
      const firstQueue = Object.keys(weeklyAHT)[0]
      console.log(`[Assumptions] Sample AHT data for queue "${firstQueue}":`, weeklyAHT[firstQueue])
    }
  }, [weeklyAHT])

  if (!forecastData) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Settings className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No Data Loaded</h2>
            <p className="text-slate-500">Upload forecast data from the Dashboard to configure assumptions.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleBaseAssumptionChange = (type, field, value) => {
    setBaseAssumptions(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: parseFloat(value) || 0 }
    }))
  }

  const handleFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        console.log('[Assumptions] File loaded, calling loadWeeklyAHT')
        console.log('[Assumptions] Current weeklyAHT BEFORE upload:', weeklyAHT)
        loadWeeklyAHT(e.target.result)
        // Note: weeklyAHT here will be stale due to async state updates
        // Check the useEffect logs to see the updated state
        console.log('[Assumptions] loadWeeklyAHT called (state will update asynchronously)')
      }
      reader.readAsText(file)
    }
  }

  const handleAssumptionsFileUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const csvText = e.target.result
        const cleanedText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
        const lines = cleanedText.split('\n').filter(line => line.trim() !== '')

        if (lines.length === 0) return

        const headers = lines[0].split(',').map(h => h.trim())
        const typeIdx = headers.findIndex(h => h.toLowerCase() === 'type')
        const metricIdx = headers.findIndex(h => h.toLowerCase() === 'metric')

        const weekColumns = []
        headers.forEach((header, idx) => {
          const weekNum = parseInt(header)
          if (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 52) {
            weekColumns.push({ week: header, colIdx: idx })
          }
        })

        const nptData = { internal: {}, external: {} }
        const shrinkageData = { internal: {}, external: {} }
        const occupancyData = { internal: {}, external: {} }

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          const type = values[typeIdx]?.toLowerCase()
          const metric = values[metricIdx]?.toLowerCase()

          if (type && (type === 'internal' || type === 'external')) {
            weekColumns.forEach(({ week, colIdx }) => {
              const value = parseFloat(values[colIdx])
              if (!isNaN(value) && value >= 0) {
                if (metric === 'npt') {
                  nptData[type][week] = value
                } else if (metric === 'shrinkage') {
                  shrinkageData[type][week] = value
                } else if (metric === 'occupancy') {
                  occupancyData[type][week] = value
                }
              }
            })
          }
        }

        // Update state directly for all three metrics
        setWeeklyNPT(prev => ({
          internal: { ...prev.internal, ...nptData.internal },
          external: { ...prev.external, ...nptData.external }
        }))
        setWeeklyShrinkage(prev => ({
          internal: { ...prev.internal, ...shrinkageData.internal },
          external: { ...prev.external, ...shrinkageData.external }
        }))
        setWeeklyOccupancy(prev => ({
          internal: { ...prev.internal, ...occupancyData.internal },
          external: { ...prev.external, ...occupancyData.external }
        }))
      }
      reader.readAsText(file)
    }
  }

  const handleDownloadAssumptionsTemplate = () => {
    // Create CSV with type, metric, and week columns
    let csv = 'type,metric'
    weeks.forEach(week => {
      csv += `,${week}`
    })
    csv += '\n'

    // Add internal NPT row
    csv += 'internal,NPT'
    weeks.forEach(week => {
      const currentNPT = weeklyNPT.internal?.[week]
      csv += `,${currentNPT !== undefined ? currentNPT : ''}`
    })
    csv += '\n'

    // Add internal Shrinkage row
    csv += 'internal,Shrinkage'
    weeks.forEach(week => {
      const currentShrinkage = weeklyShrinkage.internal?.[week]
      csv += `,${currentShrinkage !== undefined ? currentShrinkage : ''}`
    })
    csv += '\n'

    // Add internal Occupancy row
    csv += 'internal,Occupancy'
    weeks.forEach(week => {
      const currentOccupancy = weeklyOccupancy.internal?.[week]
      csv += `,${currentOccupancy !== undefined ? currentOccupancy : ''}`
    })
    csv += '\n'

    // Add external NPT row
    csv += 'external,NPT'
    weeks.forEach(week => {
      const currentNPT = weeklyNPT.external?.[week]
      csv += `,${currentNPT !== undefined ? currentNPT : ''}`
    })
    csv += '\n'

    // Add external Shrinkage row
    csv += 'external,Shrinkage'
    weeks.forEach(week => {
      const currentShrinkage = weeklyShrinkage.external?.[week]
      csv += `,${currentShrinkage !== undefined ? currentShrinkage : ''}`
    })
    csv += '\n'

    // Add external Occupancy row
    csv += 'external,Occupancy'
    weeks.forEach(week => {
      const currentOccupancy = weeklyOccupancy.external?.[week]
      csv += `,${currentOccupancy !== undefined ? currentOccupancy : ''}`
    })
    csv += '\n'

    downloadCSV(csv, 'weekly-assumptions-template.csv')
  }

  const handleDownloadTemplate = () => {
    // Create CSV with queue, type, and week columns
    let csv = 'queue,type'

    // Add week headers
    weeks.forEach(week => {
      csv += `,${week}`
    })
    csv += '\n'

    // Add all internal rows first
    queues.forEach(queue => {
      csv += `${queue},internal`
      weeks.forEach(week => {
        const currentAHT = weeklyAHT[queue]?.internal?.[week]
        // Leave empty if no AHT data exists (user needs to provide values)
        csv += `,${currentAHT !== undefined ? currentAHT : ''}`
      })
      csv += '\n'
    })

    // Then add all external rows
    queues.forEach(queue => {
      csv += `${queue},external`
      weeks.forEach(week => {
        const currentAHT = weeklyAHT[queue]?.external?.[week]
        // Leave empty if no AHT data exists (user needs to provide values)
        csv += `,${currentAHT !== undefined ? currentAHT : ''}`
      })
      csv += '\n'
    })

    downloadCSV(csv, 'aht-template.csv')
  }

  const handleDownloadMonthlyTemplate = () => {
    // Create CSV with queue, type, and month columns (Jan-Dec)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let csv = 'queue,type'

    // Add month headers
    monthNames.forEach(month => {
      csv += `,${month}`
    })
    csv += '\n'

    console.log('Generated CSV header:', csv.split('\n')[0])
    console.log('Header parts:', csv.split('\n')[0].split(','))

    // Helper to get average AHT for a month from weekly data
    const getMonthlyAHTAverage = (queue, type, monthNum) => {
      const monthToWeeksMap = {
        1: [1, 2, 3, 4],           // January
        2: [5, 6, 7, 8],           // February
        3: [9, 10, 11, 12, 13],    // March (5 weeks)
        4: [14, 15, 16, 17],       // April
        5: [18, 19, 20, 21],       // May
        6: [22, 23, 24, 25, 26],   // June (5 weeks)
        7: [27, 28, 29, 30],       // July
        8: [31, 32, 33, 34],       // August
        9: [35, 36, 37, 38, 39],   // September (5 weeks)
        10: [40, 41, 42, 43],      // October
        11: [44, 45, 46, 47],      // November
        12: [48, 49, 50, 51, 52]   // December (5 weeks)
      }

      const weeksInMonth = monthToWeeksMap[monthNum]
      const ahtValues = weeksInMonth
        .map(week => weeklyAHT[queue]?.[type]?.[week.toString()])
        .filter(val => val !== undefined && val !== null)

      if (ahtValues.length > 0) {
        const sum = ahtValues.reduce((acc, val) => acc + val, 0)
        return (sum / ahtValues.length).toFixed(2)
      }

      // Return empty if no data (user needs to provide values)
      return ''
    }

    // Add all internal rows first
    queues.forEach(queue => {
      csv += `${queue},internal`
      monthNames.forEach((_, idx) => {
        const monthNum = idx + 1
        const avgAHT = getMonthlyAHTAverage(queue, 'internal', monthNum)
        csv += `,${avgAHT}`
      })
      csv += '\n'
    })

    // Then add all external rows
    queues.forEach(queue => {
      csv += `${queue},external`
      monthNames.forEach((_, idx) => {
        const monthNum = idx + 1
        const avgAHT = getMonthlyAHTAverage(queue, 'external', monthNum)
        csv += `,${avgAHT}`
      })
      csv += '\n'
    })

    console.log('Complete CSV (first 500 chars):', csv.substring(0, 500))
    console.log('Total CSV length:', csv.length)
    console.log('Number of lines:', csv.split('\n').length)

    downloadCSV(csv, 'aht-monthly-template.csv')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Assumptions</h1>
        <p className="text-slate-500 mt-1">Configure global settings and weekly AHT per queue</p>
      </div>

      {/* Top Row - 3 Cards in One Line */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Buffer HC */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Buffer HC</CardTitle>
            <CardDescription className="text-xs">Additional buffer %</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={bufferHC}
                  onChange={(e) => setBufferHC(parseFloat(e.target.value) || 0)}
                  className="h-8 flex-1"
                  min="0"
                  max="100"
                />
                <span className="text-slate-500 text-sm">%</span>
              </div>
              <Badge variant="success" className="w-full justify-center">{bufferHC}% buffer</Badge>
            </div>
          </CardContent>
        </Card>

        {/* External Assumptions */}
        <Card>
          <CardHeader className="bg-emerald-50 rounded-t-xl pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-700" />
              External
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {[
              { key: 'npt', label: 'NPT %' },
              { key: 'shrinkage', label: 'Shrinkage %' },
              { key: 'occupancy', label: 'Occupancy %' }
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">{label}</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={baseAssumptions.external[key]}
                    onChange={(e) => handleBaseAssumptionChange('external', key, e.target.value)}
                    className="w-16 h-7 text-right text-xs"
                  />
                  <Percent className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Internal Assumptions */}
        <Card>
          <CardHeader className="bg-slate-50 rounded-t-xl pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-700" />
              Internal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {[
              { key: 'npt', label: 'NPT %' },
              { key: 'shrinkage', label: 'Shrinkage %' },
              { key: 'occupancy', label: 'Occupancy %' }
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700">{label}</label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={baseAssumptions.internal[key]}
                    onChange={(e) => handleBaseAssumptionChange('internal', key, e.target.value)}
                    className="w-16 h-7 text-right text-xs"
                  />
                  <Percent className="w-3 h-3 text-slate-400" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Queue-Level Split Settings */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Queue Split (Internal vs External)</CardTitle>
              <CardDescription>Set the internal/external split percentage for each queue. Uses global default ({globalSplit.external}% External / {globalSplit.internal}% Internal) if not customized.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {queues.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No queues available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Queue</TableHead>
                    <TableHead className="text-center w-40">
                      <div className="flex items-center justify-center gap-1">
                        <Globe className="w-4 h-4" style={{ color: '#163300' }} />
                        <span>External %</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-40">
                      <div className="flex items-center justify-center gap-1">
                        <Building2 className="w-4 h-4 text-violet-500" />
                        <span>Internal %</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-32">Total</TableHead>
                    <TableHead className="w-32">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.map(queue => {
                    const split = getQueueSplit(queue)
                    const isCustom = queueSplits[queue] !== undefined
                    return (
                      <TableRow key={queue}>
                        <TableCell className="font-medium">
                          {queue}
                          {!isCustom && <Badge variant="outline" className="ml-2 text-xs">Default</Badge>}
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={split.external}
                            onChange={(e) => updateQueueSplit(queue, 'external', e.target.value)}
                            min="0"
                            max="100"
                            className="h-8 text-center"
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            value={split.internal}
                            onChange={(e) => updateQueueSplit(queue, 'internal', e.target.value)}
                            min="0"
                            max="100"
                            className="h-8 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={split.external + split.internal === 100 ? 'success' : 'destructive'}>
                            {split.external + split.internal}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {isCustom && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resetQueueSplit(queue)}
                              className="h-7 text-xs"
                            >
                              Reset
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Queue-Level Buffer Settings */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Queue Buffer HC (%)</CardTitle>
              <CardDescription>Set the buffer percentage for each queue. Uses global default ({bufferHC}%) if not customized.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {queues.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No queues available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-64">Queue</TableHead>
                    <TableHead className="text-center w-48">
                      <div className="flex items-center justify-center gap-1">
                        <Percent className="w-4 h-4" />
                        <span>Buffer %</span>
                      </div>
                    </TableHead>
                    <TableHead className="w-32">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queues.map(queue => {
                    const buffer = getQueueBuffer(queue)
                    const isCustom = queueBuffers[queue] !== undefined
                    return (
                      <TableRow key={queue}>
                        <TableCell className="font-medium">
                          {queue}
                          {!isCustom && <Badge variant="outline" className="ml-2 text-xs">Default</Badge>}
                          {isCustom && <Badge variant="secondary" className="ml-2 text-xs">Custom</Badge>}
                        </TableCell>
                        <TableCell className="p-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={buffer}
                              onChange={(e) => updateQueueBuffer(queue, e.target.value)}
                              min="0"
                              max="100"
                              step="0.5"
                              className="h-8 text-center"
                            />
                            <span className="text-slate-500 text-sm">%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isCustom && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resetQueueBuffer(queue)}
                              className="h-7 text-xs"
                            >
                              Reset
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly NPT, Shrinkage and Occupancy (Global) */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Weekly NPT, Shrinkage & Occupancy (%)</CardTitle>
              <CardDescription>Set NPT, Shrinkage, and Occupancy percentages for each week (global across all queues). Upload CSV to bulk update.</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadAssumptionsTemplate}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Download Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => assumptionsFileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload CSV
              </Button>
              <input
                ref={assumptionsFileInputRef}
                type="file"
                accept=".csv"
                onChange={handleAssumptionsFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Type:</label>
            <div className="flex gap-2">
              <Button
                variant={selectedType === 'external' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('external')}
              >
                External
              </Button>
              <Button
                variant={selectedType === 'internal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('internal')}
              >
                Internal
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 min-w-[80px]">Week</TableHead>
                  <TableHead className="text-center min-w-[120px]">NPT %</TableHead>
                  <TableHead className="text-center min-w-[120px]">Shrinkage %</TableHead>
                  <TableHead className="text-center min-w-[120px]">Occupancy %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeks.map(week => {
                  const nptValue = getNPT(selectedType, week)
                  const shrinkageValue = getShrinkage(selectedType, week)
                  const occupancyValue = getOccupancy(selectedType, week)
                  const isNPTCustom = weeklyNPT[selectedType]?.[week] !== undefined
                  const isShrinkageCustom = weeklyShrinkage[selectedType]?.[week] !== undefined
                  const isOccupancyCustom = weeklyOccupancy[selectedType]?.[week] !== undefined

                  return (
                    <TableRow key={week}>
                      <TableCell className="sticky left-0 bg-white font-medium text-slate-600">
                        W{week}
                      </TableCell>
                      <TableCell className="p-1">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={nptValue}
                            onChange={(e) => updateNPT(selectedType, week, parseFloat(e.target.value) || 0)}
                            className="w-full h-8 text-center text-sm"
                            step="0.1"
                            min="0"
                            max="100"
                          />
                          {!isNPTCustom && <Badge variant="outline" className="text-xs whitespace-nowrap">Default</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="p-1">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={shrinkageValue}
                            onChange={(e) => updateShrinkage(selectedType, week, parseFloat(e.target.value) || 0)}
                            className="w-full h-8 text-center text-sm"
                            step="0.1"
                            min="0"
                            max="100"
                          />
                          {!isShrinkageCustom && <Badge variant="outline" className="text-xs whitespace-nowrap">Default</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="p-1">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={occupancyValue}
                            onChange={(e) => updateOccupancy(selectedType, week, parseFloat(e.target.value) || 0)}
                            className="w-full h-8 text-center text-sm"
                            step="0.1"
                            min="0"
                            max="100"
                          />
                          {!isOccupancyCustom && <Badge variant="outline" className="text-xs whitespace-nowrap">Default</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-xs text-slate-500 flex items-start gap-2">
            <span className="font-medium">Note:</span>
            <div className="flex-1">
              <span>
                Values are percentages (0-100). Default values for {selectedType}: NPT = {baseAssumptions[selectedType].npt}%, Shrinkage = {baseAssumptions[selectedType].shrinkage}%, Occupancy = {baseAssumptions[selectedType].occupancy}%.
                Weeks without custom values will use the defaults.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly AHT by Queue */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Weekly AHT by Queue</CardTitle>
              <CardDescription>Set AHT (in minutes) for each week and queue. Upload CSV to bulk update.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Weekly Template
              </Button>
              <Button variant="outline" onClick={handleDownloadMonthlyTemplate} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Monthly Template
              </Button>
              <input type="file" accept=".csv" onChange={handleFileUpload} ref={fileInputRef} className="hidden" />
              <Button onClick={() => fileInputRef.current?.click()} size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </Button>
              <Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-32">
                <option value="external">External</option>
                <option value="internal">Internal</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {queues.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No queues available
            </div>
          ) : (
            <div className="space-y-4">
              {/* AHT Grid - Queues as columns, Weeks as rows */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white z-20 w-20">Week</TableHead>
                      {queues.map(queue => (
                        <TableHead key={queue} className="text-center min-w-[120px]">
                          {queue}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weeks.map(week => {
                      // Determine if this is a month name or week number
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                      const isMonth = monthNames.includes(week)
                      const displayLabel = isMonth ? week : `W${week}`

                      return (
                        <TableRow key={week}>
                          <TableCell className="sticky left-0 bg-white font-medium text-slate-600">
                            {displayLabel}
                          </TableCell>
                          {queues.map(queue => {
                            const value = weeklyAHT[queue]?.[selectedType]?.[week]
                            const hasValue = value !== undefined && value !== null
                            return (
                              <TableCell key={queue} className="p-1">
                                <Input
                                  type="number"
                                  value={hasValue ? value : ''}
                                  onChange={(e) => updateAHT(queue, selectedType, week, parseFloat(e.target.value) || 0)}
                                  className={`w-full h-8 text-center text-sm ${!hasValue ? 'bg-amber-50 border-amber-200' : ''}`}
                                  step="0.1"
                                  min="0"
                                  placeholder={!hasValue ? '-' : ''}
                                />
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Type indicator */}
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Badge variant={selectedType === 'external' ? 'success' : 'info'}>
                  {selectedType === 'external' ? '🌐 External' : '🏢 Internal'}
                </Badge>
                <span>AHT values are in minutes</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
