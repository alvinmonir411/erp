'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/components/auth/auth-provider';
import {
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  WifiOff,
  ShieldAlert,
  Clock,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react';

type LoginErrorState = {
  id: number;
  title: string;
  message: string;
  hint?: string;
  status?: number;
  code?: string;
  kind: 'auth' | 'network' | 'validation' | 'server';
};

type FieldErrors = {
  identifier?: string;
  password?: string;
};

function getTargetRouteForRole(role: string): string {
  if (role === 'SR') return '/sr-dashboard';
  if (role === 'MANAGER') return '/manager-dashboard';
  if (role === 'DELIVERY_MAN') return '/my-deliveries';
  return '/dashboard';
}

function classifyLoginError(err: unknown, id: number): LoginErrorState {
  if (err instanceof ApiError) {
    if (err.status === 0 || err.code === 'NETWORK_ERROR') {
      return {
        id,
        kind: 'network',
        title: 'Server Connection Failed',
        message: err.message,
        hint: 'Check that the backend API server is running and reachable.',
        status: 0,
        code: err.code || 'NETWORK_ERROR',
      };
    }

    if (err.code === 'USER_NOT_FOUND') {
      return {
        id,
        kind: 'auth',
        title: 'Account Not Found',
        message: err.message,
        hint: 'Check the spelling of your email or username and try again.',
        status: err.status,
        code: err.code,
      };
    }

    if (err.code === 'INVALID_PASSWORD') {
      return {
        id,
        kind: 'auth',
        title: 'Incorrect Password',
        message: err.message,
        hint: 'Make sure Caps Lock is off, or use the eye icon to verify your password.',
        status: err.status,
        code: err.code,
      };
    }

    if (err.code === 'ACCOUNT_INACTIVE') {
      return {
        id,
        kind: 'auth',
        title: 'Account Deactivated',
        message: err.message,
        hint: 'Only a Super Admin can reactivate disabled accounts.',
        status: err.status,
        code: err.code,
      };
    }

    if (err.status === 400) {
      return {
        id,
        kind: 'validation',
        title: 'Validation Error',
        message: err.message,
        status: err.status,
        code: err.code || 'BAD_REQUEST',
      };
    }

    if (err.status >= 500) {
      return {
        id,
        kind: 'server',
        title: 'Server Error',
        message: err.message || 'An unexpected server error occurred.',
        hint: 'Please try again in a moment or inspect the backend server logs.',
        status: err.status,
        code: err.code || 'SERVER_ERROR',
      };
    }

    return {
      id,
      kind: 'auth',
      title: 'Sign In Failed',
      message: err.message || 'Invalid email/username or password.',
      status: err.status,
      code: err.code,
    };
  }

  const rawMessage =
    err instanceof Error ? err.message : 'An unexpected error occurred during sign in.';
  return {
    id,
    kind: 'auth',
    title: 'Sign In Failed',
    message: rawMessage,
  };
}

export default function LoginPage() {
  const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
  const router = useRouter();
  const { setSession } = useAuth();

  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'MS Karim Traders';
  const tagline =
    process.env.NEXT_PUBLIC_SITE_TAGLINE || 'Wholesale Distribution ERP';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [sessionNotice, setSessionNotice] = useState('');
  const [errorState, setErrorState] = useState<LoginErrorState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'expired') {
      setSessionNotice('Your previous session expired. Please sign in again.');
      window.history.replaceState({}, '', '/login');
    }
  }, []);

  const handleCapsLockCheck = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockOn(e.getModifierState('CapsLock'));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedIdentifier = identifier.trim();
    const nextFieldErrors: FieldErrors = {};

    if (!trimmedIdentifier) {
      nextFieldErrors.identifier = 'Please enter your email address or username.';
    }
    if (!password) {
      nextFieldErrors.password = 'Please enter your password.';
    } else if (password.length < 6) {
      nextFieldErrors.password = 'Password must be at least 6 characters.';
    }

    if (nextFieldErrors.identifier || nextFieldErrors.password) {
      setFieldErrors(nextFieldErrors);
      setErrorState({
        id: Date.now(),
        kind: 'validation',
        title: 'Please Check Your Inputs',
        message:
          nextFieldErrors.identifier ||
          nextFieldErrors.password ||
          'Required fields are missing.',
        code: 'CLIENT_VALIDATION',
      });
      return;
    }

    setFieldErrors({});
    setSessionNotice('');
    setErrorState(null);
    setSuccessMsg('');
    setLoading(true);

    try {
      const data = await login(trimmedIdentifier, password);
      const expiresAt = Date.now() + SESSION_DURATION_MS;
      setSession(data.user, data.access_token, expiresAt);

      const roleLabel = String(data.user.role || '').replace(/_/g, ' ');
      setSuccessMsg(`Signed in as ${data.user.name} (${roleLabel}). Redirecting...`);

      const target = getTargetRouteForRole(data.user.role);
      router.replace(target);
    } catch (err: unknown) {
      setErrorState(classifyLoginError(err, Date.now()));
    } finally {
      setLoading(false);
    }
  };

  const renderErrorIcon = () => {
    if (!errorState) return null;
    if (errorState.kind === 'network') {
      return <WifiOff className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />;
    }
    if (errorState.code === 'ACCOUNT_INACTIVE' || errorState.kind === 'server') {
      return <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />;
    }
    return <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 relative overflow-hidden text-zinc-100 px-4 py-8">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-[460px] h-[460px] bg-blue-600/20 blur-[130px] rounded-full" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-[460px] h-[460px] bg-indigo-600/20 blur-[130px] rounded-full" />

      <div className="w-full max-w-md relative z-10 backdrop-blur-2xl bg-zinc-900/75 border border-zinc-800/90 rounded-3xl shadow-2xl shadow-black/60 p-7 sm:p-8">
        {/* Header */}
        <div className="text-center mb-7">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-400 mb-1.5">
            {brandName}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-zinc-400 text-sm mt-1.5">{tagline}</p>
        </div>

        {/* Status Alerts */}
        <div className="space-y-3 mb-5">
          {sessionNotice && !errorState && !successMsg && (
            <div
              role="status"
              className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-200 text-sm"
            >
              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-300">Session Expired</p>
                <p className="text-xs text-amber-200/90 mt-0.5">{sessionNotice}</p>
              </div>
              <button
                type="button"
                onClick={() => setSessionNotice('')}
                aria-label="Dismiss session notice"
                className="text-amber-300/70 hover:text-amber-200 p-0.5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {errorState && (
            <div
              key={errorState.id}
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-3 p-4 bg-red-950/60 border border-red-500/40 rounded-2xl text-red-200 shadow-lg shadow-red-950/30"
            >
              {renderErrorIcon()}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-red-300">
                    {errorState.title}
                  </p>
                  {(errorState.status !== undefined || errorState.code) && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/25">
                      {errorState.status ? `HTTP ${errorState.status}` : 'OFFLINE'}
                      {errorState.code ? ` · ${errorState.code}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm text-red-100/95 mt-1 leading-snug break-words">
                  {errorState.message}
                </p>
                {errorState.hint && (
                  <p className="text-xs text-red-300/80 mt-1.5 leading-relaxed">
                    {errorState.hint}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setErrorState(null)}
                aria-label="Dismiss error"
                className="text-red-300/70 hover:text-red-100 p-1 rounded-lg hover:bg-red-500/15 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="flex items-center gap-3 p-3.5 bg-emerald-500/15 border border-emerald-500/35 rounded-2xl text-emerald-200 text-sm"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="font-medium text-emerald-100">{successMsg}</p>
            </div>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} noValidate className="space-y-5">
          {/* Email or Username */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-identifier"
              className="block text-xs font-medium text-zinc-300 ml-1"
            >
              Email or Username
            </label>
            <div className="relative group">
              <Mail
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${
                  fieldErrors.identifier
                    ? 'text-red-400'
                    : 'text-zinc-400 group-focus-within:text-blue-400'
                }`}
              />
              <input
                id="login-identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                disabled={loading}
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (fieldErrors.identifier) {
                    setFieldErrors((prev) => ({ ...prev, identifier: undefined }));
                  }
                }}
                className={`dark-auth-input w-full bg-[#0c0e14] border rounded-xl py-3 pl-11 pr-10 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 ${
                  fieldErrors.identifier
                    ? 'border-red-500/60 focus:ring-red-500/30 focus:border-red-500'
                    : 'border-zinc-800 focus:ring-blue-500/40 focus:border-blue-500'
                }`}
                placeholder="e.g. admin@gmail.com or RAJJAK"
              />
              {identifier && !loading && (
                <button
                  type="button"
                  onClick={() => setIdentifier('')}
                  aria-label="Clear email or username"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 p-1 rounded-md transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {fieldErrors.identifier && (
              <p className="text-xs text-red-400 ml-1">{fieldErrors.identifier}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between ml-1">
              <label
                htmlFor="login-password"
                className="block text-xs font-medium text-zinc-300"
              >
                Password
              </label>
              {capsLockOn && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
                  <AlertTriangle className="w-3 h-3" />
                  Caps Lock is ON
                </span>
              )}
            </div>
            <div className="relative group">
              <Lock
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${
                  fieldErrors.password
                    ? 'text-red-400'
                    : 'text-zinc-400 group-focus-within:text-blue-400'
                }`}
              />
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={loading}
                value={password}
                onKeyDown={handleCapsLockCheck}
                onKeyUp={handleCapsLockCheck}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                className={`dark-auth-input w-full bg-[#0c0e14] border rounded-xl py-3 pl-11 pr-11 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 ${
                  fieldErrors.password
                    ? 'border-red-500/60 focus:ring-red-500/30 focus:border-red-500'
                    : 'border-zinc-800 focus:ring-blue-500/40 focus:border-blue-500'
                }`}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-100 p-1 rounded-md transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-red-400 ml-1">{fieldErrors.password}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-blue-600/70 disabled:to-indigo-700/70 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group ring-offset-zinc-900 ring-offset-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
