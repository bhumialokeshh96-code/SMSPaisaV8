import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { CheckCircle, XCircle, Plus, RefreshCw } from 'lucide-react';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CLAIMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PROOF_UPLOADED: 'bg-purple-100 text-purple-800',
  VERIFIED: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
};

export default function PaymentTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    recipientUPI: '', amount: '', commissionRate: '4.5',
    recipientName: '', title: '', instructions: '',
  });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/admin/payment-tasks${params}`);
      setTasks(res.data.data.tasks || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/admin/payment-tasks', {
        ...form,
        amount: parseFloat(form.amount),
        commissionRate: parseFloat(form.commissionRate),
      });
      setShowCreate(false);
      setForm({ recipientUPI: '', amount: '', commissionRate: '4.5', recipientName: '', title: '', instructions: '' });
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to create task');
    }
  };

  const handleVerify = async (id) => {
    if (!confirm('Verify this task and credit commission?')) return;
    try {
      await api.put(`/admin/payment-tasks/${id}/verify`);
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason (optional):');
    try {
      await api.put(`/admin/payment-tasks/${id}/reject`, { reason });
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Payment Tasks</h1>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600"
          >
            <option value="">All Status</option>
            {['PENDING','CLAIMED','PROOF_UPLOADED','COMPLETED','FAILED','EXPIRED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" /> Create Task
          </button>
          <button onClick={fetchTasks} className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-semibold text-white">Create Payment Task</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              {[
                { label: 'Recipient UPI *', key: 'recipientUPI', required: true },
                { label: 'Amount (∫) *', key: 'amount', type: 'number', required: true },
                { label: 'Commission Rate (%)', key: 'commissionRate', type: 'number' },
                { label: 'Recipient Name', key: 'recipientName' },
                { label: 'Task Title', key: 'title' },
                { label: 'Instructions', key: 'instructions' },
              ].map(({ label, key, type = 'text', required }) => (
                <div key={key}>
                  <label className="block text-sm text-slate-400 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required={required}
                    className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-yellow-500"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm font-medium">
                  Create
                </button>
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-slate-300">
              <tr>
                {['Code', 'Amount', 'Commission', 'Recipient UPI', 'Status', 'Assigned To', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {tasks.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No tasks found</td></tr>
              ) : tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-750">
                  <td className="px-4 py-3 font-mono text-yellow-400 font-bold">{task.code}</td>
                  <td className="px-4 py-3 text-white">∫{parseFloat(task.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-green-400">+∫{parseFloat(task.commissionAmount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300">{task.recipientUPI}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-800'}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{task.assignedTo?.phone || '-'}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(task.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {task.status === 'PROOF_UPLOADED' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleVerify(task.id)} className="p-1 text-green-400 hover:text-green-300" title="Verify">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleReject(task.id)} className="p-1 text-red-400 hover:text-red-300" title="Reject">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
