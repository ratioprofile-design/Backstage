
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Film, Mail, Lock, Loader2, AlertCircle, CheckCircle2, ArrowRight, Cloud } from 'lucide-react';

interface AuthScreenProps {
  onSkip: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onSkip }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

  // After a Google OAuth round-trip the page reloads with ?code=... in the URL.
  // supabase-js auto-detects this at boot, but if its URL detection misses (or the
  // code verifier wasn't found) it fails silently. Explicitly attempt the exchange
  // and surface the state so failures aren't invisible.
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const verifierKey = Object.keys(localStorage).find(k => k.includes('code-verifier'));
        console.log('[auth] debug mount: code=', code, 'verifier=', verifierKey, 'href=', window.location.href);
        setDebug(`code=${code ? 'yes' : 'no'} verifier=${verifierKey ? 'yes' : 'no'} path=${window.location.pathname}`);
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setDebug(`exchange failed: ${error.message}`);
          } else {
            setDebug(`exchanged OK: ${data.user?.email}`);
            url.searchParams.delete('code');
            url.searchParams.delete('state');
            window.history.replaceState({}, '', url.toString());
          }
        }
      } catch (err: any) {
        setDebug(`auth debug: ${err?.message || String(err)}`);
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
        console.log('[auth] password signin attempt for', email.trim());
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        console.log('[auth] password signin result', error ? `ERROR: ${error.message}` : `OK user=${data.user?.id}`);
        if (error) {
          setError(error.message);
        }
        // On success, onAuthStateChange in ProjectContext flips the app into cloud mode.
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        console.log('[auth] signup result', error ? `ERROR: ${error.message}` : `OK user=${data.user?.id} session=${data.session ? 'yes' : 'no'}`);
        if (error) {
          setError(error.message);
        } else if (data.session) {
          // Auto signed in
        } else {
          setNotice('Account created! Check your inbox for a confirmation email, then sign in.');
        }
      }
    } catch (err: any) {
      console.error('[auth] password flow threw', err);
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
      console.log('[auth] google: starting signInWithOAuth, origin=', window.location.origin);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        console.error('[auth] google: error', error);
        setError(error.message);
      } else {
        console.log('[auth] google: signInWithOAuth resolved, navigating...');
      }
    } catch (err: any) {
      console.error('[auth] google: threw', err);
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg width="15" height="15" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C41.2 35.9 44 30.5 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );

  return (
    <div className="fixed inset-0 z-[701] bg-[#050505] text-white flex items-center justify-center font-sans">
      <div className="w-full max-w-[400px] px-8">
        <div className="flex items-center justify-center gap-4 mb-2">
          <div className="w-12 h-12 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center">
            <Film className="text-[#f5a623]" size={24} />
          </div>
        </div>
        <h1 className="text-center text-2xl font-black tracking-[0.3em] uppercase mb-1">Backstage</h1>
        <p className="text-center text-[11px] font-medium text-gray-500 uppercase tracking-[0.25em] mb-8">Cloud Sync</p>

        <div className="bg-[#0c0c0c] border border-white/10 rounded-xl p-6">
          <div className={`flex p-1 rounded-lg border relative mb-6 ${'bg-[#111] border-white/10'}`}>
            <button
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2 text-[11px] font-black uppercase rounded-md transition-all ${
                mode === 'signin'
                  ? 'bg-[#f5a623] text-black shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 text-[11px] font-black uppercase rounded-md transition-all ${
                mode === 'signup'
                  ? 'bg-[#f5a623] text-black shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Create Account
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-white text-[#111] text-xs font-black uppercase hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2.5"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.com"
                  className="w-full bg-[#161616] border border-white/10 text-white pl-9 pr-4 py-2.5 rounded-lg outline-none focus:border-[#f5a623]/60 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#161616] border border-white/10 text-white pl-9 pr-4 py-2.5 rounded-lg outline-none focus:border-[#f5a623]/60 text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-semibold">
                <AlertCircle size={13} className="shrink-0" />
                {error}
              </div>
            )}

            {notice && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-semibold">
                <CheckCircle2 size={13} className="shrink-0" />
                {notice}
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
                  {mode === 'signin' ? 'Signing In...' : 'Creating Account...'}
                </>
              ) : (
                <>
                  <Cloud size={14} />
                  {mode === 'signin' ? 'Sign In & Sync' : 'Create Account'}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-gray-600 mt-4 leading-relaxed">
          Sign in to back up your projects to the cloud, sync across devices,
          <br />
          and collaborate with your production team.
        </p>

        {debug && (
          <p className="text-center text-[9px] text-gray-500 mt-2 font-mono leading-relaxed break-all">
            {debug}
          </p>
        )}

        <button
          onClick={onSkip}
          className="mt-6 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
        >
          Continue without account <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
};

export default AuthScreen;
