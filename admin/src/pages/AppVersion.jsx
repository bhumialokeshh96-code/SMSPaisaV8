import React, { useState, useEffect } from 'react';
import client from '../api/client';
import toast from 'react-hot-toast';

export default function AppVersion() {
  const [form, setForm] = useState({
    latestVersion: '',
    minVersion: '',
    apkUrl: '',
    releaseNotes: '',
    forceUpdate: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    client.get('/api/app/version')
      .then(res => {
        const d = res.data.data;
        if (d) setForm({
          latestVersion: d.latestVersion || '',
          minVersion: d.minVersion || '',
          apkUrl: d.apkUrl || '',
          releaseNotes: d.releaseNotes || '',
          forceUpdate: d.forceUpdate || false,
        });
      })
      .catch(() => toast.error('Failed to load version info'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await client.put('/api/admin/app/version', form);
      toast.success('App version updated!');
    } catch (err) {
      toast.error('Failed to update version');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">App Version Management</h2>
        <p className="text-sm text-gray-500 mt-1">Upload APK to AWS S3 and paste the URL here. Users will get update notification on next app launch.</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
        <strong>How to upload APK to S3:</strong>
        <ol className="mt-2 ml-4 list-decimal space-y-1">
          <li>AWS Console → S3 → Your bucket</li>
          <li>Upload APK file (e.g. <code>smspaisa-v1.0.2.apk</code>)</li>
          <li>Make file public → Copy URL</li>
          <li>Paste URL below</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Latest Version *</label>
            <input
              type="text"
              value={form.latestVersion}
              onChange={e => setForm({...form, latestVersion: e.target.value})}
              placeholder="e.g. 1.0.2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Version *</label>
            <input
              type="text"
              value={form.minVersion}
              onChange={e => setForm({...form, minVersion: e.target.value})}
              placeholder="e.g. 1.0.0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Users below this version are force updated</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">APK URL (S3) *</label>
          <input
            type="url"
            value={form.apkUrl}
            onChange={e => setForm({...form, apkUrl: e.target.value})}
            placeholder="https://your-bucket.s3.ap-south-1.amazonaws.com/apks/smspaisa-v1.0.2.apk"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Release Notes</label>
          <textarea
            value={form.releaseNotes}
            onChange={e => setForm({...form, releaseNotes: e.target.value})}
            placeholder="What's new in this version..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="forceUpdate"
            checked={form.forceUpdate}
            onChange={e => setForm({...form, forceUpdate: e.target.checked})}
            className="w-4 h-4 text-indigo-600 rounded"
          />
          <label htmlFor="forceUpdate" className="text-sm font-medium text-gray-700">
            Force Update <span className="text-gray-400 font-normal">(users cannot skip this update)</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Version Info'}
        </button>
      </form>
    </div>
  );
}
