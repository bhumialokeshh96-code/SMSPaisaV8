import React, { useState, useEffect } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Settings() {
  const [perRoundSendLimit, setPerRoundSendLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get('/api/admin/settings')
      .then((res) => {
        setPerRoundSendLimit(res.data.data.settings.perRoundSendLimit);
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const value = parseInt(perRoundSendLimit, 10);
    if (isNaN(value) || value < 1 || value > 100) {
      toast.error('Value must be between 1 and 100');
      return;
    }
    setSaving(true);
    try {
      await client.put('/api/admin/settings', { perRoundSendLimit: value });
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Platform Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Per-Round SMS Send Limit
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Number of SMS messages sent in one batch before fetching the next batch (1–100).
            </p>
            <input
              type="number"
              min={1}
              max={100}
              value={perRoundSendLimit}
              onChange={(e) => setPerRoundSendLimit(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
