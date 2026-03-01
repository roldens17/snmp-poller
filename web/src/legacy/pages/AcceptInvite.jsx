import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';

export function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Missing invite token.');
      return;
    }
    if (password.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await api.registerInvite(token, password, name.trim());
      setOk(true);
      setTimeout(() => navigate('/', { replace: true }), 900);
    } catch (err) {
      const msg = err?.body?.error || err.message || 'Unable to accept invite';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-72 w-72 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md rounded-2xl p-8 border border-blue-400/20 bg-slate-900/85 backdrop-blur-xl shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-2">Accept Tenant Invite</h1>
        <p className="text-sm text-slate-400 mb-6">Create your account and join the tenant workspace.</p>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/40"
          />
          <input
            type="password"
            placeholder="Set password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-slate-950/60 border border-white/10 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/40"
          />
          {error && <div className="text-sm text-red-300 border border-red-500/20 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>}
          {ok && <div className="text-sm text-green-300 border border-green-500/20 bg-green-500/10 px-3 py-2 rounded-lg">Invite accepted. Redirecting...</div>}
          <button disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 font-bold disabled:opacity-60">
            {submitting ? 'Joining...' : 'Join tenant'}
          </button>
        </form>

        <div className="mt-4 text-xs text-slate-500">
          Already have an account? <Link className="text-blue-300 hover:text-blue-200" to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
