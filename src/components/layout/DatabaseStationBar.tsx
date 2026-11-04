import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Shield,
  Clock,
  HardDrive,
  Copy,
  Check,
  Settings,
  ArrowRightLeft,
  Globe,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { safeJson, safeFetch } from '../../lib/apiUtils';

export interface DatabaseStatusData {
  connectedToMySQL: boolean;
  connectedToMongo: boolean;
  storageEngine: 'mysqli/mysql' | 'mongodb' | 'embedded';
  targetConnection: string;
  details?: {
    host: string;
    port: number;
    database: string;
    user: string;
    lastError?: string;
    latencyMs?: number;
    counts?: {
      documents: number;
      locations: number;
      departments: number;
      users: number;
      requests: number;
    };
  };
}

export const DatabaseStationBar: React.FC = () => {
  const { user, token, hasRole } = useAuth();
  const { isAmharic } = useLanguage();

  const [dbStatus, setDbStatus] = useState<DatabaseStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [testing, setTesting] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Configuration Form State
  const [selectedEngine, setSelectedEngine] = useState<'mysql' | 'mongodb'>('mysql');
  const [cfgHost, setCfgHost] = useState<string>('127.0.0.1');
  const [cfgPort, setCfgPort] = useState<number>(3306);
  const [cfgUser, setCfgUser] = useState<string>('root');
  const [cfgPassword, setCfgPassword] = useState<string>('');
  const [cfgDatabase, setCfgDatabase] = useState<string>('archivetrack_ethiopia');
  const [cfgMongoUri, setCfgMongoUri] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [configMsg, setConfigMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Only render for ADMIN accounts
  const isAdmin = hasRole('ADMIN');

  const fetchStatus = async () => {
    try {
      const res = await safeFetch('/api/health', {
        headers: { Accept: 'application/json' },
      });
      if (res && res.ok) {
        const { ok, data } = await safeJson(res);
        if (ok && data?.database) {
          setDbStatus(data.database);
          if (data.database.details) {
            setCfgHost(data.database.details.host || '127.0.0.1');
            setCfgPort(data.database.details.port || 3306);
            setCfgUser(data.database.details.user || 'root');
            setCfgDatabase(data.database.details.database || 'archivetrack_ethiopia');
          }
        }
      }
    } catch {
      // Graceful fallback: Station status continues with last known state without unhandled exceptions
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchStatus();
    // Periodic polling every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleTestConnection = async () => {
    if (!token) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await safeFetch('/api/system/test-mysql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res) {
        setTestResult({
          success: false,
          message: 'Server did not respond to MySQL test request.',
        });
        return;
      }
      const { data } = await safeJson(res);
      if (data?.database) {
        setDbStatus(data.database);
      }
      if (data?.success) {
        setTestResult({
          success: true,
          message: `Connected successfully! MySQL Ping Latency: ${data.latencyMs || 2}ms.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data?.error || 'Connection failed or MySQL daemon is not running on 127.0.0.1:3306.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error while contacting MySQL server.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSyncDatabaseSource = async () => {
    if (!token) return;
    setSyncing(true);
    setTestResult(null);
    try {
      const res = await safeFetch('/api/system/sync-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!res) {
        setTestResult({
          success: false,
          message: 'Server did not respond to database sync request.',
        });
        return;
      }
      const { data } = await safeJson(res);
      if (data?.database) {
        setDbStatus(data.database);
      }
      if (data?.success) {
        setTestResult({
          success: true,
          message: `Synchronized successfully with database source [${data.source}]. Documents: ${data.syncedRecords?.documents}, Locations: ${data.syncedRecords?.locations}.`,
        });
      } else {
        setTestResult({
          success: false,
          message: `Sync attempted with [${data?.source || 'Database'}]: ${data?.error || 'Database source server is unreachable.'} Falling back to active store.`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Network error while synchronizing with database source.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveConfiguration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingConfig(true);
    setConfigMsg(null);
    try {
      const res = await safeFetch('/api/system/configure-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          engine: selectedEngine,
          mysqlHost: cfgHost.trim(),
          mysqlPort: Number(cfgPort),
          mysqlUser: cfgUser.trim(),
          mysqlPassword: cfgPassword,
          mysqlDatabase: cfgDatabase.trim(),
          mongoUri: cfgMongoUri.trim() || undefined,
        }),
      });

      if (!res) {
        setConfigMsg({
          success: false,
          text: 'Server did not respond to configuration request.',
        });
        return;
      }

      const { data } = await safeJson(res);
      if (data?.database) {
        setDbStatus(data.database);
      }
      if (data?.success) {
        setConfigMsg({
          success: true,
          text: `Connected to ${data.engine} source successfully (${data.latencyMs || 2}ms)!`,
        });
        setTimeout(() => {
          setShowConfigModal(false);
          setConfigMsg(null);
        }, 1500);
      } else {
        setConfigMsg({
          success: false,
          text: `Connection test failed: ${data?.error || 'Server rejected connection.'}`,
        });
      }
    } catch (err: any) {
      setConfigMsg({
        success: false,
        text: err.message || 'Failed to submit configuration.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCopyUri = () => {
    if (!dbStatus) return;
    const uri = `mysql -h ${dbStatus.details?.host || '127.0.0.1'} -P ${dbStatus.details?.port || 3306} -u ${dbStatus.details?.user || 'root'} -p ${dbStatus.details?.database || 'archivetrack_ethiopia'}`;
    navigator.clipboard.writeText(uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAdmin) {
    return null;
  }

  const isConnected = !!dbStatus?.connectedToMySQL;
  const counts = dbStatus?.details?.counts;

  return (
    <div className="w-full border-b border-slate-200 bg-slate-900 text-white transition-all duration-200">
      {/* Top Station Bar Ribbon */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-[11px] sm:px-6 lg:px-8">
        {/* Left: Station Indicator & Engine */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center space-x-1.5">
            <span className="flex h-2 w-2 relative">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isConnected ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </span>
            <div className="flex items-center space-x-1 font-mono font-bold tracking-wider text-slate-200">
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              <span>DATABASE STATION</span>
            </div>
          </div>

          <div className="hidden sm:block h-3.5 w-px bg-slate-700" />

          {/* Engine State Badge */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Database Source:</span>
            {loading ? (
              <span className="text-slate-400 italic">Detecting...</span>
            ) : isConnected ? (
              <span className="inline-flex items-center rounded-sm bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-400" />
                ONLINE (MySQL 8.0 Source)
              </span>
            ) : (
              <span className="inline-flex items-center rounded-sm bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                <AlertTriangle className="h-3 w-3 mr-1 text-amber-400" />
                STANDBY FALLBACK (Auto-Fallback)
              </span>
            )}
          </div>

          {/* Host & Port info */}
          {dbStatus?.details && (
            <div className="hidden md:flex items-center space-x-1.5 font-mono text-slate-300">
              <Server className="h-3 w-3 text-slate-400" />
              <span>
                {dbStatus.details.host}:{dbStatus.details.port}/{dbStatus.details.database}
              </span>
            </div>
          )}
        </div>

        {/* Right: Quick Actions & Expand Details */}
        <div className="flex items-center space-x-2">
          {/* Synchronize with Database Source Button */}
          <button
            onClick={handleSyncDatabaseSource}
            disabled={syncing}
            className="inline-flex items-center space-x-1 rounded bg-emerald-800/80 px-2 py-0.5 text-[10px] font-bold text-emerald-200 hover:bg-emerald-700 hover:text-white transition cursor-pointer border border-emerald-600/50 disabled:opacity-50"
            title="Synchronize and refresh records with the database source"
          >
            <ArrowRightLeft className={`h-2.5 w-2.5 ${syncing ? 'animate-spin text-emerald-300' : 'text-emerald-300'}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Source'}</span>
          </button>

          {/* Quick Ping / Refresh Button */}
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="inline-flex items-center space-x-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer border border-slate-700 disabled:opacity-50"
            title="Ping MySQL database server on configured port"
          >
            <RefreshCw className={`h-2.5 w-2.5 ${testing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
            <span>{testing ? 'Testing...' : 'Test Ping'}</span>
          </button>

          {/* Configure Database Source */}
          <button
            onClick={() => setShowConfigModal(true)}
            className="inline-flex items-center space-x-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer border border-slate-700"
            title="Configure remote database source host, port, and credentials"
          >
            <Settings className="h-2.5 w-2.5 text-slate-400" />
            <span>Config</span>
          </button>

          {/* Expand Details Toggle */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center space-x-1 rounded bg-cyan-950/80 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-900 border border-cyan-700/50 transition cursor-pointer"
          >
            <span>Station Console</span>
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Expanded Station Console Drawer */}
      {isExpanded && (
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 sm:px-6 lg:px-8 animate-in fade-in slide-in-from-top-1 text-xs">
          <div className="mx-auto max-w-7xl space-y-3">
            {/* Top row: Status cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Connection Driver Status */}
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>Database Source Socket</span>
                  <HardDrive className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="flex items-center space-x-1.5">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      isConnected ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="font-bold text-slate-100">
                    {isConnected ? 'Connected & Synchronized' : 'Offline / Standby Fallback'}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  {isConnected
                    ? `Ping Latency: ${dbStatus?.details?.latencyMs || 1}ms (mysql2 socket pool)`
                    : 'System is safely running on embedded ACID JSON store.'}
                </p>
              </div>

              {/* Card 2: Database Schema & Engine */}
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>Relational Schema</span>
                  <Layers className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="font-mono font-bold text-slate-100 text-xs">
                  {dbStatus?.details?.database || 'archivetrack_ethiopia'}
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  Schema: <code className="text-cyan-400">schema.sql</code> (InnoDB / utf8mb4)
                </p>
              </div>

              {/* Card 3: Storage Coordinates */}
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>Host & Port</span>
                  <Server className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="font-mono font-bold text-slate-100 text-xs">
                  {dbStatus?.details?.host || '127.0.0.1'}:{dbStatus?.details?.port || 3306}
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  User: <span className="text-slate-300 font-mono">{dbStatus?.details?.user || 'root'}</span>
                </p>
              </div>

              {/* Card 4: Record Statistics in Storage */}
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
                <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                  <span>Active Live Records</span>
                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                </div>
                <div className="flex items-center space-x-2 text-[11px] text-slate-200">
                  <span className="font-bold text-emerald-400">{counts?.documents || 0}</span> files
                  <span className="text-slate-600">•</span>
                  <span className="font-bold text-cyan-400">{counts?.locations || 0}</span> locations
                  <span className="text-slate-600">•</span>
                  <span className="font-bold text-amber-400">{counts?.users || 0}</span> users
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  {counts?.requests || 0} requisitions • {counts?.departments || 0} departments
                </p>
              </div>
            </div>

            {/* Test/Sync result alert */}
            {testResult && (
              <div
                className={`rounded-lg p-2.5 text-xs flex items-start space-x-2 border ${
                  testResult.success
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                    : 'bg-amber-950/60 border-amber-800 text-amber-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                )}
                <div className="flex-1">
                  <span className="font-bold">
                    {testResult.success ? 'Database Source Status: ' : 'Database Notice: '}
                  </span>
                  <span>{testResult.message}</span>
                </div>
              </div>
            )}

            {/* Bottom CLI Quick Connect & Instructions */}
            <div className="flex flex-col gap-2 rounded-lg bg-slate-900/90 p-2.5 sm:flex-row sm:items-center sm:justify-between border border-slate-800">
              <div className="flex items-center space-x-2 overflow-x-auto text-[11px] font-mono text-slate-300">
                <span className="text-cyan-400 font-bold">CLI Connect:</span>
                <code className="bg-slate-950 px-2 py-0.5 rounded text-emerald-300 select-all border border-slate-800">
                  mysql -h {dbStatus?.details?.host || '127.0.0.1'} -P {dbStatus?.details?.port || 3306} -u {dbStatus?.details?.user || 'root'} -p {dbStatus?.details?.database || 'archivetrack_ethiopia'}
                </code>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleCopyUri}
                  className="inline-flex items-center space-x-1 rounded bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>{copied ? 'Copied' : 'Copy Command'}</span>
                </button>

                <button
                  onClick={handleSyncDatabaseSource}
                  disabled={syncing}
                  className="inline-flex items-center space-x-1 rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-600 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <ArrowRightLeft className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                  <span>{syncing ? 'Syncing...' : 'Sync Database Source'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Database Source Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <button
              onClick={() => setShowConfigModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center space-x-2.5 mb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Database Source Settings</h3>
                <p className="text-xs text-slate-400">Configure remote database server endpoint and credentials</p>
              </div>
            </div>

            {configMsg && (
              <div
                className={`my-3 rounded-lg p-2.5 text-xs border ${
                  configMsg.success
                    ? 'bg-emerald-950/70 border-emerald-700 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-700 text-rose-300'
                }`}
              >
                {configMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveConfiguration} className="space-y-3 mt-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Database Engine</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedEngine('mysql')}
                    className={`rounded-lg p-2 font-bold border transition text-left ${
                      selectedEngine === 'mysql'
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    MySQL / MySQLi
                    <span className="block font-normal text-[10px] text-slate-400">Remote MySQL 5.7+ / 8.0+ server</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedEngine('mongodb')}
                    className={`rounded-lg p-2 font-bold border transition text-left ${
                      selectedEngine === 'mongodb'
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    MongoDB Atlas / Cloud
                    <span className="block font-normal text-[10px] text-slate-400">Remote mongodb+srv connection</span>
                  </button>
                </div>
              </div>

              {selectedEngine === 'mysql' ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Host / Server IP *</label>
                      <input
                        type="text"
                        required
                        value={cfgHost}
                        onChange={(e) => setCfgHost(e.target.value)}
                        placeholder="e.g. 192.168.1.100 or db.corp.et"
                        className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Port *</label>
                      <input
                        type="number"
                        required
                        value={cfgPort}
                        onChange={(e) => setCfgPort(Number(e.target.value))}
                        placeholder="3306"
                        className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Database Name *</label>
                      <input
                        type="text"
                        required
                        value={cfgDatabase}
                        onChange={(e) => setCfgDatabase(e.target.value)}
                        placeholder="archivetrack_ethiopia"
                        className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">User *</label>
                      <input
                        type="text"
                        required
                        value={cfgUser}
                        onChange={(e) => setCfgUser(e.target.value)}
                        placeholder="root or dbuser"
                        className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Password</label>
                    <input
                      type="password"
                      value={cfgPassword}
                      onChange={(e) => setCfgPassword(e.target.value)}
                      placeholder="Leave empty if no password"
                      className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Remote MongoDB URI *</label>
                  <input
                    type="text"
                    required
                    value={cfgMongoUri}
                    onChange={(e) => setCfgMongoUri(e.target.value)}
                    placeholder="mongodb+srv://user:password@cluster.mongodb.net/archivetrack_ethiopia"
                    className="w-full rounded-md border border-slate-700 bg-slate-950 p-2 font-mono text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Supports remote clusters such as MongoDB Atlas with SRV endpoints.
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2 border-t border-slate-800 pt-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="inline-flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${savingConfig ? 'animate-spin' : ''}`} />
                  <span>{savingConfig ? 'Connecting & Testing...' : 'Connect to Database Source'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
