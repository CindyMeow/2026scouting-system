import React, { useState, useMemo } from 'react';

const TeamHistoryTab = ({ coprData }) => {
    const [selectedTeam, setSelectedTeam] = useState(null);

    // ✨ 1. 新增排序狀態：key 為欄位名稱，direction 為 'asc' (升冪) 或 'desc' (降冪)
    const [sortConfig, setSortConfig] = useState({ key: 'team_number', direction: 'asc' });

    // ✨ 2. 處理排序邏輯 (使用 useMemo 優化效能)
    const sortedData = useMemo(() => {
        let sortableItems = [...coprData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                // 處理可能為 undefined 或 null 的情況
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];

                // 如果是 history 欄位，以長度排序
                if (sortConfig.key === 'history_count') {
                    aValue = Array.isArray(a.history) ? a.history.length : 0;
                    bValue = Array.isArray(b.history) ? b.history.length : 0;
                }

                // 數值轉換 (確保 EPA/OPR/world_rank 是數字比較)
                if (!isNaN(Number(aValue)) && !isNaN(Number(bValue))) {
                    aValue = Number(aValue);
                    bValue = Number(bValue);
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [coprData, sortConfig]);

    // ✨ 3. 切換排序的 function
    const requestSort = (key) => {
        let direction = 'desc'; // 預設點擊先從大到小排序 (對數據分析比較直覺)
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    // 輔助函式：渲染排序箭頭
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
                            {/* ✨ 4. 標題加入點擊事件與圖示 */}
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
                        {/* ✨ 5. 使用排序後的 sortedData */}
                        {sortedData.map(team => (
                            <tr key={team.team_number}>
                                <td style={{ fontWeight: 'bold' }}>{team.team_number}</td>
                                <td>{team.nickname}</td>
                                <td>{team.world_rank || '-'}</td>
                                <td style={{ color: '#e67e22', fontWeight: 'bold' }}>{team.OPR}</td>
                                <td style={{ color: '#27ae60' }}>{team.EPA}</td>
                                <td>{Array.isArray(team.history) ? team.history.length : 0} 場</td>
                                <td>
                                    <button className="btn-detail" onClick={() => setSelectedTeam(team)}>
                                        查看詳情
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- Modal 部分保持不變 --- */}
            {selectedTeam && (
                <div className="modal-overlay" onClick={() => setSelectedTeam(null)}>
                    {/* ... (同你原本的 Modal 內容) ... */}
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Team {selectedTeam.team_number} - {selectedTeam.nickname}</h2>
                            {/* ✨ 新增 TBA 連結按鈕 */}
                            <a
                                href={`https://www.thebluealliance.com/team/${selectedTeam.team_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="tba-link-btn"
                                title="在 TBA 查看更多"
                            >
                                🌐 TBA
                            </a>
                            <button className="close-btn" onClick={() => setSelectedTeam(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', background: '#f0f4f8', padding: '15px', borderRadius: '10px' }}>
                                <div>
                                    <small style={{ color: '#666' }}>地區</small>
                                    <div style={{ fontWeight: 'bold' }}>{selectedTeam.country} / {selectedTeam.state}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <small style={{ color: '#666' }}>EPA 世界排名</small>
                                    <div style={{ fontWeight: 'bold', color: '#e74c3c', fontSize: '18px' }}>#{selectedTeam.world_rank}</div>
                                </div>
                            </div>
                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                <div className="stat-box"><h4>Total</h4><p>{selectedTeam.EPA}</p></div>
                                <div className="stat-box"><h4>Auto</h4><p>{selectedTeam.auto_EPA}</p></div>
                                <div className="stat-box"><h4>Teleop</h4><p>{selectedTeam.teleop_EPA}</p></div>
                                <div className="stat-box"><h4>Endgame</h4><p>{selectedTeam.endgame_EPA}</p></div>
                            </div>
                            <h3>📅 2026 參賽紀錄</h3>
                            {selectedTeam.history && Array.isArray(selectedTeam.history) && selectedTeam.history.length > 0 ? (
                                selectedTeam.history.map((h, i) => (
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
                                <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>該隊伍目前尚無 2026 官方比賽紀錄</p>
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