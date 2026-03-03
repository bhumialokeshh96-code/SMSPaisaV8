import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await client.get(`/api/admin/users?page=${page}&limit=20`);
      setUsers(res.data.data.users || []);
      setPagination(res.data.data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggleActive = async (user) => {
    try {
      await client.put(`/api/admin/users/${user.id}/toggle-active`);
      toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error('Failed to update user');
    }
    setConfirm(null);
  };

  const handleChangeRole = async (user) => {
    const newRole = user.role === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await client.put(`/api/admin/users/${user.id}/role`, { role: newRole });
      toast.success(`Role changed to ${newRole}`);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error('Failed to change role');
    }
    setConfirm(null);
  };

  const handleDelete = async (user) => {
    try {
      await client.delete(`/api/admin/users/${user.id}`);
      toast.success('User deleted');
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error('Failed to delete user');
    }
    setConfirm(null);
  };

  const filtered = users.filter(u =>
    u.phone?.includes(search) || u.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search by phone or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Phone', 'Name', 'Role', 'Active', 'Balance', 'Total Earned', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{user.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}>{user.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{user.isActive ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">₹{parseFloat(user.wallet?.balance || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-600">₹{parseFloat(user.wallet?.totalEarned || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link to={`/users/${user.id}`} className="text-indigo-600 hover:underline text-xs">View</Link>
                      <button
                        onClick={() => setConfirm({ type: 'toggle', user })}
                        className="text-yellow-600 hover:underline text-xs"
                      >{user.isActive ? 'Ban' : 'Unban'}</button>
                      <button
                        onClick={() => setConfirm({ type: 'role', user })}
                        className="text-blue-600 hover:underline text-xs"
                      >Role</button>
                      <button
                        onClick={() => setConfirm({ type: 'delete', user })}
                        className="text-red-600 hover:underline text-xs"
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchUsers} />
      </div>

      <ConfirmDialog
        isOpen={confirm?.type === 'toggle'}
        title={confirm?.user?.isActive ? 'Ban User' : 'Unban User'}
        message={`Are you sure you want to ${confirm?.user?.isActive ? 'ban' : 'unban'} ${confirm?.user?.phone}?`}
        onConfirm={() => handleToggleActive(confirm.user)}
        onCancel={() => setConfirm(null)}
        confirmText={confirm?.user?.isActive ? 'Ban' : 'Unban'}
      />
      <ConfirmDialog
        isOpen={confirm?.type === 'role'}
        title="Change Role"
        message={`Change ${confirm?.user?.phone}'s role to ${confirm?.user?.role === 'ADMIN' ? 'USER' : 'ADMIN'}?`}
        onConfirm={() => handleChangeRole(confirm.user)}
        onCancel={() => setConfirm(null)}
        confirmText="Change Role"
        confirmColor="indigo"
      />
      <ConfirmDialog
        isOpen={confirm?.type === 'delete'}
        title="Delete User"
        message={`Are you sure you want to deactivate ${confirm?.user?.phone}? The user will be set as inactive.`}
        onConfirm={() => handleDelete(confirm.user)}
        onCancel={() => setConfirm(null)}
        confirmText="Delete"
      />
    </div>
  );
}
