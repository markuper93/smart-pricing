import { useRef, useState } from 'react';
import api from '../api/client';

export default function SupplementUpload({ priceList, onUploaded }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const input = useRef(null);
  const upload = async () => {
    if (!file) return;
    if (priceList.supplements_uploaded && !window.confirm(`להחליף את קובץ התוספות של ${priceList.label}?`)) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/admin/price-lists/${priceList.id}/supplements`, form);
      const warnings = [];
      if (data.skipped_rows) warnings.push(`${data.skipped_rows} שורות לא תקינות לא נטענו`);
      if (data.ambiguous_keys) warnings.push(`${data.ambiguous_keys} תוספות עם נתונים סותרים הושארו מחוץ לחישוב`);
      setMessage([data.message || 'קובץ התוספות הועלה בהצלחה', ...warnings].join('. '));
      setFile(null);
      if (input.current) input.current.value = '';
      await onUploaded();
    } catch (err) {
      setError(typeof err.response?.data?.detail === 'string' ? err.response.data.detail : 'שגיאה בהעלאת תוספות. נסה שוב.');
    } finally { setBusy(false); }
  };
  return <div className="space-y-2 min-w-56 text-sm">
    <p className={priceList.supplements_uploaded ? 'text-emerald-300' : 'text-dark-400'}>{priceList.supplements_uploaded ? `תוספות הועלו (${priceList.supplements_count ?? 0})` : 'לא הועלה קובץ תוספות'}</p>
    <input ref={input} type="file" accept=".xlsx" aria-label={`קובץ תוספות עבור ${priceList.label}`} disabled={busy}
      onChange={event => { setFile(event.target.files[0] || null); setMessage(''); setError(''); }} className="block w-full max-w-xs text-xs text-dark-300" />
    <button type="button" onClick={upload} disabled={busy || !file} className="px-3 py-1 rounded bg-primary-600 text-white disabled:opacity-50">{busy ? 'מעלה תוספות...' : priceList.supplements_uploaded ? 'החלף תוספות' : 'העלה תוספות'}</button>
    {message && <p role="status" className="text-emerald-300">{message}</p>}
    {error && <p role="alert" className="text-red-300">{error}</p>}
  </div>;
}
