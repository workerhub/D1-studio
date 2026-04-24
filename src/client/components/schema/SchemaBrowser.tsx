import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { ChevronRight, ChevronDown, Table2 } from 'lucide-react';

type Column = { name: string; type: string };
type TableInfo = { name: string; columns: Column[] };

type Props = {
  slotIndex: number | null;
};

export default function SchemaBrowser({ slotIndex }: Props) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadSchema = useCallback(async (idx: number) => {
    setLoading(true);
    try {
      const data = await apiFetch<{ schema: TableInfo[] }>(`/query/schema/${idx}`);
      setTables(data.schema);
    } catch {
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (slotIndex !== null) {
      setTables([]);
      loadSchema(slotIndex);
    }
  }, [slotIndex, loadSchema]);

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
        Schema
      </div>
      {loading && <div className="p-3 text-xs text-gray-400">Loading…</div>}
      {!loading && tables.length === 0 && slotIndex !== null && (
        <div className="p-3 text-xs text-gray-400">No tables found</div>
      )}
      {tables.map((t) => (
        <div key={t.name}>
          <button
            onClick={() => toggle(t.name)}
            className="flex items-center gap-1.5 w-full px-3 py-1.5 hover:bg-gray-100 text-xs text-gray-800"
          >
            {expanded.has(t.name) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Table2 size={12} className="text-blue-500" />
            <span className="font-medium">{t.name}</span>
          </button>
          {expanded.has(t.name) && (
            <div className="ml-6 border-l border-gray-200 pl-2 pb-1">
              {t.columns.map((col) => (
                <div key={col.name} className="flex items-center gap-1.5 py-0.5 px-2 text-xs text-gray-600">
                  <span className="font-mono">{col.name}</span>
                  <span className="text-gray-400">{col.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
