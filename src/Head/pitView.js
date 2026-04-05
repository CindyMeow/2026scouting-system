import React, { useMemo } from 'react';

/**
 * PitViewTab - 隊伍維修區概覽分頁
 * 邏輯：將 TBA 官方基本資料與 Scouters 實測數據進行聯集
 */
const PitViewTab = ({ teams = {}, pitData = [], setSelectedTeam, setActiveSubTab }) => {
  
  // 1. 建立快速查詢 Map (加速查找實測數據)
  const pitMap = useMemo(() => {
    const map = {};
    // 確保 pitData 存在且為陣列
    if (Array.isArray(pitData)) {
      pitData.forEach(p => { 
        if (p.team) map[String(p.team)] = p; 
      });
    }
    return map;
  }, [pitData]);

  // 2. 取得隊伍清單並排序 (處理 teams 為物件的情況)
  const teamList = useMemo(() => {
    return Object.keys(teams).sort((a, b) => parseInt(a) - parseInt(b));
  }, [teams]);

  // 3. 處理點擊跳轉邏輯
  const handleCardClick = (tNumber) => {
    setSelectedTeam(String(tNumber));
    setActiveSubTab('profile'); // 跳轉到隊伍紀錄詳細頁面
  };

  return (
    <div className="pit-view-container" style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: '#2d3748' }}>🛠️ Pit 資料庫總覽</h2>
        <span style={{ fontSize: '14px', color: '#718096' }}>
          已收錄: <b>{Object.keys(pitMap).length}</b> / 總計: {teamList.length} 隊
        </span>
      </div>

      <div className="scout-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
        gap: '25px'
      }}>
        {teamList.length > 0 ? (
          teamList.map((tNumber) => {
            const tInfo = teams[tNumber] || {};
            const scoutingResult = pitMap[String(tNumber)];
            const hasRecord = !!scoutingResult;

            return (
              <div 
                key={tNumber} 
                className={`pit-card ${hasRecord ? 'has-data' : 'no-data'}`}
                onClick={() => handleCardClick(tNumber)}
                style={{ 
                  cursor: 'pointer', 
                  background: '#fff', 
                  borderRadius: '16px', 
                  overflow: 'hidden', 
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  border: hasRecord ? '1px solid #e2e8f0' : '2px dashed #cbd5e0',
                  opacity: hasRecord ? 1 : 0.85
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }}
              >
                {/* 圖片區塊 */}
                <div style={{ position: 'relative', height: '180px', backgroundColor: '#edf2f7' }}>
                  <img 
                    src={scoutingResult?.photo || tInfo.robot_image_url || `https://placehold.co/400x300/2d3748/ffffff?text=Team+${tNumber}`} 
                    alt={`Team ${tNumber} Robot`} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'cover',
                      filter: hasRecord ? 'none' : 'grayscale(80%)'
                    }} 
                  />
                  {!hasRecord && (
                    <div style={{ 
                      position: 'absolute', top: '12px', right: '12px', 
                      background: '#fc8181', color: '#fff', padding: '4px 10px', 
                      borderRadius: '20px', fontSize: '11px', fontWeight: 'bold',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      MISSING
                    </div>
                  )}
                </div>
                
                <div style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: '0', color: '#2b6cb0', fontSize: '20px' }}>#{tNumber}</h3>
                    <span style={{ fontSize: '11px', color: '#a0aec0', background: '#f7fafc', padding: '2px 6px', borderRadius: '4px' }}>
                      {tInfo.city || "Unknown"}
                    </span>
                  </div>
                  
                  <p style={{ 
                    margin: '4px 0 12px 0', 
                    fontSize: '13px', 
                    color: '#718096', 
                    fontWeight: '500',
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}>
                    {tInfo.team_name || "New Team"}
                  </p>
                  
                  <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '12px' }}>
                    {hasRecord ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', fontSize: '14px' }}>
                          <span style={{ color: '#a0aec0', width: '70px' }}>Chassis:</span>
                          <span style={{ color: '#2d3748', fontWeight: '600' }}>{scoutingResult.drive || "Swerve"}</span>
                        </div>
                        <div style={{ display: 'flex', fontSize: '14px' }}>
                          <span style={{ color: '#a0aec0', width: '70px' }}>Shooter:</span>
                          <span style={{ color: '#2d3748', fontWeight: '600' }}>{scoutingResult.shooter || "Double"}</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '8px 0', fontSize: '13px', color: '#cbd5e0', fontStyle: 'italic', textAlign: 'center' }}>
                        尚未採訪此隊伍
                      </div>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '12px', color: '#4299e1', fontWeight: 'bold' }}>
                      查看詳細數據 →
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state" style={{ 
            gridColumn: '1 / -1', 
            textAlign: 'center', 
            padding: '100px 20px', 
            background: '#fff', 
            borderRadius: '20px',
            border: '2px dashed #e2e8f0'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>📋</div>
            <h3 style={{ color: '#2d3748', fontSize: '24px' }}>隊伍資料庫空空如也</h3>
            <p style={{ color: '#718096', maxWidth: '400px', margin: '10px auto' }}>
              請前往「資料匯入」分頁上傳 TBA 隊伍清單 (CSV)，系統將自動為你建立這些精美的隊伍卡片。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PitViewTab;