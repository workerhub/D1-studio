import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { ToggleLeft, ToggleRight } from 'lucide-react';

type Slot = {
  slot_index: number;
  display_name: string;
  is_active: number;
};

export default function DBManagement() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ slots: Slot[] }>('/admin/db-slots');
      setSlots(data.slots);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (slot: Slot) => {
    try {
      await apiFetch(`/admin/db-slots/${slot.slot_index}`, {
        method: 'PUT',
        body: { is_active: !slot.is_active },
      });
      load();
    } catch { /* ignore */ }
  };

  const handleRename = async (slotIndex: number) => {
    try {
      await apiFetch(`/admin/db-slots/${slotIndex}`, {
        method: 'PUT',
        body: { display_name: editName },
      });
      setEditingIndex(null);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Database Slots</h2>
      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Slot</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Display Name</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Status</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => (
              <tr key={slot.slot_index} className="hover:bg-gray-50">
                <td className="border border-gray-200 px-3 py-2 font-mono text-xs text-gray-500">
                  DB_SLOT_{slot.slot_index}
                </td>
                <td className="border border-gray-200 px-3 py-2">
                  {editingIndex === slot.slot_index ? (
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(slot.slot_index);
                        if (e.key === 'Escape') setEditingIndex(null);
                      }}
                      className="border border-blue-400 rounded px-2 py-0.5 text-sm w-48 focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="cursor-pointer hover:text-blue-600"
                      onClick={() => { setEditingIndex(slot.slot_index); setEditName(slot.display_name); }}
                    >
                      {slot.display_name}
                    </span>
                  )}
                </td>
                <td className="border border-gray-200 px-3 py-2">
                  <span className={`text-xs ${slot.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                    {slot.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="border border-gray-200 px-3 py-2">
                  <button
                    onClick={() => handleToggle(slot)}
                    className={`flex items-center gap-1 text-xs ${slot.is_active ? 'text-green-600 hover:text-gray-500' : 'text-gray-400 hover:text-green-600'}`}
                  >
                    {slot.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {slot.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Click on a display name to rename inline. Toggle activation to show/hide databases from users.
      </p>
    </div>
  );
}
