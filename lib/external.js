const { metrics, number } = require('./scout');
module.exports = async function syncExternal({ axios, key, event, year, teams, previous }) {
  if (!key) throw new Error('請在 .env 設定 TBA_API_KEY 並重新啟動後端');
  const tba = path => axios.get(`https://www.thebluealliance.com/api/v3${path}`, {
    headers: { 'X-TBA-Auth-Key': key }, timeout: 15000
  }).then(r => r.data);
  // 先驗證 TBA 連線；失敗時不寫入任何快取。
  const eventTeams = await tba(`/event/${event}/teams`);
  if (!Array.isArray(eventTeams) || !eventTeams.length) throw new Error('TBA 尚無此賽事的隊伍資料，請確認賽事代碼');
  const mergedTeams = { ...teams };
  for (const t of eventTeams) mergedTeams[t.team_number] = { ...mergedTeams[t.team_number],
    team_name: t.nickname || t.name, city: t.city, state: t.state_prov, country: t.country };
  const oprCache = new Map();
  const getOPR = eventKey => {
    if (!oprCache.has(eventKey)) oprCache.set(eventKey, tba(`/event/${eventKey}/oprs`).then(d => d?.oprs || {}));
    return oprCache.get(eventKey);
  };
  const results = new Map(previous.map(t => [String(t.team_number), t]));
  let count = 0, failed = 0;
  const warnings = [];
  // 每次最多四支隊伍，並共用賽事 OPR 回應。
  for (let i = 0; i < eventTeams.length; i += 4) {
    await Promise.all(eventTeams.slice(i, i + 4).map(async team => {
      const num = team.team_number, teamKey = `frc${num}`;
      const old = results.get(String(num)) || {};
      const record = { ...old, team_number: num, nickname: team.nickname || team.name,
        country: team.country, state: team.state_prov };
      const issues = [];
      let updated = false;
      const [epa, history] = await Promise.allSettled([
        axios.get(`https://api.statbotics.io/v3/team_year/${num}/${year}`, { timeout: 15000 }).then(r => metrics(r.data)),
        (async () => {
          const statuses = await tba(`/team/${teamKey}/events/${year}/statuses`);
          const rows = await Promise.all(Object.entries(statuses).map(async ([e, status]) => {
            const opr = number((await getOPR(e))[teamKey]);
            return { event: e, rank: status?.qual?.ranking?.rank ?? '-',
              record: status?.qual?.ranking?.record || null, opr };
          }));
          const values = rows.map(r => r.opr).filter(v => v !== null);
          return { history: rows, OPR: values.length ? values.reduce((a,b) => a+b,0)/values.length : null };
        })()
      ]);
      if (epa.status === 'fulfilled') { Object.assign(record, epa.value); record.epa_updated_at = new Date().toISOString(); updated = true; }
      else issues.push('Statbotics EPA 查詢失敗，保留舊資料');
      if (history.status === 'fulfilled') { Object.assign(record, history.value); record.opr_source = 'TBA event oprs'; updated = true; }
      else issues.push('TBA OPR／往績查詢失敗，保留舊資料');
      if (updated) { record.last_updated = new Date().toISOString(); count++; }
      if (issues.length) { failed++; warnings.push({ team: num, errors: issues }); }
      record.sync_warnings = issues;
      results.set(String(num), record);
    }));
  }
  return { teams: mergedTeams, data: [...results.values()], count, failed, total: eventTeams.length, warnings };
};
