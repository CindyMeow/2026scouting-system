export function metricValue(record, metric) {
  if (!record || record[metric] == null || record[metric] === '') return null;
  const failed = (record.sync_warnings || []).some(w => metric === 'EPA' ? /Statbotics|EPA/i.test(w) : /TBA|OPR/i.test(w));
  const value = Number(record[metric]);
  return failed || !Number.isFinite(value) ? null : value;
}
export function allianceEstimate(teams, data, metric) {
  const selected = teams.filter(Boolean);
  const values = selected.map(team => metricValue(data.find(r => String(r.team_number) === String(team)), metric));
  const ready = selected.length === 3 && new Set(selected).size === 3 && values.every(v => v !== null);
  return { total: ready ? values.reduce((a,b) => a+b,0) : null, ready };
}
