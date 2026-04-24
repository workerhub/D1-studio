import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { Trash2 } from 'lucide-react';

type HistoryItem = {
  id: number;
  sql_text: string;
  status: string;
  rows_affected: number;
  executed_at: number;
  db_name: string | null;
};

type Props = {
  onSelectQuery?: (sql: string) => void;
};

export default function QueryHistory({ onSelectQuery }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ history: HistoryItem[]; total: number }>(
        `/history?page=${p}&limit=20`
      );
      setItems(data.history);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/history/${id}`, { method: 'DELETE' });
      load(page);
    } catch { /* ignore */ }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 flex items-center justify-between">
        <span>History</span>
        <span className="text-gray-400 font-normal">{total} queries</span>
      </div>
      <div className="flex-1 overflow-auto">
        {loading && <div className="p-3 text-xs text-gray-400">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="p-3 text-xs text-gray-400">No history yet</div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="group px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            onClick={() => onSelectQuery?.(item.sql_text)}
          >
            <div className="flex items-start justify-between gap-2">
              <pre className="text-xs text-gray-700 truncate font-mono flex-1 overflow-hidden whitespace-nowrap">
                {item.sql_text}
              </pre>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              <span className={item.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                {item.status}
              </span>
              {item.db_name && <span>· {item.db_name}</span>}
              <span>· {new Date(item.executed_at).toLocaleTimeString()}</span>
            </div>
          </div>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 text-xs text-gray-500">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="disabled:opacity-40 hover:text-gray-700"
          >
            Prev
          </button>
          <span>{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="disabled:opacity-40 hover:text-gray-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
