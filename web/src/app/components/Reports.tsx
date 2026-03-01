import { useEffect, useState } from 'react';
import { reportsAPI, deviceAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { FileText, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

export function Reports() {
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('all');
  const [days, setDays] = useState('30');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  async function loadDevices() {
    try {
      const { devices: data } = await deviceAPI.list();
      setDevices(data || []);
    } catch (error: any) {
      console.error('Load devices error:', error);
    }
  }

  async function generateReport() {
    setLoading(true);
    try {
      const deviceId = selectedDevice === 'all' ? undefined : selectedDevice;
      const { report: data, period, generatedAt } = await reportsAPI.getUptimeReport(
        parseInt(days),
        deviceId
      );
      setReport({ report: data, period, generatedAt });
      toast.success('Report generated successfully');
    } catch (error: any) {
      console.error('Generate report error:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  }

  function downloadReport() {
    if (!report) return;

    const csv = generateCSV(report.report);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uptime-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  }

  function generateCSV(reportData: any[]) {
    const headers = ['Device Name', 'IP Address', 'Total Polls', 'Successful Polls', 'Failed Polls', 'Uptime %', 'Current Status', 'Last Polled'];
    const rows = reportData.map(item => [
      item.deviceName,
      item.ipAddress,
      item.totalPolls,
      item.successfulPolls,
      item.failedPolls,
      item.uptimePercentage,
      item.currentStatus,
      item.lastPolled || 'Never'
    ]);
    
    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }

  function getUptimeColor(uptime: number) {
    if (uptime >= 99) return 'text-midnight-status-success';
    if (uptime >= 95) return 'text-midnight-status-warning';
    return 'text-midnight-status-critical';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-midnight-text-primary">Reports</h1>
        <p className="text-midnight-text-secondary mt-1">Generate uptime and reliability reports for clients</p>
      </div>

      {/* Report Configuration */}
      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader>
          <CardTitle className="text-midnight-text-primary">Generate Uptime Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-midnight-text-primary">Device</label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Devices</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-midnight-text-primary">Time Period</label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 Days</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="60">Last 60 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={generateReport} disabled={loading} className="w-full bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Results */}
      {report && (
        <>
          <Card className="bg-midnight-card border border-midnight-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-midnight-text-primary">Uptime Report</CardTitle>
                  <p className="text-sm text-midnight-text-secondary mt-1">
                    Generated on {new Date(report.generatedAt).toLocaleString()}
                  </p>
                </div>
                <Button variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg" onClick={downloadReport}>
                  <Download className="w-4 h-4 mr-2" />
                  Download CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-midnight-bg border border-midnight-border">
                  <CardContent className="pt-6">
                    <div className="text-xs text-midnight-text-secondary mb-1">Devices Monitored</div>
                    <div className="text-2xl font-bold text-midnight-text-primary">{report.report.length}</div>
                  </CardContent>
                </Card>
                <Card className="bg-midnight-bg border border-midnight-border">
                  <CardContent className="pt-6">
                    <div className="text-xs text-midnight-text-secondary mb-1">Average Uptime</div>
                    <div className="text-2xl font-bold text-midnight-text-primary">
                      {(report.report.reduce((sum: number, item: any) => sum + parseFloat(item.uptimePercentage), 0) / report.report.length).toFixed(2)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-midnight-bg border border-midnight-border">
                  <CardContent className="pt-6">
                    <div className="text-xs text-midnight-text-secondary mb-1">Total Polls</div>
                    <div className="text-2xl font-bold text-midnight-text-primary">
                      {report.report.reduce((sum: number, item: any) => sum + item.totalPolls, 0)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-midnight-bg border border-midnight-border">
                  <CardContent className="pt-6">
                    <div className="text-xs text-midnight-text-secondary mb-1">Failed Polls</div>
                    <div className="text-2xl font-bold text-midnight-status-critical">
                      {report.report.reduce((sum: number, item: any) => sum + item.failedPolls, 0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-midnight-border">
                      <th className="text-left py-3 px-4 font-medium text-sm text-midnight-text-secondary">Device</th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-midnight-text-secondary">IP Address</th>
                      <th className="text-right py-3 px-4 font-medium text-sm text-midnight-text-secondary">Total Polls</th>
                      <th className="text-right py-3 px-4 font-medium text-sm text-midnight-text-secondary">Successful</th>
                      <th className="text-right py-3 px-4 font-medium text-sm text-midnight-text-secondary">Failed</th>
                      <th className="text-right py-3 px-4 font-medium text-sm text-midnight-text-secondary">Uptime %</th>
                      <th className="text-center py-3 px-4 font-medium text-sm text-midnight-text-secondary">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.report.map((item: any) => {
                      const uptime = parseFloat(item.uptimePercentage);
                      return (
                        <tr key={item.deviceId} className="border-b border-midnight-border hover:bg-midnight-bg">
                          <td className="py-3 px-4 font-medium text-midnight-text-primary">{item.deviceName}</td>
                          <td className="py-3 px-4 font-mono text-sm text-midnight-text-primary">{item.ipAddress}</td>
                          <td className="py-3 px-4 text-right text-midnight-text-primary">{item.totalPolls}</td>
                          <td className="py-3 px-4 text-right text-midnight-status-success">{item.successfulPolls}</td>
                          <td className="py-3 px-4 text-right text-midnight-status-critical">{item.failedPolls}</td>
                          <td className={`py-3 px-4 text-right font-bold ${getUptimeColor(uptime)}`}>
                            <div className="flex items-center justify-end gap-1">
                              {uptime >= 95 ? (
                                <TrendingUp className="w-4 h-4" />
                              ) : (
                                <TrendingDown className="w-4 h-4" />
                              )}
                              {uptime}%
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              variant={item.currentStatus === 'up' ? 'default' : 'destructive'}
                            >
                              {item.currentStatus}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Report Footer */}
              <div className="mt-6 p-4 bg-midnight-bg border border-midnight-border rounded-lg">
                <h4 className="font-medium mb-2 text-midnight-text-primary">Report Summary</h4>
                <ul className="text-sm text-midnight-text-secondary space-y-1">
                  <li>• Reporting period: {days} days (from {new Date(report.period.startDate).toLocaleDateString()})</li>
                  <li>• Devices with 99%+ uptime: {report.report.filter((item: any) => parseFloat(item.uptimePercentage) >= 99).length}</li>
                  <li>• Devices requiring attention: {report.report.filter((item: any) => parseFloat(item.uptimePercentage) < 95).length}</li>
                  <li>• This report can be shared with clients to demonstrate network reliability</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!report && (
        <Card className="bg-midnight-card border border-midnight-border">
          <CardContent className="text-center py-12">
            <FileText className="w-16 h-16 text-midnight-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-midnight-text-primary">No report generated</h3>
            <p className="text-midnight-text-secondary">Select your parameters and click Generate Report to create a client-facing uptime report</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
