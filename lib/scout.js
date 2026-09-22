const crypto = require('crypto');
const revision = data => crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
function metrics(data) {
  const e = data.epa || {}, b = e.breakdown || {}, r = e.ranks?.total || {};
  const EPA = number(e.total_points?.mean) ?? number(b.total_points) ?? number(e.total);
  if (EPA === null) throw new Error('Statbotics 未提供可用的 EPA');
  return { EPA, auto_EPA: number(b.auto_points), teleop_EPA: number(b.teleop_points),
    endgame_EPA: number(b.endgame_points), world_rank: r.rank ?? '-',
    percentile: number(r.percentile) === null ? 'N/A' : `${(r.percentile * 100).toFixed(1)}%` };
}
function normalizeSchedule(input) {
  if (!input || typeof input !== 'object') throw new Error('賽程格式錯誤');
  const out = {};
  for (const [oldKey, m] of Object.entries(input)) {
    if (!m || typeof m !== 'object') throw new Error('賽程格式錯誤');
    const level = m.comp_level || m.compLevel || 'qm';
    const num = m.match_number ?? m.match ?? oldKey;
    const key = m.key || m.match_key || (level === 'qm' ? String(num) : `${level}${m.set_number || 1}m${num}`);
    out[key] = { ...m, match_number: num, comp_level: level };
    for (const color of ['red', 'blue']) {
      const teams = m.alliances?.[color]?.team_keys || m[color];
      if (Array.isArray(teams)) out[key][color] = teams.map(t => String(t).replace(/^frc/, ''));
    }
  }
  return out;
}
function mergePit(old, incoming) {
  if (!Array.isArray(incoming) || incoming.some(p => !p || !/^\d+$/.test(String(p.team)))) throw new Error('Pit 資料必須含有效隊號');
  const map = new Map(old.map(p => [String(p.team), p]));
  incoming.forEach(p => map.set(String(p.team), { ...map.get(String(p.team)), ...p }));
  return [...map.values()];
}
module.exports = { revision, metrics, number, normalizeSchedule, mergePit };
