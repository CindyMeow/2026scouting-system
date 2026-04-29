//AnalysisPage.js
import React, { useState, useEffect } from 'react';
import AnalysisTab from './AnalysisTab';
import SimulatorTab from './SimulatorTab';
import RadarTab from './RadarTab';
import PicklistTab from './PicklistTab';
import TeamHistoryTab from './TeamHistoryTab';

const AnalysisPage = ({ allTeamsData, coprData, teamsDb, assignments, onTeamClick }) => {
  // 控制目前顯示哪一個分析工具
  const [activeTab, setActiveTab] = useState('table'); // table, simulator, radar, picklist
  const [alliance, setAlliance] = useState({
    red: ['', '', ''],
    blue: ['', '', '']
  });
  const [pickLists, setPickLists] = useState({
    all: [], // 初始值可以在 useEffect 根據 allTeamsData 設定
    watchlist: [],
    pick1: [],
    pick2: []
  });
  const [radarTeams, setRadarTeams] = useState({
    teamA: '',
    teamB: ''
  });

  // 3. ✨ 初始化 Picklist：當 allTeamsData 載入時，將所有隊伍填入 'all' 欄位
  useEffect(() => {
    if (allTeamsData?.teams && pickLists.all.length === 0) {
      const allNums = Object.keys(allTeamsData.teams).sort((a, b) => a - b);
      setPickLists(prev => ({ ...prev, all: allNums }));
    }
  }, [allTeamsData, pickLists.all.length]);

  // 渲染子頁面內容
  const renderContent = () => {
    switch (activeTab) {
      case 'table':
        return (
          <AnalysisTab
            allTeamsData={allTeamsData}
            coprData={coprData}
            teamsDb={teamsDb}
            onTeamClick={onTeamClick}
          />
        );
      case 'simulator':
        return <SimulatorTab
          allTeamsData={allTeamsData}
          coprData={coprData}
          alliance={alliance}        // ✨ 傳入狀態
          teamsDb={teamsDb}
          setAlliance={setAlliance}  // ✨ 傳入修改狀態的 function
        />;
      case 'radar':
        return (
          <RadarTab
            allTeamsData={allTeamsData}
            coprData={coprData}
            radarTeams={radarTeams}
            teamsDb={teamsDb}
            setRadarTeams={setRadarTeams}
          />
        );
      case 'picklist':
        return <PicklistTab
          allTeamsData={allTeamsData}
          lists={pickLists}          
          teamsDb={teamsDb}
          setLists={setPickLists}
        />;

      case 'history': // ✨ 新增 case
        return (
          <div>
           
            <TeamHistoryTab
              coprData={coprData}
              setActiveTab={() => { }} // 因為 handleViewProfile 已經處理了切換，這裡可以傳空或不傳
              setSelectedTeam={onTeamClick} // ✨ 關鍵：把 App.js 的 handleViewProfile 傳給它
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="analysis-container" style={{ padding: '20px' }}>
      {/* 頂部功能導航列 */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          className={`btn-action-sm ${activeTab === 'table' ? 'active' : ''}`}
          onClick={() => setActiveTab('table')}
        >1. 分析表格</button>
        <button
          className={`btn-action-sm ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >2. 聯盟模擬器</button>
        <button
          className={`btn-action-sm ${activeTab === 'radar' ? 'active' : ''}`}
          onClick={() => setActiveTab('radar')}
        >3. 選秀雷達圖</button>
        <button
          className={`btn-action-sm ${activeTab === 'picklist' ? 'active' : ''}`}
          onClick={() => setActiveTab('picklist')}
        >4. Picks 名單順序</button>
        <button
          className={`btn-action-sm ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          style={{ backgroundColor: '#9b59b6', color: 'white' }}
        >5. 賽前情資 (TBA)</button>
      </div>

      {/* 顯示選中的分頁內容 */}
      {renderContent()}

      <style>{`
        .btn-action-sm {
          padding: 10px 20px;
          border: 1px solid #ddd;
          background: #f9f9f9;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .btn-action-sm.active {
          background-color: #3498db !important;
          color: white !important;
          border-color: #2980b9 !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .scout-card {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
      `}</style>
    </div>
  );
};

export default AnalysisPage;