import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { BleProvider } from './context/BleContext'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import DevPanel from './components/DevPanel'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import History from './pages/History'
import Chat from './pages/Chat'
import Device from './pages/patient/Device'
import Play from './pages/patient/Play'
import Dashboard from './pages/physio/Dashboard'
import FindPatients from './pages/physio/FindPatients'
import Watch from './pages/physio/Watch'
import Admin from './pages/admin/Admin'
import { PrefsProvider } from './context/PrefsContext'

const only = (roles, el) => <ProtectedRoute roles={roles}>{el}</ProtectedRoute>

export default function App() {
  return (
    <AuthProvider>
      <PrefsProvider>
      <BleProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/login" replace />} />
              <Route path="device" element={only(['patient'], <Device />)} />
              <Route path="play" element={only(['patient'], <Play />)} />
              <Route path="history" element={only(['patient'], <History />)} />
              <Route path="dashboard" element={only(['physiotherapist'], <Dashboard />)} />
              <Route path="patients" element={only(['physiotherapist'], <FindPatients />)} />
              <Route path="patients/:pid/history" element={only(['physiotherapist'], <History />)} />
              <Route path="watch/:pid" element={only(['physiotherapist'], <Watch />)} />
              <Route path="admin" element={only(['admin'], <Admin />)} />
              <Route path="chat" element={only(['patient', 'physiotherapist'], <Chat />)} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <DevPanel />
        </BrowserRouter>
      </BleProvider>
      </PrefsProvider>
    </AuthProvider>
  )
}
