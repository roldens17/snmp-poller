import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Trash2, Plus, Bell, Settings as SettingsIcon, Save, X, Shield, CreditCard, Send, FileClock, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-100 text-amber-700 border-amber-200',
    red: 'bg-rose-100 text-rose-700 border-rose-200',
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${tones[tone]}`}>{children}</span>;
}

export function Settings() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedTabs = ['billing', 'invites', 'alerts', 'audit'];
  const rawTab = searchParams.get('tab') || 'billing';
  const tabFromUrl = allowedTabs.includes(rawTab) ? rawTab : 'billing';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [dests, setDests] = useState([]);
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookFormData, setWebhookFormData] = useState({ name: '', url: '', is_enabled: true });

  const [plan, setPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ plan_code: 'starter', billing_status: 'active', max_devices: 100 });

  const [invites, setInvites] = useState([]);
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'viewer', expires_in_hours: 72 });
  const [inviteResult, setInviteResult] = useState(null);

  const [auditEvents, setAuditEvents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  const [busy, setBusy] = useState({
    savePlan: false,
    createInvite: false,
    createWebhook: false,
    deletingInviteId: '',
    deletingWebhookId: '',
    togglingWebhookId: '',
  });

  const notify = (message, type = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  const deliveryStats = useMemo(() => {
    const total = deliveries.length;
    const failed = deliveries.filter(d => !d.success).length;
    const success = total - failed;
    return { total, success, failed };
  }, [deliveries]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [destRes, planRes, inviteRes, auditRes, deliveryRes] = await Promise.all([
        api.getAlertDestinations(),
        api.getBillingPlan(),
        api.getInvites(),
        api.getAuditEvents(50),
        api.getAlertDeliveries(50),
      ]);

      setDests(destRes.destinations || []);
      setPlan(planRes || null);
      setPlanForm({
        plan_code: planRes?.plan_code || 'starter',
        billing_status: planRes?.billing_status || 'active',
        max_devices: planRes?.max_devices || 100,
      });
      setInvites(inviteRes.invites || []);
      setAuditEvents(auditRes.events || []);
      setDeliveries(deliveryRes.deliveries || []);
    } catch (err) {
      setError(err?.body?.error || err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleWebhookSubmit = async (e) => {
    e.preventDefault();
    setBusy(prev => ({ ...prev, createWebhook: true }));
    try {
      await api.createAlertDestination({ ...webhookFormData, type: 'webhook' });
      setShowWebhookForm(false);
      setWebhookFormData({ name: '', url: '', is_enabled: true });
      await loadAll();
      notify('Webhook destination created');
    } catch (err) {
      notify(err?.body?.error || err.message, 'error');
    } finally {
      setBusy(prev => ({ ...prev, createWebhook: false }));
    }
  };

  const handleWebhookDelete = async (id) => {
    if (!await confirm('Delete this webhook destination?')) return;
    setBusy(prev => ({ ...prev, deletingWebhookId: id }));
    try {
      await api.deleteAlertDestination(id);
      await loadAll();
      notify('Webhook destination deleted');
    } catch (err) {
      notify(err?.body?.error || err.message, 'error');
    } finally {
      setBusy(prev => ({ ...prev, deletingWebhookId: '' }));
    }
  };

  const toggleWebhookEnabled = async (d) => {
    setBusy(prev => ({ ...prev, togglingWebhookId: d.id }));
    try {
      await api.updateAlertDestination(d.id, { is_enabled: !d.is_enabled });
      await loadAll();
      notify(`Webhook ${d.is_enabled ? 'disabled' : 'enabled'}`);
    } catch (err) {
      notify(err?.body?.error || err.message, 'error');
    } finally {
      setBusy(prev => ({ ...prev, togglingWebhookId: '' }));
    }
  };

  const handleSavePlan = async () => {
    setBusy(prev => ({ ...prev, savePlan: true }));
    try {
      await api.updateBillingPlan({
        plan_code: planForm.plan_code,
        billing_status: planForm.billing_status,
        max_devices: Number(planForm.max_devices),
      });
      await loadAll();
      notify('Plan updated');
    } catch (err) {
      notify(err?.body?.error || err.message, 'error');
    } finally {
      setBusy(prev => ({ ...prev, savePlan: false }));
    }
  };

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setBusy(prev => ({ ...prev, createInvite: true }));
    try {
      const res = await api.createInvite({
        email: inviteForm.email,
        role: inviteForm.role,
        expires_in_hours: Number(inviteForm.expires_in_hours),
      });
      setInviteResult(res?.accept || null);
      setInviteForm({ email: '', role: 'viewer', expires_in_hours: 72 });
      await loadAll();
      notify('Invite created');
    } catch (err) {
      notify(err?.body?.error || err.message, 'error');
    } finally {
      setBusy(prev => ({ ...prev, createInvite: false }));
    }
  };

  const handleDeleteInvite = async (id) => {
    if (!await confirm('Delete this invite?')) return;
    setBusy(prev => ({ ...prev, deletingInviteId: id }));
    try {
      await api.deleteInvite(id);
      await loadAll();
      notify('Invite deleted');
    } catch (err) {
      notify(err?.body?.error || err.message, 'error');
    } finally {
      setBusy(prev => ({ ...prev, deletingInviteId: '' }));
    }
  };

  const tabs = [
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'invites', label: 'Invites', icon: Send },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'audit', label: 'Audit', icon: FileClock },
  ];

  useEffect(() => {
    if (tabFromUrl !== activeTab) setSearchParams({ tab: activeTab }, { replace: true });
  }, [activeTab, tabFromUrl, setSearchParams]);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="h-7 w-7 text-blue-600" />
        <h1 className="text-4xl font-bold text-slate-900">Admin Settings</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={clsx('inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium', active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      {loading && <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading admin data...</div>}

      {activeTab === 'billing' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Plan & Limits</h2>
          {plan && (
            <div className="mb-4 flex items-center gap-2 text-sm text-slate-700">
              <span>Usage</span>
              <Badge tone={plan.device_count >= plan.max_devices ? 'red' : 'green'}>{plan.device_count}/{plan.max_devices} devices</Badge>
              <Badge tone="blue">status: {plan.billing_status}</Badge>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <input className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" placeholder="Plan code" value={planForm.plan_code} onChange={e => setPlanForm(prev => ({ ...prev, plan_code: e.target.value }))} />
            <select className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" value={planForm.billing_status} onChange={e => setPlanForm(prev => ({ ...prev, billing_status: e.target.value }))}>
              <option value="active">active</option><option value="past_due">past_due</option><option value="paused">paused</option><option value="canceled">canceled</option>
            </select>
            <input type="number" min={1} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" placeholder="Max devices" value={planForm.max_devices} onChange={e => setPlanForm(prev => ({ ...prev, max_devices: e.target.value }))} />
          </div>
          <button onClick={handleSavePlan} disabled={busy.savePlan} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {busy.savePlan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {busy.savePlan ? 'Saving...' : 'Save Plan'}
          </button>
        </section>
      )}

      {activeTab === 'invites' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Tenant Invites</h2>
          <form onSubmit={handleCreateInvite} className="grid gap-3 mb-4">
            <input className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" placeholder="user@example.com" value={inviteForm.email} onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <select className="rounded-lg border border-slate-300 bg-white p-3 text-sm" value={inviteForm.role} onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}>
                <option value="viewer">viewer</option><option value="admin">admin</option><option value="owner">owner</option>
              </select>
              <input type="number" min={1} className="rounded-lg border border-slate-300 bg-white p-3 text-sm" value={inviteForm.expires_in_hours} onChange={e => setInviteForm(prev => ({ ...prev, expires_in_hours: e.target.value }))} />
            </div>
            <button disabled={busy.createInvite} className="inline-flex w-fit items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {busy.createInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {busy.createInvite ? 'Creating...' : 'Create Invite'}
            </button>
          </form>

          {inviteResult?.url && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs">
              <div className="mb-1 text-blue-700">Invite link</div>
              <div className="break-all font-mono text-blue-900">{inviteResult.url}</div>
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-auto">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div>
                  <div className="text-sm text-slate-900">{inv.email}</div>
                  <div className="text-xs text-slate-500">role={inv.role} • expires {new Date(inv.expires_at).toLocaleString()}</div>
                </div>
                <button disabled={busy.deletingInviteId === inv.id} onClick={() => handleDeleteInvite(inv.id)} className="text-rose-600 hover:text-rose-700 disabled:opacity-60">
                  {busy.deletingInviteId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
            {!invites.length && <div className="text-xs text-slate-500">No pending invites</div>}
          </div>
        </section>
      )}

      {activeTab === 'alerts' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Alerts Delivery</h2>
            <button onClick={() => setShowWebhookForm(!showWebhookForm)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {showWebhookForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {showWebhookForm ? 'Cancel' : 'Add Webhook'}
            </button>
          </div>

          <div className="mb-4 flex gap-2 text-xs">
            <Badge tone="blue">total: {deliveryStats.total}</Badge>
            <Badge tone="green">success: {deliveryStats.success}</Badge>
            <Badge tone={deliveryStats.failed ? 'red' : 'gray'}>failed: {deliveryStats.failed}</Badge>
          </div>

          {showWebhookForm && (
            <form onSubmit={handleWebhookSubmit} className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" placeholder="Friendly name" value={webhookFormData.name} onChange={e => setWebhookFormData({ ...webhookFormData, name: e.target.value })} required />
                <input className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm font-mono" placeholder="https://..." value={webhookFormData.url} onChange={e => setWebhookFormData({ ...webhookFormData, url: e.target.value })} required />
              </div>
              <button type="submit" disabled={busy.createWebhook} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
                {busy.createWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {busy.createWebhook ? 'Saving...' : 'Save'}
              </button>
            </form>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Destinations</div>
              <div className="space-y-2 max-h-56 overflow-auto">
                {dests.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <div className="text-sm text-slate-900">{d.name}</div>
                      <div className="break-all font-mono text-xs text-slate-500">{d.url}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button disabled={busy.togglingWebhookId === d.id} onClick={() => toggleWebhookEnabled(d)} className={clsx('rounded border px-2 py-1 text-xs disabled:opacity-60', d.is_enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600')}>
                        {busy.togglingWebhookId === d.id ? '...' : d.is_enabled ? 'Active' : 'Disabled'}
                      </button>
                      <button disabled={busy.deletingWebhookId === d.id} onClick={() => handleWebhookDelete(d.id)} className="text-rose-600 hover:text-rose-700 disabled:opacity-60">
                        {busy.deletingWebhookId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                {!dests.length && <div className="text-xs text-slate-500">No webhook destinations</div>}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Recent Deliveries</div>
              <div className="space-y-2 max-h-56 overflow-auto">
                {deliveries.map((d) => (
                  <div key={d.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-700">alert #{d.alert_id} • attempt {d.attempt}</div>
                      <Badge tone={d.success ? 'green' : 'red'}>{d.success ? 'ok' : 'fail'}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">event={d.event} status={d.status_code || 0} duration={d.duration_ms}ms</div>
                    {d.error && <div className="mt-1 break-all text-xs text-rose-700">{d.error}</div>}
                  </div>
                ))}
                {!deliveries.length && <div className="text-xs text-slate-500">No deliveries recorded yet</div>}
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'audit' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">Security Audit Trail</h2>
          <div className="space-y-2 max-h-72 overflow-auto">
            {auditEvents.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-900">{ev.action}</div>
                  <Badge tone="gray">{new Date(ev.created_at).toLocaleString()}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">resource={ev.resource}{ev.resource_id ? `:${ev.resource_id}` : ''} • ip={ev.ip || 'n/a'}</div>
              </div>
            ))}
            {!auditEvents.length && <div className="text-xs text-slate-500">No audit events yet</div>}
          </div>
        </section>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 flex items-start gap-2">
        <Shield className="h-4 w-4 mt-0.5" />
        <span>Admin workspace supports billing, invitations, alert destinations, and audit visibility in one flow.</span>
      </div>
    </div>
  );
}
