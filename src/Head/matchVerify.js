//Head/matchVerify.js
import React, { useState } from 'react';

const MatchVerifyTab = ({ matchData, toggleVerify, deleteMatch, setSelectedTeam, setActiveSubTab, onUpdateMatch }) => {
  const [editingMatch, setEditingMatch] = useState(null);
  const [tempData, setTempData] = useState({});

  // 開啟編輯並載入所有欄位
  const startEdit = (match) => {
    setEditingMatch(match);
    setTempData({
      match: match.match,
      team: match.team,
      station: match.station,
      autoFuel: match.autoFuel || 0,
      fuelH: match.fuelH,
      missed: match.missed,
      climbLevel: match.climbLevel,
      climbTime: match.climbTime,
      headNotes: match.headNotes || "",
      // 保持評分數據不被遺失
      ratings: match.ratings || { driver: 3, defense: 3, stability: 3 },
      compLevel: match.compLevel || 'qm',
    });
  };

  const handleSave = () => {
    if (onUpdateMatch && editingMatch) {
      onUpdateMatch({
        ...editingMatch, // 保留 id, autoPath 等隱藏欄位
        match: tempData.match,
        team: tempData.team,
        station: tempData.station,
        autoFuel: parseInt(tempData.autoFuel) || 0,
        fuelH: parseInt(tempData.fuelH) || 0,
        missed: parseInt(tempData.missed) || 0,
        climbLevel: tempData.climbLevel,
        climbTime: tempData.climbTime,
        headNotes: tempData.headNotes,
        compLevel: tempData.compLevel,
        matchKey: `${tempData.compLevel}_${tempData.match}`
      });
      setEditingMatch(null);
    }
  };

  return (
    <div className="scout-card">
      <h3 className="scout-card-title">✅ 比賽數據稽核</h3>

      <div style={{ overflowX: 'auto' }}>
        <table className="scout-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Team</th>
              <th>Station</th>
              <th>Fuel (H)</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            {matchData && matchData.map(d => {
              // 定義顯示標籤
              const levelLabel = d.compLevel === 'sf' ? 'SF' : d.compLevel === 'f' ? 'F' : 'Q';

              return (
                <tr key={d.id} style={{ backgroundColor: d.verified ? '#f1f8e9' : '#fff' }}>
                  <td style={{ fontWeight: 'bold' }}>
                    {levelLabel}{d.match}
                  </td>
                  <td
                    style={{ fontWeight: 'bold', color: '#2196F3', cursor: 'pointer' }}
                    onClick={() => { setSelectedTeam(d.team); setActiveSubTab('profile'); }}
                  >
                    {d.team}
                  </td>
                  <td style={{ fontSize: '12px' }}>{d.station}</td>
                  <td>{d.fuelH}</td>
                  <td style={{ color: d.verified ? '#4CAF50' : '#FF9800', fontWeight: '500' }}>
                    {d.verified ? '● 已確認' : '○ 待核對'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn-action-sm" onClick={() => toggleVerify(d.id)}>
                        {d.verified ? '取消' : '核准'}
                      </button>
                      <button className="btn-action-sm" style={{ backgroundColor: '#e3f2fd', color: '#1976d2' }} onClick={() => startEdit(d)}>
                        編輯
                      </button>
                      <button className="btn-action-sm" style={{ color: '#f44336', backgroundColor: '#ffebee' }} onClick={() => deleteMatch(d.id)}>
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* --- 全功能編輯彈窗 --- */}
      {editingMatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="scout-card" style={{ width: '450px', maxHeight: '90vh', overflowY: 'auto', padding: '25px' }}>
            <h3 style={{ marginTop: 0, borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
              修正數據錄入 - {editingMatch.compLevel === 'sf' ? 'SF' : editingMatch.compLevel === 'f' ? 'F' : 'Q'}{editingMatch.match}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Match #</label>
                <input type="text" style={inputStyle} value={tempData.match} onChange={(e) => setTempData({ ...tempData, match: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Team #</label>
                <input type="text" style={inputStyle} value={tempData.team} onChange={(e) => setTempData({ ...tempData, team: e.target.value })} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Station</label>
                <select style={inputStyle} value={tempData.station} onChange={(e) => setTempData({ ...tempData, station: e.target.value })}>
                  <option value="Red 1">Red 1</option><option value="Red 2">Red 2</option><option value="Red 3">Red 3</option>
                  <option value="Blue 1">Blue 1</option><option value="Blue 2">Blue 2</option><option value="Blue 3">Blue 3</option>
                </select>
              </div>
              <div style={{ backgroundColor: '#e3f2fd', padding: '8px', borderRadius: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1976d2' }}>Auto Fuel Score</label>
                <input type="number" style={inputStyle} value={tempData.autoFuel} onChange={(e) => setTempData({ ...tempData, autoFuel: e.target.value })} />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Fuel (High)</label>
                <input type="number" style={inputStyle} value={tempData.fuelH} onChange={(e) => setTempData({ ...tempData, fuelH: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Missed</label>
                <input type="number" style={inputStyle} value={tempData.missed} onChange={(e) => setTempData({ ...tempData, missed: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Climb Level (0-3)</label>
                <input type="text" style={inputStyle} value={tempData.climbLevel} onChange={(e) => setTempData({ ...tempData, climbLevel: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Climb Time (s)</label>
                <input type="text" style={inputStyle} value={tempData.climbTime} onChange={(e) => setTempData({ ...tempData, climbTime: e.target.value })} />
              </div>
            </div>

            <div style={{ marginTop: '15px' }}>
              <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Head Scouter 備註</label>
              <textarea style={{ ...inputStyle, height: '80px' }} value={tempData.headNotes} onChange={(e) => setTempData({ ...tempData, headNotes: e.target.value })} placeholder="記錄異常表現或防守策略..." />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button className="btn-action-sm" style={{ flex: 1, backgroundColor: '#2196F3', color: '#fff', padding: '12px' }} onClick={handleSave}>儲存更新</button>
              <button className="btn-action-sm" style={{ flex: 1, backgroundColor: '#eee', padding: '12px' }} onClick={() => setEditingMatch(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 簡單的內聯樣式
const inputStyle = {
  width: '100%',
  padding: '10px',
  marginTop: '5px',
  borderRadius: '6px',
  border: '1px solid #ddd',
  fontSize: '14px',
  boxSizing: 'border-box'
};

export default MatchVerifyTab;