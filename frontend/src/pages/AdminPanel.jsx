import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { Upload, UserPlus, Trash2, RotateCcw, Key, Database, Users, FileText, ChevronDown, Shield, Eye, EyeOff, RefreshCw, Activity, Clock, Globe } from 'lucide-react';

export default function AdminPanel() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [defaultGroups, setDefaultGroups] = useState([]);
  const [defaultTemplate, setDefaultTemplate] = useState({ exists: false, items: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // User form
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [createdOtp, setCreatedOtp] = useState('');

  // Upload form
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadMonth, setUploadMonth] = useState('');
  const [uploadYear, setUploadYear] = useState(new Date().getFullYear());
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  // Activity state
  const [activityLogs, setActivityLogs] = useState([]);
  const [activitySummary, setActivitySummary] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activityFilter, setActivityFilter] = useState({ hours: 24, userId: '', action: '' });
  const [activityLoading, setActivityLoading] = useState(false);

  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, pl, dg, dt] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/price-lists'),
        api.get('/admin/default-groups'),
        api.get('/admin/default-template'),
      ]);
      setUsers(u.data);
      setPriceLists(pl.data);
      setDefaultGroups(dg.data);
      setDefaultTemplate(dt.data);
    } catch (err) { setMessage({ text: 'שגיאה בטעינת נתונים', type: 'error' }); }
    setLoading(false);
  };

  const showMsg = (text, type = 'success', persistent = false) => {
    setMessage({ text, type, persistent });
    if (!persistent) setTimeout(() => setMessage(prev => prev.persistent ? prev : { text: '', type: '' }), 4000);
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/users', { email: newEmail, username: newUsername });
      setCreatedOtp(res.data.otp);
      showMsg(`✅ משתמש נוצר! סיסמה זמנית: ${res.data.otp}  — שמור והעבר למשתמש`, 'success', true);
      setNewEmail(''); setNewUsername('');
      loadData();
    } catch (err) { showMsg(err.response?.data?.detail || 'שגיאה', 'error'); }
  };

  const deleteUser = async (id) => {
    if (!confirm('למחוק את המשתמש?')) return;
    await api.delete(`/admin/users/${id}`);
    showMsg('משתמש נמחק');
    loadData();
  };

  const resetPassword = async (id) => {
    const res = await api.post(`/admin/users/${id}/reset-password`);
    showMsg(`🔑 סיסמה אופסה! סיסמה זמנית: ${res.data.new_otp}  — שמור והעבר למשתמש`, 'success', true);
    loadData();
  };

  const injectDefaults = async (id) => {
    try {
      await api.post(`/admin/users/${id}/inject-defaults`);
      showMsg('קבוצת ברירת מחדל נוספה');
      loadData();
    } catch (err) { showMsg(err.response?.data?.detail || 'שגיאה', 'error'); }
  };

  const toggleVisibility = async (groupId, currentVisible) => {
    try {
      await api.patch(`/admin/groups/${groupId}/visibility`, { is_visible: !currentVisible });
      showMsg(currentVisible ? 'הקבוצה הוסתרה מהמשתמש' : 'הקבוצה הוצגה למשתמש');
      loadData();
    } catch (err) { showMsg(err.response?.data?.detail || 'שגיאה', 'error'); }
  };

  const reInjectDefaults = async (userId) => {
    if (!confirm('למחוק את קבוצת ברירת המחדל הקיימת ולהזריק מחדש?')) return;
    try {
      const existing = defaultGroups.find(dg => dg.user_id === userId && dg.has_default_group);
      if (existing && existing.group_id) {
        await api.delete(`/admin/groups/${existing.group_id}`);
      }
      await api.post(`/admin/users/${userId}/inject-defaults`);
      showMsg('הקבוצה הוזרקה מחדש');
      loadData();
    } catch (err) { showMsg(err.response?.data?.detail || 'שגיאה', 'error'); }
  };

  const uploadCSV = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadMonth) { showMsg('יש לבחור קובץ וחודש', 'error'); return; }
    setUploading(true);
    const form = new FormData();
    form.append('file', uploadFile);
    form.append('month', uploadMonth);
    form.append('year', uploadYear);
    try {
      const res = await api.post('/admin/upload-csv', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      showMsg(res.data.message);
      setUploadFile(null); setUploadMonth('');
      if (fileRef.current) fileRef.current.value = '';
      loadData();
    } catch (err) { showMsg(err.response?.data?.detail || 'שגיאה בהעלאה', 'error'); }
    setUploading(false);
  };

  const deletePriceList = async (id) => {
    if (!confirm('למחוק את המחירון?')) return;
    await api.delete(`/admin/price-lists/${id}`);
    showMsg('מחירון נמחק');
    loadData();
  };

  // Activity functions
  const loadActivity = async () => {
    setActivityLoading(true);
    try {
      const params = { hours: activityFilter.hours };
      if (activityFilter.userId) params.user_id = activityFilter.userId;
      if (activityFilter.action) params.action = activityFilter.action;
      const [logs, summary, online] = await Promise.all([
        api.get('/activity/logs', { params }),
        api.get('/activity/summary', { params: { hours: activityFilter.hours } }),
        api.get('/activity/online'),
      ]);
      setActivityLogs(logs.data.logs);
      setActivitySummary(summary.data.users);
      setOnlineUsers(online.data.online);
    } catch (err) {
      console.error('Activity load error:', err);
    }
    setActivityLoading(false);
  };

  useEffect(() => { if (tab === 'activity') loadActivity(); }, [tab, activityFilter]);

  const ACTION_LABELS = {
    login: 'כניסה',
    logout: 'יציאה',
    page_view: 'צפייה בדף',
    compare: 'השוואה',
    export_pdf: 'ייצוא PDF',
    export_excel: 'ייצוא Excel',
    upload_csv: 'העלאת CSV',
    create_group: 'יצירת קבוצה',
    chat_message: 'צ\'אט AI',
  };

  const PAGE_LABELS = {
    '/dashboard': 'לוח בקרה',
    '/groups': 'קבוצות מעקב',
    '/reports': 'דוחות',
    '/chat': 'צ\'אט AI',
    '/admin': 'ניהול מערכת',
    '/login': 'התחברות',
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  };

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 0) return 'עכשיו';
    if (diff < 60) return 'עכשיו';
    if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק'`;
    if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע'`;
    return `לפני ${Math.floor(diff / 86400)} ימים`;
  };

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="animate-fade">
      <h1 className="text-2xl font-bold text-white mb-6">ניהול מערכת</h1>

      {message.text && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${message.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
          <span>{message.text}</span>
          {message.persistent && (
            <button onClick={() => setMessage({ text: '', type: '' })} className="text-xs opacity-60 hover:opacity-100 mr-2">✕ סגור</button>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: 'users', icon: Users, label: 'משתמשים' },
          { id: 'defaults', icon: Shield, label: 'קבוצות ברירת מחדל' },
          { id: 'upload', icon: Upload, label: 'העלאת CSV' },
          { id: 'data', icon: Database, label: 'נתונים' },
          { id: 'activity', icon: Activity, label: 'פעילות משתמשים' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${tab === t.id ? 'bg-primary-600/20 text-primary-300 border border-primary-500/30' : 'glass-light text-dark-300 hover:text-white'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="glass p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5" /> הוסף משתמש חדש</h3>
            <form onSubmit={createUser} className="flex gap-3">
              <input type="email" placeholder={'דוא"ל'} value={newEmail} onChange={e => setNewEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500" required />
              <input type="text" placeholder="שם משתמש" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500" required />
              <button type="submit" className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors">הוסף</button>
            </form>
            {createdOtp && <p className="mt-3 text-amber-300 text-sm">סיסמה זמנית (שמור!): <code className="bg-dark-800 px-2 py-1 rounded">{createdOtp}</code></p>}
          </div>

          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="report-table">
                <thead>
                  <tr><th>ID</th><th>שם משתמש</th><th>{'דוא"ל'}</th><th>סטטוס</th><th>פעולות</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td className="font-medium text-white">{u.username}</td>
                      <td>{u.email}</td>
                      <td>{u.force_password_change ? <span className="text-amber-400 text-xs">ממתין לשינוי סיסמה</span> : <span className="text-green-400 text-xs">פעיל</span>}</td>
                      <td>
                        <div className="flex gap-1">
                          <button onClick={() => resetPassword(u.id)} title="איפוס סיסמה" className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-amber-400"><RotateCcw className="w-4 h-4" /></button>
                          <button onClick={() => injectDefaults(u.id)} title="הזרקת קבוצת ברירת מחדל" className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-blue-400"><Key className="w-4 h-4" /></button>
                          <button onClick={() => deleteUser(u.id)} title="מחיקה" className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan="5" className="text-center text-dark-400 py-4">אין משתמשים</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Upload Tab */}
      {tab === 'defaults' && (
        <div className="space-y-6">
          {/* Template Section */}
          <div className="glass p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5" /> תבנית ברירת מחדל
              <span className="text-sm text-dark-400 font-normal">({defaultTemplate.items.length} דגמים)</span>
            </h3>
            {defaultTemplate.exists ? (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="report-table">
                  <thead>
                    <tr><th>קוד</th><th>דגם</th><th>שנתונים</th></tr>
                  </thead>
                  <tbody>
                    {defaultTemplate.items.map((item, i) => (
                      <tr key={i}>
                        <td className="font-mono text-primary-300">{item.car_code}</td>
                        <td className="text-white text-sm">{item.model_name || item.car_code}</td>
                        <td>{item.years?.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-dark-400">אין תבנית מוגדרת. העלאה דרך API.</p>
            )}
          </div>

          {/* Users Default Groups */}
          <div className="glass overflow-hidden">
            <div className="p-4 border-b border-dark-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Users className="w-5 h-5" /> קבוצות ברירת מחדל למשתמשים
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>משתמש</th>
                    <th>דוא"ל</th>
                    <th>יש קבוצה?</th>
                    <th>נראות</th>
                    <th>פריטים</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {defaultGroups.map(dg => (
                    <tr key={dg.user_id}>
                      <td className="font-medium text-white">{dg.username}</td>
                      <td className="text-dark-400">{dg.email}</td>
                      <td>
                        {dg.has_default_group ? (
                          <span className="text-green-400 text-xs">✓ קיימת</span>
                        ) : (
                          <span className="text-red-400 text-xs">✗ אין</span>
                        )}
                      </td>
                      <td>
                        {dg.has_default_group ? (
                          <button
                            onClick={() => toggleVisibility(dg.group_id, dg.is_visible)}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                              dg.is_visible
                                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                : 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                            }`}
                          >
                            {dg.is_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                            {dg.is_visible ? 'גלוי' : 'מוסתר'}
                          </button>
                        ) : (
                          <span className="text-dark-500 text-xs">—</span>
                        )}
                      </td>
                      <td>{dg.items_count}</td>
                      <td>
                        <div className="flex gap-1">
                          {!dg.has_default_group ? (
                            <button onClick={() => injectDefaults(dg.user_id)}
                              title="הזרק קבוצת ברירת מחדל"
                              className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-blue-400">
                              <Key className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => reInjectDefaults(dg.user_id)}
                              title="הזרק מחדש"
                              className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-amber-400">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {defaultGroups.length === 0 && (
                    <tr><td colSpan="6" className="text-center text-dark-400 py-4">אין משתמשים</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Upload Tab */}
      {tab === 'upload' && (
        <div className="glass p-6 max-w-xl">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Upload className="w-5 h-5" /> העלאת מחירון חודשי</h3>
          <form onSubmit={uploadCSV} className="space-y-4">
            <div>
              <label className="block text-sm text-dark-300 mb-1">קובץ CSV</label>
              <input ref={fileRef} type="file" accept=".csv" onChange={e => setUploadFile(e.target.files[0])}
                className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-primary-600 file:text-white file:cursor-pointer" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-dark-300 mb-1">חודש</label>
                <select value={uploadMonth} onChange={e => setUploadMonth(e.target.value)}
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500">
                  <option value="">בחר חודש...</option>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-dark-300 mb-1">שנה</label>
                <input type="number" value={uploadYear} onChange={e => setUploadYear(+e.target.value)} min="2020" max="2030"
                  className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500" />
              </div>
            </div>
            <button type="submit" disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              <Upload className="w-4 h-4" /> {uploading ? 'מעלה...' : 'העלה מחירון'}
            </button>
          </form>
        </div>
      )}

      {/* Data Tab */}
      {tab === 'data' && (
        <div className="glass overflow-hidden">
          <div className="p-4 border-b border-dark-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2"><FileText className="w-5 h-5" /> מחירונים במערכת</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="report-table">
              <thead><tr><th>ID</th><th>תווית</th><th>קובץ</th><th>רשומות</th><th>פעולות</th></tr></thead>
              <tbody>
                {priceLists.map(pl => (
                  <tr key={pl.id}>
                    <td>{pl.id}</td>
                    <td className="font-medium text-white">{pl.label}</td>
                    <td className="text-dark-400">{pl.filename}</td>
                    <td>{pl.entries_count}</td>
                    <td>
                      <button onClick={() => deletePriceList(pl.id)} className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
                {priceLists.length === 0 && <tr><td colSpan="5" className="text-center text-dark-400 py-4">אין מחירונים</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="space-y-6">
          {/* Online Users */}
          <div className="glass p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-green-400" /> מחוברים עכשיו
              <span className="text-sm text-dark-400 font-normal">(ב-5 דקות האחרונות)</span>
            </h3>
            {onlineUsers.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {onlineUsers.map(u => (
                  <div key={u.user_id} className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                    <span className="text-white text-sm font-medium">{u.username}</span>
                    <span className="text-dark-400 text-xs">{timeAgo(u.last_active)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-400 text-sm">אין משתמשים מחוברים כרגע</p>
            )}
          </div>

          {/* Summary */}
          <div className="glass p-5">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" /> סיכום פעילות
            </h3>
            <div className="flex gap-3 mb-4">
              <select value={activityFilter.hours} onChange={e => setActivityFilter(f => ({...f, hours: +e.target.value}))}
                className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm">
                <option value={1}>שעה אחרונה</option>
                <option value={6}>6 שעות</option>
                <option value={24}>24 שעות</option>
                <option value={168}>שבוע</option>
                <option value={720}>חודש</option>
              </select>
            </div>
            {activitySummary.length > 0 ? (
              <div className="space-y-3">
                {activitySummary.map(u => (
                  <div key={u.user_id} className="p-3 bg-dark-800/50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{u.username}</span>
                      <span className="text-dark-400 text-xs">פעיל {timeAgo(u.last_active)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {u.actions.map(a => (
                        <span key={a.action} className="text-xs px-2 py-1 bg-dark-700 rounded text-dark-300">
                          {ACTION_LABELS[a.action] || a.action}: {a.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-dark-400 text-sm">אין פעילות בתקופה זו</p>
            )}
          </div>

          {/* Detailed Logs */}
          <div className="glass overflow-hidden">
            <div className="p-4 border-b border-dark-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5" /> לוג פעילות
              </h3>
              <div className="flex gap-2">
                <select value={activityFilter.userId} onChange={e => setActivityFilter(f => ({...f, userId: e.target.value}))}
                  className="px-2 py-1 bg-dark-800 border border-dark-600 rounded text-white text-xs">
                  <option value="">כל המשתמשים</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <select value={activityFilter.action} onChange={e => setActivityFilter(f => ({...f, action: e.target.value}))}
                  className="px-2 py-1 bg-dark-800 border border-dark-600 rounded text-white text-xs">
                  <option value="">כל הפעולות</option>
                  {Object.entries(ACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="report-table">
                <thead>
                  <tr><th>זמן</th><th>משתמש</th><th>פעולה</th><th>פרטים</th></tr>
                </thead>
                <tbody>
                  {activityLogs.map(log => (
                    <tr key={log.id}>
                      <td className="text-xs text-dark-400 whitespace-nowrap">{formatTime(log.created_at)}</td>
                      <td className="font-medium text-white text-sm">{log.username}</td>
                      <td>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          log.action === 'login' ? 'bg-green-500/20 text-green-300' :
                          log.action === 'logout' ? 'bg-red-500/20 text-red-300' :
                          log.action === 'page_view' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-dark-700 text-dark-300'
                        }`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="text-xs text-dark-400">
                        {log.details?.page && (PAGE_LABELS[log.details.page] || log.details.page)}
                        {log.details?.duration_seconds && ` (${Math.round(log.details.duration_seconds)}s)`}
                        {log.details?.label && log.details.label}
                      </td>
                    </tr>
                  ))}
                  {activityLogs.length === 0 && <tr><td colSpan="4" className="text-center text-dark-400 py-4">אין לוגים</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
