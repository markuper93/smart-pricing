import { useState, useEffect } from 'react';
import api from '../api/client';
import { FileDown, FileSpreadsheet, Play, TrendingDown, TrendingUp } from 'lucide-react';

export default function Reports() {
  const [groups, setGroups] = useState([]);
  const [priceLists, setPriceLists] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [monthA, setMonthA] = useState('');
  const [monthB, setMonthB] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/user/groups'),
      api.get('/user/price-lists'),
    ]).then(([g, pl]) => {
      setGroups(g.data);
      setPriceLists(pl.data);
    });
  }, []);

  const runComparison = async () => {
    if (!selectedGroup || !monthA || !monthB) { setError('יש לבחור קבוצה ושני חודשים'); return; }
    if (monthA === monthB) { setError('יש לבחור חודשים שונים'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/reports/compare', { group_id: +selectedGroup, month_a_id: +monthA, month_b_id: +monthB });
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'שגיאה בהפקת דוח');
    }
    setLoading(false);
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportFile = async (type, retries = 3) => {
    setExporting(type);
    setError('');

    const payload = { group_id: +selectedGroup, month_a_id: +monthA, month_b_id: +monthB };

    if (type === 'excel') {
      // Excel: backend returns JSON with base64 data
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await api.post('/reports/export/excel', payload, { timeout: 60000 });
          const { data, filename } = res.data;
          const binary = atob(data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          downloadBlob(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename || 'report.xlsx');
          setExporting('');
          setError('');
          return;
        } catch (err) {
          if (attempt < retries) {
            setError(`מנסה שוב... (${attempt}/${retries})`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            setError('שגיאה בייצוא Excel — נסה שוב');
          }
        }
      }
    } else {
      // PDF: backend returns blob
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await api.post(`/reports/export/${type}`, payload, { responseType: 'blob', timeout: 60000 });
          const cd = res.headers['content-disposition'] || '';
          const match = cd.match(/filename="?([^";\n]+)"?/);
          downloadBlob(new Blob([res.data]), match ? match[1] : 'report.pdf');
          setExporting('');
          setError('');
          return;
        } catch (err) {
          if (attempt < retries) {
            setError(`מנסה שוב... (${attempt}/${retries}) — השרת מתעורר`);
            await new Promise(r => setTimeout(r, 5000));
          } else {
            setError('שגיאה בייצוא — נסה שוב בעוד דקה');
          }
        }
      }
    }
    setExporting('');
  };

  return (
    <div className="animate-fade">
      <h1 className="text-2xl font-bold text-white mb-2">הפקת דוחות</h1>
      <p className="text-dark-400 mb-6">השווה מחירונים בין חודשים</p>

      <div className="glass p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-dark-300 mb-1">קבוצת מעקב</label>
            <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500">
              <option value="">בחר קבוצה...</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.items.length} דגמים)</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-dark-300 mb-1">חודש בסיס (A)</label>
            <select value={monthA} onChange={e => setMonthA(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500">
              <option value="">בחר חודש...</option>
              {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-dark-300 mb-1">חודש השוואה (B)</label>
            <select value={monthB} onChange={e => setMonthB(e.target.value)}
              className="w-full px-4 py-2.5 bg-dark-800 border border-dark-600 rounded-lg text-white focus:outline-none focus:border-primary-500">
              <option value="">בחר חודש...</option>
              {priceLists.map(pl => <option key={pl.id} value={pl.id}>{pl.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={runComparison} disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
              <Play className="w-4 h-4" /> {loading ? 'מחשב...' : 'הפק דוח'}
            </button>
          </div>
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>

      {report && (
        <div className="animate-fade">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{report.title}</h2>
            <div className="flex gap-2">
              <button onClick={() => exportFile('pdf')} disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-colors disabled:opacity-50">
                <FileDown className="w-4 h-4" /> {exporting === 'pdf' ? 'מייצא...' : 'PDF'}
              </button>
              <button onClick={() => exportFile('excel')} disabled={!!exporting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-600/30 transition-colors disabled:opacity-50">
                <FileSpreadsheet className="w-4 h-4" /> {exporting === 'excel' ? 'מייצא...' : 'Excel'}
              </button>
            </div>
          </div>

          <div className="glass overflow-hidden">
            <div className="overflow-x-auto">
              <table className="report-table">
                <thead>
                  <tr>
                    {report.data.length > 0 && Object.keys(report.data[0]).map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.data.map((row, i) => (
                    <tr key={i}>
                      {Object.entries(row).map(([k, v], j) => {
                        let className = '';
                        if (k === 'שינוי באחוז') {
                          const num = parseFloat(v);
                          className = num > 0 ? 'positive' : num < 0 ? 'negative' : '';
                        }
                        return <td key={j} className={className}>{v}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass p-4 mt-4 flex items-center gap-3">
            {report.average_change > 0 ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
            <p className="text-white font-medium">
              אחוז שינוי ממוצע לכלל הרכבים (מחירון ללא עליה לכביש): <span className={report.average_change > 0 ? 'text-green-400' : 'text-red-400'}>{report.average_change.toFixed(2)}%</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
