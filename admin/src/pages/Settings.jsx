import React, { useState, useEffect } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function Settings() {
  const [settings, setSettings] = useState({
    perRoundSendLimit: 25,
    defaultCommissionRate: 4.5,
    minWithdrawalAmount: 50,
    maxWithdrawalPerDay: 10000,
    newbieRewardAmount: 350,
    newbieRewardThreshold: 2000,
    referrerBonus: 10,
    referredBonus: 5,
    cashbackDisplayRate: 4.5,
    paymentWarningMessage: 'Please use Freecharge or Mobikwik or amazon wallet for payment!',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get('/api/admin/settings')
      .then((res) => {
        const s = res.data.data.settings;
        if (s) setSettings(prev => ({ ...prev, ...s }));
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await client.put('/api/admin/settings', {
        perRoundSendLimit: parseInt(settings.perRoundSendLimit),
        defaultCommissionRate: parseFloat(settings.defaultCommissionRate),
        minWithdrawalAmount: parseFloat(settings.minWithdrawalAmount),
        maxWithdrawalPerDay: parseFloat(settings.maxWithdrawalPerDay),
        newbieRewardAmount: parseFloat(settings.newbieRewardAmount),
        newbieRewardThreshold: parseFloat(settings.newbieRewardThreshold),
        referrerBonus: parseFloat(settings.referrerBonus),
        referredBonus: parseFloat(settings.referredBonus),
        cashbackDisplayRate: parseFloat(settings.cashbackDisplayRate),
        paymentWarningMessage: settings.paymentWarningMessage,
      });
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
      </div>
    );
  }

  const fields = [
    { key: 'perRoundSendLimit', label: 'Per-Round SMS Send Limit', type: 'number', hint: 'SMS batch size (1-100)' },
    { key: 'defaultCommissionRate', label: 'Default Commission Rate (%)', type: 'number', hint: 'e.g. 4.5 for 4.5%' },
    { key: 'cashbackDisplayRate', label: 'Cashback Display Rate (%)', type: 'number', hint: 'Rate shown on payment screen' },
    { key: 'minWithdrawalAmount', label: 'Min Withdrawal Amount (∫)', type: 'number' },
    { key: 'maxWithdrawalPerDay', label: 'Max Withdrawal Per Day (∫)', type: 'number' },
    { key: 'newbieRewardAmount', label: 'Newbie Reward Amount (∫)', type: 'number', hint: 'Default: 350' },
    { key: 'newbieRewardThreshold', label: 'Newbie Reward Threshold (∫)', type: 'number', hint: 'Total transactions needed to claim, default: 2000' },
    { key: 'referrerBonus', label: 'Referrer Bonus (∫)', type: 'number' },
    { key: 'referredBonus', label: 'Referred User Bonus (∫)', type: 'number' },
    { key: 'paymentWarningMessage', label: 'Payment Warning Message', type: 'text' },
  ];

  return (
    <div className="max-w-2xl">
      <div className="bg-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-6">Platform Settings</h2>
        <div className="space-y-4">
          {fields.map(({ key, label, type, hint }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
              {hint && <p className="text-xs text-slate-500 mb-1">{hint}</p>}
              <input
                type={type}
                value={settings[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="w-full bg-slate-700 text-white border border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-yellow-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors mt-4"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
