import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { Switches } from './pages/Switches';
import { DeviceDetail } from './pages/DeviceDetail';
import { DeviceNew } from './pages/DeviceNew';
import { Topology } from './pages/Topology';
import { Reports } from './pages/Reports';
import { Alerts } from './pages/Alerts';
import { Settings } from './pages/Settings';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Login } from './pages/Login';


function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <Layout user={user} onLogout={logout}>
      <Routes location={location}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/devices/new" element={<DeviceNew />} />
        <Route path="/switches" element={<Switches />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="/topology" element={<Topology />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
