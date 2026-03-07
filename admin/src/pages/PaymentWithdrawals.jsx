import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
};

export default function PaymentWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchWithdrawals = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/admin/payment-withdrawals${params}`);
      setWithdrawals(res.data.data.withdrawals || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWithdrawals(); }, [statusFilter]);

  const handleApprove = async (id) => {
    if (!confirm('Approve this withdrawal?')) return;
    try {
      await api.put(`/admin/payment-withdrawals/${id}/approve`);
      fetchWithdrawals();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Rejection reason:');
    try {
      await api.put(`/admin/payment-withdrawals/${id}/reject`, { reason });
      fetchWithdrawals();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Payment Withdrawals</h1>
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-700 text-white text-sm rounded-lg px-3 py-2 border border-slate-600"
          >
            <option value="">All Status</option>
            {['PENDING','APPROVED','PROCESSING','COMPLETED','REJECTED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button onClick={fetchWithdrawals} className="p-2 bg-slate-700 rounded-lg text-slate-300 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-700 text-slate-300">
              <tr>
                {['User', 'Amount', 'Method', 'Payment Details', 'PIN Verified', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {withdrawals.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No withdrawals found</td></tr>
              ) : withdrawals.map((w) => (
                <tr key={w.id} className="hover:bg-slate-750">
                  <td className="px-4 py-3">
                    <div className="text-white">{w.user?.name || 'Unknown'}</div>
                    <div className="text-slate-400 text-xs">{w.user?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-yellow-400 font-semibold">∫{parseFloat(w.amount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-300">{w.paymentMethod}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">
                    {typeof w.paymentDetails === 'object' ? JSON.stringify(w.paymentDetails) : w.paymentDetails}
                  </td>
                  <td className="px-4 py-3">
                    {w.pinVerified ? (
                      <span className="text-green-400 text-xs">✓ Verified</span>
                    ) : (
                      <span className="text-red-400 text-xs">✗ Not verified</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[w.status] || 'bg-gray-100 text-gray-800'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{new Date(w.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {w.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(w.id)} className="p-1 text-green-400 hover:text-green-300" title="Approve">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleReject(w.id)} className="p-1 text-red-400 hover:text-red-300" title="Reject">
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
