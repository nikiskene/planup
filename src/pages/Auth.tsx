import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ArrowRight, Cloud, Sparkles } from 'lucide-react';

export default function Auth() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (tab === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          showToast(error.message, 'error');
        } else {
          showToast('Welcome back!', 'success');
          navigate('/workspace');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          showToast(error.message, 'error');
        } else {
          showToast('Account created! Welcome to Efficiency Planner.', 'success');
          navigate('/onboarding');
        }
      }
    } catch (error: any) {
      showToast(error.message || 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950">
      <img
        src="/portrait-niki-2026.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[55%_center]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/35 to-slate-950/75 lg:from-slate-950/80 lg:via-slate-950/15 lg:to-slate-950/70" />

      <div className="relative mx-auto grid min-h-screen max-w-7xl items-end gap-10 px-5 py-6 sm:px-8 sm:py-10 lg:grid-cols-[1fr_440px] lg:items-center lg:px-12">
        <div className="hidden max-w-xl text-white lg:block">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm backdrop-blur-md">
            <Sparkles size={15} /> Your work, beautifully in motion
          </div>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight xl:text-6xl">
            Less input.<br />More action.
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-white/75">
            Tasks, notes and relationships—kept clear, calm and ready wherever the day takes you.
          </p>
        </div>

        <div className="w-full rounded-[28px] border border-white/30 bg-white/92 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
          <div className="mb-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-lg">EP</div>
            <p className="text-sm font-medium text-blue-600">Efficiency Planner</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              {tab === 'login' ? 'Welcome back' : 'Start planning better'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {tab === 'login' ? 'Step back into a clearer day.' : 'Create your private planning workspace.'}
            </p>
          </div>

          <div className="mb-6 flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab('login')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                tab === 'login'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => setTab('signup')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                tab === 'signup'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-white shadow-lg shadow-slate-950/15 transition hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Please wait...' : tab === 'login' ? 'Log In' : 'Sign Up'}
              {!loading && <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Cloud size={14} /> Ready for offline work after your first sync
          </div>
        </div>
      </div>
    </div>
  );
}
