import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Film, Mail, Lock, Loader2, AlertCircle, CheckCircle2, Cloud } from 'lucide-react';

interface AuthScreenProps {}

const AuthScreen: React.FC<AuthScreenProps> = () => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

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
          }
        }
      } catch (err: any) {
        setDebug(`Auth debug error: ${err?.message || String(err)}`);
      }
    })();
  }, []);

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) setError(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          setError(error.message);
        } else if (data.session) {
          // Auto signed in
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
    <div className="fixed inset-0 z-[701] bg-[#08080c] text-white flex items-center justify-center font-sans">
      <div className="w-full max-w-[380px] px-6 py-10 bg-[#101014] border border-white/5 rounded-2xl shadow-2xl flex flex-col gap-6">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Film className="text-[#f5a623]" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-[0.2em] uppercase text-white">Backstage</h1>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.15em] mt-0.5">Cloud Authentication</p>
          </div>
        </div>

        {/* Form Container */}
        <div className="flex flex-col gap-4">
          
          {/* Mode Switcher */}
          <div className="flex p-0.5 rounded-lg bg-white/5 border border-white/5">
            <button
              onClick={() => switchMode('signin')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                mode === 'signin'
                  ? 'bg-[#f5a623] text-black shadow-sm font-black'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded transition-all ${
                mode === 'signup'
                  ? 'bg-[#f5a623] text-black shadow-sm font-black'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Google Auth */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-white text-[#111] text-xs font-bold uppercase hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="w-full bg-white/5 border border-white/5 text-white px-3 py-2.5 rounded-lg outline-none focus:border-[#f5a623]/60 text-xs transition-colors"
              />
            </div>

            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white/5 border border-white/5 text-white px-3 py-2.5 rounded-lg outline-none focus:border-[#f5a623]/60 text-xs transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium leading-relaxed">
                <AlertCircle size={12} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-medium leading-relaxed">
                <CheckCircle2 size={12} className="shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full py-2.5 rounded-lg bg-[#f5a623] text-black text-xs font-black uppercase hover:bg-[#ffb73c] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <Cloud size={14} />
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
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
