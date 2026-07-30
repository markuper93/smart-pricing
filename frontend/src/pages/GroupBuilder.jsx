import { useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, Minus, Save, Trash2, Edit3, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

export default function GroupBuilder() {
  const [carCodes, setCarCodes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState({});  // {car_code: [years]}
  const [expandedCode, setExpandedCode] = useState(null);
  const [availableYears, setAvailableYears] = useState({});
  const [groupName, setGroupName] = useState('');
  const [editingGroup, setEditingGroup] = useState(null);
  const [search, setSearch] = useState('');
  const [totalCodes, setTotalCodes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/user/car-codes?limit=100'),
      api.get('/user/groups'),
    ]).then(([codes, grps]) => {
      setCarCodes(codes.data.items || []);
      setTotalCodes(codes.data.total || 0);
      setGroups(grps.data);
      setLoading(false);
    });
  }, []);

  const loadYears = async (code) => {
    if (availableYears[code]) { setExpandedCode(expandedCode === code ? null : code); return; }
    const res = await api.get(`/user/car-codes/${code}/years`);
    setAvailableYears(prev => ({ ...prev, [code]: res.data }));
    setExpandedCode(code);
  };

  const toggleYear = (code, year) => {
    setSelected(prev => {
      const years = prev[code] || [];
      const newYears = years.includes(year) ? years.filter(y => y !== year) : [...years, year].sort();
      if (newYears.length === 0) { const { [code]: _, ...rest } = prev; return rest; }
      return { ...prev, [code]: newYears };
    });
  };

  const selectAllYears = (code) => {
    const years = availableYears[code] || [];
    setSelected(prev => ({ ...prev, [code]: [...years] }));
  };

  const clearCode = (code) => {
    setSelected(prev => { const { [code]: _, ...rest } = prev; return rest; });
  };

  const saveGroup = async () => {
    if (!groupName.trim()) { setMessage('יש להזין שם קבוצה'); return; }
    const items = Object.entries(selected).map(([car_code, years]) => ({ car_code, years }));
    if (items.length === 0) { setMessage('יש לבחור לפחות דגם אחד'); return; }
    setSaving(true);
    try {
      if (editingGroup) {
        await api.put(`/user/groups/${editingGroup}`, { name: groupName, items });
        setMessage('קבוצה עודכנה בהצלחה');
      } else {
        await api.post('/user/groups', { name: groupName, items });
        setMessage('קבוצה נוצרה בהצלחה');
      }
      const grps = await api.get('/user/groups');
      setGroups(grps.data);
      setGroupName('');
      setSelected({});
      setEditingGroup(null);
    } catch (err) {
      setMessage(err.response?.data?.detail || 'שגיאה בשמירה');
    }
    setSaving(false);
  };

  const editGroup = (group) => {
    setEditingGroup(group.id);
    setGroupName(group.name);
    const sel = {};
    group.items.forEach(item => { sel[item.car_code] = item.years; });
    setSelected(sel);
  };

  const deleteGroup = async (id) => {
    if (!confirm('למחוק את הקבוצה?')) return;
    await api.delete(`/user/groups/${id}`);
    const grps = await api.get('/user/groups');
    setGroups(grps.data);
  };

  const filteredCodes = carCodes;

  // Search via API with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = search ? `?search=${encodeURIComponent(search)}&limit=100` : '?limit=100';
      api.get(`/user/car-codes${params}`).then(res => {
        setCarCodes(res.data.items || []);
        setTotalCodes(res.data.total || 0);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const selectedCount = Object.keys(selected).length;

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="animate-fade">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">יצירת קבוצות מעקב</h1>
          <p className="text-dark-400 mt-1">בחר דגמי רכב ושנתונים לשמירה כקבוצה</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Car Code Selection */}
        <div className="lg:col-span-2">
          <div className="glass p-4 mb-4">
            <input type="text" placeholder="חיפוש לפי קוד, יצרן או דגם..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500" />
          </div>

          <div className="glass overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              {filteredCodes.map(code => (
                <div key={code.car_code} className="border-b border-dark-700 last:border-0">
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-dark-800/50 transition-colors">
                    <input type="checkbox" checked={!!selected[code.car_code]}
                      onChange={() => selected[code.car_code] ? clearCode(code.car_code) : loadYears(code.car_code)}
                      className="w-4 h-4 rounded accent-primary-500" />
                    <button onClick={() => loadYears(code.car_code)} className="flex-1 flex items-center justify-between text-right">
                      <div>
                        <span className="font-mono text-primary-300 ml-2">{code.car_code}</span>
                        <span className="text-white font-medium">{code.manufacturer}</span>
                        <span className="text-dark-300 mr-1">{code.model_name}</span>
                      </div>
                      {expandedCode === code.car_code ? <ChevronUp className="w-4 h-4 text-dark-400" /> : <ChevronDown className="w-4 h-4 text-dark-400" />}
                    </button>
                    {selected[code.car_code] && (
                      <span className="text-xs bg-primary-600/30 text-primary-300 px-2 py-1 rounded-full">{selected[code.car_code].length} שנתונים</span>
                    )}
                  </div>

                  {expandedCode === code.car_code && availableYears[code.car_code] && (
                    <div className="px-4 pb-3 animate-fade">
                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => selectAllYears(code.car_code)} className="text-xs text-primary-400 hover:text-primary-300">בחר הכל</button>
                        <span className="text-dark-600">|</span>
                        <button onClick={() => clearCode(code.car_code)} className="text-xs text-dark-400 hover:text-red-400">נקה</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {availableYears[code.car_code].map(year => (
                          <button key={year} onClick={() => toggleYear(code.car_code, year)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              (selected[code.car_code] || []).includes(year)
                                ? 'bg-primary-600 text-white border border-primary-500'
                                : 'bg-dark-800 text-dark-300 border border-dark-600 hover:border-dark-500'
                            }`}>
                            {year}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredCodes.length === 0 && <p className="text-dark-400 text-center py-8">לא נמצאו תוצאות</p>}
            </div>
          </div>
        </div>

        {/* Save Panel + Existing Groups */}
        <div className="space-y-4">
          <div className="glass p-5">
            <h3 className="text-lg font-semibold text-white mb-3">{editingGroup ? 'עריכת קבוצה' : 'שמירה כקבוצה'}</h3>
            <input type="text" placeholder="שם הקבוצה (למשל: קבוצה 1)" value={groupName} onChange={e => setGroupName(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500 mb-3" />
            <p className="text-sm text-dark-400 mb-3">{selectedCount} דגמים נבחרו</p>
            <div className="flex gap-2">
              <button onClick={saveGroup} disabled={saving || !selectedCount}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'שומר...' : 'שמור'}
              </button>
              {editingGroup && (
                <button onClick={() => { setEditingGroup(null); setGroupName(''); setSelected({}); }}
                  className="px-4 py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {message && <p className="text-sm text-primary-300 mt-2">{message}</p>}
          </div>

          <div className="glass p-5">
            <h3 className="text-lg font-semibold text-white mb-3">קבוצות שמורות</h3>
            {groups.length === 0 ? (
              <p className="text-dark-400 text-sm">אין קבוצות עדיין</p>
            ) : (
              <div className="space-y-2">
                {groups.map(g => (
                  <div key={g.id} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{g.name}</p>
                      <p className="text-xs text-dark-400">{g.items.length} דגמים</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => editGroup(g)} className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-primary-400"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => deleteGroup(g.id)} className="p-1.5 rounded hover:bg-dark-700 text-dark-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
