import React, { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import client from '../api/client';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['', 'PENDING', 'SENT', 'FAILED'];

const EMPTY_ROW = () => ({ recipient: '', message: '', clientId: '' });

// ── CSV smart-column detection ────────────────────────────────────────────────
const RECIPIENT_ALIASES = ['recipient', 'phone', 'number', 'contact', 'mobile', 'phonenumber', 'mobilenumber', 'to', 'cell', 'telephone'];
const MESSAGE_ALIASES   = ['message', 'msg', 'text', 'content', 'sms', 'body', 'smsmessage', 'smscontent', 'wa', 'whatsapp'];
const CLIENT_ALIASES    = ['clientid', 'client', 'clientcode', 'cid', 'id'];

function detectColIndex(headers, aliases) {
  const norm = headers.map(h => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  for (const alias of aliases) {
    const needle = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    const idx = norm.indexOf(needle);
    if (idx !== -1) return idx;
  }
  return -1;
}

export default function WaTasks() {
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

  const [form, setForm] = useState({ recipient: '', message: '', clientId: '' });

  // Bulk rows: each row has recipient, message, clientId
  const [bulkRows, setBulkRows] = useState([EMPTY_ROW()]);

  // CSV upload state
  const csvFileRef = useRef(null);
  const [csvParsedRows, setCsvParsedRows] = useState([]);
  const [csvMissingFields, setCsvMissingFields] = useState([]);
  const [csvDefaults, setCsvDefaults] = useState({ message: '', clientId: '' });
  const [showCsvDefaults, setShowCsvDefaults] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const [assignForm, setAssignForm] = useState({ recipient: '', message: '', clientId: '', userId: '', userLabel: '' });

  const fetchTasks = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (status) params.set('status', status);
      const res = await client.get(`/api/admin/whatsapp/tasks?${params}`);
      setTasks(res.data.data.tasks || []);
      setPagination(res.data.data.pagination || { page: 1, totalPages: 1 });
    } catch (err) {
      toast.error('Failed to load WhatsApp tasks');
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
      await client.post('/api/admin/whatsapp/create-task', form);
      toast.success('WhatsApp task created');
      setShowCreate(false);
      setForm({ recipient: '', message: '', clientId: '' });
      fetchTasks(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create WhatsApp task');
    }
  };

  // Bulk row helpers
  const addBulkRow = () => setBulkRows(rows => [...rows, EMPTY_ROW()]);
  const removeBulkRow = (index) => setBulkRows(rows => rows.filter((_, i) => i !== index));
  const updateBulkRow = (index, field, value) => {
    setBulkRows(rows => rows.map((row, i) => {
      if (i !== index) return row;
      return { ...row, [field]: value };
    }));
  };

  // ── CSV helpers ──────────────────────────────────────────────────────────────
  const handleCsvFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const headers = meta.fields || [];
        if (!headers.length || !data.length) {
          toast.error('CSV appears to be empty or has no header row');
          return;
        }

        const recipientIdx = detectColIndex(headers, RECIPIENT_ALIASES);
        if (recipientIdx === -1) {
          toast.error('Could not detect a phone/recipient column in the CSV');
          return;
        }
        const recipientCol = headers[recipientIdx];

        const messageIdx = detectColIndex(headers, MESSAGE_ALIASES);
        const clientIdx  = detectColIndex(headers, CLIENT_ALIASES);

        const messageCol = messageIdx !== -1 ? headers[messageIdx] : null;
        const clientCol  = clientIdx  !== -1 ? headers[clientIdx]  : null;

        const parsed = data.map(row => ({
          recipient: String(row[recipientCol] || '').trim(),
          message:   messageCol ? String(row[messageCol] || '').trim() : '',
          clientId:  clientCol  ? String(row[clientCol]  || '').trim() : '',
        })).filter(r => r.recipient);

        if (!parsed.length) {
          toast.error('No valid rows found in the CSV (all recipient fields were empty)');
          return;
        }

        const missingMessage  = parsed.every(r => !r.message);
        const missingClientId = parsed.every(r => !r.clientId);
        const missing = [
          ...(missingMessage  ? ['message']  : []),
          ...(missingClientId ? ['clientId'] : []),
        ];

        setCsvParsedRows(parsed);

        if (missing.length) {
          setCsvMissingFields(missing);
          setCsvDefaults({ message: '', clientId: '' });
          setShowCsvDefaults(true);
          toast(`Found ${parsed.length} row(s). Please fill in the missing fields below.`, { icon: 'ℹ️' });
        } else {
          setBulkRows(parsed);
          setShowCsvDefaults(false);
          setCsvParsedRows([]);
          setCsvMissingFields([]);
          toast.success(`${parsed.length} row(s) imported from CSV — review and submit`);
        }
      },
      error: () => toast.error('Failed to parse CSV file'),
    });
  };

  const applyCsvDefaults = () => {
    if (csvMissingFields.includes('message') && !csvDefaults.message.trim()) {
      toast.error('Please enter a default message');
      return;
    }
    if (csvMissingFields.includes('clientId') && !csvDefaults.clientId.trim()) {
      toast.error('Please enter a default Client ID');
      return;
    }

    const merged = csvParsedRows.map(r => ({
      recipient: r.recipient,
      message:   r.message  || csvDefaults.message.trim(),
      clientId:  r.clientId || csvDefaults.clientId.trim(),
    }));

    setBulkRows(merged);
    setShowCsvDefaults(false);
    setCsvParsedRows([]);
    setCsvMissingFields([]);
    toast.success(`${merged.length} row(s) imported from CSV — review and submit`);
  };

  const CHUNK_SIZE = 500;

  const handleBulkCreate = async (e) => {
    e.preventDefault();
    const invalidRow = bulkRows.findIndex(r => !r.recipient.trim() || !r.message.trim());
    if (invalidRow !== -1) {
      toast.error(`Row ${invalidRow + 1}: Recipient and Message are required`);
      return;
    }

    const chunks = [];
    for (let i = 0; i < bulkRows.length; i += CHUNK_SIZE) {
      chunks.push(bulkRows.slice(i, i + CHUNK_SIZE));
    }

    setBulkSubmitting(true);
    setBulkProgress({ done: 0, total: bulkRows.length });
    let submitted = 0;

    try {
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunkStart = ci * CHUNK_SIZE + 1;
        const chunkEnd   = chunkStart + chunks[ci].length - 1;
        try {
          await client.post('/api/admin/whatsapp/bulk-create', { tasks: chunks[ci] });
        } catch (err) {
          const msg = err.response?.data?.message || 'Failed to create WhatsApp tasks';
          if (submitted > 0) {
            toast.error(`${msg} — rows ${chunkStart}–${chunkEnd} failed; ${submitted} of ${bulkRows.length} tasks were created`);
          } else {
            toast.error(`${msg} — rows ${chunkStart}–${chunkEnd} failed`);
          }
          return;
        }
        submitted += chunks[ci].length;
        setBulkProgress({ done: submitted, total: bulkRows.length });
      }
      toast.success(`${bulkRows.length} task${bulkRows.length !== 1 ? 's' : ''} created`);
      setShowBulk(false);
      setBulkRows([EMPTY_ROW()]);
      fetchTasks(pagination.page);
    } finally {
      setBulkSubmitting(false);
      setBulkProgress({ done: 0, total: 0 });
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!assignForm.userId) {
      toast.error('Please select a user');
      return;
    }
    try {
      const { userLabel, ...payload } = assignForm;
      await client.post('/api/admin/whatsapp/assign-task', payload);
      toast.success('WhatsApp task assigned to user');
      setShowAssign(false);
      setAssignForm({ recipient: '', message: '', clientId: '', userId: '', userLabel: '' });
      setUserSearch('');
      setUserResults([]);
      fetchTasks(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign WhatsApp task');
    }
  };

  const statusColors = {
    PENDING: 'bg-gray-100 text-gray-600',
    SENT:    'bg-green-100 text-green-600',
    FAILED:  'bg-red-100 text-red-600',
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
          <h3 className="font-semibold text-gray-800 mb-4">Create WhatsApp Task</h3>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Recipient</label>
              <input value={form.recipient} onChange={e => setForm({...form, recipient: e.target.value})}
                required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="+919876543210" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Client ID</label>
              <input value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="client-001" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
              <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})}
                required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
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
            <h3 className="font-semibold text-gray-800">Bulk Create WhatsApp Tasks</h3>
            <div className="flex items-center gap-2">
              <input
                ref={csvFileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleCsvFile}
              />
              <button
                type="button"
                onClick={() => csvFileRef.current?.click()}
                className="px-3 py-1.5 text-xs bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-1"
              >📂 Upload CSV</button>
              <button
                type="button"
                onClick={addBulkRow}
                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >+ Add Row</button>
            </div>
          </div>

          {showCsvDefaults && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                📋 {csvParsedRows.length} row(s) detected — fill in the missing fields to apply to all rows
              </p>
              <p className="text-xs text-amber-600 mb-3">
                Fields missing from CSV:{' '}
                <span className="font-medium">{csvMissingFields.join(', ')}</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {csvMissingFields.includes('message') && (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Default Message *</label>
                    <textarea
                      value={csvDefaults.message}
                      onChange={e => setCsvDefaults(d => ({ ...d, message: e.target.value }))}
                      rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="This message will be applied to all rows"
                    />
                  </div>
                )}
                {csvMissingFields.includes('clientId') && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Default Client ID *</label>
                    <input
                      value={csvDefaults.clientId}
                      onChange={e => setCsvDefaults(d => ({ ...d, clientId: e.target.value }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      placeholder="client-001"
                    />
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={applyCsvDefaults}
                  className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >Apply & Preview Rows</button>
                <button
                  type="button"
                  onClick={() => { setShowCsvDefaults(false); setCsvParsedRows([]); setCsvMissingFields([]); setCsvDefaults({ message: '', clientId: '' }); }}
                  className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >Cancel</button>
              </div>
            </div>
          )}
          <form onSubmit={handleBulkCreate}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">Recipient *</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">Message *</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 border border-gray-200">Client ID</th>
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
                          placeholder="WhatsApp message text"
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
              <button
                type="submit"
                disabled={bulkSubmitting}
                className="px-6 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {bulkSubmitting
                  ? `Submitting… ${bulkProgress.done}/${bulkProgress.total}`
                  : `Create ${bulkRows.length} Task${bulkRows.length !== 1 ? 's' : ''}`}
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
          <h3 className="font-semibold text-gray-800 mb-4">Assign WhatsApp Task to Specific User</h3>
          <form onSubmit={handleAssign} className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search User by Phone / Name</label>
              <input
                value={userSearch}
                onChange={e => handleUserSearchChange(e.target.value)}
                onFocus={() => userResults.length > 0 && setShowUserDropdown(true)}
                onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
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
                className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="client-001" />
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
                    {['Recipient', 'Message', 'Status', 'Client ID', 'Assigned To', 'Created'].map(h => (
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
                        <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[task.status] || 'bg-gray-100 text-gray-600'}`}>{task.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{task.clientId || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{task.user?.phone || '—'}</td>
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
