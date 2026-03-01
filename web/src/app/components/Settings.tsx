import { useEffect, useState } from 'react';
import { authAPI, inviteAPI } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { Settings as SettingsIcon, Building2, Bell, Database, Send, Trash2, Copy } from 'lucide-react';
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

  const [invites, setInvites] = useState<any[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'viewer', expiresInHours: 72 });
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

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

      const inv = await inviteAPI.list();
      setInvites(inv?.invites || []);
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

  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreatingInvite(true);
    try {
      const res = await inviteAPI.create(inviteForm.email, inviteForm.role as any, Number(inviteForm.expiresInHours));
      setInviteForm({ email: '', role: 'viewer', expiresInHours: 72 });
      setInvites(prev => [res.invite, ...prev]);
      const url = res?.accept?.url || (res?.accept?.token ? `${window.location.origin}/accept-invite?token=${res.accept.token}` : '');
      setInviteLink(url);
      toast.success('Invite created');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invite');
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleDeleteInvite(id: string) {
    if (!confirm('Delete this invite?')) return;
    try {
      await inviteAPI.remove(id);
      setInvites(prev => prev.filter(i => i.id !== id));
      toast.success('Invite deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete invite');
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied');
  }

  if (loading) {
    return <div className="text-center py-8 text-midnight-text-secondary">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-midnight-text-primary">Settings</h1>
          <p className="text-midnight-text-secondary mt-1">Manage your account, invites, and monitoring preferences</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            document.getElementById('invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600"
        >
          <Send className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </div>

      <Card id="invite-section" className="bg-midnight-card border border-midnight-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            <CardTitle className="text-midnight-text-primary">Tenant Invites</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateInvite} className="grid md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2 space-y-2">
              <Label>Email</Label>
              <Input placeholder="user@example.com" value={inviteForm.email} onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select className="w-full h-10 rounded-md border border-midnight-border bg-midnight-bg px-3 text-sm" value={inviteForm.role} onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
            </div>
            <Button type="submit" disabled={creatingInvite} className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">
              {creatingInvite ? 'Creating...' : 'Create Invite'}
            </Button>
          </form>

          {inviteLink && (
            <div className="p-3 rounded-lg border border-midnight-border bg-midnight-bg">
              <div className="text-xs text-midnight-text-secondary mb-1">Latest invite link</div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-midnight-text-primary break-all flex-1">{inviteLink}</code>
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  <Copy className="w-4 h-4 mr-1" /> Copy
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {invites.length === 0 ? (
              <p className="text-sm text-midnight-text-secondary">No pending invites.</p>
            ) : invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border border-midnight-border bg-midnight-bg">
                <div>
                  <div className="text-sm text-midnight-text-primary">{inv.email}</div>
                  <div className="text-xs text-midnight-text-secondary">role={inv.role} • expires {new Date(inv.expires_at).toLocaleString()}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleDeleteInvite(inv.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
            <Input value={tenant?.created_at ? new Date(tenant.created_at).toLocaleString() : ''} disabled />
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
            <Input id="pollInterval" type="number" min="30" max="3600" value={settings.pollInterval} onChange={(e) => setSettings({ ...settings, pollInterval: parseInt(e.target.value) })} />
            <p className="text-xs text-midnight-text-secondary">How often to poll devices for status updates. Minimum: 30 seconds, Maximum: 1 hour</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="alertThreshold">Alert Threshold (failed polls)</Label>
            <Input id="alertThreshold" type="number" min="1" max="10" value={settings.alertThreshold} onChange={(e) => setSettings({ ...settings, alertThreshold: parseInt(e.target.value) })} />
            <p className="text-xs text-midnight-text-secondary">Number of consecutive failed polls before creating an incident</p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="retentionDays">Data Retention (days)</Label>
            <Input id="retentionDays" type="number" min="7" max="365" value={settings.retentionDays} onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })} />
            <p className="text-xs text-midnight-text-secondary">How long to keep historical metrics and incident data</p>
          </div>

          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving} className="bg-midnight-accent text-midnight-text-primary hover:bg-blue-600">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
