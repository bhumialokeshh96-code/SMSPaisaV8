import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await client.get('/api/admin/devices');
      setDevices(res.data.data.devices || []);
    } catch (err) {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 15000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="w-2 h-2 bg-green-500 rounded-full inline-block animate-pulse"></span>
        Auto-refreshes every 15 seconds
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Device Name', 'Device ID', 'User Phone', 'Status', 'SMS Today', 'Daily Limit', 'Active Hours', 'Last Seen'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No online devices</td>
                </tr>
              ) : devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{device.deviceName}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{device.deviceId}</td>
                  <td className="px-4 py-3 text-gray-600">{device.user?.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${device.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-2 h-2 rounded-full ${device.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                      {device.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{device.smsSentToday}</td>
                  <td className="px-4 py-3 text-gray-600">{device.dailyLimit}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{device.activeHoursStart} – {device.activeHoursEnd}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {device.updatedAt ? new Date(device.updatedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
