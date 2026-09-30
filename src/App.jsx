import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'

import { ErrorBoundary } from './components/ErrorBoundary'

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Orders = lazy(() => import('./pages/Orders').then((m) => ({ default: m.Orders })))
const OrderForm = lazy(() => import('./pages/OrderForm').then((m) => ({ default: m.OrderForm })))
const Customers = lazy(() => import('./pages/Customers').then((m) => ({ default: m.Customers })))
const CustomerDetail = lazy(() => import('./pages/Customers').then((m) => ({ default: m.CustomerDetail })))
const Products = lazy(() => import('./pages/Products').then((m) => ({ default: m.Products })))
const Categories = lazy(() => import('./pages/Categories').then((m) => ({ default: m.Categories })))
const Inventory = lazy(() => import('./pages/Inventory').then((m) => ({ default: m.Inventory })))
const Reports = lazy(() => import('./pages/Reports').then((m) => ({ default: m.Reports })))
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })))

function AppRoutes() {
  const { bootstrapping } = useApp()
  if (bootstrapping) {
    return <div className="min-h-svh grid place-items-center bg-[#0F0F0F] text-white"><Spinner label="Starting RiSports…" /></div>
  }
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-svh grid place-items-center bg-[#0F0F0F] text-white"><Spinner /></div>}>
        <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/new" element={<OrderForm mode="create" />} />
          <Route path="/orders/:id" element={<OrderForm mode="view" />} />
          <Route path="/orders/:id/edit" element={<OrderForm mode="edit" />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/products" element={<Products />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  )
}
