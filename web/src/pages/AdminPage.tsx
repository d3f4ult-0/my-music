import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, Disc, Music, Flag, Check, X, Trash2 } from 'lucide-react';
import { apiRequest } from '../api/client';
import { User } from '../types';

interface SystemStats {
  users: number;
  artists: number;
  albums: number;
  songs: number;
  pending_reports: number;
}

interface ReportItem {
  id: number;
  song_id: number;
  song_title: string;
  reporter_username: string;
  reason: string;
  description?: string;
  status: string;
  created_at: string;
}

export const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');
  const [loading, setLoading] = useState(true);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [s, u, r] = await Promise.all([
        apiRequest<SystemStats>('/admin/stats'),
        apiRequest<User[]>('/admin/users'),
        apiRequest<ReportItem[]>('/reports'),
      ]);
      setStats(s);
      setUsers(u);
      setReports(r);
    } catch (err) {
      console.warn('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleResolveReport = async (reportId: number, action: 'resolve' | 'dismiss') => {
    try {
      await apiRequest(`/reports/${reportId}/resolve?action=${action}`, { method: 'PATCH' });
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      if (stats && action === 'resolve') {
        setStats({ ...stats, pending_reports: Math.max(0, stats.pending_reports - 1) });
      }
    } catch (err: any) {
      alert(`Could not resolve report: ${err.message}`);
    }
  };

  const handleToggleUser = async (userId: number, currentStatus: boolean) => {
    try {
      await apiRequest(`/admin/users/${userId}/status?is_active=${!currentStatus}`, {
        method: 'PATCH',
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: !currentStatus } : u))
      );
    } catch (err: any) {
      alert(`Could not update user: ${err.message}`);
    }
  };

  const handleRemoveTrack = async (songId: number) => {
    if (!window.confirm('Delete this unauthorized song from the entire platform?')) return;
    try {
      await apiRequest(`/admin/songs/${songId}`, { method: 'DELETE' });
      alert('Track removed from catalog.');
      loadAdminData();
    } catch (err: any) {
      alert(`Could not delete: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-neutral-500 text-sm">Loading admin data...</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
          <ShieldCheck size={28} className="text-primary" /> Platform Administration
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1">
          Monitor platform metrics, moderate reported content, and manage user accounts.
        </p>
      </div>

      {/* KPI Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-surface-card border border-border-subtle flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Users size={20} />
            </div>
            <div>
              <div className="text-xs text-neutral-400">Total Users</div>
              <div className="text-xl font-bold text-white">{stats.users}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-card border border-border-subtle flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Music size={20} />
            </div>
            <div>
              <div className="text-xs text-neutral-400">Total Songs</div>
              <div className="text-xl font-bold text-white">{stats.songs}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-card border border-border-subtle flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Disc size={20} />
            </div>
            <div>
              <div className="text-xs text-neutral-400">Albums & Singles</div>
              <div className="text-xl font-bold text-white">{stats.albums}</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-card border border-border-subtle flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Flag size={20} />
            </div>
            <div>
              <div className="text-xs text-neutral-400">Pending Reports</div>
              <div className="text-xl font-bold text-amber-400">{stats.pending_reports}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-subtle pb-3">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'reports'
              ? 'bg-primary text-black'
              : 'text-neutral-400 hover:text-white bg-surface-card'
          }`}
        >
          Reported Content ({reports.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'users'
              ? 'bg-primary text-black'
              : 'text-neutral-400 hover:text-white bg-surface-card'
          }`}
        >
          User Accounts ({users.length})
        </button>
      </div>

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <section className="space-y-3">
          {reports.length === 0 ? (
            <div className="p-12 text-center text-xs text-neutral-500 bg-surface-card rounded-xl border border-border-subtle">
              No pending reports to review! All content complies with platform guidelines.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-card">
              <table className="w-full text-left text-xs sm:text-sm text-neutral-300">
                <thead className="bg-surface-hover/80 text-[11px] uppercase tracking-wider text-neutral-400 border-b border-border-subtle">
                  <tr>
                    <th className="py-3 px-4">Track</th>
                    <th className="py-3 px-4">Reporter</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Details</th>
                    <th className="py-3 px-4 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {reports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-surface-hover/50">
                      <td className="py-3 px-4 font-semibold text-white">{rep.song_title}</td>
                      <td className="py-3 px-4 text-neutral-400">{rep.reporter_username}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {rep.reason}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-400 max-w-xs truncate">
                        {rep.description || 'No comment'}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        <button
                          onClick={() => handleRemoveTrack(rep.song_id)}
                          className="px-2.5 py-1 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white rounded text-xs font-semibold transition-colors"
                          title="Remove track immediately"
                        >
                          Remove Track
                        </button>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'resolve')}
                          className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"
                          title="Resolve report"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handleResolveReport(rep.id, 'dismiss')}
                          className="p-1 text-neutral-400 hover:bg-neutral-700 rounded"
                          title="Dismiss report"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <section className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-card">
            <table className="w-full text-left text-xs sm:text-sm text-neutral-300">
              <thead className="bg-surface-hover/80 text-[11px] uppercase tracking-wider text-neutral-400 border-b border-border-subtle">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-hover/50">
                    <td className="py-3 px-4 font-semibold text-white">
                      {u.display_name || u.username} ({u.username})
                    </td>
                    <td className="py-3 px-4 text-neutral-400">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-neutral-800 text-neutral-300 border border-neutral-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          u.is_active
                            ? 'text-emerald-400 bg-emerald-950/40'
                            : 'text-red-400 bg-red-950/40'
                        }`}
                      >
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleUser(u.id, u.is_active)}
                        className={`px-3 py-1 rounded text-xs font-semibold border ${
                          u.is_active
                            ? 'bg-neutral-800 hover:bg-red-500/20 text-neutral-300 hover:text-red-400 border-neutral-700'
                            : 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
