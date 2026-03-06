import React, { useState, useEffect, useCallback, useRef } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const SIM_LABELS = { 0: 'SIM 1', 1: 'SIM 2' };
const POLL_INTERVAL_MS = 5000;
const MESSAGE_PREVIEW_LENGTH = 80;

export default function ReceivedSms() {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [expandedMessage, setExpandedMessage] = useState(null);

  // Filter state
  const [filterSender, setFilterSender] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const firstLogIdRef = useRef(null);
  const isPollingRef = useRef(false);
  const knownIdsRef = useRef(new Set());

  const buildQuery = useCallback((page = 1, overrides = {}) => {
    const params = new URLSearchParams({ page, limit: 20 });
    const sender = overrides.sender !== undefined ? overrides.sender : filterSender;
    const userId = overrides.userId !== undefined ? overrides.userId : filterUserId;
    const from = overrides.from !== undefined ? overrides.from : filterFrom;
    const to = overrides.to !== undefined ? overrides.to : filterTo;
    if (sender) params.append('sender', sender);
    if (userId) params.append('userId', userId);
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return `/api/admin/sms/received?${params.toString()}`;
  }, [filterSender, filterUserId, filterFrom, filterTo]);

  const fetchLogs = useCallback(async (page = 1, overrides = {}) => {
    setLoading(true);
    try {
      const res = await client.get(buildQuery(page, overrides));
      const data = res.data.data;
      const newLogs = data.logs || [];
      const pag = data.pagination || { page: 1, totalPages: 1, total: 0 };
      setLogs(newLogs);
      setPagination(pag);
      if (newLogs.length > 0) firstLogIdRef.current = newLogs[0].id;
    } catch (err) {
      toast.error('Failed to load received SMS logs');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Keep knownIdsRef in sync with logs state
  useEffect(() => {
    knownIdsRef.current = new Set(logs.map((l) => l.id));
  }, [logs]);

  // Auto-refresh: poll page 1 every 5 seconds and prepend new entries
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(async () => {
      if (isPollingRef.current) return; // skip if a poll is already in-flight
      isPollingRef.current = true;
      try {
        const res = await client.get(buildQuery(1));
        const data = res.data.data;
        const newLogs = data.logs || [];
        if (newLogs.length > 0 && newLogs[0].id !== firstLogIdRef.current) {
          // Find only logs newer than what we have
          const freshLogs = newLogs.filter((l) => !knownIdsRef.current.has(l.id));
          if (freshLogs.length > 0) {
            setLogs((prev) => [...freshLogs, ...prev]);
            firstLogIdRef.current = newLogs[0].id;
            setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
          }
        }
      } catch (_) {
        // silently ignore auto-refresh errors
      } finally {
        isPollingRef.current = false;
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLive, buildQuery]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const handleFilterReset = () => {
    setFilterSender('');
    setFilterUserId('');
    setFilterFrom('');
    setFilterTo('');
    fetchLogs(1, { sender: '', userId: '', from: '', to: '' });
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <form
        onSubmit={handleFilterSubmit}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-end"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">Sender</label>
          <input
            type="text"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="e.g. +91..."
            value={filterSender}
            onChange={(e) => setFilterSender(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">User ID</label>
          <input
            type="text"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="User ID"
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">From</label>
          <input
            type="datetime-local"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase">To</label>
          <input
            type="datetime-local"
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          Search
        </button>
        <button
          type="button"
          onClick={handleFilterReset}
          className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200"
        >
          Reset
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header: total count + live indicator */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm text-gray-500">
            Total: <span className="font-semibold text-gray-800">{pagination.total ?? 0}</span> received SMS
          </span>
          <button
            onClick={() => setIsLive((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}
            />
            {isLive ? 'Live' : 'Paused'}
          </button>
        </div>

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
                      <td className="px-4 py-3 text-gray-600 max-w-xs">
                        <span
                          className="truncate block cursor-pointer hover:text-blue-600"
                          title="Click to expand"
                          onClick={() => setExpandedMessage(log.message)}
                        >
                          {log.message.length > MESSAGE_PREVIEW_LENGTH ? `${log.message.slice(0, MESSAGE_PREVIEW_LENGTH)}…` : log.message}
                        </span>
                      </td>
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

      {/* Message expand modal */}
      {expandedMessage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={() => setExpandedMessage(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Full Message</h3>
              <button
                onClick={() => setExpandedMessage(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap break-words">{expandedMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}
