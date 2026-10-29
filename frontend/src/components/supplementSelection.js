// Keep unknown saved keys until the user explicitly removes them.
export function toggleSupplement(selected, item, items) {
  if (selected.includes(item.key)) return selected.filter(key => key !== item.key);
  if (!item.selectable || item.kind === 'note') return selected;
  const variants = new Set(items.filter(option => option.kind === 'variant').map(option => option.key));
  const retained = item.kind === 'variant' ? selected.filter(key => !variants.has(key)) : selected;
  return [...retained, item.key];
}

export function supplementsForYears(supplements = {}, years = []) {
  return Object.fromEntries(years.map(year => [String(year), supplements[String(year)] || []]));
}
