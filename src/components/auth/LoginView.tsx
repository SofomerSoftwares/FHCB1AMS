import React, { useState } from 'react';
import {
  FolderArchive,
  Lock,
  User,
  ShieldCheck,
  Building2,
  CheckCircle,
  AlertCircle,
  Globe,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export const LoginView: React.FC = () => {
  const { locale, setLocale, t, isAmharic } = useLanguage();
  const { login } = useAuth();

  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('Admin@ET2026!');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await login(username, password);
    if (!res.success) {
      setError(res.error || 'Invalid credentials.');
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      {/* Language Switcher in top right of login screen */}
      <div className="absolute top-4 right-4 flex items-center rounded-lg border border-slate-700 bg-slate-800 p-1 text-xs">
        <button
          onClick={() => setLocale('en')}
          className={`rounded-md px-2.5 py-1 transition ${
            locale === 'en'
              ? 'bg-slate-700 text-white font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          English
        </button>
        <button
          onClick={() => setLocale('am')}
          className={`rounded-md px-2.5 py-1 transition ${
            locale === 'am'
              ? 'bg-slate-700 text-white font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          አማርኛ
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Emblem / Government Header */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-xl border-2 border-emerald-500">
          <FolderArchive className="h-8 w-8" />
        </div>

        <h2 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
          {t('app.title')}
        </h2>
        <p className="mt-1 text-xs font-semibold text-emerald-400 font-amharic">
          {t('app.institution')}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {t('app.subtitle')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-700/80 bg-slate-800/90 p-8 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-5 flex items-center space-x-2 rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300">
                {isAmharic ? 'የተጠቃሚ ስም ወይም ኢሜይል' : 'Username or Official Email'}
              </label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin or officer.almaz"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300">
                {isAmharic ? 'የይለፍ ቃል' : 'Password'}
              </label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900/80 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            >
              {loading
                ? isAmharic
                  ? 'በማረጋገጥ ላይ...'
                  : 'Authenticating...'
                : isAmharic
                ? 'ግባ (Sign In)'
                : 'Sign In to Official Portal'}
            </button>
          </form>
        </div>

        {/* Security watermark */}
        <p className="mt-4 text-center text-[10px] text-slate-500">
          Official Government Property • Unauthorized Access Prohibited • Monitored & Audited
        </p>
      </div>
    </div>
  );
};
