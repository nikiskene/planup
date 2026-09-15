import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

// Capture the provider error before the auth client consumes the URL fragment.
const callbackParams = new URLSearchParams(window.location.hash.slice(1));
const callbackError = callbackParams.get('error_description') || new URLSearchParams(window.location.search).get('error_description');

export default function AuthCallback({ reset = false }: { reset?: boolean }) {
  const { user, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(callbackError || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function update(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const result = await supabase.auth.updateUser({ password });
      if (result.error) throw result.error;
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update your password. Please request a new link.'); }
    finally { setBusy(false); }
  }
  if (!loading && user && !reset && !error) return <Navigate to="/app" replace />;
  return <main className="flex min-h-screen items-center justify-center bg-stone-50 p-6"><div className="w-full max-w-md rounded-3xl border bg-white p-8">
    <Link to="/" className="text-3xl font-bold tracking-tighter">wrxs.</Link>
    <h1 className="mt-7 text-2xl font-semibold">{reset ? 'Choose a new password' : 'Email confirmation'}</h1>
    {loading ? <p role="status" className="mt-5">Checking your link…</p> : done ? <p role="status" className="mt-5">Your password has been updated. <Link to="/app" className="text-blue-700 underline">Open your workspace</Link></p> : reset && user && !callbackError ? <form onSubmit={update} className="mt-6 space-y-4">
      <label className="block text-sm">New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>
      <label className="block text-sm">Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-2 w-full rounded-xl border p-3" /></label>
      <button disabled={busy} className="w-full rounded-xl bg-slate-950 p-3 text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save password'}</button>
    </form> : <p className="mt-5 text-sm leading-6">This link could not be confirmed. It may have expired or already been used. <Link to="/auth" className="text-blue-700 underline">Log in or request another email</Link>.</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
  </div></main>;
}
