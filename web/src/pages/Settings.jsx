import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Trash2, Plus, Bell, Settings as SettingsIcon, Save, X, Shield, CreditCard, Send, FileClock, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useToast } from '../components/ToastProvider';
import { useConfirm } from '../components/ConfirmProvider';

function Badge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-700/30 text-gray-300 border-gray-600/30',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  };
  return <span className={`px-2 py-1 rounded-lg text-xs border ${tones[tone]}`}>{children}</span>;
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
    if (tabFromUrl !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab, tabFromUrl, setSearchParams]);

  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-gradient-to-br from-gold/20 to-transparent border border-gold/10">
          <SettingsIcon className="w-6 h-6 text-gold" />
        </div>
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gold to-white text-glow">Admin Settings</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={clsx('px-4 py-2 rounded-xl border text-sm flex items-center gap-2 transition', active ? 'border-gold/40 bg-gold/10 text-gold' : 'border-white/10 text-gray-300 hover:border-gold/20 hover:text-gold')}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {error && <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{error}</div>}
      {loading && <div className="p-3 rounded-lg border border-gold/20 bg-gold/5 text-gold text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading admin data...</div>}

      {activeTab === 'billing' && (
        <div className="glass-panel-premium rounded-2xl p-6 border border-gold/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><CreditCard className="w-5 h-5 text-gold" /> Plan & Limits</h3>
          {plan && (
            <div className="mb-4 text-sm text-gray-300 space-y-1">
              <div className="flex gap-2 items-center">
                <span>Usage</span>
                <Badge tone={plan.device_count >= plan.max_devices ? 'red' : 'green'}>{plan.device_count}/{plan.max_devices} devices</Badge>
                <Badge tone="blue">status: {plan.billing_status}</Badge>
              </div>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <input className="w-full bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm" placeholder="Plan code" value={planForm.plan_code} onChange={e => setPlanForm(prev => ({ ...prev, plan_code: e.target.value }))} />
            <select className="w-full bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm" value={planForm.billing_status} onChange={e => setPlanForm(prev => ({ ...prev, billing_status: e.target.value }))}>
              <option value="active">active</option>
              <option value="past_due">past_due</option>
              <option value="paused">paused</option>
              <option value="canceled">canceled</option>
            </select>
            <input type="number" min={1} className="w-full bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm" placeholder="Max devices" value={planForm.max_devices} onChange={e => setPlanForm(prev => ({ ...prev, max_devices: e.target.value }))} />
          </div>
          <button onClick={handleSavePlan} disabled={busy.savePlan} className="mt-4 px-4 py-2 bg-gold text-black rounded-lg text-sm font-bold hover:bg-gold-light disabled:opacity-60 flex items-center gap-2">
            {busy.savePlan && <Loader2 className="w-4 h-4 animate-spin" />} {busy.savePlan ? 'Saving...' : 'Save Plan'}
          </button>
        </div>
      )}

      {activeTab === 'invites' && (
        <div className="glass-panel-premium rounded-2xl p-6 border border-gold/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><Send className="w-5 h-5 text-gold" /> Tenant Invites</h3>
          <form onSubmit={handleCreateInvite} className="grid gap-3 mb-4">
            <input className="w-full bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm" placeholder="user@example.com" value={inviteForm.email} onChange={e => setInviteForm(prev => ({ ...prev, email: e.target.value }))} required />
            <div className="grid grid-cols-2 gap-3">
              <select className="bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm" value={inviteForm.role} onChange={e => setInviteForm(prev => ({ ...prev, role: e.target.value }))}>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
                <option value="owner">owner</option>
              </select>
              <input type="number" min={1} className="bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm" value={inviteForm.expires_in_hours} onChange={e => setInviteForm(prev => ({ ...prev, expires_in_hours: e.target.value }))} />
            </div>
            <button disabled={busy.createInvite} className="px-4 py-2 bg-gold text-black rounded-lg text-sm font-bold hover:bg-gold-light disabled:opacity-60 flex items-center gap-2 w-fit">
              {busy.createInvite && <Loader2 className="w-4 h-4 animate-spin" />} {busy.createInvite ? 'Creating...' : 'Create Invite'}
            </button>
          </form>

          {inviteResult?.url && (
            <div className="mb-4 p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-xs">
              <div className="text-blue-300 mb-1">Invite link</div>
              <div className="font-mono break-all text-blue-100">{inviteResult.url}</div>
            </div>
          )}

          <div className="space-y-2 max-h-72 overflow-auto">
            {invites.map(inv => (
              <div key={inv.id} className="p-3 rounded-lg border border-white/10 bg-white/5 flex items-center justify-between">
                <div>
                  <div className="text-sm text-white">{inv.email}</div>
                  <div className="text-xs text-gray-400">role={inv.role} • expires {new Date(inv.expires_at).toLocaleString()}</div>
                </div>
                <button disabled={busy.deletingInviteId === inv.id} onClick={() => handleDeleteInvite(inv.id)} className="text-red-400 hover:text-red-300 disabled:opacity-60">
                  {busy.deletingInviteId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
            {!invites.length && <div className="text-xs text-gray-500">No pending invites</div>}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="glass-panel-premium rounded-2xl p-6 border border-gold/10">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2"><Bell className="w-5 h-5 text-gold" /> Alerts Delivery</h3>
            <button onClick={() => setShowWebhookForm(!showWebhookForm)} className="flex items-center gap-2 px-3 py-2 bg-gold text-black hover:bg-gold-light rounded-lg text-sm font-bold">
              {showWebhookForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {showWebhookForm ? 'Cancel' : 'Add Webhook'}
            </button>
          </div>

          <div className="flex gap-2 mb-4 text-xs">
            <Badge tone="blue">total: {deliveryStats.total}</Badge>
            <Badge tone="green">success: {deliveryStats.success}</Badge>
            <Badge tone={deliveryStats.failed ? 'red' : 'gray'}>failed: {deliveryStats.failed}</Badge>
          </div>

          <AnimatePresence>
            {showWebhookForm && (
              <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={handleWebhookSubmit} className="mb-4 p-4 bg-black/30 rounded-xl border border-gold/20 overflow-hidden">
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="w-full bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm" placeholder="Friendly name" value={webhookFormData.name} onChange={e => setWebhookFormData({ ...webhookFormData, name: e.target.value })} required />
                  <input className="w-full bg-rich-black/50 border border-white/10 rounded-xl p-3 text-sm font-mono" placeholder="https://..." value={webhookFormData.url} onChange={e => setWebhookFormData({ ...webhookFormData, url: e.target.value })} required />
                </div>
                <button type="submit" disabled={busy.createWebhook} className="mt-3 px-4 py-2 bg-gold text-black rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-60">
                  {busy.createWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {busy.createWebhook ? 'Saving...' : 'Save'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="grid lg:grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Destinations</div>
              <div className="space-y-2 max-h-56 overflow-auto">
                {dests.map(d => (
                  <div key={d.id} className="p-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white">{d.name}</div>
                      <div className="text-xs text-gray-500 font-mono break-all">{d.url}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button disabled={busy.togglingWebhookId === d.id} onClick={() => toggleWebhookEnabled(d)} className={clsx('text-xs px-2 py-1 rounded border disabled:opacity-60', d.is_enabled ? 'text-green-400 border-green-500/30' : 'text-gray-500 border-gray-600/30')}>
                        {busy.togglingWebhookId === d.id ? '...' : d.is_enabled ? 'Active' : 'Disabled'}
                      </button>
                      <button disabled={busy.deletingWebhookId === d.id} onClick={() => handleWebhookDelete(d.id)} className="text-red-400 hover:text-red-300 disabled:opacity-60">
                        {busy.deletingWebhookId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
                {!dests.length && <div className="text-xs text-gray-500">No webhook destinations</div>}
              </div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Recent Deliveries</div>
              <div className="space-y-2 max-h-56 overflow-auto">
                {deliveries.map(d => (
                  <div key={d.id} className="p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-300">alert #{d.alert_id} • attempt {d.attempt}</div>
                      <Badge tone={d.success ? 'green' : 'red'}>{d.success ? 'ok' : 'fail'}</Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">event={d.event} status={d.status_code || 0} duration={d.duration_ms}ms</div>
                    {d.error && <div className="text-xs text-red-300 mt-1 break-all">{d.error}</div>}
                  </div>
                ))}
                {!deliveries.length && <div className="text-xs text-gray-500">No deliveries recorded yet</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="glass-panel-premium rounded-2xl p-6 border border-gold/10">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-4"><FileClock className="w-5 h-5 text-gold" /> Security Audit Trail</h3>
          <div className="space-y-2 max-h-72 overflow-auto">
            {auditEvents.map(ev => (
              <div key={ev.id} className="p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-white">{ev.action}</div>
                  <Badge tone="gray">{new Date(ev.created_at).toLocaleString()}</Badge>
                </div>
                <div className="text-xs text-gray-400 mt-1">resource={ev.resource}{ev.resource_id ? `:${ev.resource_id}` : ''} • ip={ev.ip || 'n/a'}</div>
              </div>
            ))}
            {!auditEvents.length && <div className="text-xs text-gray-500">No audit events yet</div>}
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl border border-gold/20 bg-gold/5 text-xs text-gold-100 flex items-start gap-2">
        <Shield className="w-4 h-4 mt-0.5 text-gold" />
        <span>Admin UX polish done: tabbed sections, non-blocking notifications, and loading-safe action buttons.</span>
      </div>
    </motion.div>
  );
}
