import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'SENT', 'DELIVERED', 'FAILED'];

const statusColors = {
  SENT: 'bg-yellow-100 text-yellow-600',
  DELIVERED: 'bg-green-100 text-green-600',
  FAILED: 'bg-red-100 text-red-600',
};

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [smsLogs, setSmsLogs] = useState([]);
  const [smsStats, setSmsStats] = useState({ sent: 0, delivered: 0, failed: 0, total: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchUser = useCallback(async (page = 1) => {
    if (page === 1) setLoading(true);
    else setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      const res = await client.get(`/api/admin/users/${id}?${params}`);
      const data = res.data.data;
      setUser(data.user);
      setSmsLogs(data.smsLogs || []);
      setSmsStats(data.smsStats || { sent: 0, delivered: 0, failed: 0, total: 0 });
      setPagination(data.smsLogsPagination || { page: 1, totalPages: 1 });
    } catch (err) {
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
      setLogsLoading(false);
    }
  }, [id, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
    fetchUser(1);
  }, [fetchUser]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchUser(page);
  };

  const handleToggleActive = async () => {
    try {
      await client.put(`/api/admin/users/${id}/toggle-active`);
      toast.success('User status updated');
      fetchUser(currentPage);
    } catch (err) {
      toast.error('Failed to update user');
    }
    setConfirm(null);
  };

  const handleChangeRole = async () => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await client.put(`/api/admin/users/${id}/role`, { role: newRole });
      toast.success(`Role changed to ${newRole}`);
      fetchUser(currentPage);
    } catch (err) {
      toast.error('Failed to change role');
    }
    setConfirm(null);
  };

  const handleDelete = async () => {
    try {
      await client.delete(`/api/admin/users/${id}`);
      toast.success('User deleted');
      navigate('/users');
    } catch (err) {
      toast.error('Failed to delete user');
    }
    setConfirm(null);
  };

  if (loading) return <LoadingSpinner size="lg" />;
  if (!user) return <div className="text-gray-500 p-6">User not found</div>;

  const wallet = user.wallet || {};

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/users')}
        className="text-indigo-600 hover:underline text-sm flex items-center gap-1"
      >
        ← Back to Users
      </button>

      {/* ── Section 1: User Profile Card ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{user.name || 'No Name'}</h2>
            <p className="text-gray-500 mt-1">{user.phone}</p>
            {user.email && <p className="text-gray-400 text-sm">{user.email}</p>}
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
              }`}>{user.role}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>{user.isActive ? 'Active' : 'Inactive'}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                user.kycVerified ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>{user.kycVerified ? 'KYC Verified' : 'KYC Pending'}</span>
            </div>
            <div className="mt-3 text-sm text-gray-500 space-y-1">
              <p>Referral Code: <span className="font-mono font-semibold text-indigo-600">{user.referralCode}</span></p>
              <p>Joined: {new Date(user.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              {user.referralReceived?.referrer && (
                <p>Referred By: <span className="text-gray-700">{user.referralReceived.referrer.phone}</span></p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setConfirm('toggle')}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition ${
                user.isActive
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >{user.isActive ? 'Ban User' : 'Unban User'}</button>
            <button
              onClick={() => setConfirm('role')}
              className="px-4 py-2 text-sm rounded-lg font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 transition"
            >{user.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin'}</button>
            <button
              onClick={() => setConfirm('delete')}
              className="px-4 py-2 text-sm rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition"
            >Delete User</button>
          </div>
        </div>
      </div>

      {/* ── Section 2: Account Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Wallet Balance', value: `₹${Number(wallet.balance || 0).toFixed(2)}`, color: 'text-indigo-600' },
          { label: 'Total Earned', value: `₹${Number(wallet.totalEarned || 0).toFixed(2)}`, color: 'text-green-600' },
          { label: 'Total Withdrawn', value: `₹${Number(wallet.totalWithdrawn || 0).toFixed(2)}`, color: 'text-orange-600' },
          { label: 'Devices', value: user.devices?.length || 0, color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Section 3: SMS Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Delivered', value: smsStats.delivered, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Sent', value: smsStats.sent, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Failed', value: smsStats.failed, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`rounded-xl border border-gray-100 p-4 text-center ${bg}`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label} SMS</p>
          </div>
        ))}
      </div>

      {/* ── Section 4: SMS Logs Table ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">SMS Logs <span className="text-gray-400 font-normal text-sm">({smsStats.total} total)</span></h3>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
          </select>
        </div>

        {logsLoading ? <div className="p-8 flex justify-center"><LoadingSpinner /></div> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Recipient', 'Message', 'Status', 'Amount Earned', 'Sent At', 'Created'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {smsLogs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No SMS logs found</td></tr>
                  ) : smsLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-gray-700">{log.task?.recipient || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs">
                        <span className="block truncate" title={log.task?.message}>{log.task?.message || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[log.status] || 'bg-gray-100 text-gray-600'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-green-700 font-medium">₹{Number(log.amountEarned || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {log.sentAt ? new Date(log.sentAt).toLocaleString('en-IN') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={handlePageChange} />
          </>
        )}
      </div>

      {/* ── Section 5: Devices ── */}
      {user.devices && user.devices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Devices ({user.devices.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Device Name', 'Model', 'Status', 'Last Seen', 'Registered'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {user.devices.map((device) => (
                  <tr key={device.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{device.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{device.model || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        device.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>{device.isOnline ? 'Online' : 'Offline'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {device.lastSeen ? new Date(device.lastSeen).toLocaleString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(device.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 6: Payment Accounts ── */}
      {user.paymentAccounts && user.paymentAccounts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Payment Accounts ({user.paymentAccounts.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Type', 'Account Number / UPI', 'Name', 'Added'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {user.paymentAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700">{acc.type}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{acc.accountNumber || acc.upiId || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{acc.name || acc.holderName || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(acc.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 7: Referrals ── */}
      {user.referralsMade && user.referralsMade.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Users Referred ({user.referralsMade.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Phone', 'Name', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {user.referralsMade.map((ref) => (
                  <tr key={ref.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-800">{ref.referred?.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{ref.referred?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        ref.bonusPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-600'
                      }`}>{ref.bonusPaid ? 'Bonus Paid' : 'Pending'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(ref.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Confirm Dialogs ── */}
      <ConfirmDialog
        isOpen={confirm === 'toggle'}
        title={user.isActive ? 'Ban User?' : 'Unban User?'}
        message={user.isActive ? 'This user will be blocked from using the app.' : 'This user will regain access to the app.'}
        onConfirm={handleToggleActive}
        onCancel={() => setConfirm(null)}
        confirmText={user.isActive ? 'Ban' : 'Unban'}
      />
      <ConfirmDialog
        isOpen={confirm === 'role'}
        title="Change Role?"
        message={`Change role to ${user.role === 'ADMIN' ? 'USER' : 'ADMIN'}?`}
        onConfirm={handleChangeRole}
        onCancel={() => setConfirm(null)}
        confirmText="Change Role"
        confirmColor="indigo"
      />
      <ConfirmDialog
        isOpen={confirm === 'delete'}
        title="Delete User?"
        message="This action is permanent. All data will be deleted."
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        confirmText="Delete"
      />
    </div>
  );
}
