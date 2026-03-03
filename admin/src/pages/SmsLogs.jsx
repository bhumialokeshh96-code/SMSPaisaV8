import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'SENT', 'DELIVERED', 'FAILED'];

export default function SmsLogs() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (status) params.set('status', status);
      const res = await client.get(`/api/admin/sms/logs?${params}`);
      setLogs(res.data.data.logs || []);
      setPagination(res.data.data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      toast.error('Failed to load SMS logs');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const statusColors = {
    SENT: 'bg-yellow-100 text-yellow-600',
    DELIVERED: 'bg-green-100 text-green-600',
    FAILED: 'bg-red-100 text-red-600',
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
                    {['User Phone', 'Recipient', 'Message', 'Status', 'Amount Earned', 'Created'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{log.user?.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{log.task?.recipient || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{log.task?.message || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[log.status] || ''}`}>{log.status}</span>
                      </td>
                      <td className="px-4 py-3 text-green-600 font-medium">₹{log.amountEarned?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(log.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchLogs} />
          </>
        )}
      </div>
    </div>
  );
}
