import { useEffect, useState } from 'react';
import api from '../api/client';
import { toggleSupplement } from './supplementSelection';

export default function SupplementPicker({ code, year, value = [], onChange, disabled = false, priceListId }) {
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const identity = `${code}:${year}:${priceListId || ''}:${retry}`;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    api.get(`/user/car-codes/${encodeURIComponent(code)}/supplements`, {
      params: { year, ...(priceListId ? { price_list_id: priceListId } : {}) }, signal: controller.signal,
    }).then(({ data }) => {
      if (active) setResult({ identity, data });
    }).catch(error => {
      if (active && !controller.signal.aborted) setResult({ identity, error: typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'לא ניתן לטעון תוספות. הבחירות השמורות נשמרות.' });
    });
    return () => { active = false; controller.abort(); };
  }, [code, year, priceListId, identity]);

  const current = result?.identity === identity ? result : null;
  const items = current?.data?.items || [];
  const selectable = items.filter(item => item.selectable && item.kind !== 'note');
  const unresolved = value.filter(key => !selectable.some(item => item.key === key));
  return (
    <fieldset disabled={disabled} className="mt-3 p-3 rounded-lg border border-dark-600 text-sm min-w-0">
      <legend className="text-primary-300 px-1">תוספות — {code} / {year}</legend>
      <p className="text-xs text-dark-400 mb-2">לפי המחירון האחרון. רמת גימור אחת; אביזרים מצטברים. ללא אגרת עלייה לכביש.</p>
      <div aria-live="polite">
        {!current && <p className="text-dark-300">טוען תוספות...</p>}
        {current?.error && <p role="alert" className="text-red-300">{current.error} <button type="button" className="underline" onClick={() => setRetry(n => n + 1)}>נסה שוב</button></p>}
        {current?.data && !current.data.available && <p className="text-dark-400">לא הועלה קובץ תוספות למחירון זה.</p>}
        {current?.data?.available && selectable.length === 0 && <p className="text-dark-400">אין תוספות לבחירה לקוד ולשנתון זה.</p>}
      </div>
      {items.map(item => item.selectable && item.kind !== 'note' ? (
        <label key={item.key} className="flex items-start gap-2 py-1 text-white cursor-pointer">
          <input type="checkbox" className="mt-1 accent-primary-500" checked={value.includes(item.key)} onChange={() => onChange(toggleSupplement(value, item, items))} />
          <span>{item.description} {item.percent != null && <b dir="ltr">({item.percent}%)</b>} <span className="text-dark-400 text-xs">{item.kind === 'variant' ? 'רמת גימור' : 'אביזר'}</span></span>
        </label>
      ) : <p key={item.key} className="text-dark-400 py-1">הערה: {item.description}</p>)}
      {value.length > 0 && (!current || current.error) && <p className="text-amber-300 text-xs mt-2">בחירות שמורות (טרם אומתו):</p>}
      {unresolved.map(key => (
        <label key={key} className="flex items-start gap-2 py-1 text-amber-300 break-all">
          <input type="checkbox" className="mt-1 accent-primary-500" checked onChange={() => onChange(value.filter(saved => saved !== key))} />
          <span>{key} — {current?.data ? 'בחירה שמורה שאינה זמינה; ניתן להסיר' : 'בחירה שמורה; ניתן להסיר'}</span>
        </label>
      ))}
    </fieldset>
  );
}
