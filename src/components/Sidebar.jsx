import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Settings,
  UserMinus,
  Users,
  FlaskConical,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  Upload,
  Zap,
  UserCheck,
  Menu,
  X,
  Building2,
  DollarSign
} from 'lucide-react'
import { useState } from 'react'
import { useApp } from '@/context/AppContext'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/assumptions', icon: Settings, label: 'Assumptions' },
  { path: '/current-hc', icon: UserCheck, label: 'Current HC' },
  { path: '/attrition', icon: UserMinus, label: 'Attrition' },
  { path: '/batches', icon: Users, label: 'Batches' },
  { path: '/what-ifs', icon: FlaskConical, label: 'What-Ifs' },
  { path: '/demand-plan', icon: FileCheck, label: 'Demand Plan' },
  { path: '/cost', icon: DollarSign, label: 'Cost Analysis' },
  { path: '/exec-view', icon: Building2, label: 'Executive View' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { forecastData, queues, weeks } = useApp()

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 bg-slate-900 text-white rounded-lg shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-50 flex flex-col",
        collapsed ? "w-16" : "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Mobile Close Button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 p-1 hover:bg-slate-800 rounded"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg p-0.4" style={{ background: 'linear-gradient(to bottom right, #9FE870, #163300)' }}>
              <img src="/favicon-32x32.png" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="font-bold text-lg leading-tight tracking-tight">Capacity</h1>
                <p className="text-xs text-slate-400">Planning Tool</p>
              </div>
            )}
          </div>
        </div>

        {/* Data Status */}
        {!collapsed && forecastData && (
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#9FE870' }}></div>
              <span className="text-slate-300">Data Loaded</span>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {queues.length} queues • {weeks.length} weeks
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                      isActive
                        ? "border"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                    style={isActive ? { backgroundColor: 'rgba(159, 232, 112, 0.2)', color: '#9FE870', borderColor: 'rgba(159, 232, 112, 0.3)' } : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" style={isActive ? { color: '#9FE870' } : undefined} />
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Upload Section */}
        {!collapsed && !forecastData && (
          <div className="p-4 border-t border-slate-700">
            <NavLink
              to="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-white"
              style={{ backgroundColor: '#163300' }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#0f2200'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#163300'}
            >
              <Upload className="w-4 h-4" />
              Upload Forecast
            </NavLink>
          </div>
        )}

        {/* Collapse Button - Desktop Only */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full items-center justify-center shadow-lg transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>

        {/* Footer */}
        {!collapsed && (
          <div className="p-4 border-t border-slate-700">
            <div className="text-xs text-slate-500 text-center">
            
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
