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
    <div className="min-h-screen bg-rich-black text-gray-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md glass-panel-premium rounded-2xl p-8 border border-gold/20">
        <h1 className="text-2xl font-bold text-white mb-2">Accept tenant invite</h1>
        <p className="text-sm text-gray-400 mb-6">Create your account and join the tenant.</p>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm"
          />
          <input
            type="password"
            placeholder="Set password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm"
          />
          {error && <div className="text-sm text-red-300 border border-red-500/20 bg-red-500/10 px-3 py-2 rounded-lg">{error}</div>}
          {ok && <div className="text-sm text-green-300 border border-green-500/20 bg-green-500/10 px-3 py-2 rounded-lg">Invite accepted. Redirecting...</div>}
          <button disabled={submitting} className="w-full rounded-xl bg-gold text-black py-3 font-bold disabled:opacity-60">
            {submitting ? 'Joining...' : 'Join tenant'}
          </button>
        </form>

        <div className="mt-4 text-xs text-gray-500">
          Already have an account? <Link className="text-gold" to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
