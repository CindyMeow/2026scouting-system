export function matchIdentity(record) {
  const level = record.compLevel || record.comp_level || 'qm';
  const match = record.match_number ?? record.match;
  const set = record.set_number ?? record.setNumber;
  return `${level}:${set ?? '?'}:${match}`;
}
export function sameMatch(a, b) {
  if (String(a.team) !== String(b.team)) return false;
  const level = a.compLevel || a.comp_level || 'qm';
  if (level !== (b.compLevel || b.comp_level || 'qm')) return false;
  if (a.officialMatchKey && b.officialMatchKey) return a.officialMatchKey === b.officialMatchKey;
  if (['pt', 'qm'].includes(level)) return String(a.match) === String(b.match);
  return matchIdentity(a) === matchIdentity(b);
}
export function replaceMatch(records, incoming) {
  const existing = records.find(r => sameMatch(r, incoming));
  const record = existing ? { ...incoming, id: existing.id, headNotes: existing.headNotes || '', verified: false } : incoming;
  return [record, ...records.filter(r => !sameMatch(r, incoming))];
}
export function totalFuel(record) { return (Number(record?.autoFuel) || 0) + (Number(record?.fuelH) || 0); }
export function updateMatchNotes(records, id, notes) {
  if (!records.some(r => r.id === id)) throw new Error('找不到紀錄，請重新整理');
  return records.map(r => r.id === id ? { ...r, headNotes: notes, updatedAt: new Date().toISOString() } : r);
}
