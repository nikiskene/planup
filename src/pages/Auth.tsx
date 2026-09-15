import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

import { BrandBackground, BrandLogo } from '../components/brand/BrandAssets';

type Mode = 'login' | 'signup' | 'reset' | 'confirm';
export default function Auth() {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const changeMode = (next: Mode) => { setMode(next); setMessage(''); setError(''); };

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const cleanEmail = email.trim();
      if (mode === 'login') {
        const result = await signIn(cleanEmail, password);
        if (result.error) throw result.error;
        navigate('/app', { replace: true });
      } else if (mode === 'signup') {
        const result = await signUp(cleanEmail, password);
        if (result.error) throw result.error;
        if (result.confirmed) navigate('/onboarding', { replace: true });
        else { setMode('confirm'); setMessage('Check your inbox for a confirmation link. Confirm your email before logging in. If you already have an account, log in or reset your password.'); }
      } else if (mode === 'reset') {
        const result = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: `${window.location.origin}/auth/reset-password` });
        if (result.error) throw result.error;
        setMessage('If this address has an account, you will receive a password reset link. Check your inbox and spam folder.');
      } else {
        const result = await supabase.auth.resend({ type: 'signup', email: cleanEmail, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } });
        if (result.error) throw result.error;
        setMessage('Confirmation requested. Check your inbox and spam folder, and allow a minute before trying again.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to continue. Please try again.'); }
    finally { setBusy(false); }
  }

  return <main className="relative isolate flex min-h-screen flex-col items-center justify-center px-5 py-12 text-slate-950">
    <BrandBackground />
    <Link to="/" aria-label="wrxs home" className="mb-8"><BrandLogo className="h-12 w-44" /></Link>
    <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-7 shadow-xl shadow-black/20 sm:p-9">
      <h1 className="text-2xl font-semibold tracking-tight">{mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Confirm your email'}</h1>
      <p className="mb-7 mt-2 text-sm leading-6 text-slate-500">{mode === 'signup' ? 'A workspace for your tasks, notes and relationships.' : mode === 'confirm' ? 'Use the link in your email to finish setting up your account.' : 'A clearer day starts here.'}</p>
      <form onSubmit={submit} className="space-y-5">
        <div><label htmlFor="email" className="mb-2 block text-sm font-medium">Email</label><input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" /></div>
        {(mode === 'login' || mode === 'signup') && <div><label htmlFor="password" className="mb-2 block text-sm font-medium">Password</label><input id="password" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" />{mode === 'signup' && <p className="mt-2 text-xs text-slate-500">Use at least 8 characters.</p>}</div>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {message && <p role="status" className="rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900">{message}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white disabled:opacity-50">{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Resend confirmation'}</button>
      </form>
      <div className="mt-6 flex flex-wrap justify-between gap-4 text-sm text-blue-700">
        <button disabled={busy} onClick={() => changeMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'Create an account' : 'Back to log in'}</button>
        {mode === 'login' && <button disabled={busy} onClick={() => changeMode('reset')}>Forgot password?</button>}
        {mode === 'login' && <button disabled={busy} onClick={() => changeMode('confirm')}>Resend confirmation email</button>}
      </div>
    </div>
    <Link to="/" className="mt-7 text-sm text-white/80">← Back to wrxs</Link>
  </main>;
}
