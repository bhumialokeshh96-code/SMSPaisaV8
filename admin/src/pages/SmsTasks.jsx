import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'QUEUED', 'ASSIGNED', 'SENT', 'DELIVERED', 'FAILED'];

export default function SmsTasks() {
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ recipient: '', message: '', clientId: '', priority: 0 });
  const [bulkInput, setBulkInput] = useState('');
  const [assignForm, setAssignForm] = useState({ recipient: '', message: '', clientId: '', priority: 0, userId: '' });

  const fetchTasks = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (status) params.set('status', status);
      const res = await client.get(`/api/admin/sms/tasks?${params}`);
      setTasks(res.data.data.tasks || []);
      setPagination(res.data.data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      toast.error('Failed to load SMS tasks');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const fetchUsers = async () => {
    try {
      const res = await client.get('/api/admin/users?limit=100');
      setUsers(res.data.data.users || []);
    } catch (err) {
      toast.error('Failed to load users');
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await client.post('/api/admin/sms/create-task', form);
      toast.success('Task created');
      setShowCreate(false);
      setForm({ recipient: '', message: '', clientId: '', priority: 0 });
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    }
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    try {
      const tasks = JSON.parse(bulkInput);
      await client.post('/api/admin/sms/bulk-create', { tasks });
      toast.success(`${tasks.length} tasks created`);
      setShowBulk(false);
      setBulkInput('');
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid JSON or failed to create tasks');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    try {
      await client.post('/api/admin/sms/assign-task', assignForm);
      toast.success('Task assigned to user');
      setShowAssign(false);
      setAssignForm({ recipient: '', message: '', clientId: '', priority: 0, userId: '' });
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to assign task');
    }
  };

  const statusColors = {
    QUEUED: 'bg-gray-100 text-gray-600',
    ASSIGNED: 'bg-blue-100 text-blue-600',
    SENT: 'bg-yellow-100 text-yellow-600',
    DELIVERED: 'bg-green-100 text-green-600',
    FAILED: 'bg-red-100 text-red-600',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >+ Create Task</button>
        <button
          onClick={() => setShowBulk(!showBulk)}
          className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >Bulk Create</button>
        <button
          onClick={() => setShowAssign(!showAssign)}
          className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
        >📋 Assign to User</button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Create SMS Task</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recipient</label>
              <input value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value})}
                required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="+919876543210" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
              <input value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}
                required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="client-001" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
              <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <input type="number" value={form.priority} onChange={e => setForm({...form, priority: parseInt(e.target.value)})}
                min={0} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Create</button>
            </div>
          </form>
        </div>
      )}

      {showBulk && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-2">Bulk Create Tasks (JSON)</h3>
          <p className="text-xs text-gray-500 mb-3">Paste a JSON array: [{"{"}"recipient": "+91...", "message": "...", "clientId": "...", "priority": 0{"}"}]</p>
          <form onSubmit={handleBulkCreate}>
            <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)}
              rows={6} className="w-full border rounded-lg px-3 py-2 text-sm font-mono mb-3" placeholder='[{"recipient":"+919876543210","message":"Test","clientId":"c1","priority":0}]' />
            <button type="submit" className="px-6 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">Bulk Create</button>
          </form>
        </div>
      )}

      {showAssign && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Assign Task to Specific User</h3>
          <form onSubmit={handleAssign} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Choose User</label>
              <select
                value={assignForm.userId}
                onChange={e => setAssignForm({...assignForm, userId: e.target.value})}
                required
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select a user...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.phone} {u.name ? `(${u.name})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recipient</label>
              <input value={assignForm.recipient} onChange={e => setAssignForm({...assignForm, recipient: e.target.value})}
                required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="+919876543210" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
              <input value={assignForm.clientId} onChange={e => setAssignForm({...assignForm, clientId: e.target.value})}
                required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="client-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <input type="number" value={assignForm.priority} onChange={e => setAssignForm({...assignForm, priority: parseInt(e.target.value) || 0})}
                min={0} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
              <textarea value={assignForm.message} onChange={e => setAssignForm({...assignForm, message: e.target.value})}
                required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="px-6 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Assign Task</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? <LoadingSpinner /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Recipient', 'Message', 'Status', 'Priority', 'Assigned To', 'Created'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-800">{task.recipient}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{task.message}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[task.status] || ''}`}>{task.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{task.priority}</td>
                      <td className="px-4 py-3 text-gray-500">{task.assignedTo?.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{new Date(task.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={fetchTasks} />
          </>
        )}
      </div>
    </div>
  );
}
