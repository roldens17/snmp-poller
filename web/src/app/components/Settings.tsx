import { useEffect, useState } from 'react';
import { authAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Settings as SettingsIcon, Building2, Bell, Database } from 'lucide-react';
import { toast } from 'sonner';

export function Settings() {
  const [tenant, setTenant] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    pollInterval: 60,
    alertThreshold: 3,
    retentionDays: 90,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const session = await authAPI.getSession();
      setUser(session.user);
      setTenant(session.tenant);
      
      if (session.tenant?.settings) {
        setSettings(session.tenant.settings);
      }
    } catch (error: any) {
      console.error('Load settings error:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    toast.info('Tenant settings write endpoint is not available yet in the Go backend.');
    setSaving(false);
  }

  if (loading) {
    return <div className="text-center py-8 text-midnight-text-secondary">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-midnight-text-primary">Settings</h1>
        <p className="text-midnight-text-secondary mt-1">Manage your account and monitoring preferences</p>
      </div>

      {/* Organization Settings */}
      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            <CardTitle className="text-midnight-text-primary">Organization</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input value={tenant?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Organization ID</Label>
              <Input value={tenant?.id || ''} disabled className="font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Owner</Label>
            <Input value={user?.name || user?.email || ''} disabled />
          </div>
          <div className="space-y-2">
            <Label>Created</Label>
            <Input
              value={tenant?.created_at ? new Date(tenant.created_at).toLocaleString() : ''}
              disabled
            />
          </div>
        </CardContent>
      </Card>

      {/* Monitoring Settings */}
      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            <CardTitle className="text-midnight-text-primary">Monitoring Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pollInterval">Poll Interval (seconds)</Label>
            <Input
              id="pollInterval"
              type="number"
              min="30"
              max="3600"
              value={settings.pollInterval}
              onChange={(e) => setSettings({ ...settings, pollInterval: parseInt(e.target.value) })}
            />
            <p className="text-xs text-midnight-text-secondary">
              How often to poll devices for status updates. Minimum: 30 seconds, Maximum: 1 hour
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="alertThreshold">Alert Threshold (failed polls)</Label>
            <Input
              id="alertThreshold"
              type="number"
              min="1"
              max="10"
              value={settings.alertThreshold}
              onChange={(e) => setSettings({ ...settings, alertThreshold: parseInt(e.target.value) })}
            />
            <p className="text-xs text-midnight-text-secondary">
              Number of consecutive failed polls before creating an incident
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="retentionDays">Data Retention (days)</Label>
            <Input
              id="retentionDays"
              type="number"
              min="7"
              max="365"
              value={settings.retentionDays}
              onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })}
            />
            <p className="text-xs text-midnight-text-secondary">
              How long to keep historical metrics and incident data
            </p>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alert Preferences */}
      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <CardTitle className="text-midnight-text-primary">Alert Preferences</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-midnight-bg border border-midnight-border rounded-lg">
              <h4 className="font-medium text-midnight-text-primary mb-2">Webhook Notifications</h4>
              <p className="text-sm text-midnight-text-secondary">
                Configure webhooks in the Webhooks section to receive real-time notifications
                when incidents occur. Webhooks support Slack, Discord, Microsoft Teams, and custom endpoints.
              </p>
            </div>
            
            <div className="text-sm text-midnight-text-secondary">
              <p className="mb-2">Supported notification events:</p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Incident created</li>
                <li>Incident resolved</li>
                <li>Device down</li>
                <li>Device recovered</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            <CardTitle className="text-midnight-text-primary">System Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-midnight-text-secondary">Platform Version</span>
              <span className="font-medium text-midnight-text-primary">1.0.0</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-midnight-text-secondary">SNMP Protocol</span>
              <span className="font-medium text-midnight-text-primary">v1, v2c, v3</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-midnight-text-secondary">API Status</span>
              <span className="font-medium text-midnight-status-success">Operational</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Profile */}
      <Card className="bg-midnight-card border border-midnight-border">
        <CardHeader>
          <CardTitle className="text-midnight-text-primary">Your Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={user?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={user?.role || 'user'} disabled className="capitalize" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
