import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

type Setting = { key: string; value: string };

const RETENTION_OPTIONS = ['3', '7', '15', '30'];

export default function SystemConfig() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(false);
  const [retentionDays, setRetentionDays] = useState('30');
  const [customRetention, setCustomRetention] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ settings: Setting[] }>('/admin/settings');
      setSettings(data.settings);
      const retention = data.settings.find((s) => s.key === 'history_retention_days')?.value ?? '30';
      if (RETENTION_OPTIONS.includes(retention)) {
        setRetentionDays(retention);
        setIsCustom(false);
      } else {
        setIsCustom(true);
        setCustomRetention(retention);
        setRetentionDays('custom');
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const value = isCustom ? customRetention : retentionDays;
      await apiFetch('/admin/settings', {
        method: 'PUT',
        body: { key: 'history_retention_days', value },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-sm text-gray-400">Loading…</div>;

  return (
    <div className="max-w-md">
      <h2 className="text-base font-semibold text-gray-900 mb-4">System Configuration</h2>
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Query History Retention
          </label>
          <div className="flex items-center gap-2">
            <select
              value={isCustom ? 'custom' : retentionDays}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setIsCustom(true);
                  setRetentionDays('custom');
                } else {
                  setIsCustom(false);
                  setRetentionDays(e.target.value);
                }
              }}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="15">15 days</option>
              <option value="30">30 days</option>
              <option value="custom">Custom…</option>
            </select>
            {isCustom && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={customRetention}
                  onChange={(e) => setCustomRetention(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm w-20"
                  placeholder="days"
                />
                <span className="text-sm text-gray-500">days</span>
              </div>
            )}
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            History older than this will be automatically deleted.
          </p>
        </div>

        {settings.filter((s) => s.key !== 'history_retention_days').map((s) => (
          <div key={s.key} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">{s.key}</label>
            <span className="text-sm text-gray-600">{s.value}</span>
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
