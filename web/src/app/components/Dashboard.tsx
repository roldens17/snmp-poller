import { useEffect, useState } from 'react';
import { reportsAPI, incidentAPI, deviceAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Server, AlertTriangle, Activity, TrendingUp } from 'lucide-react';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { QuickStart } from './QuickStart';

export function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [summaryRes, incidentsRes, devicesRes] = await Promise.all([
        reportsAPI.getHealthSummary(),
        incidentAPI.list('open'),
        deviceAPI.list(),
      ]);

      setSummary(summaryRes.summary);
      setIncidents(incidentsRes.incidents || []);
      setDevices(devicesRes.devices || []);
    } catch (error: any) {
      console.error('Dashboard load error:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  async function pollAllDevices() {
    if (polling) return;
    setPolling(true);
    toast.info('Polling all devices...');

    try {
      const pollPromises = devices.map(device => 
        deviceAPI.poll(device.id).catch(err => {
          console.error(`Failed to poll ${device.name}:`, err);
          return null;
        })
      );
      
      await Promise.all(pollPromises);
      await loadData();
      toast.success('All devices polled successfully');
    } catch (error: any) {
      console.error('Polling error:', error);
      toast.error('Failed to poll devices');
    } finally {
      setPolling(false);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-midnight-text-secondary">Loading dashboard...</div>;
  }

  const upPercentage = parseFloat(summary?.devices?.availability || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-midnight-text-primary">Dashboard</h1>
          <p className="text-midnight-text-secondary mt-1">Network health overview</p>
        </div>
        <button
          onClick={pollAllDevices}
          disabled={polling || devices.length === 0}
          className="px-4 py-2 bg-midnight-accent text-midnight-text-primary rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {polling ? 'Polling...' : 'Poll All Devices'}
        </button>
      </div>

      {/* Show Quick Start if no devices */}
      {devices.length === 0 && <QuickStart />}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-midnight-text-secondary">Total Devices</CardTitle>
            <Server className="w-4 h-4 text-midnight-text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-midnight-text-primary">{summary?.devices?.total || 0}</div>
            <p className="text-xs text-midnight-text-secondary mt-1">
              {summary?.devices?.up || 0} up, {summary?.devices?.down || 0} down
            </p>
          </CardContent>
        </Card>

        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-midnight-text-secondary">Availability</CardTitle>
            <Activity className="w-4 h-4 text-midnight-text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-midnight-text-primary">{upPercentage.toFixed(1)}%</div>
            <Progress value={upPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-midnight-text-secondary">Open Incidents</CardTitle>
            <AlertTriangle className="w-4 h-4 text-midnight-status-critical" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-midnight-status-critical">{summary?.incidents?.open || 0}</div>
            <p className="text-xs text-midnight-text-secondary mt-1">
              {summary?.incidents?.total || 0} total incidents
            </p>
          </CardContent>
        </Card>

        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-midnight-text-secondary">Network Health</CardTitle>
            <TrendingUp className="w-4 h-4 text-midnight-text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upPercentage >= 95 ? (
                <span className="text-midnight-status-success">Excellent</span>
              ) : upPercentage >= 80 ? (
                <span className="text-midnight-status-success">Good</span>
              ) : (
                <span className="text-midnight-status-critical">Poor</span>
              )}
            </div>
            <p className="text-xs text-midnight-text-secondary mt-1">Overall network status</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Incidents */}
        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader>
            <CardTitle className="text-midnight-text-primary">Open Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <p className="text-midnight-text-secondary text-sm py-4">No open incidents</p>
            ) : (
              <div className="space-y-3">
                {incidents.slice(0, 5).map((incident) => (
                  <div key={incident.id} className="flex items-start gap-3 p-3 rounded-lg bg-midnight-status-critical/10 border border-midnight-border border-l-2 border-l-midnight-status-critical">
                    <AlertTriangle className="w-5 h-5 text-midnight-status-critical mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-midnight-text-primary">{incident.deviceName}</span>
                        <Badge variant="destructive" className="text-xs">
                          {incident.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-midnight-text-secondary">{incident.description}</p>
                      <p className="text-xs text-midnight-text-secondary mt-1">
                        {new Date(incident.startTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {incidents.length > 5 && (
                  <Link to="/incidents" className="text-sm text-midnight-accent hover:underline block text-center pt-2">
                    View all {incidents.length} incidents →
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Device Status */}
        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader>
            <CardTitle className="text-midnight-text-primary">Device Status</CardTitle>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <div className="text-center py-8">
                <Server className="w-12 h-12 text-midnight-text-secondary mx-auto mb-3" />
                <p className="text-midnight-text-secondary text-sm mb-3">No devices configured</p>
                <Link
                  to="/devices"
                  className="inline-block px-4 py-2 bg-midnight-accent text-midnight-text-primary rounded-md hover:bg-blue-600 text-sm"
                >
                  Add Your First Device
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-center justify-between p-3 bg-midnight-bg border border-midnight-border rounded-lg hover:bg-midnight-card transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          device.status === 'up'
                            ? 'bg-green-500'
                            : device.status === 'down'
                            ? 'bg-red-500'
                            : 'bg-gray-400'
                        }`}
                      />
                      <div>
                        <div className="font-medium text-sm text-midnight-text-primary">{device.name}</div>
                        <div className="text-xs text-midnight-text-secondary">{device.ipAddress}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={device.status === 'up' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {device.status}
                      </Badge>
                      {device.lastPolled && (
                        <div className="text-xs text-midnight-text-secondary mt-1">
                          {new Date(device.lastPolled).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
