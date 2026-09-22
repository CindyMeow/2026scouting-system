//app.js
import React, { useState, useEffect } from 'react';
import ScouterPage from './ScouterPage';
import PitScoutPage from './PitScoutPage';
import HeadScoutPage from './Head/HeadScoutPage';
import AnalysisPage from './Analysis/AnalysisPage';

function App() {
  const [activeTab, setActiveTab] = useState('match');
  const [teams, setTeams] = useState({});
  const [coprData, setCoprData] = useState([]);
  const [masterData, setMasterData] = useState({ matchData: [], pitData: [] });
  const [selectedTeam, setSelectedTeam] = useState(null);
  useEffect(() => {
    const fetchData = async () => {
  try {
    const response = await fetch(`/api/data`);
    if (!response.ok) throw new Error("載入失敗");
    const data = await response.json();

    if (data && typeof data === 'object') {
      if (data.teams) setTeams(data.teams);
      
      // 確保即使後端沒資料，也會傳入空陣列而不是 undefined
      setMasterData({
        matchData: Array.isArray(data.matchData) ? data.matchData : [],
        pitData: Array.isArray(data.pitData) ? data.pitData : [],
        teams: data.teams || {},
        eventKey: data.eventKey
      });
    }
  } catch (err) {
    console.error("初始化抓取失敗:", err);
    // 發生錯誤時保持結構完整，避免下游組件崩潰
    setMasterData({ matchData: [], pitData: [] });
  }
};
    const fetchCopr = async () => {
      try {
        const res = await fetch(`/api/copr`);
        if (!res.ok) throw new Error("載入失敗");
        const data = await res.json();
        setCoprData(data); // 這樣 AnalysisPage 就有 OPR 數據了！
      } catch (err) {
        console.warn("尚未偵測到 COPR 資料，表格將僅顯示 Scouting 數據");
      }
    };
    const refresh = () => { fetchCopr(); fetchData(); };
    refresh();
    window.addEventListener('scout-data-updated', refresh);
    return () => window.removeEventListener('scout-data-updated', refresh);
  }, [activeTab]);
const handleViewProfile = (teamNum) => {
  setSelectedTeam(String(teamNum)); 
  setActiveTab('head'); // 直接跳到 Head 分頁，並讓 Head 內部顯示 Profile
};
  return (
    <div style={styles.appContainer}>
      {/* 更新導覽列：增加 Head Scouter 按鈕 */}
      <nav style={styles.navBar}>
        <button
          style={{ ...styles.navBtn, backgroundColor: activeTab === 'pit' ? '#4CAF50' : '#eee', color: activeTab === 'pit' ? '#fff' : '#333' }}
          onClick={() => setActiveTab('pit')}
        >
          🛠️ Pit
        </button>

        <button
          style={{ ...styles.navBtn, backgroundColor: activeTab === 'match' ? '#2196F3' : '#eee', color: activeTab === 'match' ? '#fff' : '#333' }}
          onClick={() => setActiveTab('match')}
        >
          🏆 Match
        </button>

        <button
          style={{ ...styles.navBtn, backgroundColor: activeTab === 'head' ? '#9C27B0' : '#eee', color: activeTab === 'head' ? '#fff' : '#333' }}
          onClick={() => setActiveTab('head')}
        >
          📡 Head
        </button>

        {/* ✨ 修改 1：新增分析頁面按鈕 */}
        <button
          style={{ ...styles.navBtn, backgroundColor: activeTab === 'analysis' ? '#FF5722' : '#eee', color: activeTab === 'analysis' ? '#fff' : '#333' }}
          onClick={() => setActiveTab('analysis')}
        >
          🔥 Analysis
        </button>
      </nav>

      {/* 根據 Tab 顯示內容 */}
      <div style={styles.content}>
        {activeTab === 'match' && <ScouterPage />}
        {activeTab === 'pit' && <PitScoutPage />}
        {activeTab === 'head' && (<HeadScoutPage
    teams={teams} 
    setTeams={setTeams} 
    externalTeam={selectedTeam} // ✨ 把選中的隊伍傳進去
  />
        )}
        {activeTab === 'analysis' && (
          <AnalysisPage
            allTeamsData={masterData}
            coprData={coprData}
            onTeamClick={handleViewProfile}
          />
        )}
      </div>
    </div>
  );
}

// 樣式部分只需稍微調整 navBtn 的 flex 即可
const styles = {
  appContainer: { display: 'flex', flexDirection: 'column', height: '100vh' },
  navBar: { display: 'flex', padding: '10px', backgroundColor: '#fff', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' },
  navBtn: { flex: 1, padding: '12px', border: 'none', borderRadius: '8px', margin: '0 5px', fontWeight: 'bold' },
  content: { flex: 1, overflowY: 'auto' }
};

export default App;