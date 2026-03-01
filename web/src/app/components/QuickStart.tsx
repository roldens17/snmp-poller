import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Server, Webhook, FileText, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function QuickStart() {
  return (
    <Card className="border-2 border-midnight-border bg-midnight-card">
      <CardHeader>
        <CardTitle className="text-midnight-text-primary">Quick Start Guide</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-midnight-text-secondary">
            Welcome to NetMonitor! Get started with these simple steps:
          </p>
          
          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 bg-midnight-bg border border-midnight-border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-midnight-accent text-midnight-text-primary flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1 text-midnight-text-primary">Add Your Devices</h4>
                <p className="text-sm text-midnight-text-secondary mb-2">
                  Configure your network devices with SNMP settings
                </p>
                <Link to="/devices">
                  <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg">
                    <Server className="w-4 h-4 mr-2" />
                    Go to Devices
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-midnight-bg border border-midnight-border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-midnight-accent text-midnight-text-primary flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1 text-midnight-text-primary">Start Monitoring</h4>
                <p className="text-sm text-midnight-text-secondary mb-2">
                  Poll your devices to begin collecting health metrics
                </p>
                  <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg" disabled>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Auto-polls every 60 seconds
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-midnight-bg border border-midnight-border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-midnight-accent text-midnight-text-primary flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1 text-midnight-text-primary">Setup Alerts (Optional)</h4>
                <p className="text-sm text-midnight-text-secondary mb-2">
                  Configure webhooks to receive incident notifications
                </p>
                <Link to="/webhooks">
                  <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg">
                    <Webhook className="w-4 h-4 mr-2" />
                    Configure Webhooks
                  </Button>
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-midnight-bg border border-midnight-border rounded-lg">
              <div className="w-8 h-8 rounded-full bg-midnight-accent text-midnight-text-primary flex items-center justify-center font-bold flex-shrink-0">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-semibold mb-1 text-midnight-text-primary">Generate Reports</h4>
                <p className="text-sm text-midnight-text-secondary mb-2">
                  Create professional uptime reports for your clients
                </p>
                <Link to="/reports">
                  <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg">
                    <FileText className="w-4 h-4 mr-2" />
                    View Reports
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
