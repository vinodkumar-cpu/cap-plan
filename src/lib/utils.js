import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '-'
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

export function getShortMonth(monthNum) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months[(monthNum - 1) % 12] || ''
}

export function getMonthName(monthNum) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return months[(monthNum - 1) % 12] || ''
}

export function weekToMonth(weekNum) {
  // Approximate: 4.33 weeks per month
  return Math.ceil(weekNum / 4.33)
}

export function getWeeksForMonth(monthNum) {
  // Returns approximate weeks for a month (1-indexed)
  const weeksPerMonth = [4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5] // Rough distribution
  let startWeek = 1
  for (let i = 0; i < monthNum - 1; i++) {
    startWeek += weeksPerMonth[i]
  }
  const endWeek = startWeek + weeksPerMonth[monthNum - 1] - 1
  const weeks = []
  for (let w = startWeek; w <= endWeek && w <= 52; w++) {
    weeks.push(w.toString())
  }
  return weeks
}

export function groupWeeksByMonth(weeks) {
  const monthGroups = {}

  // Get current month to determine year context (1-12)
  const currentMonth = new Date().getMonth() + 1

  // Check if we have weeks that span year boundary
  const weekNumbers = weeks.map(w => parseInt(w))
  const hasHighWeeks = weekNumbers.some(w => w >= 49) // Dec weeks (49-52)
  const hasLowWeeks = weekNumbers.some(w => w <= 13)  // Jan-Mar weeks (1-13)
  const spansYearBoundary = hasHighWeeks && hasLowWeeks

  weeks.forEach(week => {
    const weekNum = parseInt(week)
    let monthNum
    let displayOrder

    if (spansYearBoundary) {
      // Data spans year boundary - determine order based on current date
      // When we have both high weeks (49-52) and low weeks (1-13), we need to determine
      // which year each belongs to based on the current month

      // Most common case: weeks 49-52 are from previous Dec, weeks 1-13 are current year
      // This is true when uploaded between Dec-Jun (months 12, 1-6)
      if (currentMonth === 12 || currentMonth <= 6) {
        // We're in Dec-Jun, so weeks 49-52 are from LAST year (previous Dec)
        // Order: weeks 49-52 first (previous Dec), then 1-52 (current year Jan onwards)
        if (weekNum >= 49) {
          monthNum = 12 // December (previous year)
          displayOrder = 0 // Show first
        } else {
          monthNum = weekToMonth(weekNum)
          displayOrder = monthNum // Follow natural order after Dec
        }
      } else {
        // We're in Jul-Nov, so if we see weeks 1-13, they're likely for NEXT year
        // This is less common but handles mid-year planning
        if (weekNum >= 49) {
          monthNum = 12 // December (current year)
          displayOrder = monthNum
        } else {
          // Weeks 1-13 are next year, show them after current year
          monthNum = weekToMonth(weekNum)
          displayOrder = 12 + monthNum // Show after current Dec
        }
      }
    } else {
      // No year boundary spanning - normal sequential ordering
      monthNum = weekToMonth(weekNum)
      displayOrder = monthNum
    }

    const key = `${displayOrder}-${monthNum}`

    if (!monthGroups[key]) {
      monthGroups[key] = {
        month: getMonthName(monthNum),
        monthNum,
        displayOrder,
        weeks: []
      }
    }
    monthGroups[key].weeks.push(week)
  })

  return Object.values(monthGroups).sort((a, b) => a.displayOrder - b.displayOrder)
}

export function generateCSVTemplate() {
  let csv = 'QUEUE,TIMEZONE'
  for (let i = 1; i <= 52; i++) {
    csv += `,${i}`
  }
  csv += '\nQueue1,EST'
  for (let i = 1; i <= 52; i++) {
    csv += ',1000'
  }
  return csv
}

export function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Maps calendar months (Jan-Dec) to their corresponding week numbers
// Based on standard 4-4-5 week distribution pattern (52 weeks total)
export function getCalendarWeeksForMonth(monthNum) {
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

// Converts a monthly AHT value to populate all weeks in that month
export function expandMonthlyAHTToWeeks(monthlyData) {
  const weeklyData = {}

  Object.keys(monthlyData).forEach(monthNum => {
    const ahtValue = monthlyData[monthNum]
    const weeks = getCalendarWeeksForMonth(parseInt(monthNum))

    weeks.forEach(weekNum => {
      weeklyData[weekNum] = ahtValue
    })
  })

  return weeklyData
}
