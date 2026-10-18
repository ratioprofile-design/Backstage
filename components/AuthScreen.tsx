import React, { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { useProject } from '../context/ProjectContext';
import { 
  Film, Mail, Lock, User, Eye, EyeOff, CheckCircle2, 
  AlertCircle, Cloud, CloudOff, LogOut, ArrowRight, X, KeyRound, Loader2 
} from 'lucide-react';

// Friendly error message parser
const parseAuthError = (err: any): string => {
  let raw = '';
  if (typeof err === 'string') raw = err;
  else if (err?.message) raw = err.message;
  else if (err?.error_description) raw = err.error_description;
  else {
    try { raw = JSON.stringify(err); } catch { raw = 'Unknown authentication error'; }
  }

  try {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      raw = parsed.message || parsed.msg || parsed.error_description || raw;
    }
  } catch {}

  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'Invalid email or password. Please verify your credentials or create an account.';
  }
  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return 'An account with this email already exists. Please sign in below.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in. Check your inbox for the confirmation link.';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'Password must be at least 6 characters long.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a few moments and try again.';
  }
  if (lower.includes('gateway timeout') || lower.includes('504') || lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Unable to reach the cloud server. Check your connection or continue in Offline Mode.';
  }
  return raw || 'An unexpected error occurred. Please try again.';
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C41.2 35.9 44 30.5 44 24c0-1.3-.1-2.6-.4-3.9z"/>
  </svg>
);

interface AuthScreenProps {
  onClose?: () => void;
  onSuccess?: () => void;
  initialView?: 'signin' | 'signup' | 'reset' | 'local';
}

type AuthTab = 'signin' | 'signup' | 'reset' | 'local';

