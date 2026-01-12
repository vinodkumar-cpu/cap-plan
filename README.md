# Capacity Planner

A React-based workforce capacity planning tool to plan headcount requirements, manage staffing, track attrition, and run what-if scenarios for optimal resource allocation.

## Features

- **Volume Forecasting**: Upload call/transaction volumes by queue and timezone
- **Capacity Calculation**: Automated HC calculations based on AHT, NPT, Shrinkage, and Occupancy
- **Staffing Management**: Configure internal/external splits with queue-level overrides
- **Batch Planning**: Manage new hire and upskilling batches with ramp-up curves
- **Attrition Tracking**: Plan for weekly or percentage-based attrition rates
- **What-If Scenarios**: Simulate AHT changes and analyze impact on capacity
- **Executive Views**: Site-wise and queue-wise demand plan summaries
- **Data Persistence**: Automatic save to localStorage with export/import capabilities

## Tech Stack

- **Frontend**: React 18.2, React Router 6.21
- **Build Tool**: Vite 5.0
- **Styling**: Tailwind CSS 3.4
- **Icons**: Lucide React
- **State Management**: React Context API + localStorage

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Runs the development server at `http://localhost:5173`

## Build

```bash
npm run build
```

Creates production build in `/dist` directory

## Project Structure

```
/src
├── /pages              # Main application routes
│   ├── Dashboard.jsx   # Overview and metrics
│   ├── Assumptions.jsx # NPT, Shrinkage, Occupancy config
│   ├── CurrentHC.jsx   # Headcount management
│   ├── Attrition.jsx   # Attrition planning
│   ├── Batches.jsx     # Training batch management
│   ├── WhatIfs.jsx     # Scenario simulations
│   ├── DemandPlan.jsx  # Finalized capacity plan
│   └── ExecView.jsx    # Executive summary
├── /components         # UI components
│   ├── Layout.jsx      # App layout wrapper
│   ├── Sidebar.jsx     # Navigation sidebar
│   └── /ui             # Reusable UI components
├── /context
│   └── AppContext.jsx  # Global state management
├── /lib
│   └── utils.js        # Utility functions
├── App.jsx             # Route definitions
└── main.jsx            # React entry point
```

## Capacity Formula

```
Required HC = (Volume × AHT) / (Available Time × (1 - NPT%) × (1 - Shrinkage%) × Occupancy%)

Where:
- Available Time = 2,400 minutes/week (40 hours)
- NPT = Non-Productive Time percentage
- Shrinkage = Planned absence percentage
- Occupancy = Target occupancy rate
```

## Usage Workflow

1. **Upload Data**: Import forecast volumes, AHT, and current headcount via CSV
2. **Configure Assumptions**: Set base NPT, Shrinkage, Occupancy rates with weekly overrides
3. **Define Splits**: Configure internal/external staffing ratios and buffer percentages
4. **Add Batches**: Plan new hire training schedules with ramp-up curves
5. **Track Attrition**: Input weekly attrition or planned attrition rates
6. **Run Scenarios**: Create what-if simulations by adjusting AHT values
7. **Generate Plan**: Review demand plan with comprehensive HC breakdowns
8. **Export Results**: Download capacity plans for stakeholder review

## Key Pages

- **Dashboard** (`/`) - High-level metrics and KPIs
- **Assumptions** (`/assumptions`) - Core planning parameters
- **Current HC** (`/current-hc`) - Existing headcount by site/timezone
- **Batches** (`/batches`) - Training batch scheduling
- **What-Ifs** (`/what-ifs`) - Scenario analysis tool
- **Demand Plan** (`/demand-plan`) - Finalized capacity requirements
- **Exec View** (`/exec-view`) - Executive summary dashboard

## Data Formats

All CSV uploads support weekly or monthly formats with proper queue, type, and timezone breakdowns. Sample data files are included for reference.

## Browser Support

Modern browsers with ES6+ support (Chrome, Firefox, Safari, Edge)

## License

Proprietary
