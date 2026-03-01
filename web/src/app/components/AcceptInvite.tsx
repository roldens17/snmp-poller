import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { authAPI } from '../lib/api';

export function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) return setError('Missing invite token');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    setSubmitting(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_BASE_URL ?? '/api') + '/auth/register-invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, name }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ error: 'Invite acceptance failed' }));
        throw new Error(e.error || 'Invite acceptance failed');
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-midnight-bg text-midnight-text-primary flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-midnight-card border border-midnight-border rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-2">Accept Invite</h1>
        <p className="text-sm text-midnight-text-secondary mb-6">Create your account and join the tenant.</p>
        <form onSubmit={submit} className="space-y-4">
          <input className="w-full h-10 rounded-md border border-midnight-border bg-midnight-bg px-3" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="w-full h-10 rounded-md border border-midnight-border bg-midnight-bg px-3" type="password" placeholder="Set password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="text-sm text-red-400">{error}</div>}
          <button disabled={submitting} className="w-full h-10 rounded-md bg-midnight-accent text-midnight-text-primary">{submitting ? 'Joining...' : 'Join tenant'}</button>
        </form>
        <div className="mt-4 text-xs text-midnight-text-secondary">Already have an account? <Link className="text-midnight-accent" to="/login">Sign in</Link></div>
      </div>
    </div>
  );
}
