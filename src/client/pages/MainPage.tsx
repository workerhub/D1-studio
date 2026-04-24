import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useQuery } from '../hooks/useQuery';
import { apiFetch } from '../lib/api';
import SQLEditor from '../components/editor/SQLEditor';
import ConfirmDialog from '../components/editor/ConfirmDialog';
import ResultsTable from '../components/results/ResultsTable';
import SchemaBrowser from '../components/schema/SchemaBrowser';
import QueryHistory from '../components/history/QueryHistory';
import { Database, History, Settings, LogOut, ChevronLeft, ChevronRight, Play } from 'lucide-react';

type DbOption = { slot_index: number; display_name: string };

export default function MainPage() {
  const { user, logout, refreshUser } = useAuth();
  const { result, loading, error, execute } = useQuery();
  const [sql, setSql] = useState('SELECT 1;');
  const [databases, setDatabases] = useState<DbOption[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showSchema, setShowSchema] = useState(true);
  const [pendingSql, setPendingSql] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmWriteOps, setConfirmWriteOps] = useState(user?.confirm_write_ops === 1);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadDatabases = useCallback(async () => {
    try {
      const data = await apiFetch<{ databases: DbOption[] }>('/query/databases');
      setDatabases(data.databases);
      if (data.databases.length > 0 && selectedSlot === null) {
        setSelectedSlot(data.databases[0].slot_index);
      }
    } catch { /* ignore */ }
  }, [selectedSlot]);

  useEffect(() => { loadDatabases(); }, [loadDatabases]);

  const isWriteOp = (s: string) => {
    const trimmed = s.trim().toUpperCase();
    return !trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH') &&
      !trimmed.startsWith('PRAGMA') && !trimmed.startsWith('EXPLAIN');
  };

  const handleRun = async () => {
    if (!selectedSlot || !sql.trim()) return;

    if (user?.confirm_write_ops && isWriteOp(sql)) {
      setPendingSql(sql);
      return;
    }

    await execute(sql, selectedSlot);
  };

  const handleConfirmExecute = async () => {
    if (!selectedSlot || !pendingSql) return;
    setPendingSql(null);
    await execute(pendingSql, selectedSlot);
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await apiFetch('/auth/settings', {
        method: 'PUT',
        body: { confirm_write_ops: confirmWriteOps },
      });
      refreshUser();
    } catch { /* ignore */ }
    finally {
      setSavingSettings(false);
      setShowSettings(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">D1Studio</span>
          <div className="flex items-center gap-1.5">
            <Database size={14} className="text-gray-400" />
            <select
              value={selectedSlot ?? ''}
              onChange={(e) => setSelectedSlot(parseInt(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {databases.length === 0 && <option value="">No databases available</option>}
              {databases.map((db) => (
                <option key={db.slot_index} value={db.slot_index}>
                  {db.display_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{user?.username}</span>
          {user?.role === 'admin' && (
            <a
              href="/admin"
              className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-0.5"
            >
              Admin
            </a>
          )}
          <button
            onClick={() => { setConfirmWriteOps(user?.confirm_write_ops === 1); setShowSettings(true); }}
            className="text-gray-400 hover:text-gray-600"
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={logout}
            className="text-gray-400 hover:text-gray-600"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Schema sidebar */}
        <div className={`flex-shrink-0 border-r border-gray-200 flex flex-col transition-all duration-200 ${showSchema ? 'w-64' : 'w-0 overflow-hidden'}`}>
          <SchemaBrowser slotIndex={selectedSlot} />
        </div>

        {/* Toggle schema button */}
        <button
          onClick={() => setShowSchema((s) => !s)}
          className="flex-shrink-0 flex items-center justify-center w-5 border-r border-gray-200 hover:bg-gray-100 text-gray-400"
          title={showSchema ? 'Hide schema' : 'Show schema'}
        >
          {showSchema ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Editor + results */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor area */}
          <div className="flex flex-col flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-500">SQL Editor</span>
              <button
                onClick={handleRun}
                disabled={loading || !selectedSlot}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50"
              >
                <Play size={12} /> {loading ? 'Running…' : 'Run (⌘↵)'}
              </button>
            </div>
            <div className="flex-1 overflow-hidden" style={{ minHeight: '200px' }}>
              <SQLEditor value={sql} onChange={setSql} onRun={handleRun} />
            </div>
          </div>

          {/* Results area */}
          <div className="flex-shrink-0 border-t border-gray-200" style={{ height: '280px' }}>
            {error ? (
              <div className="p-4 text-sm text-red-600 bg-red-50 h-full overflow-auto">
                <strong>Error:</strong> {error}
              </div>
            ) : result ? (
              <ResultsTable
                columns={result.columns}
                rows={result.rows}
                rowsAffected={result.rowsAffected}
                isSelect={result.isSelect}
                executionTime={result.executionTime}
              />
            ) : (
              <div className="p-4 text-sm text-gray-400">
                Run a query to see results here
              </div>
            )}
          </div>
        </div>

        {/* History sidebar */}
        <div className={`flex-shrink-0 border-l border-gray-200 flex flex-col transition-all duration-200 ${showHistory ? 'w-80' : 'w-0 overflow-hidden'}`}>
          <QueryHistory onSelectQuery={(q) => setSql(q)} />
        </div>

        {/* Toggle history button */}
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="flex-shrink-0 flex items-center justify-center w-5 border-l border-gray-200 hover:bg-gray-100 text-gray-400"
          title={showHistory ? 'Hide history' : 'Show history'}
        >
          <History size={12} />
        </button>
      </div>

      {/* Confirm dialog */}
      {pendingSql && (
        <ConfirmDialog
          sql={pendingSql}
          onConfirm={handleConfirmExecute}
          onCancel={() => setPendingSql(null)}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-80 shadow-xl space-y-4">
            <h3 className="font-semibold text-gray-900">User Settings</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmWriteOps}
                onChange={(e) => setConfirmWriteOps(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-gray-700">Confirm write operations</span>
            </label>
            <p className="text-xs text-gray-400">
              When enabled, a confirmation dialog is shown before executing INSERT, UPDATE, DELETE, etc.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {savingSettings ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-1.5 border rounded text-sm hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
