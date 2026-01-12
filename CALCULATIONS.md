# Project Calculations Documentation

This document provides a comprehensive list of all calculations used in the workforce capacity planning application.

---

## Table of Contents

1. [Core HC Requirement Calculation](#1-core-hc-requirement-calculation)
2. [Dashboard Metrics Calculations](#2-dashboard-metrics-calculations)
3. [Demand Plan Calculations](#3-demand-plan-calculations)
4. [Attrition Calculations](#4-attrition-calculations)
5. [Batch HC Calculations](#5-batch-hc-calculations)
6. [What-If Simulation Calculations](#6-what-if-simulation-calculations)
7. [Executive View Calculations](#7-executive-view-calculations)
8. [Current HC Calculations](#8-current-hc-calculations)
9. [Utility Calculations](#9-utility-calculations)
10. [Summary Statistics](#summary-statistics)

---

## 1. Core HC Requirement Calculation

**Location:** `src/context/AppContext.jsx:675-681`
**Function:** `calculateRequiredHC`

### Description
Core workforce planning formula that calculates required headcount based on operational parameters.

### Formula
```javascript
const availableMinutesPerWeek = 40 * 60 // 2,400 minutes
const effectiveTime = availableMinutesPerWeek * (1 - npt / 100) * (1 - shrinkage / 100)
const productiveTime = effectiveTime * (occupancy / 100)
const timeNeeded = volume * ahtMinutes
return productiveTime > 0 ? timeNeeded / productiveTime : 0
```

### Parameters
- **volume**: Number of transactions/calls to handle
- **ahtMinutes**: Average Handle Time in minutes
- **npt**: Non-Productive Time percentage
- **shrinkage**: Shrinkage percentage (leave, breaks, etc.)
- **occupancy**: Occupancy percentage (productive vs idle time)

### Output
Required headcount (FTE) to handle the given volume

---

## 2. Dashboard Metrics Calculations

**Location:** `src/pages/Dashboard.jsx`

### 2.1 Queue Split Percentage Calculation
**Lines:** 68-69

```javascript
splitPct = type === 'external' ? queueSplit.external / 100 : queueSplit.internal / 100
```

Converts queue split from percentage to decimal for internal/external allocation.

---

### 2.2 Volume Calculation
**Line:** 80

```javascript
volume = (row.volumes[week] || 0) * splitPct
```

Calculates actual volume for a queue type by applying the split percentage.

---

### 2.3 HC with Buffer
**Line:** 92

```javascript
totalRequiredHCWithBuffer += reqHC * (1 + bufferHC / 100)
```

Adds buffer percentage to required headcount for contingency planning.

---

### 2.4 Average HC Calculations
**Lines:** 99-102

```javascript
avgRequiredHCNoBuffer = totalRequiredHCNoBuffer / periodWeeks.length
avgRequiredHCWithBuffer = totalRequiredHCWithBuffer / periodWeeks.length
avgBatchHC = totalBatchHC / periodWeeks.length
avgTrainingHC = totalTrainingHC / periodWeeks.length
```

Calculates average headcount metrics across selected period weeks.

---

### 2.5 Production HC
**Line:** 106

```javascript
productionHC = actualHC + avgBatchHC
```

Combines actual headcount with batch headcount for production capacity.

---

### 2.6 Over/Under Gap
**Lines:** 107-108

```javascript
overUnder = actualHC - avgRequiredHCWithBuffer
overUnderPct = avgRequiredHCWithBuffer > 0 ? (overUnder / avgRequiredHCWithBuffer) * 100 : 0
```

Calculates staffing gap (positive = overstaffed, negative = understaffed) and gap percentage.

---

### 2.7 Totals Aggregation
**Lines:** 147-148

```javascript
overUnder = totals.actualHC - totals.requiredHCWithBuffer
overUnderPct = totals.requiredHCWithBuffer > 0 ? (totals.overUnder / totals.requiredHCWithBuffer) * 100 : 0
```

Aggregates gap calculations across all queue-timezone combinations.

---

## 3. Demand Plan Calculations

**Location:** `src/pages/DemandPlan.jsx`

### 3.1 Queue Split Percentage
**Lines:** 78-79, 184

```javascript
splitPct = type === 'external' ? queueSplit.external / 100 : queueSplit.internal / 100
```

Converts queue split percentage to decimal for volume calculations.

---

### 3.2 Monthly Volume Aggregation
**Lines:** 129, 196

```javascript
volume = (row.volumes[week] || 0) * splitPct
```

Aggregates weekly volumes by month with queue split applied.

---

### 3.3 Required HC with Buffer
**Lines:** 151, 201

```javascript
monthTotalRequiredHC += reqHC * (1 + bufferHC / 100)
```

Calculates monthly required HC including buffer percentage.

---

### 3.4 Average Required HC
**Lines:** 159, 214, 222

```javascript
avgRequiredHC = monthTotalRequiredHC / weeksCount
```

Calculates average required headcount per month.

---

### 3.5 Gap Calculation
**Lines:** 160, 210, 229-230

```javascript
gap = monthTotalActualHC - avgRequiredHC
overall[type].gap = overall[type].actualHC - overall[type].requiredHC
```

Computes monthly and overall staffing gaps.

---

### 3.6 Assumption Averages
**Lines:** 168-171

```javascript
npt: totalNPT / weeksCount
shrinkage: totalShrinkage / weeksCount
occupancy: totalOccupancy / weeksCount
aht: totalAHT / weeksCount
```

Calculates average operational assumptions across weeks in a month.

---

### 3.7 Batch HC Aggregation
**Line:** 321

```javascript
batches.reduce((s, b) => s + b.hcCount, 0)
```

Sums total headcount across all batches.

---

## 4. Attrition Calculations

**Location:** `src/pages/Attrition.jsx`

### 4.1 Total HC Calculation
**Lines:** 41-47

Sums all internal and external HC across all queue-timezone combinations for attrition baseline.

---

### 4.2 Planned Flat Attrition
**Lines:** 64-65

```javascript
total += (totalHC * plannedPct / 100) * weeks.length
```

Calculates total attrition impact over selected weeks using flat percentage.

---

### 4.3 Weekly Attrition HC
**Lines:** 106, 133

```javascript
Math.round(totalHC * (plannedAttrition[type] / 100))
```

Calculates headcount lost to attrition per week.

---

## 5. Batch HC Calculations

**Location:** `src/context/AppContext.jsx`

### 5.1 Training Duration Calculation
**Lines:** 526-528

```javascript
startWeek = parseInt(batch.startWeek)
trainingDuration = parseInt(batch.trainingDuration)
trainingEnd = startWeek + trainingDuration - 1
```

Determines the week range when a batch is in training.

---

### 5.2 Ramp Curve Application
**Lines:** 579-584, 587-588

```javascript
weeksAfterTraining = normalizedWeek - finalTrainingWeek
monthsAfterTraining = Math.floor((weeksAfterTraining - 1) / weeksPerMonth) // weeksPerMonth = 4
rampPct = batch.rampCurve[rampIndex] / 100
totalHC += batch.hcCount * rampPct
```

### Description
Applies productivity ramp curve to new hires after training completion. Batches gradually increase productivity over several months.

### Process
1. Calculate weeks elapsed since training completion
2. Convert weeks to months (using 4 weeks/month)
3. Look up ramp percentage for that month
4. Apply ramp percentage to batch headcount

---

### 5.3 Total New HC and Upskilling HC
**Location:** `src/pages/Batches.jsx:134-135`

```javascript
totalNewHC = batches.filter(b => b.batchType === 'new').reduce((sum, b) => sum + b.hcCount, 0)
totalUpskillHC = batches.filter(b => b.batchType === 'upskilling').reduce((sum, b) => sum + b.hcCount, 0)
```

Separates and totals headcount by batch type (new hires vs upskilling).

---

## 6. What-If Simulation Calculations

**Location:** `src/pages/WhatIfs.jsx`

### 6.1 Baseline HC Calculation
**Lines:** 205-206

```javascript
baselineHC = calculateRequiredHC(volume, baseAHT, baseNPT, baseShrinkage, baseOccupancy)
baselineWithBuffer = baselineHC * (1 + bufferHC / 100)
```

Calculates baseline required HC using current operational parameters.

---

### 6.2 Simulated HC Calculation
**Lines:** 213-214

```javascript
simulatedHC = calculateRequiredHC(volume, simAHT, simNPT, simShrinkage, simOccupancy)
simulatedWithBuffer = simulatedHC * (1 + bufferHC / 100)
```

Calculates required HC with simulated "what-if" parameters.

---

### 6.3 HC Savings Calculation
**Line:** 217

```javascript
hcSavings = baselineWithBuffer - simulatedWithBuffer
```

### Description
Computes headcount savings by comparing baseline vs simulated scenarios.

**Positive savings** = Efficiency improvement
**Negative savings** = Additional HC required

---

### 6.4 Total Savings Calculations
**Lines:** 423, 436, 456

```javascript
simulationResults.baseline.reduce((a, b) => a + b, 0)
simulationResults.simulated.reduce((a, b) => a + b, 0)
simulationResults.savings.reduce((a, b) => a + b, 0)
```

Aggregates baseline, simulated, and savings HC across all weeks.

---

## 7. Executive View Calculations

**Location:** `src/pages/ExecView.jsx`

### 7.1 Queue-Timezone Metrics
**Lines:** 57-93

```javascript
// Sums across all weeks
totalRequiredHCWithBuffer = totalRequiredHCNoBuffer * (1 + bufferHC / 100)
```

Aggregates volume, required HC, batch HC, and training HC for each queue-timezone combination.

---

### 7.2 Site-Level Proportional Allocation
**Lines:** 112-139

```javascript
siteShare = totalActual > 0 ? siteActual / totalActual : 0
internalRequired += internalMetrics.totalRequiredHCWithBuffer * siteShare
externalRequired += externalMetrics.totalRequiredHCWithBuffer * siteShare
```

### Description
Distributes required HC to sites proportionally based on their share of actual headcount.

### Logic
- Calculate site's proportion of total actual HC
- Apply same proportion to required HC calculations

---

### 7.3 Total Summary Calculations
**Lines:** 142-169

```javascript
totalInternalActual, totalExternalActual, totalInternalRequired, totalExternalRequired
totalActual = totalInternalActual + totalExternalActual
totalRequired = totalInternalRequired + totalExternalRequired
internalGap = totalInternalActual - totalInternalRequired
externalGap = totalExternalActual - totalExternalRequired
totalGap = totalActual - totalRequired
```

Computes organization-wide totals and gaps for internal, external, and combined HC.

---

### 7.4 Site Gap Calculations
**Lines:** 286-288

```javascript
internalGap = siteHC.internal - siteRequired.internal
externalGap = siteHC.external - siteRequired.external
totalGap = internalGap + externalGap
```

Calculates staffing gaps at site level.

---

## 8. Current HC Calculations

**Location:** `src/pages/CurrentHC.jsx`

### 8.1 Total HC Aggregation
**Lines:** 176-182

Reduces all currentHC entries to compute total internal and external headcount.

---

### 8.2 Compound Attrition Calculation
**Lines:** 130-137

```javascript
const weeklyAttritionRate = attritionRate[type] / 100
let currentHC = startingHC
for (let i = 1; i < weekNumber; i++) {
  currentHC = currentHC * (1 - weeklyAttritionRate)
}
```

### Description
Applies **compound attrition** week-over-week to project future headcount.

### Formula
`HC(week n) = HC(week 0) × (1 - attrition rate)^n`

This models exponential decay similar to compound interest in reverse.

---

### 8.3 Weekly HC Projections
**Lines:** 148-170

```javascript
internalHC = calculateHCWithAttrition(hc.internal, 'internal', weekNum)
externalHC = calculateHCWithAttrition(hc.external, 'external', weekNum)
totalInternal += internalHC
totalExternal += externalHC
combined = totalInternal + totalExternal
```

Projects headcount forward applying compound attrition, then aggregates by queue-timezone.

---

## 9. Utility Calculations

**Location:** `src/lib/utils.js`

### 9.1 Week to Month Conversion
**Lines:** 26-29

```javascript
Math.ceil(weekNum / 4.33)
```

### Description
Approximates which month a week falls into using 4.33 weeks per month average.

**Note:** This is an approximation. Actual calendar months vary.

---

### 9.2 Week-Month Grouping
**Lines:** 46-112

Complex logic that groups weeks by calendar month with year boundary detection and proper display ordering.

---

### 9.3 Month Distribution Pattern
**Lines:** 31-44

```javascript
[4, 4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5]
```

### Description
Distributes 52 weeks across 12 months using a **4-4-5 calendar pattern**.

This is a common retail/manufacturing calendar system where:
- Quarters have 13 weeks each
- Each quarter has two 4-week months and one 5-week month

---

## Summary Statistics

- **Total Unique Calculations Identified:** 50+
- **Files Containing Calculations:** 7
- **Core Calculation Engine:** `calculateRequiredHC` (AppContext.jsx)

### Primary Calculation Categories

1. **Headcount Requirement Formulas** (5 variations)
   - Core HC calculation
   - With buffer
   - With ramp curve
   - With training adjustments
   - With attrition

2. **Aggregation/Summation** (15+)
   - Volume totals
   - HC totals by type
   - Weekly/monthly summaries
   - Site-level rollups

3. **Percentage Calculations** (10+)
   - Queue splits
   - Buffer percentages
   - Gap percentages
   - Ramp percentages
   - Attrition rates

4. **Attrition Modeling** (3 methods)
   - Flat weekly attrition
   - Compound weekly attrition
   - Planned attrition projections

5. **Ramp Curve Applications** (2)
   - New hire productivity ramp
   - Month-based ramp progression

6. **Gap Analysis** (8+)
   - Over/under staffing
   - Site gaps
   - Type gaps (internal/external)
   - Percentage gaps

7. **Proportional Allocations** (4)
   - Site share distribution
   - Queue split allocation
   - Volume distribution

8. **Time Series Modeling** (1)
   - Compound attrition decay formula

---

## Key Formulas Reference

### Required HC Formula
```
Required HC = (Volume × AHT) / (Available Time × (1 - NPT%) × (1 - Shrinkage%) × Occupancy%)
```

Where:
- Available Time = 40 hours/week × 60 minutes = 2,400 minutes

### HC with Buffer
```
HC with Buffer = Required HC × (1 + Buffer%)
```

### Compound Attrition
```
HC(week n) = Starting HC × (1 - Weekly Attrition Rate)^n
```

### Ramp Curve HC
```
Effective HC = Batch HC Count × Ramp%
```
Where Ramp% increases monthly: Month 1 (50%), Month 2 (75%), Month 3+ (100%)

### Gap Calculation
```
Gap = Actual HC - Required HC (with Buffer)
Gap% = (Gap / Required HC) × 100
```

---

## Notes

- All percentage inputs are converted to decimals (divided by 100) before calculation
- Zero-division checks are implemented where applicable
- Rounding is applied to final HC counts using `Math.round()`
- Week numbering is 1-indexed (Week 1 through Week 52)
- Month calculations use both 4.33 average and 4-4-5 calendar patterns depending on context

---

**Document Generated:** 2026-01-06
**Project:** Workforce Capacity Planning Application
