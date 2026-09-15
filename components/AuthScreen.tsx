import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useProject } from '../context/ProjectContext';
import { Film, Mail, Lock, Loader2, AlertCircle, CheckCircle2, Cloud, X, User, ArrowRight, Laptop } from 'lucide-react';

interface AuthScreenProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onClose, onSuccess }) => {
  const { login, currentUser, supabaseUser } = useProject();
  const [tab, setTab] = useState<'cloud' | 'local'>('cloud');
  const [cloudMode, setCloudMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localName, setLocalName] = useState(currentUser || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

  // Auto-dismiss if session is established
  useEffect(() => {
    if (supabaseUser) {
      onSuccess?.();
      onClose?.();
    }
  }, [supabaseUser, onSuccess, onClose]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Handle OAuth redirect code if present in URL
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setDebug(`Auth failed: ${error.message}`);
          } else {
            setDebug(`Authenticated as: ${data.user?.email}`);
            url.searchParams.delete('code');
            url.searchParams.delete('state');
            window.history.replaceState({}, '', url.toString());
            onSuccess?.();
            onClose?.();
          }
        }
      } catch (err: any) {
        setDebug(`Auth debug error: ${err?.message || String(err)}`);
      }
    })();
  }, [onSuccess, onClose]);

  const handleCloudSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (cloudMode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setError(error.message);
        } else {
          if (data.user?.email) {
            login(data.user.email);
          }
          onSuccess?.();
          onClose?.();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          setError(error.message);
        } else if (data.session) {
          if (data.user?.email) {
            login(data.user.email);
          }
          onSuccess?.();
          onClose?.();
        } else {
          setNotice('Account created! Please check your email inbox to confirm your account, then sign in.');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = localName.trim();
    if (!trimmed) {
      setError('Please enter a display name or pen name.');
      return;
    }
    login(trimmed);
    onSuccess?.();
    onClose?.();
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) setError(error.message);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg width="14" height="14" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C41.2 35.9 44 30.5 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-sans select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div 
        className="relative w-full max-w-[400px] px-6 py-8 bg-[#121217] border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-5 text-white animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        )}

        {/* Logo Header */}
        <div className="flex flex-col items-center gap-2 text-center pt-1">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Film className="text-[#f5a623]" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.2em] uppercase text-white">Backstage</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] mt-0.5">
              {tab === 'cloud' ? 'Cloud Sync & Collaboration' : 'Local Writer Profile'}
            </p>
          </div>
        </div>

        {/* Main Tab Navigation: Cloud vs Local */}
        <div className="flex p-1 rounded-xl bg-black/40 border border-white/5">
          <button
            type="button"
            onClick={() => { setTab('cloud'); setError(null); setNotice(null); }}
            className={`flex-1 py-1.5 text-[11px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'cloud'
                ? 'bg-amber-400 text-black shadow-md font-black'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Cloud size={13} />
            <span>Cloud Account</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('local'); setError(null); setNotice(null); }}
            className={`flex-1 py-1.5 text-[11px] font-bold uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              tab === 'local'
                ? 'bg-amber-400 text-black shadow-md font-black'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Laptop size={13} />
            <span>Local Profile</span>
          </button>
        </div>

        {/* CLOUD TAB CONTENT */}
        {tab === 'cloud' && (
          <div className="flex flex-col gap-4">
            {/* Mode Switcher: Sign In vs Sign Up */}
            <div className="flex p-0.5 rounded-lg bg-white/5 border border-white/5">
              <button
                type="button"
                onClick={() => { setCloudMode('signin'); setError(null); setNotice(null); }}
                className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-all ${
                  cloudMode === 'signin'
                    ? 'bg-white/15 text-white font-black'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setCloudMode('signup'); setError(null); setNotice(null); }}
                className={`flex-1 py-1 text-[10px] font-bold uppercase rounded transition-all ${
                  cloudMode === 'signup'
                    ? 'bg-white/15 text-white font-black'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Google Auth */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-white hover:bg-gray-100 text-[#111] text-xs font-bold uppercase disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-2 py-0.5">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">or email</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* Email / Password Form */}
            <form onSubmit={handleCloudSubmit} className="flex flex-col gap-3">
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-3 py-2 rounded-lg outline-none focus:border-amber-400/60 text-xs transition-colors"
                />
              </div>

              <div className="relative">
                <Lock size={13} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-3 py-2 rounded-lg outline-none focus:border-amber-400/60 text-xs transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium leading-relaxed">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {notice && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium leading-relaxed">
                  <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                  <span>{notice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full py-2.5 mt-1 rounded-lg bg-amber-400 text-black text-xs font-black uppercase hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-400/20"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Cloud size={14} />
                    <span>{cloudMode === 'signin' ? 'Sign In to Cloud' : 'Create Cloud Account'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* LOCAL PROFILE TAB CONTENT */}
        {tab === 'local' && (
          <form onSubmit={handleLocalSubmit} className="flex flex-col gap-3.5">
            <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-[11px] text-gray-400 leading-relaxed">
              Use a local writer handle for auto-saving scripts and notes on this machine without creating an online account.
            </div>

            <div className="relative">
              <User size={13} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                required
                autoFocus
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                placeholder="Pen Name or Screenwriter Name (e.g. Nolan)"
                className="w-full bg-white/5 border border-white/10 text-white pl-9 pr-3 py-2 rounded-lg outline-none focus:border-amber-400/60 text-xs transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium leading-relaxed">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!localName.trim()}
              className="w-full py-2.5 mt-1 rounded-lg bg-amber-400 text-black text-xs font-black uppercase hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md shadow-amber-400/20"
            >
              <span>Continue Locally as {localName.trim() || 'Writer'}</span>
              <ArrowRight size={13} />
            </button>
          </form>
        )}

        {/* Debug notice if available */}
        {debug && (
          <p className="text-center text-[9px] text-gray-500 font-mono leading-relaxed break-all bg-white/5 p-2 rounded">
            {debug}
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthScreen;
