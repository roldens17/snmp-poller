import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { Switches } from './pages/Switches';
import { DeviceDetail } from './pages/DeviceDetail';
import { Topology } from './pages/Topology';
import { Reports } from './pages/Reports';
import { Alerts } from './pages/Alerts';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/switches" element={<Switches />} />
          <Route path="/devices/:id" element={<DeviceDetail />} />
          <Route path="/topology" element={<Topology />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
