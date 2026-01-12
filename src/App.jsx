import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Assumptions from './pages/Assumptions'
import CurrentHC from './pages/CurrentHC'
import Attrition from './pages/Attrition'
import Batches from './pages/Batches'
import WhatIfs from './pages/WhatIfs'
import DemandPlan from './pages/DemandPlan'
import ExecView from './pages/ExecView'
import Cost from './pages/Cost'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="exec-view" element={<ExecView />} />
            <Route path="assumptions" element={<Assumptions />} />
            <Route path="current-hc" element={<CurrentHC />} />
            <Route path="attrition" element={<Attrition />} />
            <Route path="batches" element={<Batches />} />
            <Route path="what-ifs" element={<WhatIfs />} />
            <Route path="demand-plan" element={<DemandPlan />} />
            <Route path="cost" element={<Cost />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}


