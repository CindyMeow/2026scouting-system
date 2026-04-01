import React, { useState, useMemo } from 'react';

const SimulatorTab = ({ allTeamsData, coprData, alliance, setAlliance }) => {
  
  const teamOptions = useMemo(() => {
    return Object.keys(allTeamsData?.teams || {}).sort((a, b) => a - b);
  }, [allTeamsData]);

  // 1. 取得單隊詳細數據（包含防守與得分拆解）
  const getTeamStats = (teamNum) => {
    if (!teamNum) return { opr: 0, auto: 0, teleop: 0, climb: 0, defense: 0 };
    const tba = coprData?.find(item => String(item.team_number) === String(teamNum)) || {};
    const history = (allTeamsData?.matchData || []).filter(m => String(m.team) === String(teamNum));
    
    const autoOPR = parseFloat(tba.totalAutoPoints || 0);
    const totalOPR = parseFloat(tba.OPR || 0);
    
    // 計算防守評分 (取該隊所有比賽的平均駕駛/防守表現)
    const avgDefense = history.length > 0
      ? history.reduce((sum, m) => sum + (Number(m?.ratings?.defense) || 0), 0) / history.length
      : 0;

    return {
      team: teamNum,
      opr: totalOPR,
      auto: autoOPR,
      teleop: totalOPR - autoOPR, // 估算 Teleop 分數
      climb: history.length > 0 ? (history.filter(m => m.climbLevel !== '0').length / history.length) * 100 : 0,
      defense: avgDefense
    };
  };

  // 2. 計算聯盟表現（含防守動態調整）
  const calculateAlliance = (myTeamNums, opponentTeamNums) => {
    const myTeams = myTeamNums.map(num => getTeamStats(num));
    const opponentTeams = opponentTeamNums.map(num => getTeamStats(num));

    let totalAuto = myTeams.reduce((sum, t) => sum + t.auto, 0);
    let totalTeleop = myTeams.reduce((sum, t) => sum + t.teleop, 0);
    let totalClimb = myTeams.reduce((sum, t) => sum + (t.climb * 15 / 100), 0); // 假設爬升平均 15 分

    // --- ✨ 動態防守邏輯 ---
    // 找出對手最強的防守隊伍
    const bestOpponentDefender = Math.max(...opponentTeams.map(t => t.defense));
    
    let defenseImpact = 0;
    if (bestOpponentDefender >= 4) {
      // 如果對手有評分 4 以上的防守，扣除我方最強得分手 30% 的 Teleop 分數
      const myBestScorer = [...myTeams].sort((a, b) => b.teleop - a.teleop)[0];
      if (myBestScorer && myBestScorer.teleop > 0) {
        defenseImpact = myBestScorer.teleop * 0.3;
        totalTeleop -= defenseImpact;
      }
    }

    return {
      total: totalAuto + totalTeleop + totalClimb,
      auto: totalAuto,
      teleop: totalTeleop,
      climb: totalClimb,
      impact: defenseImpact
    };
  };

  const redStats = calculateAlliance(alliance.red, alliance.blue);
  const blueStats = calculateAlliance(alliance.blue, alliance.red);

  // 計算勝率 (使用簡易 Logit 曲線概念)
  const winProb = useMemo(() => {
    if (redStats.total === 0 && blueStats.total === 0) return 50;
    const diff = redStats.total - blueStats.total;
    // 每差 10 分，勝率移動約 15%
    const prob = 50 + (diff * 1.5);
    return Math.max(5, Math.min(95, Math.round(prob)));
  }, [redStats, blueStats]);

const handleSelect = (color, index, value) => {
    setAlliance(prev => ({
      ...prev,
      [color]: prev[color].map((v, i) => i === index ? value : v)
    }));
  };

  return (
    <div className="sim-tab">
      {/* 勝率預測條 */}
      <div className="prob-container">
        <div className="prob-label">Red Win Probability: {winProb}%</div>
        <div className="prob-bar-bg">
          <div className="prob-bar-red" style={{ width: `${winProb}%` }} />
        </div>
      </div>

      <div className="sim-grid">
        {/* 紅色聯盟控制區 */}
        <div className="alliance-panel red">
          <h3 className="alliance-title">🔴 Red Alliance</h3>
          {alliance.red.map((num, i) => (
            <div key={i} className="team-picker">
              <select value={num} onChange={(e) => handleSelect('red', i, e.target.value)}>
                <option value="">Select Team</option>
                {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {num && <span className="stat-hint">OPR: {getTeamStats(num).opr.toFixed(1)} | Def: {getTeamStats(num).defense.toFixed(1)}</span>}
            </div>
          ))}
          <div className="summary-box">
            <div>ΣAuto: {redStats.auto.toFixed(1)}</div>
            <div>ΣTeleop: {redStats.teleop.toFixed(1)} {redStats.impact > 0 && <small>(被防守 -{redStats.impact.toFixed(1)})</small>}</div>
            <div className="total-score">預估總分: {redStats.total.toFixed(1)}</div>
          </div>
        </div>

        <div className="vs-text">VS</div>

        {/* 藍色聯盟控制區 */}
        <div className="alliance-panel blue">
          <h3 className="alliance-title">🔵 Blue Alliance</h3>
          {alliance.blue.map((num, i) => (
            <div key={i} className="team-picker">
              <select value={num} onChange={(e) => handleSelect('blue', i, e.target.value)}>
                <option value="">Select Team</option>
                {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {num && <span className="stat-hint">OPR: {getTeamStats(num).opr.toFixed(1)} | Def: {getTeamStats(num).defense.toFixed(1)}</span>}
            </div>
          ))}
          <div className="summary-box">
            <div>ΣAuto: {blueStats.auto.toFixed(1)}</div>
            <div>ΣTeleop: {blueStats.teleop.toFixed(1)} {blueStats.impact > 0 && <small>(被防守 -{blueStats.impact.toFixed(1)})</small>}</div>
            <div className="total-score">預估總分: {blueStats.total.toFixed(1)}</div>
          </div>
        </div>
      </div>

      <style>{`
        .prob-container { margin-bottom: 30px; text-align: center; }
        .prob-label { font-weight: bold; margin-bottom: 10px; font-size: 1.2rem; }
        .prob-bar-bg { background: #3498db; height: 30px; border-radius: 15px; overflow: hidden; display: flex; }
        .prob-bar-red { background: #e74c3c; height: 100%; transition: width 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        
        .sim-grid { display: flex; gap: 20px; align-items: flex-start; }
        .alliance-panel { flex: 1; background: #f8f9fa; padding: 20px; border-radius: 15px; border-top: 5px solid #ccc; }
        .alliance-panel.red { border-color: #e74c3c; }
        .alliance-panel.blue { border-color: #3498db; }
        
        .team-picker { margin-bottom: 15px; display: flex; flex-direction: column; }
        .team-picker select { padding: 8px; border-radius: 6px; border: 1px solid #ddd; font-size: 1rem; }
        .stat-hint { font-size: 0.75rem; color: #777; margin-top: 4px; }
        
        .summary-box { margin-top: 20px; padding-top: 15px; border-top: 2px dashed #ddd; font-size: 0.9rem; }
        .total-score { font-size: 1.3rem; font-weight: bold; margin-top: 10px; color: #2c3e50; }
        .vs-text { align-self: center; font-size: 2rem; font-weight: 900; color: #bdc3c7; }
        small { color: #e67e22; font-weight: bold; }
      `}</style>
    </div>
  );
};

export default SimulatorTab;