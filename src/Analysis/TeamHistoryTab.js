import React, { useState, useMemo } from 'react';

// ✨ 修正 1: 傳入 setActiveTab 與 setSelectedTeam (如果是由父層管理狀態)
const TeamHistoryTab = ({ coprData, setActiveTab, setSelectedTeam: setGlobalSelectedTeam }) => {
    // 內部 Modal 使用的狀態 (如果是要在本頁跳轉，建議維持儲存物件)
    const [localSelectedTeam, setLocalSelectedTeam] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'team_number', direction: 'asc' });

    const sortedData = useMemo(() => {
        let sortableItems = [...coprData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                if (sortConfig.key === 'history_count') {
                    aValue = Array.isArray(a.history) ? a.history.length : 0;
                    bValue = Array.isArray(b.history) ? b.history.length : 0;
                }

                // 數值轉換優化
                const numA = Number(aValue);
                const numB = Number(bValue);
                if (!isNaN(numA) && !isNaN(numB)) {
                    aValue = numA;
                    bValue = numB;
                }

                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortableItems;
    }, [coprData, sortConfig]);

    const requestSort = (key) => {
        let direction = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '🔼' : '🔽';
    };

    return (
        <div className="scout-card">
            <h3 className="scout-card-title">🏁 2026 賽季情資彙整</h3>

            <div className="table-wrapper">
                <table className="scout-table">
                    <thead>
                        <tr>
                            <th onClick={() => requestSort('team_number')} style={headerStyle}>
                                隊伍 {getSortIcon('team_number')}
                            </th>
                            <th>名稱</th>
                            <th onClick={() => requestSort('world_rank')} style={headerStyle}>
                                世界排名 {getSortIcon('world_rank')}
                            </th>
                            <th onClick={() => requestSort('OPR')} style={headerStyle}>
                                平均 OPR {getSortIcon('OPR')}
                            </th>
                            <th onClick={() => requestSort('EPA')} style={headerStyle}>
                                EPA {getSortIcon('EPA')}
                            </th>
                            <th onClick={() => requestSort('history_count')} style={headerStyle}>
                                已參加賽事 {getSortIcon('history_count')}
                            </th>
                            <th>詳細</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map(team => (
                            <tr key={team.team_number}>
                                <td
                                    style={{ fontWeight: 'bold', cursor: 'pointer', color: '#3498db', textDecoration: 'underline' }}
                                    onClick={() => {
                                        // ✨ 修正 2: 同時執行跳轉與設定全域隊伍
                                        if(setGlobalSelectedTeam) setGlobalSelectedTeam(team.team_number); 
                                        if(setActiveTab) setActiveTab('profile');           
                                    }}
                                >
                                    {team.team_number}
                                </td>
                                <td>{team.nickname}{team.sync_warnings?.length > 0 && <small style={{ display: 'block', color: '#b45309' }}>{team.sync_warnings.join('；')}</small>}</td>
                                <td>{team.world_rank || '-'}</td>
                                <td style={{ color: '#e67e22', fontWeight: 'bold' }}>{team.OPR ?? '—'}</td>
                                <td style={{ color: '#27ae60' }}>{team.EPA ?? '—'}</td>
                                <td>{Array.isArray(team.history) ? team.history.length : 0} 場</td>
                                <td>
                                    {/* ✨ 修正 3: 這裡改為設定 local 物件，給本頁 Modal 使用 */}
                                    <button className="btn-detail" onClick={() => setLocalSelectedTeam(team)}>
                                        查看詳情
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- Modal 部分 --- */}
            {localSelectedTeam && (
                <div className="modal-overlay" onClick={() => setLocalSelectedTeam(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            {/* ✨ 修正 4: 確保讀取的是物件裡的屬性 */}
                            <h2>Team {localSelectedTeam.team_number} - {localSelectedTeam.nickname}</h2>
                            <a
                                href={`https://www.thebluealliance.com/team/${localSelectedTeam.team_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tba-link-btn"
                            >
                                🌐 TBA
                            </a>
                            <button className="close-btn" onClick={() => setLocalSelectedTeam(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', background: '#f0f4f8', padding: '15px', borderRadius: '10px' }}>
                                <div>
                                    <small style={{ color: '#666' }}>地區</small>
                                    <div style={{ fontWeight: 'bold' }}>{localSelectedTeam.country} / {localSelectedTeam.state}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <small style={{ color: '#666' }}>EPA 世界排名</small>
                                    <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '18px' }}>#{localSelectedTeam.world_rank}</div>
                                </div>
                            </div>
                            <div className="stats-grid">
                                <div className="stat-box"><h4>Total</h4><p>{localSelectedTeam.EPA}</p></div>
                                <div className="stat-box"><h4>Auto</h4><p>{localSelectedTeam.auto_EPA}</p></div>
                                <div className="stat-box"><h4>Teleop</h4><p>{localSelectedTeam.teleop_EPA}</p></div>
                                <div className="stat-box"><h4>Endgame</h4><p>{localSelectedTeam.endgame_EPA}</p></div>
                            </div>
                            <h3>📅 2026 參賽紀錄</h3>
                            {localSelectedTeam.history && localSelectedTeam.history.length > 0 ? (
                                localSelectedTeam.history.map((h, i) => (
                                    <div key={i} className="history-card">
                                        <div className="event-name">{h.event.toUpperCase()}</div>
                                        <div className="event-details">
                                            <span>排名: <strong>{h.rank}</strong></span>
                                            <span>OPR: <strong>{h.opr}</strong></span>
                                            <span>戰績: {h.record?.wins}W-{h.record?.losses}L-{h.record?.ties}T</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>該隊伍目前尚無紀錄</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                /* 新增標題 hover 效果 */
                .scout-table th { cursor: pointer; user-select: none; transition: background 0.2s; }
                .scout-table th:hover { background: #eee; }
                .table-wrapper { overflow-x: auto; margin-top: 10px; }
                .btn-detail { background: #3498db; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
                .modal-overlay { position: fixed; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 3000; }
                .modal-content { background: white; width: 90%; max-width: 500px; border-radius: 15px; overflow: hidden; animation: slideUp 0.3s ease; }
                .modal-header { padding: 20px; background: #2c3e50; color: white; display: flex; justify-content: space-between; align-items: center; }
                .close-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; }
                .modal-body { padding: 20px; max-height: 70vh; overflow-y: auto; }
                .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
                .stat-box { background: #f8f9fa; padding: 10px; border-radius: 8px; text-align: center; border: 1px solid #eee; }
                .stat-box h4 { margin: 0; font-size: 10px; color: #666; }
                .stat-box p { margin: 5px 0 0 0; font-size: 16px; font-weight: bold; color: #2c3e50; }
                .history-card { background: #f1f8ff; border-left: 4px solid #3498db; padding: 12px; border-radius: 6px; margin-bottom: 10px; }
                .event-name { font-weight: bold; margin-bottom: 5px; color: #2980b9; }
                .event-details { display: flex; gap: 15px; font-size: 13px; color: #555; }
                .tba-link-btn {
    background: #ffffff33; /* 半透明白色 */
    color: white;
    text-decoration: none;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: bold;
    border: 1px solid #ffffff66;
    transition: all 0.2s;
    display: flex;
    align-items: center;
}

.tba-link-btn:hover {
    background: #ffffff;
    color: #2c3e50;
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            `}</style>
        </div>
    );
};

// 標題樣式
const headerStyle = {
    whiteSpace: 'nowrap',
    position: 'relative'
};

export default TeamHistoryTab;