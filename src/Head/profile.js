//profile.js
import React, { useState, useEffect, useRef } from 'react';

const ProfileTab = ({
  selectedTeam,
  setSelectedTeam,
  profile,
  //canvasRef,
  setIsModalOpen,
  drawAutoPaths,
  onUpdateMatch,
  schedule,        // 需由父層傳入
  setActiveSubTab  // 需由父層傳入，用於跳轉頁面
}) => {
  const localCanvasRef = useRef(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [editingMatch, setEditingMatch] = useState(null);
  const [tempNotes, setTempNotes] = useState("");
  const [showPitModal, setShowPitModal] = useState(false);

  useEffect(() => {
    setSelectedMatchId(null);
  }, [selectedTeam]);

  useEffect(() => {
    if (profile && localCanvasRef.current && typeof drawAutoPaths === 'function') {
      drawAutoPaths(localCanvasRef.current, false, selectedMatchId);
    }
  }, [selectedMatchId, profile, drawAutoPaths]);

  // --- 新增：合併官方賽程邏輯 ---
  const getCombinedHistory = () => {
    if (!schedule || !selectedTeam) return [];


    const teamStr = String(selectedTeam);
    const rawArray = Array.isArray(schedule) ? schedule : Object.values(schedule);

    // 1. 建立唯一 ID (組合類型與場次)，避免 Q1 重複
    const uniqueMatches = Array.from(
      rawArray.reduce((map, item) => {
        // 這裡建立一個唯一的 key，例如 "qm_1" 或 "sf_1"
        const uniqueKey = `${item.comp_level}_${item.match_number || item.match}`;
        if (!map.has(uniqueKey)) map.set(uniqueKey, item);
        return map;
      }, new Map()).values()
    );

    return uniqueMatches
      .filter(sMatch => {
        const teamsInMatch = [
          sMatch.red1, sMatch.red2, sMatch.red3,
          sMatch.blue1, sMatch.blue2, sMatch.blue3
        ].map(String);
        return teamsInMatch.includes(teamStr);
      })
      .sort((a, b) => {
        // 2. 排序邏輯：資格賽優先 (qm -> sf -> f)
        const levelOrder = { qm: 1, sf: 2, f: 3 };
        if (levelOrder[a.comp_level] !== levelOrder[b.comp_level]) {
          return levelOrder[a.comp_level] - levelOrder[b.comp_level];
        }
        return (a.match_number || a.match) - (b.match_number || b.match);
      })
      .map(sMatch => {
        const mNum = sMatch.match_number || sMatch.match;
        const level = sMatch.comp_level;

        // 3. 格式化顯示名稱
        // qm 1 -> Q1, sf 1 -> SF1, f 1 -> F1
        const displayLabel = level === 'qm' ? `Q${mNum}` :
          level === 'sf' ? `SF${sMatch.set_number || mNum}` :
            `F${mNum}`;

        const isRed = [sMatch.red1, sMatch.red2, sMatch.red3].map(String).includes(teamStr);
        const redScore = sMatch.red_score ?? 0;
        const blueScore = sMatch.blue_score ?? 0;

        let result = "-";
        if (redScore > 0 || blueScore > 0) {
          if (redScore === blueScore) result = "Tie";
          else if (isRed) result = redScore > blueScore ? "Win" : "Loss";
          else result = blueScore > redScore ? "Win" : "Loss";
        }

        // 4. 比對 Scouter 數據 (比對時也要考慮 comp_level 以免對錯)
        const scouterData = profile?.history?.find(h => {
          const hMatch = String(h.match);
          const sMatchNum = String(mNum);
          const hLevel = h.compLevel || 'qm';
          // 同時支援 matchKey 或 (編號+階段) 的比對
          return (h.matchKey === `${level}_${mNum}`) || (hMatch === sMatchNum && hLevel === level);
        });

        return {
          match: displayLabel, // 現在會顯示 Q1, SF1 等正確標籤
          isRed,
          result,
          scores: { red: redScore, blue: blueScore },
          scouterData: scouterData || null
        };
      });
  };

  const combinedHistory = getCombinedHistory();

  // 計算聚合數據 (維持原樣)
  const history = profile?.history || [];
  const getAvgRatings = (history) => {
    if (!history || history.length === 0) return { driver: "0.0", defense: "0.0", stability: "0.0" };

    const sums = history.reduce((acc, curr) => {
      // 增加安全轉型，防止資料庫中有 null 或 undefined 導致崩潰
      acc.driver += Number(curr.ratings?.driver || 0);
      acc.defense += Number(curr.ratings?.defense || 0);
      acc.stability += Number(curr.ratings?.stability || 0);
      return acc;
    }, { driver: 0, defense: 0, stability: 0 });

    return {
      driver: (sums.driver / history.length).toFixed(1),
      defense: (sums.defense / history.length).toFixed(1),
      stability: (sums.stability / history.length).toFixed(1)
    };
  };

  const avgRatings = getAvgRatings(history);

  const handleSaveEdit = () => {
    if (onUpdateMatch && editingMatch) {
      onUpdateMatch({ ...editingMatch, headNotes: tempNotes });
      setEditingMatch(null);
      alert("備註已更新");
    }
  };

  if (!selectedTeam) {
    return (
      <div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            className="scout-filter-input"
            style={{ width: '300px' }}
            placeholder="🔍 輸入隊伍編號 (例如: 7632)..."
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          />
        </div>
        <div className="scout-card" style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
          請輸入隊伍編號以查看詳細資料。
        </div>
      </div>
    );
  }

  const stats = history.reduce((acc, match) => {
    acc.totalFuel += (Number(match.fuelH) || 0);
    acc.totalMissed += (Number(match.missed) || 0);
    acc.totalClimbTime += (Number(match.climbTime) || 0);
    acc.avgCircleSum += (Number(match.avgCircle || match.avgCycle) || 0);
    acc.matchCount += 1;
    return acc;
  }, { totalFuel: 0, totalMissed: 0, totalClimbTime: 0, avgCircleSum: 0, matchCount: 0 });

  const hitRate = stats.totalFuel + stats.totalMissed > 0
    ? ((stats.totalFuel / (stats.totalFuel + stats.totalMissed)) * 100).toFixed(1)
    : 0;

  const avgCircle = stats.matchCount > 0 ? (stats.avgCircleSum / stats.matchCount).toFixed(2) : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          className="scout-filter-input"
          style={{ width: '300px' }}
          placeholder="🔍 輸入隊伍編號..."
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
        />
      </div>

      {profile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 上方資訊區保持原樣 */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch' }}>
            <div className="scout-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ width: '120px' }}>
                  {profile?.pitInfo?.photo ?
                    <img src={profile.pitInfo.photo} style={{ width: '100%', borderRadius: '8px' }} alt="bot" /> :
                    <div className="pit-no-img" style={{ height: '100px', borderRadius: '8px' }}>無照片</div>
                  }
                  <button className="btn-action-sm" onClick={() => setShowPitModal(true)}>🔍 查看 Pit 紀錄</button>
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: '0 0 5px 0' }}>Team {selectedTeam}</h2>
                  <p className="pit-text"><b>底盤:</b> {profile.pitInfo?.drive || "未知"}</p>
                  <p className="pit-text"><b>Shooter:</b> {profile.pitInfo?.shooter || "未知"}</p>
                </div>
              </div>

              {/* 數據統計區保持原樣 */}
              <div className="stats-analysis-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '10px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>總命中率</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2ecc71' }}>{hitRate}%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>平均 Circle</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3498db' }}>{avgCircle}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', color: '#666' }}>平均爬升</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e67e22' }}>{(stats.totalClimbTime / stats.matchCount || 0).toFixed(1)}s</div>
                </div>
              </div>

              {/* 評分條保持原樣 */}
              <div style={{ padding: '10px', backgroundColor: '#f7fafc', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>📊 綜合技術評分 (平均)</h4>
                {['driver', 'defense', 'stability'].map(key => (
                  <div key={key} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span>{key === 'driver' ? '駕駛技術' : key === 'defense' ? '防守能力' : '穩定度'}</span>
                      <span style={{ fontWeight: 'bold' }}>{avgRatings[key]} / 5</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px' }}>
                      <div style={{ width: `${(avgRatings[key] / 5) * 100}%`, height: '100%', backgroundColor: '#4299e1', borderRadius: '3px' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* 路徑選擇器 */}
              <div style={{ marginTop: '5px' }}>
                <h4 style={{ marginBottom: '10px', color: '#718096' }}>📅 選擇路徑來源：</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className={`btn-action-sm ${selectedMatchId === null ? 'active-path' : ''}`} onClick={() => setSelectedMatchId(null)}>📍 顯示所有疊加路徑</button>
                  {/* 2. 比賽場次路徑 (從歷史數據抓取) */}
                  {profile?.history.filter(m => m.autoPath).map((m) => (
                    <button
                      key={m.id}
                      className={`btn-action-sm ${selectedMatchId === m.id ? 'active-path' : ''}`}
                      onClick={() => setSelectedMatchId(m.id)}
                    >
                      {m.compLevel === 'sf' ? 'SF' : m.compLevel === 'f' ? 'F' : 'Q'}{m.match} - {m.station}                    </button>
                  ))}

                  {/* ✨ 3. 新增：Pit 預想路徑按鈕 (只要 pitInfo 有路徑就顯示) */}
                  {profile.pitInfo?.autoPath && (
                    <button
                      className={`btn-action-sm ${selectedMatchId === 'pit' ? 'active-path' : ''}`}
                      style={{ borderLeft: '4px solid #27ae60', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '5px' }}
                      onClick={() => setSelectedMatchId('pit')}
                    >
                      🛠️ Pit 預想路徑 (Preview)
                    </button>
                  )}
                </div>

              </div>
            </div>

            <div className="scout-card" style={{ flex: 1.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="scout-card-title" style={{ margin: 0 }}>軌跡詳情</h3>
                <button className="btn-action-sm" onClick={() => setIsModalOpen(true)}>🔍 全螢幕</button>
              </div>
              <div style={{ position: 'relative', marginTop: '15px', aspectRatio: '4/3', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
                <canvas ref={localCanvasRef} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
          </div>

          {/* --- 修改後的表格區 --- */}
          <div className="scout-card">
            <h3 className="scout-card-title">⏱️ 比賽歷史數據 (對齊賽程)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="scout-table">
                <thead>
                  <tr>
                    <th>Match</th>
                    <th>聯盟/結果</th>
                    <th>命中率</th>
                    <th>Avg Cycle</th>
                    <th>Fuel</th>
                    <th>Missed</th>
                    <th>Climb</th>
                    <th>Climb Time</th>
                    <th>Auto</th>
                    <th>Ratings</th>
                    <th>Head 備註</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedHistory.map((row, i) => {
                    const { scouterData, isRed, result, scores, match } = row;
                    const resColor = result === "Win" ? "#2ecc71" : result === "Loss" ? "#e74c3c" : "#95a5a6";

                    return (
                      <tr key={i} style={{ backgroundColor: selectedMatchId === scouterData?.id ? '#e3f2fd' : 'transparent' }}>
                        {/* 點擊 Match 號碼跳轉到 schedule 頁面 */}
                        <td
                          style={{ fontWeight: 'bold', cursor: 'pointer', color: '#3498db', textDecoration: 'underline' }}
                          onClick={() => setActiveSubTab('schedule')}
                        >
                          {match}
                        </td>

                        <td style={{ fontSize: '12px' }}>
                          <span style={{ color: isRed ? '#e74c3c' : '#3498db', fontWeight: 'bold' }}>
                            {isRed ? "RED" : "BLUE"}
                          </span>
                          <div style={{ color: resColor, fontWeight: 'bold' }}>
                            {result} {scores ? `(${scores.red}:${scores.blue})` : ''}
                          </div>
                        </td>

                        {/* 如果 scouterData 存在才顯示數據，否則顯示 "-" */}
                        <td>{scouterData ? `${((scouterData.fuelH / (Number(scouterData.fuelH) + Number(scouterData.missed) || 1)) * 100).toFixed(0)}%` : "-"}</td>
                        <td>{scouterData?.avgCycle || scouterData?.avgCircle || "-"}</td>
                        <td>{scouterData?.fuelH ?? "-"}</td>
                        <td>{scouterData?.missed ?? "-"}</td>
                        <td>{scouterData ? `L${scouterData.climbLevel}` : "-"}</td>
                        <td>{scouterData ? `${scouterData.climbTime}s` : "-"}</td>
                        <td style={{ textAlign: 'center' }}>
                          {scouterData ? (scouterData.autoSuccess ? "✅" : (scouterData.autoPath ? "⚠️" : "❌")) : "-"}
                        </td>
                        <td style={{ fontSize: '12px', minWidth: '100px', verticalAlign: 'middle' }}>
                          {scouterData ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ whiteSpace: 'nowrap' }}>⭐ {scouterData.ratings?.driver || 0} <small>(駕)</small></div>
                              <div style={{ whiteSpace: 'nowrap' }}>⭐ {scouterData.ratings?.defense || 0} <small>(防)</small></div>
                              <div style={{ whiteSpace: 'nowrap' }}>⭐ {scouterData.ratings?.stability || 0} <small>(穩)</small></div>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: '#ccc' }}>-</div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: '#666', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {scouterData?.headNotes || "-"}
                        </td>
                        <td>
                          {scouterData && (
                            <button className="btn-action-sm" onClick={() => { setEditingMatch(scouterData); setTempNotes(scouterData.headNotes || ""); }}>✏️</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="scout-card" style={{ textAlign: 'center', padding: '50px', color: '#999' }}>請輸入隊伍編號以查看詳細資料。</div>
      )}

      {/* --- 編輯備註彈窗 --- */}
      {editingMatch && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
          <div className="scout-card" style={{ width: '400px', padding: '20px' }}>
            <h3>
              Match {editingMatch.compLevel === 'sf' ? 'SF' : editingMatch.compLevel === 'f' ? 'F' : 'Q'}
              {editingMatch.match} 數據編輯
            </h3>
            <p style={{ fontSize: '14px', color: '#666' }}>Team: {editingMatch.team}</p>

            <label style={{ display: 'block', marginTop: '15px', fontWeight: 'bold' }}>Head Scouter 備註：</label>
            <textarea
              style={{ width: '100%', height: '100px', marginTop: '5px', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }}
              value={tempNotes}
              onChange={(e) => setTempNotes(e.target.value)}
              placeholder="輸入此場次的特殊觀察或修正建議..."
            />

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn-action-sm" style={{ flex: 1, backgroundColor: '#3182ce', color: 'white' }} onClick={handleSaveEdit}>保存更新</button>
              <button className="btn-action-sm" style={{ flex: 1, backgroundColor: '#e2e8f0' }} onClick={() => setEditingMatch(null)}>取消</button>
            </div>
          </div>
        </div>
      )}
      {/* --- Pit 詳細資料彈窗 --- */}

      {showPitModal && (
        <div className="modal-overlay" onClick={() => setShowPitModal(false)} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
          <div className="scout-card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '600px', padding: '25px', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0 }}>🛠️ Team {selectedTeam} Pit 詳細紀錄</h3>
              <button onClick={() => setShowPitModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '24px' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '250px' }}>

              </div>
              <div style={{ flex: '1', minWidth: '200px' }}>
                {/* 修正：對應範例中的欄位名稱 */}
                <p className="pit-text"><b>底盤:</b> {profile.pitInfo?.drive || "未知"}</p>
                <p className="pit-text"><b>Shooter:</b> {profile.pitInfo?.shooter || "未知"}</p>
                <p className="pit-text"><b>Intake:</b> {profile.pitInfo?.intake || "未知"}</p>
                <p className="pit-text"><b>Climb:</b> {profile.pitInfo?.climb || "未知"}</p>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '15px', background: '#fff9db', borderRadius: '8px' }}>
              <strong>Pit 備註：</strong>
              <p style={{ fontSize: '14px', color: '#444', margin: '5px 0 0 0' }}>
                {profile.pitInfo?.notes || "目前尚無詳細 Pit 備註資料。"}
              </p>
            </div>
          </div>
        </div>
      )}


    </div>

  );
};

export default ProfileTab;