import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function Login() {
  const { user, login, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    if (!email.trim() || !password.trim()) {
      setFormError('Email and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err && err.status === 401) {
        setFormError('Invalid credentials.');
      } else {
        setFormError('Unable to sign in right now.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-rich-black text-gray-100 flex items-center justify-center px-6">
      <div className="w-full max-w-md relative">
        <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-gold/20 via-transparent to-transparent blur-2xl"></div>
        <div className="relative glass-panel-gold rounded-3xl p-8 md:p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="text-3xl font-bold text-gold-gradient tracking-wide">SNMP Poller</div>
            <p className="mt-2 text-sm text-gray-400">Sign in to access your network telemetry.</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-gray-500">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-xl bg-rich-gray/80 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                placeholder="admin@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.2em] text-gray-500">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-xl bg-rich-gray/80 border border-white/10 px-4 py-3 text-sm focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {(formError || error) && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {formError || error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-gradient-to-r from-gold to-yellow-500 text-black font-semibold py-3 shadow-[0_10px_30px_rgba(212,175,55,0.35)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.45)] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
