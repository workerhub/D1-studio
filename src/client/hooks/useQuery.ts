import { useState, useCallback } from 'react';
import { apiFetch } from '../lib/api';

type QueryResult = {
  columns: string[];
  rows: unknown[][];
  rowsAffected: number;
  isSelect: boolean;
  executionTime: number;
};

export function useQuery() {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (sql: string, slotIndex: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<QueryResult>('/query/execute', {
        method: 'POST',
        body: { sql, slotIndex },
      });
      setResult(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Query failed';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, execute, setResult };
}
