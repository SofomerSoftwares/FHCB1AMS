import React, { useState } from 'react';
import {
  FolderArchive,
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronRight,
  ShieldAlert,
  Server,
  FileCheck2,
  QrCode,
  Layers,
  FileLock2,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export const LoginView: React.FC = () => {
  const { locale, setLocale, t, isAmharic } = useLanguage();
  const { login } = useAuth();

  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError(
        isAmharic
          ? 'እባክዎ የተጠቃሚ ስም እና ይለፍ ቃል ያስገቡ።'
          : 'Please enter your institutional username and password.'
      );
      return;
    }

    setLoading(true);
    const res = await login(username.trim(), password);
    if (!res.success) {
      setError(
        res.error ||
          (isAmharic
            ? 'የተሳሳተ የተጠቃሚ ስም ወይም የይለፍ ቃል'
            : 'Invalid credentials. Please verify your username and password.')
      );
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Subtle Production Grid Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-600 blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-teal-700 blur-3xl"></div>
        <div className="h-full w-full bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] opacity-40"></div>
      </div>

      {/* Top Sovereign Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800/80 backdrop-blur-md bg-slate-950/60">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white shadow-lg shadow-emerald-900/30 border border-emerald-500/40">
            <span className="font-extrabold text-xs tracking-wider text-amber-300">FHC</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold tracking-tight text-white">
                {isAmharic ? 'የፌዴራል ቤቶች ኮርፖሬሽን' : 'Federal Housing Corporation'}
              </span>
              <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                Branch 1
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-amharic">
              {isAmharic
                ? 'ቅርንጫፍ አንድ የማህደርና ሰነዶች አስተዳደር ስርዓት'
                : 'Branch One Physical Archive & Document Tracking System'}
            </p>
          </div>
        </div>

        {/* Language Switcher */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-0.5 text-xs shadow-inner">
          <button
            onClick={() => setLocale('en')}
            className={`rounded-md px-3 py-1 font-semibold transition cursor-pointer ${
              locale === 'en'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLocale('am')}
            className={`rounded-md px-3 py-1 font-semibold font-amharic transition cursor-pointer ${
              locale === 'am'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            አማርኛ
          </button>
        </div>
      </header>

      {/* Main Content: Split Institutional Overview & Production Authentication */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Column: Official Archive Security Standards */}
          <div className="lg:col-span-6 space-y-6 text-left hidden lg:block pr-4">
            <div className="inline-flex items-center space-x-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 text-xs text-emerald-300 backdrop-blur-md">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold tracking-wide">
                {isAmharic ? 'ይፋዊ የመንግስት ማህደር መዝገብ' : 'Government Records & Vault Registry'}
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
                {isAmharic
                  ? 'ትክክለኛና ደህንነቱ የተጠበቀ ይፋዊ የማህደር አስተዳደር ስርዓት'
                  : 'Enterprise Physical Archival & Chain of Custody'}
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                {isAmharic
                  ? 'የፌዴራል ቤቶች ኮርፖሬሽን የቅርንጫፍ አንድ ህጋዊ ሰነዶችን፣ የይዞታ ማረጋገጫዎችን፣ የተከራዮች ፋይሎችን እና ውሎችን በQR መለያ፣ በመደርደሪያና ሳጥን መገኛ የሚያስተዳድር የመንግስት ፖርታል'
                  : 'Official sovereign repository for deed registries, tenancy certificates, judicial decrees, and corporate commercial files catalogued with Shelf & Box physical archival coordinates.'}
              </p>
            </div>

            {/* Core Institutional Features */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xs space-y-1.5">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                  <QrCode className="h-4 w-4" />
                  <span>{isAmharic ? 'የQR መለያና መከታተያ' : 'QR Barcode Tracking'}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAmharic
                    ? 'የመደርደሪያና ሳጥን ፈጣን ፍተሻ እና ትክክለኛ መገኛ'
                    : 'Precise Shelf & Box physical location mapping for rapid retrieval.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xs space-y-1.5">
                <div className="flex items-center space-x-2 text-teal-400 text-xs font-bold">
                  <FileCheck2 className="h-4 w-4" />
                  <span>{isAmharic ? 'የውሰትና ርክክብ ፈቃድ' : 'Chain of Custody'}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAmharic
                    ? 'የስራ ክፍል ኃላፊ ማጽደቂያ እና የመመለሻ ጊዜ ቁጥጥር'
                    : 'Multi-level supervisor review, handovers, and return deadlines.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xs space-y-1.5">
                <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold">
                  <FileLock2 className="h-4 w-4" />
                  <span>{isAmharic ? 'የምስጢራዊነት ደረጃዎች' : 'Security Clearance'}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAmharic
                    ? 'የመንግስት ሚስጥራዊ እና ከፍተኛ ሚስጥር ሰነዶች ጥበቃ'
                    : 'Top Secret, Secret, and Confidential RBAC clearance policies.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-xs space-y-1.5">
                <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold">
                  <Layers className="h-4 w-4" />
                  <span>{isAmharic ? 'የተሟላ የኦዲት መዝገብ' : 'Immutable Audit Log'}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAmharic
                    ? 'እያንዳንዱ የሰነድ እንቅስቃሴና ለውጥ በቋሚነት ይመዘገባል'
                    : 'Full forensic history and movement tracking across jurisdictions.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: High-Trust Production Login Form */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="relative rounded-2xl border border-slate-800 bg-slate-900/95 p-8 shadow-2xl backdrop-blur-xl">
              {/* Top Accent Gradient Bar */}
              <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 rounded-b"></div>

              <div className="text-center sm:text-left mb-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-950 text-white shadow-md border border-emerald-600/40 mb-3">
                  <FolderArchive className="h-6 w-6 text-emerald-300" />
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {isAmharic ? 'ወደ ስርዓቱ ይግቡ' : 'Sign In to Portal'}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {isAmharic
                    ? 'የተፈቀደልዎትን የተጠቃሚ መለያ እና ይለፍ ቃል ያስገቡ'
                    : 'Enter your authorized institutional credentials to continue.'}
                </p>
              </div>

              {error && (
                <div className="mb-5 flex items-start space-x-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 p-3 text-xs text-rose-300 animate-in fade-in">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {isAmharic ? 'የተጠቃሚ ስም ወይም ይፋዊ ኢሜይል' : 'Username or Government Email'}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={isAmharic ? 'የተጠቃሚ ስም ያስገቡ' : 'Enter institutional username'}
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-2.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      {isAmharic ? 'የይለፍ ቃል' : 'Password'}
                    </label>
                    <span className="text-[10px] text-slate-500">
                      {isAmharic ? 'ደህንነቱ የተጠበቀ' : 'End-to-End Encrypted'}
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-2.5 pl-9 pr-10 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:from-emerald-500 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>{isAmharic ? 'በማረጋገጥ ላይ...' : 'Verifying Clearance...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{isAmharic ? 'ወደ ፖርታሉ ግባ' : 'Sign In to Official Archive'}</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Institutional Compliance Notice */}
              <div className="mt-6 flex items-start space-x-2.5 rounded-lg bg-slate-950/70 p-3 border border-slate-800 text-[11px] text-slate-400">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400/90 mt-0.5" />
                <p className="leading-snug">
                  {isAmharic
                    ? 'ይህ ስርዓት የኢ.ፌ.ዲ.ሪ ህጋዊ ንብረት ነው። ያልተፈቀደ መግባት በወንጀል ያስቀጣል።'
                    : 'Official Federal Housing Corporation property. Unauthorized access, alteration, or extraction of records is strictly prohibited.'}
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Sovereign Footer Bar */}
      <footer className="relative z-10 border-t border-slate-800/80 px-6 py-3 text-center text-[11px] text-slate-500 backdrop-blur-md bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between">
        <span>
          © {new Date().getFullYear()} Federal Housing Corporation (FHC) — Branch One Archive Division
        </span>
        <span className="flex items-center space-x-1.5 mt-1 sm:mt-0 text-slate-400">
          <Server className="h-3 w-3 text-emerald-400" />
          <span>FDRE Sovereign Physical Records Network</span>
        </span>
      </footer>
    </div>
  );
};
