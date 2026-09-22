import React, { useState, useMemo } from 'react';

const AnalysisTab = ({ allTeamsData, coprData, onTeamClick }) => {
  const [sortConfig, setSortConfig] = useState({ keys: ['opr'], directions: ['desc'] });
  const [filters, setFilters] = useState({
    shooter: 'All',
    intake: 'All',
    climb: 'All'
  });
  // --- 1. 數據整合邏輯 ---
  const combinedData = useMemo(() => {
    if (!allTeamsData || !allTeamsData.teams) return [];

    const allTeamNums = Object.keys(allTeamsData.teams);

    return allTeamNums.map(teamNum => {
      const history = (allTeamsData.matchData || []).filter(m => String(m.team) === String(teamNum));
      const pitInfo = (allTeamsData.pitData || []).find(p => String(p.team) === String(teamNum)) || {};

      // 假設你已經從後端 API 抓到 EPA 並存在 coprData 或另外傳入 epaData
      // 這裡我們暫定 coprData 已經包含 EPA 相關欄位
      const stats = coprData?.find(item => String(item.team_number) === String(teamNum)) || {};

      const avgFuelH = history.length > 0
        ? history.reduce((sum, m) => sum + (Number(m.fuelH) || 0), 0) / history.length
        : 0;

      // 取得駕駛平均評分 (從你的 rating 數據)
      const avgDriver = history.length > 0
        ? history.reduce((sum, m) => sum + (Number(m.ratings?.driver) || 0), 0) / history.length
        : 0;

      return {
        team: teamNum,
        name: allTeamsData.teams[teamNum]?.team_name || "Unknown",
        // --- TBA / Statbotics 數據 ---
        opr: stats.OPR == null ? '—' : Number(stats.OPR).toFixed(1),
        epa: stats.EPA == null ? '—' : Number(stats.EPA).toFixed(1), // ✨ 新增 EPA
        autoEPA: stats.auto_EPA == null ? '—' : Number(stats.auto_EPA).toFixed(1), // ✨ 新增 Auto EPA

        // --- 現場 Scouting 數據 ---
        scoutFuelH: avgFuelH.toFixed(1),
        driverRating: avgDriver.toFixed(1),
        defense: history.reduce((sum, m) => sum + (Number(m.ratings?.defense) || 0), 0) / (history.length || 1),

        // --- Pit 數據 ---
        shooterType: pitInfo.shooter || 'Unknown',
        intakeType: pitInfo.intake || 'Unknown',
        canClimb: (['None', '0', '', undefined, null].includes(pitInfo.climb ?? pitInfo.climbLevel)) ? 'No' : 'Yes'
      };
    });
  }, [allTeamsData, coprData]);

  // --- 2. 篩選邏輯 ---
  const filteredData = useMemo(() => {
    return combinedData.filter(d => {
      const matchShooter = filters.shooter === 'All' || d.shooterType === filters.shooter;
      const matchIntake = filters.intake === 'All' || d.intakeType === filters.intake;
      const matchClimb = filters.climb === 'All' || d.canClimb === filters.climb;
      return matchShooter && matchIntake && matchClimb;
    });
  }, [combinedData, filters]);

  // --- 3. 排序邏輯 ---
  const sortedData = useMemo(() => {
    let items = [...filteredData];
    if (sortConfig.keys.length > 0) {
      items.sort((a, b) => {
        for (let i = 0; i < sortConfig.keys.length; i++) {
          const key = sortConfig.keys[i];
          const dir = sortConfig.directions[i] === 'asc' ? 1 : -1;
          const valA = isNaN(a[key]) ? a[key] : Number(a[key]);
          const valB = isNaN(b[key]) ? b[key] : Number(b[key]);
          if (valA < valB) return -1 * dir;
          if (valA > valB) return 1 * dir;
        }
        return 0;
      });
    }
    return items;
  }, [filteredData, sortConfig]);

  const requestSort = (key) => {
    let newDirs = (sortConfig.keys[0] === key && sortConfig.directions[0] === 'desc') ? ['asc'] : ['desc'];
    setSortConfig({ keys: [key], directions: newDirs });
  };

  return (
    <div className="scout-card">
      {coprData?.some(t => t.sync_warnings?.length) && <p role="alert">部分外部資料更新失敗，表格保留上次數據；請至賽季情資查看各隊狀態。</p>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>📊 綜合競爭力分析表 (TBA + Scouting)</h3>

        {/* 篩選 UI */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <select className="filter-select" value={filters.shooter} onChange={(e) => setFilters({ ...filters, shooter: e.target.value })}>
            <option value="All">🎯 Shooter: All</option>
            <option value="Linear">Linear</option>
            <option value="Single">Single</option>
            <option value="Double">Double</option>
          </select>
          <select className="filter-select" value={filters.intake} onChange={(e) => setFilters({ ...filters, intake: e.target.value })}>
            <option value="All">📥 Intake: All</option>
            <option value="Over Bumper">Over Bumper</option>
            <option value="Under Bumper">Under Bumper</option>
          </select>
          <select className="filter-select" value={filters.climb} onChange={(e) => setFilters({ ...filters, climb: e.target.value })}>
            <option value="All">🧗 Climb: All</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="scout-table">
          <thead>
            <tr>
              <th onClick={() => requestSort('team')}>Team</th>
              {/* 預測組 */}
              <th onClick={() => requestSort('epa')} style={{ backgroundColor: '#eef2ff' }}>📊 EPA (預測)</th>
              <th onClick={() => requestSort('opr')} style={{ backgroundColor: '#eef2ff' }}>Total OPR</th>
              {/* 現場組 */}
              <th onClick={() => requestSort('scoutFuelH')} style={{ backgroundColor: '#fff7ed' }}>🔥 Avg Fuel (現場)</th>
              <th onClick={() => requestSort('driverRating')}>駕駛評分</th>
              <th>Shooter</th>
              <th>Intake</th>
              <th>Climb</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map(d => (
              <tr key={d.team}>
                <td style={{ fontWeight: 'bold' }}>{d.team}</td>
                {/* EPA 亮色顯示 */}
                <td style={{ color: '#6366f1', fontWeight: 'bold', backgroundColor: '#f5f7ff' }}>{d.epa}</td>
                <td>{d.opr}</td>
                {/* 現場數據對照 */}
                <td style={{ color: '#f97316', fontWeight: 'bold', backgroundColor: '#fffaf5' }}>{d.scoutFuelH}</td>
                <td>
                  <span style={{ color: d.driverRating >= 4 ? '#2ecc71' : '#333' }}>
                    ⭐ {d.driverRating}
                  </span>
                </td>
                <td><span className="badge">{d.shooterType}</span></td>
                <td><span className="badge">{d.intakeType}</span></td>
                <td>{d.canClimb === 'Yes' ? '✅' : '❌'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedData.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>找不到符合篩選條件的隊伍</div>}
      </div>

      <style>{`
        .scout-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .scout-table th, .scout-table td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        .scout-table th { cursor: pointer; background: #f8f9fa; }
        .scout-table tr:hover { background: #fcfcfc; }
        .team-link-btn {
          background: none; border: none; color: #3498db;
          text-decoration: underline; cursor: pointer; font-weight: bold; padding: 0;
        }
        .filter-select { padding: 6px 10px; border-radius: 6px; border: 1px solid #ddd; font-size: 13px; }
        .badge { background-color: #f0f2f5; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #666; }
      `}</style>
    </div>
  );
};

export default AnalysisTab;