import React, { useState, useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const RadarTab = ({ allTeamsData, coprData, radarTeams, setRadarTeams }) => {
  const { teamA, teamB } = radarTeams;

  const teamOptions = useMemo(() => {
    return Object.keys(allTeamsData?.teams || {}).sort((a, b) => Number(a) - Number(b));
  }, [allTeamsData]);

  // 更新選擇的 Function
  const handleTeamChange = (key, value) => {
    setRadarTeams(prev => ({ ...prev, [key]: value }));
  };

  const fetchTeamMetrics = (num) => {
    if (!num) return { opr: 0, auto: 0, cycle: 0, stability: 0, defense: 0 };
    const tba = coprData?.find(item => String(item.team_number) === String(num)) || {};
    const history = (allTeamsData?.matchData || []).filter(m => String(m.team) === String(num));
    
    // 指標標準化 (0-100)
    const oprScore = Math.min((parseFloat(tba.OPR || 0) / 60) * 100, 100);
    const autoScore = history.length > 0 ? (history.filter(m => m.autoSuccess).length / history.length) * 100 : 0;
    const avgCycle = history.length > 0 ? history.reduce((sum, m) => sum + (Number(m.avgCycle) || 20), 0) / history.length : 20;
    const cycleScore = Math.max(0, 100 - (avgCycle - 10) * 5);

    const getAvgRating = (key) => {
      const vals = history.map(m => m.ratings?.[key] || 3);
      return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) * 20 : 0;
    };

    return { opr: oprScore, auto: autoScore, cycle: cycleScore, stability: getAvgRating('stability'), defense: getAvgRating('defense') };
  };

  const radarData = useMemo(() => {
    const s1 = fetchTeamMetrics(teamA);
    const s2 = fetchTeamMetrics(teamB);
    return [
      { subject: '得分爆發 (OPR)', A: s1.opr, B: s2.opr, fullMark: 100 },
      { subject: '自動穩定 (Auto%)', A: s1.auto, B: s2.auto, fullMark: 100 },
      { subject: '駕駛效率 (Cycle)', A: s1.cycle, B: s2.cycle, fullMark: 100 },
      { subject: '生存能力 (Stability)', A: s1.stability, B: s2.stability, fullMark: 100 },
      { subject: '防守貢獻 (Defense)', A: s1.defense, B: s2.defense, fullMark: 100 },
    ];
  }, [teamA, teamB, allTeamsData, coprData]);

  return (
    <div className="radar-tab-container">
      <div className="radar-controls">
        <div className="control-group">
          <label style={{ color: '#8884d8', fontWeight: 'bold' }}>Team A (Purple)</label>
          <select 
          value={teamA} 
          onChange={e => handleTeamChange('teamA', e.target.value)} // ✨ 這裡要改成 handleTeamChange
        >
          <option value="">Select Team</option>
          {teamOptions.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        </div>
        <div className="vs-circle">VS</div>
        <div className="control-group">
          <label style={{ color: '#82ca9d', fontWeight: 'bold' }}>Team B (Green)</label>
          <select value={teamB} onChange={e => handleTeamChange('teamB', e.target.value)}>
            <option value="">Select Team</option>
            {teamOptions.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      <div className="radar-chart-wrapper">
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <PolarGrid stroke="#e0e0e0" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#666', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            
            {teamA && (
              <Radar
                name={`Team ${teamA}`}
                dataKey="A"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.5}
              />
            )}
            {teamB && (
              <Radar
                name={`Team ${teamB}`}
                dataKey="B"
                stroke="#82ca9d"
                fill="#82ca9d"
                fillOpacity={0.5}
              />
            )}
            
            <Tooltip />
            <Legend />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <style>{`
        .radar-tab-container { display: flex; flex-direction: column; align-items: center; }
        .radar-controls { display: flex; gap: 30px; align-items: center; margin-bottom: 20px; background: #fff; padding: 15px 30px; border-radius: 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        .control-group { display: flex; flex-direction: column; gap: 5px; }
        .control-group select { padding: 8px 15px; border-radius: 8px; border: 1px solid #ddd; font-weight: bold; }
        .vs-circle { background: #f0f0f0; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #999; font-size: 12px; }
        .radar-chart-wrapper { width: 100%; max-width: 700px; background: white; border-radius: 20px; padding: 20px; }
      `}</style>
    </div>
  );
};

export default RadarTab;