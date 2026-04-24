import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

type HistoryItem = {
  id: number;
  username: string;
  sql_text: string;
  status: string;
  rows_affected: number;
  executed_at: number;
  db_name: string | null;
};

export default function AdminHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filterUserId, setFilterUserId] = useState('');
  const [filterSlotIndex, setFilterSlotIndex] = useState('');

  const load = useCallback(async (p: number, uid: string, slot: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (uid) params.set('userId', uid);
      if (slot) params.set('slotIndex', slot);
      const data = await apiFetch<{ history: HistoryItem[]; total: number }>(
        `/admin/history?${params.toString()}`
      );
      setItems(data.history);
      setTotal(data.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, filterUserId, filterSlotIndex); }, [page, filterUserId, filterSlotIndex, load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Global Query History</h2>
        <div className="flex items-center gap-2">
          <input
            placeholder="User ID"
            value={filterUserId}
            onChange={(e) => { setFilterUserId(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-24"
          />
          <input
            placeholder="Slot"
            value={filterSlotIndex}
            onChange={(e) => { setFilterSlotIndex(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-20"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">User</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">DB</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">SQL</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Status</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Rows</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Time</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 text-xs">{item.username}</td>
                <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{item.db_name ?? '—'}</td>
                <td className="border border-gray-200 px-3 py-2 max-w-xs">
                  <pre className="text-xs font-mono truncate overflow-hidden">{item.sql_text}</pre>
                </td>
                <td className="border border-gray-200 px-3 py-2">
                  <span className={`text-xs ${item.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                    {item.status}
                  </span>
                </td>
                <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">{item.rows_affected}</td>
                <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500">
                  {new Date(item.executed_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >
            Prev
          </button>
          <span>{page} / {totalPages} ({total} total)</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
