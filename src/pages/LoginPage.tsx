import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  X,
  Building2,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { Badge } from '../components/ui/Badge';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [loginCategory, setLoginCategory] = useState<'all' | 'student' | 'staff'>('all');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forgot password modal state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotId, setForgotId] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Demo accounts loaded from local DB
  const [demoAccounts, setDemoAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    apiFetch('/api/auth/demo-accounts')
      .then(data => setDemoAccounts(data.accounts || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Please enter both your School ID / Username and password.');
      return;
    }

    setSubmitting(true);
    try {
      await login(identifier.trim(), password, rememberMe);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please verify your School ID and password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInstantDemoLogin = async (username: string) => {
    setError(null);
    setIdentifier(username);
    setPassword('password123');
    setSubmitting(true);
    try {
      await login(username, 'password123', true);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotMessage(null);
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: forgotId }),
      });
      setForgotMessage(res.message);
    } catch (err: any) {
      setForgotError(err.message);
    }
  };

  const featuredDemoRoles = [
    {
      role: 'Student',
      roleBadge: 'info' as const,
      name: 'Aarav Sharma',
      schoolId: 'STU-2026-001',
      username: 'student1',
      subtitle: 'Grade 10 — Section A • Roll #1',
      accent: 'border-blue-500/30 hover:border-blue-500/70',
    },
    {
      role: 'Teacher',
      roleBadge: 'success' as const,
      name: 'Mr. Julian Mercer',
      schoolId: 'TCH-2026-101',
      username: 'teacher1',
      subtitle: 'Senior Mathematics Lead • 10-A Homeroom',
      accent: 'border-emerald-500/30 hover:border-emerald-500/70',
    },
    {
      role: 'Academic Coordinator',
      roleBadge: 'purple' as const,
      name: 'Prof. Marcus Sterling',
      schoolId: 'CRD-2026-001',
      username: 'coordinator1',
      subtitle: 'Senior Secondary Wing (Grades 9–10)',
      accent: 'border-purple-500/30 hover:border-purple-500/70',
    },
    {
      role: 'Principal Executive',
      roleBadge: 'outline' as const,
      name: 'Dr. Eleanor Vance',
      schoolId: 'PRN-2026-001',
      username: 'principal',
      subtitle: 'Institutional Executive & Administration',
      accent: 'border-amber-500/30 hover:border-amber-500/70',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans">
      {/* Left Column: Sign-In Form */}
      <div className="w-full lg:w-[480px] xl:w-[540px] shrink-0 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-14 bg-white border-r border-slate-200/80">
        <div className="w-full max-w-md mx-auto">
          {/* Institutional MCB Branding */}
          <div className="flex items-center gap-3.5 mb-8">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 flex items-center justify-center text-white shadow-sm ring-1 ring-blue-700/20">
              <span className="font-heading font-black text-sm tracking-tighter">MCB</span>
            </div>
            <div>
              <div className="font-heading font-bold text-lg text-slate-900 tracking-tight flex items-center gap-2">
                <span>MCB Veritas</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  v2.4
                </span>
              </div>
              <div className="text-xs font-medium text-slate-500">
                Institutional School Management Platform • AY 2026–2027
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Sign in to your portal
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
              Enter your official School ID, username, or institutional credentials.
            </p>
          </div>

          {/* Student / Staff Identification Selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-6">
            {[
              { id: 'all', label: 'All Portals' },
              { id: 'student', label: 'Student' },
              { id: 'staff', label: 'Faculty & Staff' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLoginCategory(tab.id as any)}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  loginCategory === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Semantic Sign-In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-identifier" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {loginCategory === 'student'
                  ? 'Student ID / Username'
                  : loginCategory === 'staff'
                  ? 'Employee Code / Staff Username'
                  : 'Username, School ID, or Email'}
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-identifier"
                  name="username"
                  type="text"
                  autoComplete="username"
                  spellCheck="false"
                  autoCorrect="off"
                  autoCapitalize="off"
                  enterKeyHint="next"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder={
                    loginCategory === 'student'
                      ? 'e.g. STU-2026-001 or student1'
                      : loginCategory === 'staff'
                      ? 'e.g. TCH-2026-101 or principal'
                      : 'e.g. student1, teacher1, principal'
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="current-password" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotId(identifier);
                    setForgotOpen(true);
                  }}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="current-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label htmlFor="remember-me" className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="remember-me"
                  name="rememberMe"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-600">Keep me signed in on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 active:scale-[0.99] disabled:opacity-60 text-white font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-8 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              {import.meta.env.DEV
                ? 'Development environment — Scrypt hashed credentials & role-based access control enabled.'
                : 'Enterprise security — Scrypt-hashed credentials & role-based operational permissions.'}
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: High-End Enterprise Showcase & Instant Role Access */}
      <div className="flex-1 bg-[#0B0F19] text-white p-6 sm:p-12 lg:p-16 flex flex-col justify-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-2xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Enterprise Multi-Role Demo Portal</span>
          </div>

          <h2 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">
            Explore All Four Interconnected Portals
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed max-w-xl">
            Click any role below to sign in immediately. Every action—marking attendance, submitting assignments, entering grades, or publishing circulars—synchronizes across all four role workspaces in real time.
          </p>

          {/* 4 Primary Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-8">
            {featuredDemoRoles.map(card => (
              <div
                key={card.username}
                className={`p-4 rounded-xl bg-slate-900/80 border ${card.accent} backdrop-blur-xs transition-all flex flex-col justify-between group`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant={card.roleBadge} size="sm">
                      {card.role}
                    </Badge>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/40 text-slate-300 border border-slate-800">
                      {card.schoolId}
                    </span>
                  </div>
                  <div className="font-heading font-semibold text-base text-white group-hover:text-blue-300 transition-colors">
                    {card.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{card.subtitle}</div>
                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>User: <strong className="text-slate-200">{card.username}</strong></span>
                    <span>Pass: <strong className="text-slate-200">password123</strong></span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleInstantDemoLogin(card.username)}
                    className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                  >
                    <span>Instant Sign In</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier(card.schoolId);
                      setPassword('password123');
                    }}
                    className="py-2 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
                    title="Fill credentials into form"
                  >
                    Fill
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Seeded Accounts Table if available */}
          {demoAccounts.length > 4 && (
            <div className="mt-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800/80">
              <div className="text-xs font-semibold text-slate-300 mb-2.5 flex items-center justify-between">
                <span>Additional Seeded Accounts</span>
                <span className="font-mono text-[11px] text-slate-400">Default password: password123</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                {demoAccounts.slice(4).map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleInstantDemoLogin(acc.username)}
                    className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-semibold text-white truncate">{acc.fullName}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {acc.schoolId} • {acc.role}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setForgotOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900">Password Recovery</h3>
                  <p className="text-xs text-slate-500">Verify your School ID or institutional email</p>
                </div>
              </div>
              <button onClick={() => setForgotOpen(false)} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label htmlFor="forgot-id" className="block text-xs font-semibold text-slate-700 mb-1">
                  School ID, Username, or Email
                </label>
                <input
                  id="forgot-id"
                  type="text"
                  required
                  value={forgotId}
                  onChange={e => setForgotId(e.target.value)}
                  placeholder="e.g. STU-2026-001 or student1"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {forgotError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {forgotError}
                </div>
              )}

              {forgotMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{forgotMessage}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Verify Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

