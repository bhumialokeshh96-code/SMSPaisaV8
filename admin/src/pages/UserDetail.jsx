import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const fetchUser = useCallback(async () => {
    try {
      const res = await client.get(`/api/admin/users/${id}`);
      setUser(res.data.data.user);
    } catch (err) {
      toast.error('Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const handleToggleActive = async () => {
    try {
      await client.put(`/api/admin/users/${id}/toggle-active`);
      toast.success('User status updated');
      fetchUser();
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
      fetchUser();
    } catch (err) {
      toast.error('Failed to change role');
    }
    setConfirm(null);
  };

  if (loading) return <LoadingSpinner size="lg" />;
  if (!user) return <div className="text-gray-500">User not found</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/users')} className="text-indigo-600 hover:underline text-sm">← Back to Users</button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{user.name || 'No Name'}</h3>
            <p className="text-gray-500">{user.phone}</p>
            {user.email && <p className="text-gray-400 text-sm">{user.email}</p>}
          </div>
          <div className="flex gap-3">
            <span className={`px-3 py-1 rounded-full text-sm ${
              user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
            }`}>{user.role}</span>
            <span className={`px-3 py-1 rounded-full text-sm ${
              user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>{user.isActive ? 'Active' : 'Inactive'}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setConfirm('toggle')}
            className={`px-4 py-2 text-sm rounded-lg ${user.isActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
          >{user.isActive ? 'Ban User' : 'Unban User'}</button>
          <button
            onClick={() => setConfirm('role')}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
          >Change to {user.role === 'ADMIN' ? 'USER' : 'ADMIN'}</button>
        </div>
      </div>

      {user.wallet && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="font-semibold text-gray-700 mb-4">Wallet</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">₹{parseFloat(user.wallet.balance || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Balance</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">₹{parseFloat(user.wallet.totalEarned || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Total Earned</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">₹{parseFloat(user.wallet.totalWithdrawn || 0).toFixed(2)}</p>
              <p className="text-sm text-gray-500">Total Withdrawn</p>
            </div>
          </div>
        </div>
      )}

      {user.devices?.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="font-semibold text-gray-700 mb-4">Devices ({user.devices.length})</h4>
          <div className="space-y-3">
            {user.devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm text-gray-800">{device.deviceName}</p>
                  <p className="text-xs text-gray-500">{device.deviceId}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${device.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {device.isOnline ? 'Online' : 'Offline'}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">SMS today: {device.smsSentToday}/{device.dailyLimit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirm === 'toggle'}
        title={user.isActive ? 'Ban User' : 'Unban User'}
        message={`Are you sure you want to ${user.isActive ? 'ban' : 'unban'} this user?`}
        onConfirm={handleToggleActive}
        onCancel={() => setConfirm(null)}
        confirmText={user.isActive ? 'Ban' : 'Unban'}
      />
      <ConfirmDialog
        isOpen={confirm === 'role'}
        title="Change Role"
        message={`Change role to ${user.role === 'ADMIN' ? 'USER' : 'ADMIN'}?`}
        onConfirm={handleChangeRole}
        onCancel={() => setConfirm(null)}
        confirmText="Change Role"
        confirmColor="indigo"
      />
    </div>
  );
}