export const AuthScreen: React.FC<AuthScreenProps> = ({ 
  onClose, 
  onSuccess,
  initialView = 'signin'
}) => {
  const { currentUser, supabaseUser, login, loginWithSupabase, logout, isCloudMode } = useProject();

  const [activeTab, setActiveTab] = useState<AuthTab>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [writerName, setWriterName] = useState('');
  const [localPenName, setLocalPenName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const resetNotices = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const switchTab = (tab: AuthTab) => {
    resetNotices();
    setActiveTab(tab);
  };

  // 1. Sign In handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return;

    resetNotices();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!isMounted.current) return;

      if (error) {
        setErrorMessage(parseAuthError(error));
        setLoading(false);
        return;
      }

      if (data?.session?.user) {
        setSuccessMessage('Signed in successfully! Launching studio...');
        await loginWithSupabase();
        setTimeout(() => {
          if (isMounted.current) {
            onSuccess?.();
            onClose?.();
          }
        }, 350);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setErrorMessage(parseAuthError(err));
        setLoading(false);
      }
    }
  };

  // 2. Sign Up handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) return;

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    resetNotices();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: writerName.trim() || undefined,
            full_name: writerName.trim() || undefined,
          }
        }
      });

      if (!isMounted.current) return;

      if (error) {
        setErrorMessage(parseAuthError(error));
        setLoading(false);
        return;
      }

      // If session is immediately returned (no email verification required)
      if (data?.session?.user) {
        setSuccessMessage('Account created! Entering studio...');
        await loginWithSupabase();
        setTimeout(() => {
          if (isMounted.current) {
            onSuccess?.();
            onClose?.();
          }
        }, 350);
      } else {
        // Verification email sent
        setSuccessMessage('Account registered! Please check your email inbox to confirm your account, then sign in.');
        setActiveTab('signin');
        setLoading(false);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setErrorMessage(parseAuthError(err));
        setLoading(false);
      }
    }
  };

  // 3. Password Reset handler
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address to receive reset instructions.');
      return;
    }

    resetNotices();
    setLoading(true);

    try {
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (!isMounted.current) return;

      if (error) {
        setErrorMessage(parseAuthError(error));
      } else {
        setSuccessMessage('Password reset instructions have been sent to your email.');
      }
    } catch (err: any) {
      if (isMounted.current) {
        setErrorMessage(parseAuthError(err));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // 4. Google OAuth handler
  const handleGoogleSignIn = async () => {
    resetNotices();
    setGoogleLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) {
        if (isMounted.current) {
          setErrorMessage(parseAuthError(error));
          setGoogleLoading(false);
        }
      } else if (data?.url) {
        window.location.assign(data.url);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setErrorMessage(parseAuthError(err));
        setGoogleLoading(false);
      }
    }
  };

  // 5. Offline / Local Writer Mode handler
  const handleOfflineMode = (e: React.FormEvent) => {
    e.preventDefault();
    const name = localPenName.trim() || 'Screenwriter';
    login(name);
    window.dispatchEvent(new CustomEvent('backstage:local-login', { detail: { name } }));
    onSuccess?.();
    onClose?.();
  };

  const handleSignOutActive = async () => {
    setLoading(true);
    await logout();
    setLoading(false);
    resetNotices();
    setSuccessMessage('Signed out successfully.');
  };

  return (
    <div 
      className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div 
        className="relative w-full max-w-[440px] rounded-2xl bg-[#121218] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.9),0_0_0_1px_rgba(245,166,35,0.08)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Amber brand top line glow */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-[#f5a623] to-transparent shrink-0" />

        {/* Modal Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors z-10"
            title="Close"
          >
            <X size={16} />
          </button>
        )}

        <div className="p-6 md:p-8 flex flex-col gap-5">
          {/* Header branding */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f5a623]/25 to-[#f5a623]/5 border border-[#f5a623]/30 shadow-[0_8px_24px_rgba(245,166,35,0.18)] flex items-center justify-center text-[#f5a623]">
              <Film size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wider uppercase text-white">
                Backstage Studio
              </h2>
              <p className="text-[11px] uppercase tracking-widest text-zinc-400 font-semibold mt-0.5">
                {activeTab === 'local' ? 'Offline Local Mode' : 'Cloud Screenwriting Suite'}
              </p>
            </div>
          </div>

          {/* Current Session Banner if logged in */}
          {currentUser && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-white/10 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#f5a623] text-black font-black flex items-center justify-center text-xs shrink-0">
                  {currentUser.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                    {supabaseUser ? <Cloud size={10} className="text-emerald-400" /> : <CloudOff size={10} className="text-amber-400" />}
                    <span>{supabaseUser ? 'Cloud Active' : 'Offline Mode'}</span>
                  </div>
                  <div className="text-zinc-200 font-medium truncate text-xs">{currentUser}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOutActive}
                disabled={loading}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0 flex items-center gap-1"
                title="Sign out of this session"
              >
                <LogOut size={11} />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Tab Selector */}
          <div className="grid grid-cols-3 p-1 rounded-xl bg-black/40 border border-white/5 text-xs font-bold">
            <button
              type="button"
              onClick={() => switchTab('signin')}
              className={`py-2 rounded-lg transition-all tracking-wide text-center cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-[#f5a623] text-black shadow-[0_2px_10px_rgba(245,166,35,0.3)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab('signup')}
              className={`py-2 rounded-lg transition-all tracking-wide text-center cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-[#f5a623] text-black shadow-[0_2px_10px_rgba(245,166,35,0.3)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => switchTab('local')}
              className={`py-2 rounded-lg transition-all tracking-wide text-center cursor-pointer ${
                activeTab === 'local'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Offline
            </button>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs leading-relaxed animate-in fade-in">
              <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{errorMessage}</p>
                {errorMessage.includes('create an account') && (
                  <button
                    type="button"
                    onClick={() => switchTab('signup')}
                    className="mt-1 text-[11px] font-bold text-[#f5a623] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Create a new account now <ArrowRight size={11} />
                  </button>
                )}
                {errorMessage.includes('sign in below') && (
                  <button
                    type="button"
                    onClick={() => switchTab('signin')}
                    className="mt-1 text-[11px] font-bold text-[#f5a623] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Switch to Sign In <ArrowRight size={11} />
                  </button>
                )}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs leading-relaxed animate-in fade-in">
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Cloud Views: Sign In or Register */}
          {(activeTab === 'signin' || activeTab === 'signup') && (
            <div className="flex flex-col gap-4">
              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-white text-zinc-900 hover:bg-zinc-100 active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 shadow-md disabled:opacity-50 cursor-pointer"
              >
                {googleLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin text-zinc-700" />
                    <span>Connecting Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                  or with email
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <form 
                onSubmit={activeTab === 'signin' ? handleSignIn : handleSignUp}
                className="flex flex-col gap-3"
              >
                {activeTab === 'signup' && (
                  <div className="relative">
                    <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Writer / Pen Name (optional)"
                      value={writerName}
                      onChange={(e) => setWriterName(e.target.value)}
                      disabled={loading || googleLoading}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-hidden focus:border-[#f5a623] focus:bg-white/8 transition-all"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="Email address"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading || googleLoading}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-hidden focus:border-[#f5a623] focus:bg-white/8 transition-all"
                  />
                </div>

                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={activeTab === 'signup' ? 'Password (at least 6 characters)' : 'Password'}
                    autoComplete={activeTab === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading || googleLoading}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-hidden focus:border-[#f5a623] focus:bg-white/8 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {activeTab === 'signin' && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => switchTab('reset')}
                      className="text-[11px] text-zinc-400 hover:text-[#f5a623] transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || googleLoading || !email.trim() || !password}
                  className="w-full mt-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-[#f5a623] to-[#ffb83f] text-black shadow-[0_4px_16px_rgba(245,166,35,0.3)] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 size={15} className="animate-spin text-black" />
                      <span>{activeTab === 'signin' ? 'Signing In...' : 'Creating Account...'}</span>
                    </>
                  ) : (
                    <span>{activeTab === 'signin' ? 'Sign In to Studio' : 'Create Studio Account'}</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Reset Password Tab */}
          {activeTab === 'reset' && (
            <form onSubmit={handlePasswordReset} className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-zinc-400 text-xs leading-relaxed">
                Enter your account email. We will send you a secure link to reset your password.
              </div>

              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  placeholder="Your account email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-hidden focus:border-[#f5a623] focus:bg-white/8 transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-[#f5a623] to-[#ffb83f] text-black shadow-[0_4px_16px_rgba(245,166,35,0.3)] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                <span>Send Reset Link</span>
              </button>

              <div className="text-center mt-2">
                <button
                  type="button"
                  onClick={() => switchTab('signin')}
                  className="text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Offline / Local Mode Tab */}
          {activeTab === 'local' && (
            <form onSubmit={handleOfflineMode} className="flex flex-col gap-4">
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 text-zinc-400 text-xs leading-relaxed flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-zinc-200 font-bold uppercase tracking-wider text-[10px]">
                  <CloudOff size={13} className="text-amber-400" />
                  <span>Private Local Storage</span>
                </div>
                <p>
                  Work completely offline without any cloud account. All scripts, beats, and vaults remain safely in this browser on your device.
                </p>
              </div>

              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pen Name or Writer Name (optional)"
                  value={localPenName}
                  onChange={(e) => setLocalPenName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 text-xs focus:outline-hidden focus:border-amber-400 focus:bg-white/8 transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <span>Continue as {localPenName.trim() ? `"${localPenName.trim()}"` : 'Guest Screenwriter'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
