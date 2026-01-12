import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const AppContext = createContext()

const STORAGE_KEY = 'workforce-planning-data'

export function AppProvider({ children }) {
  const isInitialMount = useRef(true)

  // Forecast data from CSV upload
  const [forecastData, setForecastData] = useState(null)
  const [weeks, setWeeks] = useState([])
  const [queues, setQueues] = useState([])

  // Planning granularity: 'week' or 'month'
  const [planningGranularity, setPlanningGranularity] = useState('week')
  const [periods, setPeriods] = useState([]) // Stores period identifiers (weeks or months)

  // Global split settings (default) - just numbers, derived automatically
  const [globalSplit, setGlobalSplit] = useState({ external: 70, internal: 30 })

  // Queue-level split settings: { 'QueueName': { external: 70, internal: 30 } }
  const [queueSplits, setQueueSplits] = useState({})

  // Global buffer percentage (default)
  const [bufferHC, setBufferHC] = useState(10)

  // Queue-level buffer percentage: { 'QueueName': 10 }
  const [queueBuffers, setQueueBuffers] = useState({})

  // Base assumptions (defaults) - AHT in minutes
  const [baseAssumptions, setBaseAssumptions] = useState({
    internal: { npt: 15, shrinkage: 20, occupancy: 85 },
    external: { npt: 10, shrinkage: 15, occupancy: 90 }
  })

  // Weekly NPT per type (global, not queue-specific): { internal: { '1': 15, '2': 14, ... }, external: { '1': 10, ... } }
  const [weeklyNPT, setWeeklyNPT] = useState({ internal: {}, external: {} })

  // Weekly Shrinkage per type (global, not queue-specific): { internal: { '1': 20, '2': 18, ... }, external: { '1': 15, ... } }
  const [weeklyShrinkage, setWeeklyShrinkage] = useState({ internal: {}, external: {} })

  // Weekly Occupancy per type (global, not queue-specific): { internal: { '1': 85, '2': 87, ... }, external: { '1': 90, ... } }
  const [weeklyOccupancy, setWeeklyOccupancy] = useState({ internal: {}, external: {} })

  // Queue-level assumptions per week (overrides base assumptions when set)
  // { 'QueueName': { internal: { npt: { '1': 15, '2': 14, ... }, shrinkage: { '1': 20, ... }, occupancy: { '1': 85, ... } }, external: { ... } } }
  const [queueAssumptions, setQueueAssumptions] = useState({})

  // Weekly AHT per queue per type (in minutes): { 'QueueName': { internal: { '1': 10, '2': 10.5, ... }, external: { '1': 8, ... } } }
  const [weeklyAHT, setWeeklyAHT] = useState({})

  // Original uploaded AHT data (baseline before any simulation overrides)
  // This preserves the CSV-uploaded values so they can be restored when simulations are reset
  const [originalUploadedAHT, setOriginalUploadedAHT] = useState({})

  // Skills per queue: { 'QueueName': ['Skill1', 'Skill2'] }
  const [queueSkills, setQueueSkills] = useState({})

  // Current HC data (uploaded via CSV): { 'QueueName': { internal: 50, external: 100 } }
  const [currentHC, setCurrentHC] = useState({})

  // Attrition data - HC numbers per week per queue per type
  // { 'QueueName': { internal: { '1': 2, '2': 0, ... }, external: { '1': 3, ... } } }
  const [attritionData, setAttritionData] = useState({})

  // Planned flat attrition per type (weekly percentage of overall HC)
  const [plannedAttrition, setPlannedAttrition] = useState({ internal: 0, external: 0 })

  // Attrition percentage per type (weekly %)
  const [attritionRate, setAttritionRate] = useState({ internal: 0.3, external: 0.3 })

  // Batches with training duration and type (upskilling/new)
  const [batches, setBatches] = useState([])

  // What-If Simulations (week-level)
  const [simulations, setSimulations] = useState([])
  const [activeSimulationId, setActiveSimulationId] = useState(null)
  // Baseline AHT data saved before a simulation is activated (for restoration on deactivation)
  // Structure: { queue, type, aht: { weekNum: value, ... } }
  const [baselineAHTData, setBaselineAHTData] = useState(null)

  // Finalized demand plan
  const [demandPlan, setDemandPlan] = useState([])

  // What-Ifs page UI selection persistence
  const [whatIfsSelection, setWhatIfsSelection] = useState({ queue: '', type: 'external' })

  // Location-based cost data (annual cost per HC by site and type)
  // { 'SiteName': { internal: 50000, external: 30000 } }
  const [locationCosts, setLocationCosts] = useState({})

  // Parse and set forecast data
  const loadForecastData = useCallback((csvText) => {
    const lines = csvText.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim())

    const data = []
    const weekList = []

    // Helper function to get calendar weeks for a month
    const getCalendarWeeksForMonth = (monthNum) => {
      const monthToWeeksMap = {
        1: [1, 2, 3, 4],           // January: weeks 1-4
        2: [5, 6, 7, 8],           // February: weeks 5-8
        3: [9, 10, 11, 12, 13],    // March: weeks 9-13 (5 weeks)
        4: [14, 15, 16, 17],       // April: weeks 14-17
        5: [18, 19, 20, 21],       // May: weeks 18-21
        6: [22, 23, 24, 25, 26],   // June: weeks 22-26 (5 weeks)
        7: [27, 28, 29, 30],       // July: weeks 27-30
        8: [31, 32, 33, 34],       // August: weeks 31-34
        9: [35, 36, 37, 38, 39],   // September: weeks 35-39 (5 weeks)
        10: [40, 41, 42, 43],      // October: weeks 40-43
        11: [44, 45, 46, 47],      // November: weeks 44-47
        12: [48, 49, 50, 51, 52]   // December: weeks 48-52 (5 weeks)
      }
      return monthToWeeksMap[monthNum] || []
    }

    // Detect format: check if we have month names or week numbers
    const dataColumns = headers.filter(h => h !== 'QUEUE' && h !== 'TIMEZONE')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const isMonthlyFormat = dataColumns.some(col => monthNames.includes(col))

    console.log('Forecast format detected:', isMonthlyFormat ? 'Monthly' : 'Weekly')

    // Set planning granularity based on detected format
    setPlanningGranularity(isMonthlyFormat ? 'month' : 'week')

    if (isMonthlyFormat) {
      // Monthly format: store as months (don't expand to weeks)
      // Build month column map
      const monthColumns = []
      dataColumns.forEach((col) => {
        const monthIdx = monthNames.indexOf(col)
        if (monthIdx >= 0) {
          monthColumns.push({
            monthNum: monthIdx + 1,
            monthName: col,
            colIdx: headers.indexOf(col)
          })
          weekList.push(col) // Store month names as periods
        }
      })

      // Parse data and store monthly volumes directly
      let currentQueue = ''
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const row = { queue: '', timezone: '', volumes: {} }

        // Get queue and timezone
        const queueIdx = headers.indexOf('QUEUE')
        const timezoneIdx = headers.indexOf('TIMEZONE')

        if (queueIdx >= 0) {
          const queueValue = values[queueIdx]
          if (queueValue) {
            currentQueue = queueValue
          }
          row.queue = currentQueue
        }

        if (timezoneIdx >= 0) {
          row.timezone = values[timezoneIdx]
        }

        // Store monthly volumes directly (no expansion to weeks)
        monthColumns.forEach(({ monthName, colIdx }) => {
          const monthlyVolume = parseFloat(values[colIdx]) || 0
          row.volumes[monthName] = monthlyVolume
        })

        // Only add rows that have a valid queue and timezone
        if (row.queue && row.timezone) {
          data.push(row)
        }
      }
    } else {
      // Weekly format: use as-is
      headers.forEach(header => {
        if (header !== 'QUEUE' && header !== 'TIMEZONE') {
          weekList.push(header)
        }
      })

      let currentQueue = ''
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const row = { queue: '', timezone: '', volumes: {} }

        headers.forEach((header, index) => {
          if (header === 'QUEUE') {
            const queueValue = values[index]
            if (queueValue) {
              currentQueue = queueValue
            }
            row.queue = currentQueue
          } else if (header === 'TIMEZONE') {
            row.timezone = values[index]
          } else {
            row.volumes[header] = parseFloat(values[index]) || 0
          }
        })

        // Only add rows that have a valid queue and timezone
        if (row.queue && row.timezone) {
          data.push(row)
        }
      }
    }

    const queueList = [...new Set(data.map(d => d.queue))]

    setForecastData(data)
    setWeeks(weekList) // This will contain either week numbers or month names
    setPeriods(weekList) // Same as weeks for now
    setQueues(queueList)

    // Initialize weekly AHT structure (empty, no default values)
    const initialAHT = {}
    const initialSkills = {}
    queueList.forEach(queue => {
      initialAHT[queue] = { internal: {}, external: {} }
      initialSkills[queue] = [queue] // Default skill is queue name
      // No default AHT values - weeks remain empty until uploaded
    })
    setWeeklyAHT(prev => {
      const merged = { ...initialAHT }
      Object.keys(prev).forEach(queue => {
        if (merged[queue]) {
          merged[queue] = {
            internal: { ...merged[queue].internal, ...prev[queue]?.internal },
            external: { ...merged[queue].external, ...prev[queue]?.external }
          }
        }
      })
      return merged
    })
    setQueueSkills(prev => ({ ...initialSkills, ...prev }))
  }, [])

  // Update global split - auto-derive the other
  const updateGlobalSplit = useCallback((type, value) => {
    const val = Math.min(100, Math.max(0, parseFloat(value) || 0))
    if (type === 'external') {
      setGlobalSplit({ external: val, internal: 100 - val })
    } else {
      setGlobalSplit({ external: 100 - val, internal: val })
    }
  }, [])

  // Get split for a queue (falls back to global split if not set)
  const getQueueSplit = useCallback((queue) => {
    return queueSplits[queue] || globalSplit
  }, [queueSplits, globalSplit])

  // Update queue-level split - auto-derive the other
  const updateQueueSplit = useCallback((queue, type, value) => {
    const val = Math.min(100, Math.max(0, parseFloat(value) || 0))
    setQueueSplits(prev => ({
      ...prev,
      [queue]: type === 'external'
        ? { external: val, internal: 100 - val }
        : { external: 100 - val, internal: val }
    }))
  }, [])

  // Reset queue split to use global default
  const resetQueueSplit = useCallback((queue) => {
    setQueueSplits(prev => {
      const updated = { ...prev }
      delete updated[queue]
      return updated
    })
  }, [])

  // Get buffer for a queue (falls back to global buffer if not set)
  const getQueueBuffer = useCallback((queue) => {
    return queueBuffers[queue] !== undefined ? queueBuffers[queue] : bufferHC
  }, [queueBuffers, bufferHC])

  // Update queue-level buffer
  const updateQueueBuffer = useCallback((queue, value) => {
    const val = Math.min(100, Math.max(0, parseFloat(value) || 0))
    setQueueBuffers(prev => ({
      ...prev,
      [queue]: val
    }))
  }, [])

  // Reset queue buffer to use global default
  const resetQueueBuffer = useCallback((queue) => {
    setQueueBuffers(prev => {
      const updated = { ...prev }
      delete updated[queue]
      return updated
    })
  }, [])

  // Get NPT for type/week (global)
  // Returns base assumption if no weekly NPT data exists
  const getNPT = useCallback((type, week) => {
    const value = weeklyNPT[type]?.[week]
    return value !== undefined ? value : baseAssumptions[type].npt
  }, [weeklyNPT, baseAssumptions])

  // Update NPT
  const updateNPT = useCallback((type, week, value) => {
    setWeeklyNPT(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [week]: parseFloat(value) || 0
      }
    }))
  }, [])

  // Get Shrinkage for type/week (global)
  // Returns base assumption if no weekly Shrinkage data exists
  const getShrinkage = useCallback((type, week) => {
    const value = weeklyShrinkage[type]?.[week]
    return value !== undefined ? value : baseAssumptions[type].shrinkage
  }, [weeklyShrinkage, baseAssumptions])

  // Update Shrinkage
  const updateShrinkage = useCallback((type, week, value) => {
    setWeeklyShrinkage(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [week]: parseFloat(value) || 0
      }
    }))
  }, [])

  // Get Occupancy for type/week (global)
  // Returns base assumption if no weekly Occupancy data exists
  const getOccupancy = useCallback((type, week) => {
    const value = weeklyOccupancy[type]?.[week]
    return value !== undefined ? value : baseAssumptions[type].occupancy
  }, [weeklyOccupancy, baseAssumptions])

  // Update Occupancy
  const updateOccupancy = useCallback((type, week, value) => {
    setWeeklyOccupancy(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [week]: parseFloat(value) || 0
      }
    }))
  }, [])

  // Load NPT from CSV (supports both weekly and monthly formats)
  const loadWeeklyNPT = useCallback((csvText) => {
    const cleanedText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
    const lines = cleanedText.split('\n').filter(line => line.trim() !== '')

    if (lines.length === 0) return

    const headers = lines[0].split(',').map(h => h.trim())
    const typeIdx = headers.findIndex(h => h.toLowerCase() === 'type')

    // Detect format: check if we have month names or week numbers
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dataColumns = headers.slice(1) // Skip 'TYPE' column
    const isMonthlyFormat = dataColumns.some(col => monthNames.includes(col))

    const periodColumns = []
    headers.forEach((header, idx) => {
      if (isMonthlyFormat) {
        // Check if header is a month name
        if (monthNames.includes(header)) {
          periodColumns.push({ period: header, colIdx: idx })
        }
      } else {
        // Check if header is a week number
        const weekNum = parseInt(header)
        if (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 52) {
          periodColumns.push({ period: header, colIdx: idx })
        }
      }
    })

    const nptData = { internal: {}, external: {} }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const type = values[typeIdx]?.toLowerCase()

      if (type && (type === 'internal' || type === 'external')) {
        periodColumns.forEach(({ period, colIdx }) => {
          const nptValue = parseFloat(values[colIdx])
          if (!isNaN(nptValue) && nptValue >= 0) {
            nptData[type][period] = nptValue
          }
        })
      }
    }

    setWeeklyNPT(prev => ({
      internal: { ...prev.internal, ...nptData.internal },
      external: { ...prev.external, ...nptData.external }
    }))
  }, [])

  // Load Shrinkage from CSV (supports both weekly and monthly formats)
  const loadWeeklyShrinkage = useCallback((csvText) => {
    const cleanedText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
    const lines = cleanedText.split('\n').filter(line => line.trim() !== '')

    if (lines.length === 0) return

    const headers = lines[0].split(',').map(h => h.trim())
    const typeIdx = headers.findIndex(h => h.toLowerCase() === 'type')

    // Detect format: check if we have month names or week numbers
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dataColumns = headers.slice(1) // Skip 'TYPE' column
    const isMonthlyFormat = dataColumns.some(col => monthNames.includes(col))

    const periodColumns = []
    headers.forEach((header, idx) => {
      if (isMonthlyFormat) {
        if (monthNames.includes(header)) {
          periodColumns.push({ period: header, colIdx: idx })
        }
      } else {
        const weekNum = parseInt(header)
        if (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 52) {
          periodColumns.push({ period: header, colIdx: idx })
        }
      }
    })

    const shrinkageData = { internal: {}, external: {} }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const type = values[typeIdx]?.toLowerCase()

      if (type && (type === 'internal' || type === 'external')) {
        periodColumns.forEach(({ period, colIdx }) => {
          const shrinkageValue = parseFloat(values[colIdx])
          if (!isNaN(shrinkageValue) && shrinkageValue >= 0) {
            shrinkageData[type][period] = shrinkageValue
          }
        })
      }
    }

    setWeeklyShrinkage(prev => ({
      internal: { ...prev.internal, ...shrinkageData.internal },
      external: { ...prev.external, ...shrinkageData.external }
    }))
  }, [])

  // Load Occupancy from CSV (supports both weekly and monthly formats)
  const loadWeeklyOccupancy = useCallback((csvText) => {
    const cleanedText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
    const lines = cleanedText.split('\n').filter(line => line.trim() !== '')

    if (lines.length === 0) return

    const headers = lines[0].split(',').map(h => h.trim())
    const typeIdx = headers.findIndex(h => h.toLowerCase() === 'type')

    // Detect format: check if we have month names or week numbers
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const dataColumns = headers.slice(1) // Skip 'TYPE' column
    const isMonthlyFormat = dataColumns.some(col => monthNames.includes(col))

    const periodColumns = []
    headers.forEach((header, idx) => {
      if (isMonthlyFormat) {
        if (monthNames.includes(header)) {
          periodColumns.push({ period: header, colIdx: idx })
        }
      } else {
        const weekNum = parseInt(header)
        if (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 52) {
          periodColumns.push({ period: header, colIdx: idx })
        }
      }
    })

    const occupancyData = { internal: {}, external: {} }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const type = values[typeIdx]?.toLowerCase()

      if (type && (type === 'internal' || type === 'external')) {
        periodColumns.forEach(({ period, colIdx }) => {
          const occupancyValue = parseFloat(values[colIdx])
          if (!isNaN(occupancyValue) && occupancyValue >= 0) {
            occupancyData[type][period] = occupancyValue
          }
        })
      }
    }

    setWeeklyOccupancy(prev => ({
      internal: { ...prev.internal, ...occupancyData.internal },
      external: { ...prev.external, ...occupancyData.external }
    }))
  }, [])

  // Get AHT for queue/type/week (in minutes)
  // Returns null if no AHT data exists for that week (not uploaded)
  const getAHT = useCallback((queue, type, week) => {
    const value = weeklyAHT[queue]?.[type]?.[week]
    return value !== undefined ? value : null
  }, [weeklyAHT])

  // Update AHT
  const updateAHT = useCallback((queue, type, week, value) => {
    setWeeklyAHT(prev => ({
      ...prev,
      [queue]: {
        ...prev[queue],
        [type]: {
          ...prev[queue]?.[type],
          [week]: parseFloat(value) || 0
        }
      }
    }))
  }, [])

  // Bulk update AHT (for a range of weeks)
  const bulkUpdateAHT = useCallback((queue, type, startWeek, endWeek, value) => {
    setWeeklyAHT(prev => {
      const updated = { ...prev }
      if (!updated[queue]) updated[queue] = { internal: {}, external: {} }

      const start = parseInt(startWeek)
      const end = parseInt(endWeek)
      for (let w = start; w <= end; w++) {
        updated[queue][type][w.toString()] = parseFloat(value) || 0
      }
      return updated
    })
  }, [])

  // Load AHT from CSV (supports both monthly and weekly formats)
  const loadWeeklyAHT = useCallback((csvText) => {
    // Remove BOM if present and normalize line endings
    const cleanedText = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
    const lines = cleanedText.split('\n').filter(line => line.trim() !== '')

    if (lines.length === 0) {
      console.error('CSV file is empty')
      return
    }

    const headers = lines[0].split(',').map(h => h.trim())

    console.log('Raw CSV text (first 200 chars):', csvText.substring(0, 200))
    console.log('Cleaned CSV text (first 200 chars):', cleanedText.substring(0, 200))
    console.log('CSV Headers:', headers)

    // Find indices for queue, type, and period columns
    const queueIdx = headers.findIndex(h => h.toLowerCase() === 'queue')
    const typeIdx = headers.findIndex(h => h.toLowerCase() === 'type')

    console.log('Queue index:', queueIdx, 'Type index:', typeIdx)

    // Detect format: check if we have month names or week numbers
    const dataColumns = headers.slice(2)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const isMonthlyFormat = dataColumns.some(col => monthNames.includes(col))

    console.log('Is monthly format:', isMonthlyFormat)
    console.log('Data columns:', dataColumns)
    console.log('Current planning granularity:', planningGranularity)

    // Helper function to get calendar weeks for a month
    const getCalendarWeeksForMonth = (monthNum) => {
      const monthToWeeksMap = {
        1: [1, 2, 3, 4],           // January: weeks 1-4
        2: [5, 6, 7, 8],           // February: weeks 5-8
        3: [9, 10, 11, 12, 13],    // March: weeks 9-13 (5 weeks)
        4: [14, 15, 16, 17],       // April: weeks 14-17
        5: [18, 19, 20, 21],       // May: weeks 18-21
        6: [22, 23, 24, 25, 26],   // June: weeks 22-26 (5 weeks)
        7: [27, 28, 29, 30],       // July: weeks 27-30
        8: [31, 32, 33, 34],       // August: weeks 31-34
        9: [35, 36, 37, 38, 39],   // September: weeks 35-39 (5 weeks)
        10: [40, 41, 42, 43],      // October: weeks 40-43
        11: [44, 45, 46, 47],      // November: weeks 44-47
        12: [48, 49, 50, 51, 52]   // December: weeks 48-52 (5 weeks)
      }
      return monthToWeeksMap[monthNum] || []
    }

    const ahtData = {}

    if (isMonthlyFormat) {
      // Process monthly format
      const monthColumns = []
      dataColumns.forEach((col, idx) => {
        const monthIdx = monthNames.indexOf(col)
        if (monthIdx >= 0) {
          monthColumns.push({ monthNum: monthIdx + 1, monthName: col, colIdx: idx + 2 })
        }
      })

      console.log('Month columns found:', monthColumns)

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const queue = values[queueIdx]
        const type = values[typeIdx]?.toLowerCase()

        console.log(`Processing row ${i}: queue=${queue}, type=${type}`)

        if (queue && type && (type === 'internal' || type === 'external')) {
          if (!ahtData[queue]) {
            ahtData[queue] = { internal: {}, external: {} }
          }

          // Process monthly AHT values
          monthColumns.forEach(({ monthNum, monthName, colIdx }) => {
            const monthlyAhtValue = parseFloat(values[colIdx])
            console.log(`Month ${monthName}, value at col ${colIdx}: ${values[colIdx]} -> ${monthlyAhtValue}`)

            if (!isNaN(monthlyAhtValue) && monthlyAhtValue > 0) {
              // Check if current planning is monthly or weekly
              if (planningGranularity === 'month') {
                // Store with month name as key
                ahtData[queue][type][monthName] = monthlyAhtValue
                console.log(`Stored as month: ${monthName} = ${monthlyAhtValue}`)
              } else {
                // Expand to weeks: apply same AHT to all weeks in this month
                const weeksInMonth = getCalendarWeeksForMonth(monthNum)
                weeksInMonth.forEach(weekNum => {
                  ahtData[queue][type][weekNum.toString()] = monthlyAhtValue
                })
                console.log(`Expanded to weeks ${weeksInMonth.join(', ')} = ${monthlyAhtValue}`)
              }
            }
          })
        }
      }
    } else {
      // Process weekly format (original logic)
      const weekColumns = []
      headers.forEach((header, idx) => {
        const weekNum = parseInt(header)
        if (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 52) {
          weekColumns.push({ week: header, colIdx: idx })
        }
      })

      console.log('Week columns found:', weekColumns)

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const queue = values[queueIdx]
        const type = values[typeIdx]?.toLowerCase()

        if (queue && type && (type === 'internal' || type === 'external')) {
          if (!ahtData[queue]) {
            ahtData[queue] = { internal: {}, external: {} }
          }

          // Parse AHT values for each week
          weekColumns.forEach(({ week, colIdx }) => {
            const ahtValue = parseFloat(values[colIdx])
            if (!isNaN(ahtValue) && ahtValue > 0) {
              ahtData[queue][type][week] = ahtValue
            }
          })
        }
      }
    }

    console.log('Final AHT data:', ahtData)
    console.log('Number of queues parsed:', Object.keys(ahtData).length)

    if (Object.keys(ahtData).length === 0) {
      console.error('No AHT data was parsed! Check CSV format.')
      alert('Error: No AHT data was found in the CSV file. Please check the file format.')
      return
    }

    setWeeklyAHT(prev => {
      // Merge with existing data
      const merged = { ...prev }
      Object.keys(ahtData).forEach(queue => {
        if (!merged[queue]) {
          merged[queue] = { internal: {}, external: {} }
        }
        merged[queue].internal = { ...merged[queue].internal, ...ahtData[queue].internal }
        merged[queue].external = { ...merged[queue].external, ...ahtData[queue].external }
      })
      console.log('Merged weekly AHT:', merged)
      console.log('✅ AHT upload successful! Updated', Object.keys(ahtData).length, 'queues')
      return merged
    })

    // Also save to originalUploadedAHT as the baseline for reset functionality
    setOriginalUploadedAHT(prev => {
      const merged = { ...prev }
      Object.keys(ahtData).forEach(queue => {
        if (!merged[queue]) {
          merged[queue] = { internal: {}, external: {} }
        }
        merged[queue].internal = { ...merged[queue].internal, ...ahtData[queue].internal }
        merged[queue].external = { ...merged[queue].external, ...ahtData[queue].external }
      })
      return merged
    })
  }, [planningGranularity])

  // Get queue-level assumption for a specific week (falls back to weekly global, then base assumption)
  const getQueueAssumption = useCallback((queue, type, field, week) => {
    const queueValue = queueAssumptions[queue]?.[type]?.[field]?.[week]
    if (queueValue !== undefined && queueValue !== null) {
      return queueValue
    }
    // Fall back to weekly NPT/Shrinkage/Occupancy if available, otherwise base assumption
    if (field === 'npt') {
      return getNPT(type, week)
    } else if (field === 'shrinkage') {
      return getShrinkage(type, week)
    } else if (field === 'occupancy') {
      return getOccupancy(type, week)
    }
    return baseAssumptions[type][field]
  }, [queueAssumptions, baseAssumptions, getNPT, getShrinkage, getOccupancy])

  // Update queue-level assumption for a specific week
  const updateQueueAssumption = useCallback((queue, type, field, week, value) => {
    setQueueAssumptions(prev => {
      const updated = { ...prev }
      if (!updated[queue]) {
        updated[queue] = {
          internal: { npt: {}, shrinkage: {}, occupancy: {} },
          external: { npt: {}, shrinkage: {}, occupancy: {} }
        }
      }
      if (!updated[queue][type]) {
        updated[queue][type] = { npt: {}, shrinkage: {}, occupancy: {} }
      }
      if (!updated[queue][type][field]) {
        updated[queue][type][field] = {}
      }
      updated[queue][type][field][week] = parseFloat(value) || 0
      return updated
    })
  }, [])

  // Bulk update queue-level assumptions for a range of weeks
  const bulkUpdateQueueAssumption = useCallback((queue, type, field, startWeek, endWeek, value) => {
    setQueueAssumptions(prev => {
      const updated = { ...prev }
      if (!updated[queue]) {
        updated[queue] = {
          internal: { npt: {}, shrinkage: {}, occupancy: {} },
          external: { npt: {}, shrinkage: {}, occupancy: {} }
        }
      }
      if (!updated[queue][type]) {
        updated[queue][type] = { npt: {}, shrinkage: {}, occupancy: {} }
      }
      if (!updated[queue][type][field]) {
        updated[queue][type][field] = {}
      }

      const start = parseInt(startWeek)
      const end = parseInt(endWeek)
      const parsedValue = parseFloat(value) || 0
      for (let w = start; w <= end; w++) {
        updated[queue][type][field][w.toString()] = parsedValue
      }
      return updated
    })
  }, [])

  // Copy base assumptions to queue for all weeks
  const copyBaseToQueue = useCallback((queue, type) => {
    setQueueAssumptions(prev => {
      const updated = { ...prev }
      if (!updated[queue]) {
        updated[queue] = {
          internal: { npt: {}, shrinkage: {}, occupancy: {} },
          external: { npt: {}, shrinkage: {}, occupancy: {} }
        }
      }

      const fields = ['npt', 'shrinkage', 'occupancy']
      fields.forEach(field => {
        updated[queue][type][field] = {}
        for (let w = 1; w <= 52; w++) {
          updated[queue][type][field][w.toString()] = baseAssumptions[type][field]
        }
      })
      return updated
    })
  }, [baseAssumptions])

  // Reset simulation for a queue/type - restores ALL values (AHT, NPT, Shrinkage, Occupancy) to defaults
  const resetSimulation = useCallback((queue, type) => {
    // Check if this queue/type matches the active simulation
    const activeSim = simulations.find(s => s.id === activeSimulationId)
    const isActiveSimulation = activeSim && activeSim.queue === queue && activeSim.type === type

    // Restore AHT to original uploaded values
    const originalAHT = originalUploadedAHT[queue]?.[type]
    if (originalAHT && Object.keys(originalAHT).length > 0) {
      setWeeklyAHT(prev => ({
        ...prev,
        [queue]: {
          ...prev[queue],
          [type]: { ...originalAHT }
        }
      }))
    }

    // Clear the baselineAHTData if it matches this queue/type
    if (baselineAHTData && baselineAHTData.queue === queue && baselineAHTData.type === type) {
      setBaselineAHTData(null)
    }

    // Clear the queue assumptions (NPT, Shrinkage, Occupancy) for this specific queue/type
    setQueueAssumptions(prev => {
      const updated = { ...prev }
      if (updated[queue]?.[type]) {
        delete updated[queue][type]
        if (Object.keys(updated[queue]).length === 0) {
          delete updated[queue]
        }
      }
      return updated
    })

    // Deactivate simulation if it matches
    if (isActiveSimulation) {
      setActiveSimulationId(null)
    }
  }, [simulations, activeSimulationId, originalUploadedAHT, baselineAHTData])

  // Load current HC from CSV
  const loadCurrentHC = useCallback((csvText) => {
    const lines = csvText.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

    const queueIdx = headers.findIndex(h => h === 'queue')
    const timezoneIdx = headers.findIndex(h => h === 'timezone')
    const siteIdx = headers.findIndex(h => h === 'site' || h === 'location')
    const internalIdx = headers.findIndex(h => h === 'internal' || h === 'internal_hc')
    const externalIdx = headers.findIndex(h => h === 'external' || h === 'external_hc')

    const hcData = {}
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const queue = values[queueIdx]
      const timezone = timezoneIdx >= 0 ? values[timezoneIdx] : ''
      const site = siteIdx >= 0 ? values[siteIdx] : 'N/A'

      if (queue && timezone) {
        // Use new format with site if available, otherwise legacy format
        const key = siteIdx >= 0 ? `${queue}-${timezone}-${site}` : `${queue}-${timezone}`
        hcData[key] = {
          internal: parseInt(values[internalIdx]) || 0,
          external: parseInt(values[externalIdx]) || 0
        }
      }
    }
    setCurrentHC(hcData)
  }, [])

  // Get current HC for queue and timezone (aggregates all sites)
  const getCurrentHC = useCallback((queue, timezone, type) => {
    let total = 0
    // Sum up HC from all matching queue-timezone combinations (all sites)
    Object.keys(currentHC).forEach(key => {
      const parts = key.split('-')
      const keyQueue = parts[0]
      const keyTimezone = parts[1]

      if (keyQueue === queue && keyTimezone === timezone) {
        total += currentHC[key]?.[type] ?? 0
      }
    })
    return total
  }, [currentHC])

  // Update attrition for queue/type/week
  const updateAttrition = useCallback((queue, type, week, value) => {
    setAttritionData(prev => ({
      ...prev,
      [queue]: {
        ...prev[queue],
        [type]: {
          ...prev[queue]?.[type],
          [week]: parseInt(value) || 0
        }
      }
    }))
  }, [])

  // Get attrition for queue/type/week (optionally pass totalHC to include planned % attrition)
  const getAttrition = useCallback((queue, type, week, totalHC = null) => {
    const queueAttrition = attritionData[queue]?.[type]?.[week] ?? 0
    // If totalHC is provided, calculate planned attrition as percentage of total HC
    const plannedFlat = totalHC ? (totalHC * (plannedAttrition[type] ?? 0) / 100) : 0
    return queueAttrition + plannedFlat
  }, [attritionData, plannedAttrition])

  // Add batch with new fields
  const addBatch = useCallback((batch) => {
    const newBatch = {
      ...batch,
      id: Date.now().toString(),
      batchType: batch.batchType || 'new', // 'new' or 'upskilling'
      timezone: batch.timezone || 'CENTRAL', // Add timezone field
      trainingDuration: parseInt(batch.trainingDuration) || 4,
      rampCurve: batch.rampCurve || [25, 50, 75, 100],
      hcCount: parseInt(batch.hcCount) || 0
    }
    setBatches(prev => [...prev, newBatch])
  }, [])

  // Update batch
  const updateBatch = useCallback((id, updates) => {
    setBatches(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }, [])

  // Delete batch
  const deleteBatch = useCallback((id) => {
    setBatches(prev => prev.filter(b => b.id !== id))
  }, [])

  // Get effective HC from batches for a specific week (considering ramp curve)
  const getBatchHCForWeek = useCallback((queue, type, week, timezone = null) => {
    const weekNum = parseInt(week)
    let totalHC = 0

    batches.filter(b => {
      const queueMatch = b.queue === queue
      const typeMatch = b.type === type
      const timezoneMatch = timezone ? b.timezone === timezone : true
      return queueMatch && typeMatch && timezoneMatch
    }).forEach(batch => {
      const startWeek = parseInt(batch.startWeek)
      const trainingDuration = parseInt(batch.trainingDuration)
      const trainingEnd = startWeek + trainingDuration - 1

      // Determine if batch spans year boundary
      const spansYearBoundary = trainingEnd > 52 || (startWeek > 26 && weekNum < startWeek)

      // Normalize week numbers for comparison
      let normalizedWeek = weekNum
      let normalizedStart = startWeek
      let normalizedEnd = trainingEnd

      if (spansYearBoundary) {
        if (trainingEnd > 52) {
          // Training explicitly goes beyond week 52
          normalizedEnd = trainingEnd - 52
          if (weekNum >= startWeek) {
            // Current week is in the same year as start (e.g., weeks 49-52)
            normalizedWeek = weekNum
          } else if (weekNum <= normalizedEnd) {
            // Current week is in next year during training (e.g., weeks 1-4)
            normalizedWeek = weekNum + 52
          }
        } else if (startWeek > 26 && weekNum < startWeek) {
          // Batch started late in year (after week 26), current week is early next year
          // Convert current week to continuous timeline
          normalizedWeek = weekNum + 52
        }
      }

      // Check if week is before batch starts
      if (normalizedWeek < normalizedStart) {
        totalHC += 0
        return
      }

      // Check if week is during training
      const finalTrainingWeek = normalizedStart + trainingDuration - 1
      if (normalizedWeek <= finalTrainingWeek) {
        totalHC += 0
        return
      }

      // After training - apply ramp curve
      const weeksAfterTraining = normalizedWeek - finalTrainingWeek

      // Handle month-level vs week-level ramping
      const rampGranularity = batch.rampGranularity || 'week'
      let rampIndex

      if (rampGranularity === 'month') {
        // Month-level ramping: each period represents ~4 weeks
        const weeksPerMonth = 4
        const monthsAfterTraining = Math.floor((weeksAfterTraining - 1) / weeksPerMonth)
        rampIndex = Math.min(monthsAfterTraining, batch.rampCurve.length - 1)
      } else {
        // Week-level ramping: each period represents 1 week
        rampIndex = Math.min(weeksAfterTraining - 1, batch.rampCurve.length - 1)
      }

      if (rampIndex >= 0 && weeksAfterTraining >= 1) {
        const rampPct = batch.rampCurve[rampIndex] / 100
        totalHC += batch.hcCount * rampPct
      }
    })

    return totalHC
  }, [batches])

  // Get training HC for a specific week
  const getTrainingHCForWeek = useCallback((queue, type, week, timezone = null) => {
    const weekNum = parseInt(week)
    let trainingHC = 0

    batches.filter(b => {
      const queueMatch = b.queue === queue
      const typeMatch = b.type === type
      const timezoneMatch = timezone ? b.timezone === timezone : true
      return queueMatch && typeMatch && timezoneMatch
    }).forEach(batch => {
      const startWeek = parseInt(batch.startWeek)
      const trainingDuration = parseInt(batch.trainingDuration)
      const trainingEnd = startWeek + trainingDuration - 1

      // Determine if batch spans year boundary
      const spansYearBoundary = trainingEnd > 52 || (startWeek > 26 && weekNum < startWeek)

      // Normalize week numbers for comparison
      let normalizedWeek = weekNum
      let normalizedStart = startWeek

      if (spansYearBoundary) {
        if (trainingEnd > 52) {
          // Training explicitly goes beyond week 52
          const normalizedEnd = trainingEnd - 52
          if (weekNum >= startWeek) {
            // Current week is in the same year as start
            normalizedWeek = weekNum
          } else if (weekNum <= normalizedEnd) {
            // Current week is in next year during training
            normalizedWeek = weekNum + 52
          }
        } else if (startWeek > 26 && weekNum < startWeek) {
          // Batch started late in year, current week is early next year
          normalizedWeek = weekNum + 52
        }
      }

      // Check if week is during training period
      const finalTrainingWeek = normalizedStart + trainingDuration - 1
      if (normalizedWeek >= normalizedStart && normalizedWeek <= finalTrainingWeek) {
        trainingHC += batch.hcCount
      }
    })

    return trainingHC
  }, [batches])

  // Add simulation (week-level)
  const addSimulation = useCallback((simulation) => {
    const newSim = {
      ...simulation,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    }
    setSimulations(prev => [...prev, newSim])
    return newSim.id
  }, [])

  // Update simulation
  const updateSimulation = useCallback((id, updates) => {
    setSimulations(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }, [])

  // Delete simulation
  const deleteSimulation = useCallback((id) => {
    setSimulations(prev => prev.filter(s => s.id !== id))
    if (activeSimulationId === id) setActiveSimulationId(null)
  }, [activeSimulationId])

  // Finalize simulation to demand plan
  const finalizeSimulation = useCallback((simulationId) => {
    const simulation = simulations.find(s => s.id === simulationId)
    if (simulation) {
      setDemandPlan(prev => [...prev, { ...simulation, finalizedAt: new Date().toISOString() }])
    }
  }, [simulations])

  // Calculate required HC (core formula)
  const calculateRequiredHC = useCallback((volume, ahtMinutes, npt, shrinkage, occupancy) => {
    const availableMinutesPerWeek = 40 * 60 // 40 hours
    const effectiveTime = availableMinutesPerWeek * (1 - npt / 100) * (1 - shrinkage / 100)
    const productiveTime = effectiveTime * (occupancy / 100)
    const timeNeeded = volume * ahtMinutes
    return productiveTime > 0 ? timeNeeded / productiveTime : 0
  }, [])

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        if (data.forecastData) setForecastData(data.forecastData)
        if (data.weeks) setWeeks(data.weeks)
        if (data.queues) setQueues(data.queues)
        if (data.planningGranularity) setPlanningGranularity(data.planningGranularity)
        if (data.periods) setPeriods(data.periods)
        if (data.globalSplit) setGlobalSplit(data.globalSplit)
        if (data.queueSplits) setQueueSplits(data.queueSplits)
        if (data.bufferHC !== undefined) setBufferHC(data.bufferHC)
        if (data.queueBuffers) setQueueBuffers(data.queueBuffers)
        if (data.baseAssumptions) setBaseAssumptions(data.baseAssumptions)
        if (data.weeklyNPT) setWeeklyNPT(data.weeklyNPT)
        if (data.weeklyShrinkage) setWeeklyShrinkage(data.weeklyShrinkage)
        if (data.weeklyOccupancy) setWeeklyOccupancy(data.weeklyOccupancy)
        if (data.weeklyAHT) setWeeklyAHT(data.weeklyAHT)
        if (data.originalUploadedAHT) setOriginalUploadedAHT(data.originalUploadedAHT)
        if (data.queueSkills) setQueueSkills(data.queueSkills)
        if (data.currentHC) setCurrentHC(data.currentHC)
        if (data.attritionData) setAttritionData(data.attritionData)
        if (data.plannedAttrition) setPlannedAttrition(data.plannedAttrition)
        if (data.attritionRate) setAttritionRate(data.attritionRate)
        if (data.batches) setBatches(data.batches)
        if (data.simulations) setSimulations(data.simulations)
        if (data.activeSimulationId !== undefined) setActiveSimulationId(data.activeSimulationId)
        if (data.baselineAHTData) setBaselineAHTData(data.baselineAHTData)
        if (data.demandPlan) setDemandPlan(data.demandPlan)
        if (data.queueAssumptions) setQueueAssumptions(data.queueAssumptions)
        if (data.whatIfsSelection) setWhatIfsSelection(data.whatIfsSelection)
        if (data.locationCosts) setLocationCosts(data.locationCosts)
      }
      // Mark that initial load is complete
      isInitialMount.current = false
    } catch (error) {
      console.error('Error loading data from localStorage:', error)
      isInitialMount.current = false
    }
  }, [])

  // Save data to localStorage whenever it changes (skip initial mount)
  useEffect(() => {
    // Don't save on initial mount - wait for data to load first
    if (isInitialMount.current) {
      return
    }

    try {
      const dataToSave = {
        forecastData,
        weeks,
        queues,
        planningGranularity,
        periods,
        globalSplit,
        queueSplits,
        bufferHC,
        queueBuffers,
        baseAssumptions,
        weeklyNPT,
        weeklyShrinkage,
        weeklyOccupancy,
        weeklyAHT,
        originalUploadedAHT,
        queueSkills,
        currentHC,
        attritionData,
        plannedAttrition,
        attritionRate,
        batches,
        simulations,
        activeSimulationId,
        baselineAHTData,
        demandPlan,
        queueAssumptions,
        whatIfsSelection,
        locationCosts,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
    } catch (error) {
      console.error('Error saving data to localStorage:', error)
    }
  }, [
    forecastData, weeks, queues, planningGranularity, periods, globalSplit, queueSplits, bufferHC, queueBuffers, baseAssumptions,
    weeklyNPT, weeklyShrinkage, weeklyOccupancy, weeklyAHT, originalUploadedAHT, queueSkills, currentHC, attritionData, plannedAttrition,
    attritionRate, batches, simulations, activeSimulationId, baselineAHTData, demandPlan, queueAssumptions,
    whatIfsSelection, locationCosts
  ])

  // Export all data to JSON
  const exportAllData = useCallback(() => {
    const dataToExport = {
      forecastData,
      weeks,
      queues,
      planningGranularity,
      periods,
      globalSplit,
      queueSplits,
      bufferHC,
      queueBuffers,
      baseAssumptions,
      weeklyNPT,
      weeklyShrinkage,
      weeklyOccupancy,
      weeklyAHT,
      queueSkills,
      currentHC,
      attritionData,
      plannedAttrition,
      attritionRate,
      batches,
      simulations,
      activeSimulationId,
      demandPlan,
      queueAssumptions,
      locationCosts,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workforce-planning-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [
    forecastData, weeks, queues, planningGranularity, periods, globalSplit, queueSplits, bufferHC, queueBuffers, baseAssumptions,
    weeklyNPT, weeklyShrinkage, weeklyOccupancy, weeklyAHT, queueSkills, currentHC, attritionData, plannedAttrition,
    attritionRate, batches, simulations, activeSimulationId, demandPlan, queueAssumptions
  ])

  // Import data from JSON
  const importAllData = useCallback((jsonText) => {
    try {
      const data = JSON.parse(jsonText)
      if (data.forecastData) setForecastData(data.forecastData)
      if (data.weeks) setWeeks(data.weeks)
      if (data.queues) setQueues(data.queues)
      if (data.planningGranularity) setPlanningGranularity(data.planningGranularity)
      if (data.periods) setPeriods(data.periods)
      if (data.globalSplit) setGlobalSplit(data.globalSplit)
      if (data.queueSplits) setQueueSplits(data.queueSplits)
      if (data.bufferHC !== undefined) setBufferHC(data.bufferHC)
      if (data.queueBuffers) setQueueBuffers(data.queueBuffers)
      if (data.baseAssumptions) setBaseAssumptions(data.baseAssumptions)
      if (data.weeklyNPT) setWeeklyNPT(data.weeklyNPT)
      if (data.weeklyShrinkage) setWeeklyShrinkage(data.weeklyShrinkage)
      if (data.weeklyOccupancy) setWeeklyOccupancy(data.weeklyOccupancy)
      if (data.weeklyAHT) setWeeklyAHT(data.weeklyAHT)
      if (data.originalUploadedAHT) setOriginalUploadedAHT(data.originalUploadedAHT)
      if (data.queueSkills) setQueueSkills(data.queueSkills)
      if (data.currentHC) setCurrentHC(data.currentHC)
      if (data.attritionData) setAttritionData(data.attritionData)
      if (data.plannedAttrition) setPlannedAttrition(data.plannedAttrition)
      if (data.attritionRate) setAttritionRate(data.attritionRate)
      if (data.batches) setBatches(data.batches)
      if (data.simulations) setSimulations(data.simulations)
      if (data.activeSimulationId !== undefined) setActiveSimulationId(data.activeSimulationId)
      if (data.baselineAHTData) setBaselineAHTData(data.baselineAHTData)
      if (data.demandPlan) setDemandPlan(data.demandPlan)
      if (data.queueAssumptions) setQueueAssumptions(data.queueAssumptions)
      if (data.locationCosts) setLocationCosts(data.locationCosts)
      return true
    } catch (error) {
      console.error('Error importing data:', error)
      return false
    }
  }, [])

  // Clear all data
  const clearAllData = useCallback(() => {
    setForecastData(null)
    setWeeks([])
    setQueues([])
    setPlanningGranularity('week')
    setPeriods([])
    setWeeklyNPT({ internal: {}, external: {} })
    setWeeklyShrinkage({ internal: {}, external: {} })
    setWeeklyOccupancy({ internal: {}, external: {} })
    setWeeklyAHT({})
    setOriginalUploadedAHT({})
    setQueueSkills({})
    setCurrentHC({})
    setAttritionData({})
    setPlannedAttrition({ internal: 0, external: 0 })
    setBatches([])
    setSimulations([])
    setActiveSimulationId(null)
    setBaselineAHTData(null)
    setDemandPlan([])
    setQueueAssumptions({})
    setGlobalSplit({ external: 70, internal: 30 })
    setQueueSplits({})
    setBufferHC(10)
    setQueueBuffers({})
    setBaseAssumptions({
      internal: { npt: 15, shrinkage: 20, occupancy: 85 },
      external: { npt: 10, shrinkage: 15, occupancy: 90 }
    })
    setAttritionRate({ internal: 0.3, external: 0.3 })
    setLocationCosts({})
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  // Get all unique sites from currentHC keys
  const getSites = useCallback(() => {
    const sites = new Set()
    Object.keys(currentHC).forEach(key => {
      const parts = key.split('-')
      if (parts.length >= 3) {
        const site = parts.slice(2).join('-') // Everything after queue-timezone
        sites.add(site)
      }
    })
    return Array.from(sites).sort()
  }, [currentHC])

  // Get all unique timezones from forecastData
  const getTimezones = useCallback(() => {
    if (!forecastData) return []
    const timezones = new Set()
    forecastData.forEach(row => {
      if (row.timezone) timezones.add(row.timezone)
    })
    return Array.from(timezones).sort()
  }, [forecastData])

  // Get site-wise HC summary (aggregated across all queues and timezones)
  const getSiteWiseHC = useCallback(() => {
    const siteData = {}

    Object.entries(currentHC).forEach(([key, hc]) => {
      const parts = key.split('-')
      if (parts.length >= 3) {
        const site = parts.slice(2).join('-')

        if (!siteData[site]) {
          siteData[site] = { internal: 0, external: 0 }
        }

        siteData[site].internal += (hc.internal || 0)
        siteData[site].external += (hc.external || 0)
      }
    })

    return siteData
  }, [currentHC])

  // Get queue-timezone pairs with their sites and HC
  const getQueueTimezoneSites = useCallback(() => {
    const qtzData = {}

    Object.entries(currentHC).forEach(([key, hc]) => {
      const parts = key.split('-')
      if (parts.length >= 3) {
        const queue = parts[0]
        const timezone = parts[1]
        const site = parts.slice(2).join('-')
        const qtzKey = `${queue}-${timezone}`

        if (!qtzData[qtzKey]) {
          qtzData[qtzKey] = {
            queue,
            timezone,
            sites: {}
          }
        }

        if (!qtzData[qtzKey].sites[site]) {
          qtzData[qtzKey].sites[site] = { internal: 0, external: 0 }
        }

        qtzData[qtzKey].sites[site].internal += (hc.internal || 0)
        qtzData[qtzKey].sites[site].external += (hc.external || 0)
      }
    })

    return qtzData
  }, [currentHC])

  const value = {
    // Data
    forecastData,
    weeks,
    queues,
    planningGranularity,
    periods,

    // Split
    globalSplit,
    updateGlobalSplit,
    queueSplits,
    getQueueSplit,
    updateQueueSplit,
    resetQueueSplit,

    // Buffer
    bufferHC,
    setBufferHC,
    queueBuffers,
    getQueueBuffer,
    updateQueueBuffer,
    resetQueueBuffer,

    // Assumptions
    baseAssumptions,
    setBaseAssumptions,

    // Weekly NPT and Shrinkage (global)
    weeklyNPT,
    setWeeklyNPT,
    getNPT,
    updateNPT,
    loadWeeklyNPT,
    weeklyShrinkage,
    setWeeklyShrinkage,
    getShrinkage,
    updateShrinkage,
    loadWeeklyShrinkage,
    weeklyOccupancy,
    setWeeklyOccupancy,
    getOccupancy,
    updateOccupancy,
    loadWeeklyOccupancy,

    // AHT
    weeklyAHT,
    setWeeklyAHT,
    getAHT,
    updateAHT,
    bulkUpdateAHT,
    loadWeeklyAHT,

    // Queue-level assumptions
    queueAssumptions,
    setQueueAssumptions,
    getQueueAssumption,
    updateQueueAssumption,
    bulkUpdateQueueAssumption,
    copyBaseToQueue,
    resetSimulation,

    // Skills
    queueSkills,
    setQueueSkills,
    
    // Current HC
    currentHC,
    loadCurrentHC,
    getCurrentHC,
    setCurrentHC,
    
    // Attrition
    attritionData,
    plannedAttrition,
    setPlannedAttrition,
    attritionRate,
    setAttritionRate,
    updateAttrition,
    getAttrition,
    
    // Batches
    batches,
    addBatch,
    updateBatch,
    deleteBatch,
    getBatchHCForWeek,
    getTrainingHCForWeek,
    
    // Simulations
    simulations,
    activeSimulationId,
    setActiveSimulationId,
    baselineAHTData,
    setBaselineAHTData,
    addSimulation,
    updateSimulation,
    deleteSimulation,

    // Demand Plan
    demandPlan,
    finalizeSimulation,

    // What-Ifs page UI selection
    whatIfsSelection,
    setWhatIfsSelection,

    // Calculations
    calculateRequiredHC,

    // Actions
    loadForecastData,
    clearAllData,

    // Persistence
    exportAllData,
    importAllData,

    // Executive View Helpers
    getSites,
    getTimezones,
    getSiteWiseHC,
    getQueueTimezoneSites,

    // Cost Analysis
    locationCosts,
    setLocationCosts
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useApp must be used within AppProvider')
  }
  return context
}
