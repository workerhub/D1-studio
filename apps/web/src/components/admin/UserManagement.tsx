import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../lib/api';
import { Plus, Pencil, Trash2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';

type UserRow = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  is_active: number;
  created_at: number;
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ username: '', password: '', email: '', role: 'user' });
  const [addError, setAddError] = useState<string | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: UserRow[] }>('/admin/users');
      setUsers(data.users);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    try {
      await apiFetch('/admin/users', {
        method: 'POST',
        body: addForm,
      });
      setShowAdd(false);
      setAddForm({ username: '', password: '', email: '', role: 'user' });
      load();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user?')) return;
    try {
      await apiFetch(`/admin/users/${id}`, { method: 'DELETE' });
      load();
    } catch { /* ignore */ }
  };

  const handleToggleActive = async (user: UserRow) => {
    try {
      await apiFetch(`/admin/users/${user.id}/status`, {
        method: 'PUT',
        body: { is_active: !user.is_active },
      });
      load();
    } catch { /* ignore */ }
  };

  const handleRoleChange = async (id: number, role: string) => {
    try {
      await apiFetch(`/admin/users/${id}/role`, { method: 'PUT', body: { role } });
      load();
    } catch { /* ignore */ }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordId) return;
    try {
      await apiFetch(`/admin/users/${resetPasswordId}/reset-password`, {
        method: 'POST',
        body: { password: newPassword },
      });
      setResetPasswordId(null);
      setNewPassword('');
    } catch { /* ignore */ }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await apiFetch(`/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: { username: editUsername, email: editEmail || null },
      });
      setEditingUser(null);
      load();
    } catch { /* ignore */ }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Users</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          <Plus size={14} /> Add User
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">New User</h3>
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Username"
              value={addForm.username}
              onChange={(e) => setAddForm((f) => ({ ...f, username: e.target.value }))}
              required
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              value={addForm.password}
              onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              required
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            />
            <select
              value={addForm.role}
              onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}
              className="border border-gray-300 rounded px-3 py-1.5 text-sm"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              Create
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-1.5 border rounded text-sm hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Username</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Email</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Role</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Status</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Created</th>
              <th className="border border-gray-200 px-3 py-2 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="border border-gray-200 px-3 py-2">{user.username}</td>
                <td className="border border-gray-200 px-3 py-2 text-gray-500">{user.email ?? '—'}</td>
                <td className="border border-gray-200 px-3 py-2">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="border border-gray-200 rounded px-2 py-0.5 text-xs"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="border border-gray-200 px-3 py-2">
                  <button
                    onClick={() => handleToggleActive(user)}
                    className={`flex items-center gap-1 text-xs ${user.is_active ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {user.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {user.is_active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="border border-gray-200 px-3 py-2 text-gray-500 text-xs">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="border border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingUser(user);
                        setEditUsername(user.username);
                        setEditEmail(user.email ?? '');
                      }}
                      className="text-gray-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setResetPasswordId(user.id)}
                      className="text-gray-400 hover:text-orange-600"
                      title="Reset password"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {resetPasswordId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={handleResetPassword} className="bg-white rounded-lg p-6 w-80 shadow-xl space-y-3">
            <h3 className="font-medium text-gray-900">Reset Password</h3>
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-1.5 bg-orange-600 text-white rounded text-sm hover:bg-orange-700">
                Reset
              </button>
              <button type="button" onClick={() => { setResetPasswordId(null); setNewPassword(''); }} className="px-4 py-1.5 border rounded text-sm hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <form onSubmit={handleEdit} className="bg-white rounded-lg p-6 w-80 shadow-xl space-y-3">
            <h3 className="font-medium text-gray-900">Edit User</h3>
            <input
              placeholder="Username"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              required
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                Save
              </button>
              <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-1.5 border rounded text-sm hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
