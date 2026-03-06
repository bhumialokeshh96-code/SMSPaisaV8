import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const SIM_LABELS = { 0: 'SIM 1', 1: 'SIM 2' };

export default function ReceivedSms() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await client.get(`/api/admin/sms/received?page=${page}&limit=20`);
      setLogs(res.data.data.logs || []);
      setPagination(res.data.data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      toast.error('Failed to load received SMS logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['User Phone', 'Device', 'Sender', 'Message', 'SIM', 'Received At'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No received SMS logs yet</td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{log.user?.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono">{log.device?.deviceName || log.device?.deviceId || '—'}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{log.sender}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={log.message}>{log.message}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                          {SIM_LABELS[log.simSlot] ?? `SIM ${log.simSlot + 1}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(log.receivedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={fetchLogs}
            />
          </>
        )}
      </div>
    </div>
  );
}
