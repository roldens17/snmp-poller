import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Server, Webhook, CheckCircle2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickStartProps {
  hasDevices: boolean;
  hasWebhooks: boolean;
  dismissed?: boolean;
  onDismiss?: () => void;
}

export function QuickStart({ hasDevices, hasWebhooks, dismissed = false, onDismiss }: QuickStartProps) {
  const completed = [hasDevices, hasWebhooks].filter(Boolean).length;
  if (dismissed || completed >= 2) return null;

  return (
    <Card className="border border-midnight-border bg-midnight-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-midnight-text-primary flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-midnight-accent" />
            Get production-ready in 2 steps
          </CardTitle>
          <button onClick={onDismiss} className="text-xs text-midnight-text-secondary hover:text-midnight-text-primary">Skip for now</button>
        </div>
        <p className="text-xs text-midnight-text-secondary">Estimated time: 3 minutes • Setup progress: {completed}/2 complete</p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="flex items-start gap-3 p-3 bg-midnight-bg border border-midnight-border rounded-lg">
            <CheckCircle2 className={`w-5 h-5 mt-0.5 ${hasDevices ? 'text-green-500' : 'text-midnight-text-secondary'}`} />
            <div className="flex-1">
              <h4 className="font-semibold mb-1 text-midnight-text-primary">Add your first device to start SLA tracking</h4>
              <p className="text-sm text-midnight-text-secondary mb-2">Configure SNMP settings and verify connectivity.</p>
              {!hasDevices && (
                <Link to="/devices">
                  <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg">
                    <Server className="w-4 h-4 mr-2" />
                    Go to Devices
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-midnight-bg border border-midnight-border rounded-lg">
            <CheckCircle2 className={`w-5 h-5 mt-0.5 ${hasWebhooks ? 'text-green-500' : 'text-midnight-text-secondary'}`} />
            <div className="flex-1">
              <h4 className="font-semibold mb-1 text-midnight-text-primary">Connect an alert destination for real-time incidents</h4>
              <p className="text-sm text-midnight-text-secondary mb-2">Webhook delivery lets your team respond faster.</p>
              {!hasWebhooks && (
                <Link to="/webhooks">
                  <Button size="sm" variant="outline" className="border-midnight-border text-midnight-text-primary bg-midnight-card hover:bg-midnight-bg">
                    <Webhook className="w-4 h-4 mr-2" />
                    Configure Webhooks
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
