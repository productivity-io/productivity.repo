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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

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
      name: 'Aarav Sharma',
      schoolId: 'STU-2026-001',
      username: 'student1',
      subtitle: 'Grade 10 — Section A • Roll #1',
      badge: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    {
      role: 'Teacher',
      name: 'Mr. Julian Mercer',
      schoolId: 'TCH-2026-101',
      username: 'teacher1',
      subtitle: 'Senior Mathematics Lead • 10-A Homeroom',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
      role: 'Academic Coordinator',
      name: 'Prof. Marcus Sterling',
      schoolId: 'CRD-2026-001',
      username: 'coordinator1',
      subtitle: 'Senior Secondary Wing (Grades 9–10)',
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    {
      role: 'Principal',
      name: 'Dr. Eleanor Vance',
      schoolId: 'PRN-2026-001',
      username: 'principal',
      subtitle: 'Institutional Executive & Administration',
      badge: 'bg-slate-900 text-white border-slate-800',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Column: Sign-In Form (Prioritized near top for mobile keyboards per modern-web-guidance) */}
      <div className="flex-1 flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-20 bg-white border-r border-slate-200/80">
        <div className="w-full max-w-md mx-auto">
          {/* School Branding */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-blue-700 flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="font-heading font-bold text-lg text-slate-900 tracking-tight">
                Veritas Collegiate Academy
              </div>
              <div className="text-xs font-medium text-slate-500">
                Unified School Management Ecosystem • AY 2026–2027
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">
              Sign in to your portal
            </h1>
            <p className="text-sm text-slate-600 mt-1.5">
              Enter your School ID, username, or institutional email address.
            </p>
          </div>

          {/* Student / Staff Identification Selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-6">
            {[
              { id: 'all', label: 'All Portals' },
              { id: 'student', label: 'Student Login' },
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
              className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Semantic Sign-In Form following autofill-sign-in-form guidance */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-identifier" className="block text-xs font-semibold text-slate-700 mb-1.5">
                {loginCategory === 'student'
                  ? 'Student ID / Username'
                  : loginCategory === 'staff'
                  ? 'Employee Code / Staff Email'
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
                      : 'e.g. STU-2026-001, teacher1, principal'
                  }
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
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
                  className="text-xs font-semibold text-blue-700 hover:text-blue-800"
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
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
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
                  className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                />
                <span className="text-xs font-medium text-slate-600">Keep me signed in on this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-semibold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>{submitting ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              {import.meta.env.DEV
                ? 'Local Development Mode — Scrypt hashed credentials & role-based access control enabled.'
                : 'Secure sign-in — scrypt-hashed credentials and role-based access control.'}
            </span>
          </div>
        </div>
      </div>

      {/* Demo accounts are development-only; the production API returns 404. */}
      {demoAccounts.length > 0 && (
      <div className="flex-1 bg-slate-900 text-white p-6 sm:p-12 lg:p-16 flex flex-col justify-center">
        <div className="w-full max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Local Demo Environment — Instant Role Access</span>
          </div>

          <h2 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Explore All Four Interconnected Portals
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Click any role below to sign in immediately. Every action you take—marking attendance, publishing assignments, submitting work, or issuing emergency alerts—synchronizes across all four dashboards in real time via the local SQLite database.
          </p>

          {/* 4 Primary Role Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-7">
            {featuredDemoRoles.map(card => (
              <div
                key={card.username}
                className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-blue-500/60 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      {card.role}
                    </span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700">
                      {card.schoolId}
                    </span>
                  </div>
                  <div className="font-heading font-semibold text-base text-white">{card.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{card.subtitle}</div>
                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span>User: {card.username}</span>
                    <span>Pass: password123</span>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleInstantDemoLogin(card.username)}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Instant Sign In →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIdentifier(card.schoolId);
                      setPassword('password123');
                    }}
                    className="py-2 px-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
                    title="Fill credentials into form"
                  >
                    Fill
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Seeded Accounts Table */}
          {demoAccounts.length > 4 && (
            <div className="mt-6 p-4 rounded-2xl bg-slate-800/50 border border-slate-800">
              <div className="text-xs font-semibold text-slate-300 mb-2.5">
                Additional Seeded Student, Teacher & Coordinator Accounts (Password: <code className="text-blue-300">password123</code>)
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                {demoAccounts.slice(4).map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleInstantDemoLogin(acc.username)}
                    className="p-2 rounded-xl bg-slate-900/70 hover:bg-slate-800 border border-slate-700/60 text-left transition-colors"
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
      )}

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setForgotOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900">Password Recovery (Local Demo)</h3>
                  <p className="text-xs text-slate-500">Verify your School ID or institutional email</p>
                </div>
              </div>
              <button onClick={() => setForgotOpen(false)} className="p-1 text-slate-400 hover:text-slate-700">
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
                  placeholder="e.g. STU-2026-001 or aarav.sharma@student.veritas.edu"
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
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
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

