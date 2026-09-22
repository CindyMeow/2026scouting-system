const teamNumber = value => String(value ?? '').replace(/^frc/, '');
const levelOf = m => m.comp_level || m.compLevel || 'qm';
const numberOf = m => String(m.match_number ?? m.match ?? '');
const teamsOf = (m, color) => (m.alliances?.[color]?.team_keys || m[color] ||
  [m[`${color}1`], m[`${color}2`], m[`${color}3`]]).map(teamNumber);
const labelOf = m => `${({pt:'P',qm:'Q',ef:'EF',qf:'QF',sf:'SF',f:'F'})[levelOf(m)] || levelOf(m)}${levelOf(m) === 'sf' ? (m.set_number || numberOf(m)) : numberOf(m)}`;

export function buildTeamHistory(schedule, history, selectedTeam) {
  if (!selectedTeam) return [];
  const team = teamNumber(selectedTeam);
  const records = (history || []).filter(h => teamNumber(h.team) === team);
  const used = new Set();
  const matches = Object.values(schedule || {}).filter(m => teamsOf(m,'red').includes(team) || teamsOf(m,'blue').includes(team));
  const rows = [];
  const add = (m, record, scheduled) => {
    const red = scheduled ? teamsOf(m,'red').includes(team) : /^red\b/i.test(record.station || '') ? true : /^blue\b/i.test(record.station || '') ? false : null;
    const rs = m.scores?.red ?? m.red_score ?? m.alliances?.red?.score;
    const bs = m.scores?.blue ?? m.blue_score ?? m.alliances?.blue?.score;
    const scored = scheduled && rs != null && bs != null && Number.isFinite(Number(rs)) && Number.isFinite(Number(bs)) && Number(rs) >= 0 && Number(bs) >= 0;
    rows.push({ match: labelOf(m), isRed:red, result:scored ? Number(rs) === Number(bs) ? 'Tie' : ((Number(rs)>Number(bs)) === red ? 'Win':'Loss') : '-',
      scores:scored ? {red:rs,blue:bs}:null, scouterData:record || null, scheduled,
      level:levelOf(m), number:Number(numberOf(m)), set:Number(m.set_number || 0) });
  };
  for (const match of matches) {
    const found = records.filter(h => {
      if (levelOf(h) !== levelOf(match)) return false;
      if ((h.officialMatchKey || h.matchKey || h.match) === (match.key || match.match_key)) return true;
      if (numberOf(h) !== numberOf(match)) return false;
      if (h.set_number != null) return Number(h.set_number) === Number(match.set_number);
      // 舊 QR 沒有 set_number；存在多個候選時不猜測配對。
      return matches.filter(m => levelOf(m) === levelOf(h) && numberOf(m) === numberOf(h)).length === 1;
    });
    if (!found.length) add(match,null,true);
    for (const record of found) { used.add(record); add(match,record,true); }
  }
  for (const record of records) if (!used.has(record)) add(record,record,false);
  const order = {pt:0,qm:1,ef:2,qf:3,sf:4,f:5};
  return rows.sort((a,b)=>(order[a.level]??9)-(order[b.level]??9)||a.set-b.set||a.number-b.number);
}
