import { useEffect, useState } from 'react';
import { deviceAPI } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Server, Plus, Trash2, Play, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

export function Devices() {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    ipAddress: '',
    snmpVersion: '2c',
    snmpCommunity: 'public',
    snmpPort: '161',
    description: '',
  });

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      const { devices: data } = await deviceAPI.list();
      setDevices(data || []);
    } catch (error: any) {
      console.error('Load devices error:', error);
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      await deviceAPI.create(formData);
      toast.success('Device added successfully');
      setDialogOpen(false);
      setFormData({
        name: '',
        ipAddress: '',
        snmpVersion: '2c',
        snmpCommunity: 'public',
        snmpPort: '161',
        description: '',
      });
      loadDevices();
    } catch (error: any) {
      console.error('Create device error:', error);
      toast.error(error.message || 'Failed to add device');
    }
  }

  async function handleDelete(deviceId: string) {
    if (!confirm('Are you sure you want to delete this device?')) return;

    try {
      await deviceAPI.delete(deviceId);
      toast.success('Device deleted');
      loadDevices();
    } catch (error: any) {
      console.error('Delete device error:', error);
      toast.error('Failed to delete device');
    }
  }

  async function handlePoll(device: any) {
    try {
      toast.info(`Polling ${device.name}...`);
      await deviceAPI.poll(device.id);
      toast.success(`${device.name} polled successfully`);
      loadDevices();
    } catch (error: any) {
      console.error('Poll device error:', error);
      toast.error(`Failed to poll ${device.name}`);
    }
  }

  async function viewMetrics(device: any) {
    setSelectedDevice(device);
    setMetricsDialogOpen(true);
    
    try {
      const { metrics: data } = await deviceAPI.getMetrics(device.id, 50);
      setMetrics(data || []);
    } catch (error: any) {
      console.error('Load metrics error:', error);
      toast.error('Failed to load metrics');
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-midnight-text-secondary">Loading devices...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-midnight-text-primary">Devices</h1>
          <p className="text-midnight-text-secondary mt-1">Manage your monitored network devices</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-midnight-card border-midnight-border text-midnight-text-primary">
            <DialogHeader>
              <DialogTitle>Add New Device</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-midnight-text-primary">Device Name</Label>
                <Input
                  id="name"
                  placeholder="Router-01"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ipAddress" className="text-midnight-text-primary">IP Address</Label>
                <Input
                  id="ipAddress"
                  placeholder="192.168.1.1"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="snmpVersion" className="text-midnight-text-primary">SNMP Version</Label>
                  <Select
                    value={formData.snmpVersion}
                    onValueChange={(value) => setFormData({ ...formData, snmpVersion: value })}
                  >
                    <SelectTrigger id="snmpVersion">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">v1</SelectItem>
                      <SelectItem value="2c">v2c</SelectItem>
                      <SelectItem value="3">v3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="snmpPort" className="text-midnight-text-primary">SNMP Port</Label>
                  <Input
                    id="snmpPort"
                    placeholder="161"
                    value={formData.snmpPort}
                    onChange={(e) => setFormData({ ...formData, snmpPort: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="snmpCommunity" className="text-midnight-text-primary">SNMP Community String</Label>
                <Input
                  id="snmpCommunity"
                  placeholder="public"
                  value={formData.snmpCommunity}
                  onChange={(e) => setFormData({ ...formData, snmpCommunity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-midnight-text-primary">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Main office router"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">Add Device</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {devices.length === 0 ? (
        <Card className="bg-midnight-card border border-midnight-border">
          <CardContent className="text-center py-12">
            <Server className="w-16 h-16 text-midnight-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-midnight-text-primary">No devices yet</h3>
            <p className="text-midnight-text-secondary mb-4">Get started by adding your first network device</p>
            <Button className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600" onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-midnight-card border border-midnight-border">
          <CardHeader>
            <CardTitle className="text-midnight-text-primary">All Devices ({devices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-midnight-border">
                    <th className="text-left py-3 px-4 font-medium text-sm text-midnight-text-secondary">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-midnight-text-secondary">Device Name</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-midnight-text-secondary">IP Address</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-midnight-text-secondary">SNMP Version</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-midnight-text-secondary">Last Polled</th>
                    <th className="text-left py-3 px-4 font-medium text-sm text-midnight-text-secondary">Metrics</th>
                    <th className="text-right py-3 px-4 font-medium text-sm text-midnight-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device) => (
                    <tr key={device.id} className="border-b border-midnight-border hover:bg-midnight-bg">
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            device.status === 'up'
                              ? 'default'
                              : device.status === 'down'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {device.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-midnight-text-primary">{device.name}</div>
                        {device.description && (
                          <div className="text-xs text-midnight-text-secondary">{device.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-midnight-text-primary">{device.ipAddress}</td>
                      <td className="py-3 px-4 text-sm text-midnight-text-primary">{device.snmpVersion}</td>
                      <td className="py-3 px-4 text-sm text-midnight-text-primary">
                        {device.lastPolled ? (
                          <div>
                            <div>{new Date(device.lastPolled).toLocaleDateString()}</div>
                            <div className="text-xs text-midnight-text-secondary">
                              {new Date(device.lastPolled).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-midnight-text-secondary">Never</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-midnight-text-primary">
                        {device.lastMetrics && (
                          <div className="space-y-1">
                            {device.lastMetrics.responseTime && (
                              <div className="text-xs">
                                RT: {device.lastMetrics.responseTime}ms
                              </div>
                            )}
                            {device.lastMetrics.cpuUsage !== null && (
                              <div className="text-xs">
                                CPU: {device.lastMetrics.cpuUsage}%
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg"
                              onClick={() => viewMetrics(device)}
                            >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg"
                              onClick={() => handlePoll(device)}
                            >
                            <Play className="w-4 h-4" />
                          </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-midnight-border text-midnight-status-critical bg-midnight-card hover:bg-midnight-bg"
                              onClick={() => handleDelete(device.id)}
                            >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Dialog */}
      <Dialog open={metricsDialogOpen} onOpenChange={setMetricsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-midnight-card border-midnight-border text-midnight-text-primary">
          <DialogHeader>
            <DialogTitle>
              Metrics: {selectedDevice?.name}
            </DialogTitle>
          </DialogHeader>
          {metrics.length === 0 ? (
            <p className="text-midnight-text-secondary text-center py-8">No metrics available yet. Poll the device to collect data.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-midnight-bg border border-midnight-border">
                  <CardContent className="pt-6">
                    <div className="text-xs text-midnight-text-secondary mb-1">Avg Response Time</div>
                    <div className="text-2xl font-bold text-midnight-text-primary">
                      {(metrics.reduce((sum, m) => sum + (m.responseTime || 0), 0) / metrics.filter(m => m.responseTime).length).toFixed(0)}ms
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-midnight-bg border border-midnight-border">
                  <CardContent className="pt-6">
                    <div className="text-xs text-midnight-text-secondary mb-1">Uptime</div>
                    <div className="text-2xl font-bold text-midnight-text-primary">
                      {((metrics.filter(m => m.status === 'up').length / metrics.length) * 100).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-midnight-bg border border-midnight-border">
                  <CardContent className="pt-6">
                    <div className="text-xs text-midnight-text-secondary mb-1">Total Polls</div>
                    <div className="text-2xl font-bold text-midnight-text-primary">{metrics.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-midnight-bg border border-midnight-border">
                  <CardContent className="pt-6">
                    <div className="text-xs text-midnight-text-secondary mb-1">Failed Polls</div>
                    <div className="text-2xl font-bold text-midnight-status-critical">
                      {metrics.filter(m => m.status === 'down').length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-medium mb-3">Recent Metrics</h4>
                <div className="space-y-2">
                  {metrics.slice(0, 20).map((metric, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            metric.status === 'up' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-gray-600">
                          {new Date(metric.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs">
                        {metric.responseTime && <span>RT: {metric.responseTime}ms</span>}
                        {metric.cpuUsage !== null && <span>CPU: {metric.cpuUsage}%</span>}
                        {metric.memoryUsage !== null && <span>MEM: {metric.memoryUsage}%</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
