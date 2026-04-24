import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import UserManagement from '../components/admin/UserManagement';
import DBManagement from '../components/admin/DBManagement';
import PermissionManagement from '../components/admin/PermissionManagement';
import AdminHistory from '../components/admin/AdminHistory';
import SystemConfig from '../components/admin/SystemConfig';
import { ArrowLeft } from 'lucide-react';

type Tab = 'users' | 'databases' | 'permissions' | 'history' | 'settings';

export default function AdminPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'databases', label: 'Databases' },
    { id: 'permissions', label: 'Permissions' },
    { id: 'history', label: 'History' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft size={14} /> Back to Editor
          </a>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-900">D1Studio Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{user?.username}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4">
        <nav className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <main className="p-6 max-w-6xl mx-auto">
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'databases' && <DBManagement />}
        {activeTab === 'permissions' && <PermissionManagement />}
        {activeTab === 'history' && <AdminHistory />}
        {activeTab === 'settings' && <SystemConfig />}
      </main>
    </div>
  );
}
