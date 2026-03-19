import React, { useState, useEffect, useCallback, useRef } from 'react';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'QUEUED', 'ASSIGNED', 'SENT', 'DELIVERED', 'FAILED'];

const EMPTY_ROW = () => ({ recipient: '', message: '', clientId: '', priority: 0 });

export default function SmsTasks() {
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showAssign, setShowAssign] = useState(false);

  // Autocomplete state for "Assign to User" dropdown
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userSearchTimer = useRef(null);

  const [form, setForm] = useState({ recipient: '', message: '', clientId: '', priority: 0 });

  // Bulk rows: each row has recipient, message, clientId, priority
  const [bulkRows, setBulkRows] = useState([EMPTY_ROW()]);

  const [assignForm, setAssignForm] = useState({ recipient: '', message: '', clientId: '', priority: 0, userId: '', userLabel: '' });

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

  // Autocomplete: search users by phone/name with debounce
  const handleUserSearchChange = (value) => {
    setUserSearch(value);
    setAssignForm(f => ({ ...f, userId: '', userLabel: '' }));
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current);
    if (!value.trim()) {
      setUserResults([]);
      setShowUserDropdown(false);
      return;
    }
    userSearchTimer.current = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const res = await client.get(`/api/admin/users?search=${encodeURIComponent(value)}&limit=20`);
        setUserResults(res.data.data.users || []);
        setShowUserDropdown(true);
      } catch {
        toast.error('Failed to search users');
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);
  };

  const selectUser = (user) => {
    setAssignForm(f => ({ ...f, userId: user.id, userLabel: `${user.phone}${user.name ? ` (${user.name})` : ''}` }));
    setUserSearch(`${user.phone}${user.name ? ` (${user.name})` : ''}`);
    setShowUserDropdown(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await client.post('/api/admin/sms/create-task', form);
      toast.success('Task created');
      setShowCreate(false);
      setForm({ recipient: '', message: '', clientId: '', priority: 0 });
      fetchTasks(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create task');
    }
  };

  // Bulk row helpers
  const addBulkRow = () => setBulkRows(rows => [...rows, EMPTY_ROW()]);
  const removeBulkRow = (index) => setBulkRows(rows => rows.filter((_, i) => i !== index));
  const updateBulkRow = (index, field, value) => {
    setBulkRows(rows => rows.map((row, i) => {
      if (i !== index) return row;
      return { ...row, [field]: field === 'priority' ? (parseInt(value) || 0) : value };
    }));
  };

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    const invalidRow = bulkRows.findIndex(r => !r.recipient.trim() || !r.message.trim() || !r.clientId.trim());
    if (invalidRow !== -1) {
      toast.error(`Row ${invalidRow + 1}: Recipient, Message, and Client ID are required`);
      return;
    }
    try {
      await client.post('/api/admin/sms/bulk-create', { tasks: bulkRows });
      toast.success(`${bulkRows.length} task${bulkRows.length !== 1 ? 's' : ''} created`);
      setShowBulk(false);
      setBulkRows([EMPTY_ROW()]);
      fetchTasks(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create tasks');
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.userId) {
      toast.error('Please select a user');
      return;
    }
    try {
      // exclude userLabel – it is UI-only state and not part of the API contract
      const { userLabel, ...payload } = assignForm;
      await client.post('/api/admin/sms/assign-task', payload);
      toast.success('Task assigned to user');
      setShowAssign(false);
      setAssignForm({ recipient: '', message: '', clientId: '', priority: 0, userId: '', userLabel: '' });
      setUserSearch('');
      setUserResults([]);
      fetchTasks(pagination.page);
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
          onChange={(e) => { setStatus(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
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
              <input type="number" value={form.priority} onChange={e => setForm({...form, priority: parseInt(e.target.value) || 0})}
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Bulk Create Tasks</h3>
            <button
              type="button"
              onClick={addBulkRow}
              className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >+ Add Row</button>
          </div>
          <form onSubmit={handleBulkCreate}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">Recipient *</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">Message *</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">Client ID *</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">Priority</th>
                    <th className="px-3 py-2 border border-gray-200"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 border border-gray-200 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 border border-gray-200">
                        <input
                          value={row.recipient}
                          onChange={e => updateBulkRow(i, 'recipient', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs min-w-[130px]"
                          placeholder="+919876543210"
                        />
                      </td>
                      <td className="px-3 py-2 border border-gray-200">
                        <textarea
                          value={row.message}
                          onChange={e => updateBulkRow(i, 'message', e.target.value)}
                          rows={2}
                          className="w-full border rounded px-2 py-1 text-xs min-w-[200px]"
                          placeholder="SMS message text"
                        />
                      </td>
                      <td className="px-3 py-2 border border-gray-200">
                        <input
                          value={row.clientId}
                          onChange={e => updateBulkRow(i, 'clientId', e.target.value)}
                          className="w-full border rounded px-2 py-1 text-xs min-w-[100px]"
                          placeholder="client-001"
                        />
                      </td>
                      <td className="px-3 py-2 border border-gray-200">
                        <input
                          type="number"
                          value={row.priority}
                          onChange={e => updateBulkRow(i, 'priority', e.target.value)}
                          min={0}
                          className="w-full border rounded px-2 py-1 text-xs w-16"
                        />
                      </td>
                      <td className="px-3 py-2 border border-gray-200 text-center">
                        {bulkRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBulkRow(i)}
                            className="text-red-500 hover:text-red-700 text-xs font-medium"
                          >Remove</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button type="submit" className="px-6 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
                Create {bulkRows.length} Task{bulkRows.length !== 1 ? 's' : ''}
              </button>
              <button
                type="button"
                onClick={addBulkRow}
                className="px-4 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"
              >+ Add Row</button>
              <span className="text-xs text-gray-500">{bulkRows.length} row{bulkRows.length !== 1 ? 's' : ''} ready</span>
            </div>
          </form>
        </div>
      )}

      {showAssign && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Assign Task to Specific User</h3>
          <form onSubmit={handleAssign} className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search User by Phone / Name</label>
              <input
                value={userSearch}
                onChange={e => handleUserSearchChange(e.target.value)}
                onFocus={() => userResults.length > 0 && setShowUserDropdown(true)}
                onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)} // delay allows click events on dropdown items to fire first
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Type phone or name..."
                autoComplete="off"
              />
              {userSearchLoading && (
                <span className="absolute right-3 top-8 text-xs text-gray-400">Searching…</span>
              )}
              {showUserDropdown && userResults.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto text-sm">
                  {userResults.map(u => (
                    <li
                      key={u.id}
                      onMouseDown={() => selectUser(u)}
                      className="px-3 py-2 hover:bg-indigo-50 cursor-pointer"
                    >
                      {u.phone}{u.name ? ` (${u.name})` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {userSearch && !assignForm.userId && !userSearchLoading && (
                <p className="mt-1 text-xs text-amber-600">Select a user from the results above</p>
              )}
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
