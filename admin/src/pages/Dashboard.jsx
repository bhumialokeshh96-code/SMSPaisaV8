import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, MessageSquare, DollarSign, Smartphone, Clock } from 'lucide-react';
import client from '../api/client';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentWithdrawals, setRecentWithdrawals] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, withdrawalsRes, usersRes, chartRes] = await Promise.all([
        client.get('/api/admin/stats'),
        client.get('/api/admin/withdrawals?limit=5'),
        client.get('/api/admin/users?limit=5'),
        client.get('/api/admin/chart/weekly'),
      ]);
      setStats(statsRes.data.data);
      setRecentWithdrawals(withdrawalsRes.data.data.transactions || []);
      setRecentUsers(usersRes.data.data.users || []);
      setChartData(chartRes.data.data.days || []);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers?.toLocaleString() || 0}
          icon={<Users className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="SMS Delivered"
          value={stats?.totalSmsDelivered?.toLocaleString() || 0}
          icon={<MessageSquare className="w-5 h-5" />}
          color="indigo"
        />
        <StatCard
          title="Total Earnings"
          value={`₹${parseFloat(stats?.totalEarnings || 0).toFixed(2)}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          title="Online Devices"
          value={stats?.onlineDevices || 0}
          icon={<Smartphone className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Pending Withdrawals"
          value={stats?.pendingWithdrawals || 0}
          icon={<Clock className="w-5 h-5" />}
          color="yellow"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">SMS Activity (Last 7 Days)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="sms" stroke="#6366f1" strokeWidth={2} name="SMS Sent" />
            <Line type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={2} name="Earnings (₹)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Recent Withdrawals</h3>
            <Link to="/withdrawals" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          {recentWithdrawals.length === 0 ? (
            <p className="text-gray-500 text-sm">No withdrawals yet</p>
          ) : (
            <div className="space-y-3">
              {recentWithdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{w.user?.phone}</p>
                    <p className="text-xs text-gray-500">{new Date(w.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">₹{w.amount}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      w.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      w.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>{w.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Recent Users</h3>
            <Link to="/users" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-gray-500 text-sm">No users yet</p>
          ) : (
            <div className="space-y-3">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{u.phone}</p>
                    <p className="text-xs text-gray-500">{u.name || 'No name'}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                    <p className="text-xs text-gray-500 mt-1">{new Date(u.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
