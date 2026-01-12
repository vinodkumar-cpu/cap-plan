# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Capacity Planner is a workforce capacity planning application for contact centers. It calculates required headcount based on volume forecasts, AHT (Average Handle Time), and operational assumptions (NPT, Shrinkage, Occupancy). The application supports both weekly (1-52) and monthly (Jan-Dec) planning granularities.

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:5173

# Production
npm run build        # Build for production (output: /dist)
npm run preview      # Preview production build

# No tests configured in this project
```

## Architecture

### State Management: AppContext

**Critical**: All application state lives in `src/context/AppContext.jsx`. This is a React Context that manages:

- **Forecast data**: Volumes by queue/timezone/period
- **Planning granularity**: `'week'` (1-52) or `'month'` (Jan-Dec) - auto-detected from CSV upload
- **AHT data**: `weeklyAHT` object storing AHT values per queue/type/period
- **Assumptions**: NPT, Shrinkage, Occupancy (global + queue-level overrides)
- **Current HC**: Headcount by queue/timezone/site
- **Batches**: Training batches with ramp curves
- **Simulations**: What-if scenarios with modified AHT
- **Demand Plan**: Finalized capacity requirements

**State Persistence**: All state auto-saves to localStorage on every change (except initial mount). Data structure stored under key `'workforce-planning-data'`.

### Data Flow: CSV Upload → Granularity Detection → Storage

1. **Forecast Upload** (`loadForecastData`):
   - Detects format: checks if headers contain month names (Jan-Dec) vs week numbers (1-52)
   - Sets `planningGranularity` to `'month'` or `'week'`
   - Stores volumes with period keys matching the detected format
   - Sets `weeks` array to either `['Jan', 'Feb', ...]` or `['1', '2', ..., '52']`

2. **AHT Upload** (`loadWeeklyAHT`):
   - Detects CSV format (monthly vs weekly)
   - **Critical behavior**: If AHT CSV is monthly but `planningGranularity === 'week'`:
     - Automatically expands monthly values to all weeks in that month
     - Example: `Jan: 12.6` becomes `{'1': 12.6, '2': 12.6, '3': 12.6, '4': 12.6}`
   - If both are monthly: stores with month names as keys
   - Month-to-week mapping defined in `getCalendarWeeksForMonth()` helper

3. **Other CSV Uploads** (NPT, Shrinkage, Occupancy, Current HC):
   - Support both formats with auto-detection
   - NPT/Shrinkage/Occupancy stored globally by type (internal/external)
   - Current HC uses composite keys: `{queue}-{timezone}-{site}`

### Capacity Calculation Formula

```javascript
// Core formula in calculateRequiredHC()
const availableMinutesPerWeek = 40 * 60  // 2,400 minutes
const effectiveTime = availableMinutesPerWeek * (1 - npt/100) * (1 - shrinkage/100)
const productiveTime = effectiveTime * (occupancy/100)
const timeNeeded = volume * ahtMinutes
const requiredHC = timeNeeded / productiveTime
```

Applied per period (week or month), with buffer % added for final requirement.

### Key Architecture Patterns

1. **Granularity Handling**:
   - Components check `planningGranularity` to determine display mode
   - Dashboard `displayPeriods` useMemo adapts to show weeks or months
   - Calculations work with `periodWeeks` arrays that contain either week numbers or month names

2. **Queue-Level Overrides**:
   - Splits (internal/external %): Falls back to global if not set per queue
   - Buffer %: Falls back to global if not set per queue
   - Assumptions (NPT/Shrinkage/Occupancy): Falls back to weekly global, then base assumptions

3. **Batch HC Calculation** (`getBatchHCForWeek`):
   - Handles year-boundary spanning (week 52 → week 1)
   - Applies ramp curves after training period ends
   - Supports both week-level and month-level ramp granularity

4. **Simulation Management**:
   - Active simulation modifies AHT values in `weeklyAHT`
   - Original values preserved in `originalUploadedAHT` for reset
   - Deactivating simulation restores original AHT

### React Hooks Order Critical Points

**IMPORTANT**: The Dashboard component has hooks that must be called before conditional returns:

```javascript
// These useMemo hooks MUST be called before the `if (!forecastData)` return
const monthlyGroups = useMemo(...)
const displayPeriods = useMemo(...)

// Then conditional return is safe
if (!forecastData) return <UploadPrompt />
```

Breaking this order causes "Rendered more hooks than during the previous render" errors.

### Path Aliasing

Vite configured with `@` alias pointing to `/src`:
```javascript
import { useApp } from '@/context/AppContext'
import { Card } from '@/components/ui/card'
```

### CSV Format Examples

**Forecast (Monthly)**:
```
QUEUE,TIMEZONE,Jan,Feb,Mar,...,Dec
Queue1,CENTRAL,1000,1200,1100,...,1050
```

**Forecast (Weekly)**:
```
QUEUE,TIMEZONE,1,2,3,...,52
Queue1,CENTRAL,250,260,240,...,270
```

**AHT**:
```
queue,type,Jan,Feb,Mar,...,Dec    # or 1,2,3,...,52 for weekly
Queue1,internal,12.5,13.0,...
Queue1,external,10.2,10.5,...
```

**Current HC**:
```
queue,timezone,site,internal,external
Queue1,CENTRAL,Manila,50,100
```

### Component Communication

- All pages use `useApp()` hook to access context
- No prop drilling - all state accessed via context
- Pages trigger context methods (e.g., `loadForecastData`, `updateAHT`)
- Context updates trigger re-renders across all consuming components

### Month-to-Week Mapping

Used throughout the app for conversions:
```javascript
1: [1,2,3,4]         // Jan: weeks 1-4
2: [5,6,7,8]         // Feb: weeks 5-8
3: [9,10,11,12,13]   // Mar: weeks 9-13 (5 weeks)
...
12: [48,49,50,51,52] // Dec: weeks 48-52 (5 weeks)
```

5-week months: March, June, September, December

## Common Pitfalls

1. **AHT not appearing**: Likely mismatch between forecast granularity and AHT keys. Check console logs from `loadWeeklyAHT` to verify expansion logic ran.

2. **Missing key props**: When mapping inside another map, the outermost element needs a `key`. Use `<Fragment key={...}>` not `<>`.

3. **Hook order errors**: Ensure all hooks are called before any conditional returns. Move useMemo/useState/useEffect above early returns.

4. **NaN in calculations**: If AHT is null/undefined, calculations return 0 HC. Check AHT upload completed successfully.

5. **LocalStorage quota**: Large datasets may exceed 5-10MB localStorage limit. Export/import feature provides backup.

## UI Components

All UI components in `src/components/ui/` follow shadcn/ui patterns with Tailwind CSS and class-variance-authority for variants. Component styling uses `cn()` utility to merge Tailwind classes.

## Router Configuration

React Router v6 with future flags enabled in `App.jsx`:
```javascript
<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
```

This suppresses deprecation warnings and opts into v7 behavior.
