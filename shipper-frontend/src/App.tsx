import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './stores/authStore'
import Home from './pages/Home'
import About from './pages/About'
import Contact from './pages/Contact'
import Login from './pages/Login'
import ShipperOrderList from './pages/shipper/OrderList'
import ShipperOrderDetail from './pages/shipper/OrderDetail'
import UpdatePayment from './pages/shipper/UpdatePayment'
import NotePhoto from './pages/shipper/NotePhoto'
import ShipperRoutes from './pages/shipper/ShipperRoutes'
import ShipperTransfers from './pages/shipper/ShipperTransfers'
import AccountantDashboard from './pages/accountant/Dashboard'
import AccountantOrderPool from './pages/accountant/OrderPool'
import AccountantOrderDetail from './pages/accountant/OrderDetail'
import AccountantRoutes from './pages/accountant/AccountantRoutes'
import ImportXlsx from './pages/accountant/ImportXlsx'
import UnmatchedTx from './pages/accountant/UnmatchedTx'
import Reports from './pages/accountant/Reports'
import AdminUsers from './pages/admin/Users'
import AdminConfig from './pages/admin/Config'
import AuditLogs from './pages/admin/AuditLogs'
import RouteManagement from './pages/admin/RouteManagement'
import SePayPage from './pages/admin/SePayPage'
import AiAssistantWidget from './components/AiAssistantWidget'
import LampToggle from './components/LampToggle'

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Reset scroll on route change; smooth-scroll to anchor when hash present.
function ScrollToTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      // Defer until DOM has the new page mounted
      const id = hash.slice(1)
      requestAnimationFrame(() => {
        const el = document.getElementById(id)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        else window.scrollTo({ top: 0 })
      })
    } else {
      window.scrollTo({ top: 0 })
    }
  }, [pathname, hash])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />

        {/* Shipper */}
        <Route path="/shipper/routes" element={<RequireAuth roles={['Shipper']}><ShipperRoutes /></RequireAuth>} />
        <Route path="/shipper/transfers" element={<RequireAuth roles={['Shipper']}><ShipperTransfers /></RequireAuth>} />
        <Route path="/shipper/orders" element={<RequireAuth roles={['Shipper']}><ShipperOrderList /></RequireAuth>} />
        <Route path="/shipper/orders/:id" element={<RequireAuth roles={['Shipper']}><ShipperOrderDetail /></RequireAuth>} />
        <Route path="/shipper/orders/:id/payment" element={<RequireAuth roles={['Shipper']}><UpdatePayment /></RequireAuth>} />
        <Route path="/shipper/orders/:id/photo" element={<RequireAuth roles={['Shipper']}><NotePhoto /></RequireAuth>} />

        {/* Accountant */}
        <Route path="/accountant/dashboard" element={<RequireAuth roles={['Accountant', 'Admin']}><AccountantDashboard /></RequireAuth>} />
        <Route path="/accountant/orders" element={<RequireAuth roles={['Accountant', 'Admin']}><AccountantOrderPool /></RequireAuth>} />
        <Route path="/accountant/orders/:id" element={<RequireAuth roles={['Accountant', 'Admin']}><AccountantOrderDetail /></RequireAuth>} />
        <Route path="/accountant/routes" element={<RequireAuth roles={['Accountant', 'Admin']}><AccountantRoutes /></RequireAuth>} />
        <Route path="/accountant/import" element={<RequireAuth roles={['Accountant', 'Admin']}><ImportXlsx /></RequireAuth>} />
        <Route path="/accountant/unmatched" element={<RequireAuth roles={['Accountant', 'Admin']}><UnmatchedTx /></RequireAuth>} />
        <Route path="/accountant/reports" element={<RequireAuth roles={['Accountant', 'Admin']}><Reports /></RequireAuth>} />

        {/* Admin */}
        <Route path="/admin/users" element={<RequireAuth roles={['Admin']}><AdminUsers /></RequireAuth>} />
        <Route path="/admin/routes" element={<RequireAuth roles={['Accountant', 'Admin']}><RouteManagement /></RequireAuth>} />
        <Route path="/admin/sepay" element={<RequireAuth roles={['Accountant', 'Admin']}><SePayPage /></RequireAuth>} />
        <Route path="/admin/config" element={<RequireAuth roles={['Admin']}><AdminConfig /></RequireAuth>} />
        <Route path="/admin/audit-logs" element={<RequireAuth roles={['Admin']}><AuditLogs /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AiAssistantWidget />
      <LampToggle />
    </BrowserRouter>
  )
}
