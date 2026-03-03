import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const TYPE_OPTIONS = ['', 'EARNING', 'WITHDRAWAL', 'REFERRAL_BONUS', 'SIGNUP_BONUS'];
const STATUS_OPTIONS = ['', 'PENDING', 'COMPLETED', 'FAILED'];

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

  const fetchTransactions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (type) params.set('type', type);
      if (status) params.set('status', status);
      const res = await client.get(`/api/admin/transactions?${params}`);
      setTransactions(res.data.data.transactions || []);
      setPagination(res.data.data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [type, status]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const typeColors = {
    EARNING: 'bg-green-100 text-green-700',
    WITHDRAWAL: 'bg-blue-100 text-blue-700',
    REFERRAL_BONUS: 'bg-purple-100 text-purple-700',
    SIGNUP_BONUS: 'bg-yellow-100 text-yellow-700',
  };

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    COMPLETED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t || 'All Types'}</option>)}
        </select>
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
                    {['User Phone', 'Type', 'Amount', 'Status', 'Method', 'Description', 'Created'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{t.user?.phone || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${typeColors[t.type] || 'bg-gray-100 text-gray-600'}`}>{t.type}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800">₹{t.amount}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[t.status] || ''}`}>{t.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.paymentMethod || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{t.description || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchTransactions} />
          </>
        )}
      </div>
    </div>
  );
}
