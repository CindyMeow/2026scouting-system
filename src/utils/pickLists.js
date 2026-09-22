export const emptyPicks = () => ({ all: [], watchlist: [], pick1: [], pick2: [] });
export const pickStorageKey = event => `frc_picklists_v1:${event}`;
export function reconcilePicks(saved, teams) {
  const result = emptyPicks(), used = new Set();
  const valid = new Set(teams.map(String));
  // 保留已選清單的順序，all 清空不代表需重新加入已分類的隊伍。
  for (const key of ['watchlist','pick1','pick2','all']) {
    for (const team of Array.isArray(saved?.[key]) ? saved[key].map(String) : []) {
      if (valid.has(team) && !used.has(team)) { used.add(team); result[key].push(team); }
    }
  }
  for (const team of [...valid].sort((a,b) => Number(a)-Number(b))) if (!used.has(team)) result.all.push(team);
  return result;
}
