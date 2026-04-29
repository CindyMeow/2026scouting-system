import React, { useState } from 'react';

const ScheduleTab = ({ schedule, setSchedule, onSyncOfficial, onTeamClick }) => {
    const [localScores, setLocalScores] = useState({});

    // 💡 新增：輔助函數，用來統一不同來源的隊伍資料結構
    const getTeamsArray = (match, color) => {
        if (!match) return [];
        // 如果是 CSV 格式 (red1, red2, red3)
        if (match[`${color}1`]) {
            return [match[`${color}1`], match[`${color}2`], match[`${color}3`]].filter(Boolean);
        }
        // 如果是官方 API 格式 (陣列)
        if (Array.isArray(match[color])) {
            return match[color];
        }
        return [];
    };

    const handleInputChange = (mKey, field, value) => {
        const val = parseInt(value) || 0;
        setLocalScores(prev => ({
            ...prev,
            [mKey]: {
                ...prev[mKey],
                // 這裡要相容物件或陣列索引
                ...(prev[mKey] ? {} : (schedule[mKey]?.scores || { red: 0, blue: 0, redRP: 0, blueRP: 0 })),
                [field]: val
            }
        }));
    };

    const handleConfirmSave = async (mKey) => {
        const match = schedule[mKey];
        const mNum = match.match || match.match_number || mKey;
        const scoresToSave = localScores[mKey] || match.scores || { red: 0, blue: 0, redRP: 0, blueRP: 0 };

        try {
            const response = await fetch(`http://${window.location.hostname}:5000/api/update-score`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchNum: mNum,
                    redScore: scoresToSave.red,
                    blueScore: scoresToSave.blue,
                    redRP: scoresToSave.redRP || 0,
                    blueRP: scoresToSave.blueRP || 0
                })
            });

            if (response.ok) {
                // 判斷是陣列還是物件來更新
                let updatedSchedule;
                if (Array.isArray(schedule)) {
                    updatedSchedule = [...schedule];
                    updatedSchedule[mKey] = { ...match, scores: scoresToSave };
                } else {
                    updatedSchedule = {
                        ...schedule,
                        [mKey]: { ...match, scores: scoresToSave }
                    };
                }

                setSchedule(updatedSchedule);
                const newLocal = { ...localScores };
                delete newLocal[mKey];
                setLocalScores(newLocal);
            }
        } catch (err) {
            console.error("同步失敗:", err);
        }
    };

    const renderTeams = (teams) => {
        // 🛡️ 安全防護：確保 teams 是陣列
        if (!Array.isArray(teams)) return "無資料";

        return teams.map((team, index) => (
            <span key={`${team}-${index}`}>
                <span
                    className="team-link"
                    onClick={() => onTeamClick(String(team))}
                    style={{
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        marginRight: '5px'
                    }}
                >
                    {team}
                </span>
                {index < teams.length - 1 && ", "}
            </span>
        ));
    };

    // 💡 統一處理迭代 key
    const matchKeys = schedule
        ? (Array.isArray(schedule) ? Object.keys(schedule) : Object.keys(schedule))
        : [];

    return (
        <div className="scout-card">
            <div className="schedule-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 className="scout-card-title" style={{ margin: 0 }}>🗓️ 官方賽程與比分管理</h3>
                <button className="btn-action-sm" onClick={onSyncOfficial} style={{ backgroundColor: '#27ae60', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer' }}>
                    🌐 連網同步官方資料
                </button>
            </div>

            <div className="schedule-table-container" style={{ overflowX: 'auto' }}>
                <table className="schedule-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                            <th style={{ width: '80px', padding: '10px' }}>Match</th>
                            <th style={{ width: '20%' }}>Red Alliance</th>
                            <th style={{ width: '20%' }}>Blue Alliance</th>
                            <th>Red Score</th>
                            <th>Blue Score</th>
                            <th>RP (R/B)</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {matchKeys.sort((a, b) => {
                            const matchA = schedule[a];
                            const matchB = schedule[b];

                            // 🏆 定義比賽階段的權重
                            const levelWeight = {
                                'pt': 0, // Practice Match 排在最前
                                'qm': 1,
                                'sf': 2,
                                'f': 3
                            };
                            const levelA = matchA.comp_level || 'qm';
                            const levelB = matchB.comp_level || 'qm';

                            // 1. 先比對比賽階段權重
                            if (levelWeight[levelA] !== levelWeight[levelB]) {
                                return levelWeight[levelA] - levelWeight[levelB];
                            }

                            // 2. 如果階段相同，比對場次編號 (注意 SF 要看 set_number，Q 要看 match_number)
                            const numA = parseInt(matchA.match_number || matchA.match || 0);
                            const numB = parseInt(matchB.match_number || matchB.match || 0);

                            // 3. 針對 SF 的特殊排序 (通常 SF 是由 set_number 決定的)
                            if (levelA === 'sf' && levelB === 'sf') {
                                const setA = parseInt(matchA.set_number || 0);
                                const setB = parseInt(matchB.set_number || 0);
                                if (setA !== setB) return setA - setB;
                            }

                            return numA - numB;
                        }).map(mKey => {
                            const match = schedule[mKey];
                            const level = match.comp_level || 'qm';
                            const mNum = match.match_number || match.match || mKey;
                            // 顯示標籤邏輯
                            let displayLabel = `Q${mNum}`;
                            if (level === 'pt') displayLabel = `P${mNum}`; // 新增 Practice 顯示
                            if (level === 'sf') displayLabel = `SF${match.set_number || mNum}`;
                            if (level === 'f') displayLabel = `F${mNum}`;

                            const redTeams = getTeamsArray(match, 'red');
                            const blueTeams = getTeamsArray(match, 'blue');

                            const displayRed = localScores[mKey]?.red ?? (match.scores?.red ?? 0);
                            const displayBlue = localScores[mKey]?.blue ?? (match.scores?.blue ?? 0);
                            const displayRedRP = localScores[mKey]?.redRP ?? (match.scores?.redRP ?? 0);
                            const displayBlueRP = localScores[mKey]?.blueRP ?? (match.scores?.blueRP ?? 0);

                            return (
                                <tr key={mKey} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ textAlign: 'center', padding: '10px' }}>{displayLabel}</td>
                                    <td style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                                        {renderTeams(redTeams)}
                                    </td>
                                    <td style={{ color: '#3498db', fontWeight: 'bold' }}>
                                        {renderTeams(blueTeams)}
                                    </td>
                                    <td>
                                        <input type="number" className="score-input" value={displayRed}
                                            onChange={(e) => handleInputChange(mKey, 'red', e.target.value)}
                                            style={{ width: '50px', padding: '4px' }} />
                                    </td>
                                    <td>
                                        <input type="number" className="score-input" value={displayBlue}
                                            onChange={(e) => handleInputChange(mKey, 'blue', e.target.value)}
                                            style={{ width: '50px', padding: '4px' }} />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <input type="number" value={displayRedRP}
                                            onChange={(e) => handleInputChange(mKey, 'redRP', e.target.value)}
                                            style={{ width: '35px' }} />
                                        /
                                        <input type="number" value={displayBlueRP}
                                            onChange={(e) => handleInputChange(mKey, 'blueRP', e.target.value)}
                                            style={{ width: '35px' }} />
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className="btn-save-row"
                                            onClick={() => handleConfirmSave(mKey)}
                                            style={{
                                                backgroundColor: localScores[mKey] ? '#f39c12' : '#2ecc71',
                                                color: '#fff', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer'
                                            }}
                                        >
                                            {localScores[mKey] ? "💾 儲存" : "OK"}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ScheduleTab;