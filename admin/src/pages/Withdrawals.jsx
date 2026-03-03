import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'PENDING', 'COMPLETED', 'FAILED'];

export default function Withdrawals() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDING');
  const [confirm, setConfirm] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchWithdrawals = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (status) params.set('status', status);
      const res = await client.get(`/api/admin/withdrawals?${params}`);
      setTransactions(res.data.data.transactions || []);
      setPagination(res.data.data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handleApprove = async (id) => {
    try {
      await client.put(`/api/admin/withdrawals/${id}/approve`);
      toast.success('Withdrawal approved');
      fetchWithdrawals();
    } catch (err) {
      toast.error('Failed to approve withdrawal');
    }
    setConfirm(null);
  };

  const handleReject = async (id) => {
    try {
      await client.put(`/api/admin/withdrawals/${id}/reject`);
      toast.success('Withdrawal rejected');
      fetchWithdrawals();
    } catch (err) {
      toast.error('Failed to reject withdrawal');
    }
    setConfirm(null);
  };

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['User Phone', 'Amount', 'Method', 'Status', 'Created', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((t) => (
                    <React.Fragment key={t.id}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-800">{t.user?.phone || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">₹{t.amount}</td>
                        <td className="px-4 py-3 text-gray-600">{t.paymentMethod}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[t.status] || ''}`}>{t.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                              className="text-gray-500 hover:underline text-xs">Details</button>
                            {t.status === 'PENDING' && (
                              <>
                                <button onClick={() => setConfirm({ type: 'approve', id: t.id })}
                                  className="text-green-600 hover:underline text-xs">Approve</button>
                                <button onClick={() => setConfirm({ type: 'reject', id: t.id })}
                                  className="text-red-600 hover:underline text-xs">Reject</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === t.id && (
                        <tr>
                          <td colSpan={6} className="px-4 py-3 bg-gray-50">
                            <div className="text-xs text-gray-600">
                              <strong>Payment Details:</strong>
                              <pre className="mt-1 bg-white p-2 rounded border text-xs overflow-auto">
                                {JSON.stringify(t.paymentDetails, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchWithdrawals} />
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirm?.type === 'approve'}
        title="Approve Withdrawal"
        message="Are you sure you want to approve this withdrawal?"
        onConfirm={() => handleApprove(confirm.id)}
        onCancel={() => setConfirm(null)}
        confirmText="Approve"
        confirmColor="indigo"
      />
      <ConfirmDialog
        isOpen={confirm?.type === 'reject'}
        title="Reject Withdrawal"
        message="Are you sure you want to reject this withdrawal?"
        onConfirm={() => handleReject(confirm.id)}
        onCancel={() => setConfirm(null)}
        confirmText="Reject"
      />
    </div>
  );
}
