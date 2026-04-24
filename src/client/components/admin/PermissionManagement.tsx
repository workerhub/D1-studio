import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';

type UserRow = { id: number; username: string };
type Slot = { slot_index: number; display_name: string; is_active: number };

export default function PermissionManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadUsersAndSlots = useCallback(async () => {
    try {
      const [usersData, slotsData] = await Promise.all([
        apiFetch<{ users: UserRow[] }>('/admin/users'),
        apiFetch<{ slots: Slot[] }>('/admin/db-slots'),
      ]);
      setUsers(usersData.users);
      setSlots(slotsData.slots.filter((s) => s.is_active));
    } catch { /* ignore */ }
  }, []);

  const loadPermissions = useCallback(async (userId: number) => {
    try {
      const data = await apiFetch<{ slots: number[] }>(`/admin/permissions/${userId}`);
      setSelectedSlots(new Set(data.slots));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadUsersAndSlots(); }, [loadUsersAndSlots]);

  useEffect(() => {
    if (selectedUserId !== null) {
      loadPermissions(selectedUserId);
    }
  }, [selectedUserId, loadPermissions]);

  const handleToggleSlot = (slotIndex: number) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      if (next.has(slotIndex)) next.delete(slotIndex); else next.add(slotIndex);
      return next;
    });
  };

  const handleSave = async () => {
    if (selectedUserId === null) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/permissions/${selectedUserId}`, {
        method: 'PUT',
        body: { slots: Array.from(selectedSlots) },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900 mb-4">Permission Management</h2>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-gray-600">Select user:</label>
        <select
          value={selectedUserId ?? ''}
          onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
        >
          <option value="">— Choose a user —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.username}</option>
          ))}
        </select>
      </div>

      {selectedUserId !== null && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Active database slots:</p>
          {slots.length === 0 ? (
            <p className="text-sm text-gray-400">No active slots. Activate slots in the Databases tab first.</p>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => (
                <label key={slot.slot_index} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedSlots.has(slot.slot_index)}
                    onChange={() => handleToggleSlot(slot.slot_index)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-800">{slot.display_name}</span>
                  <span className="text-xs text-gray-400">(DB_SLOT_{slot.slot_index})</span>
                </label>
              ))}
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Permissions'}
          </button>
        </div>
      )}
    </div>
  );
}
