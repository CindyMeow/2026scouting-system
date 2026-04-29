// AnalysisPage.js
import React, { useState, useEffect } from 'react';
// 1. ✨ 引入獨立的 CSS 檔案
import '../css/AnalysisPage.css'; 

import AnalysisTab from './AnalysisTab';
import SimulatorTab from './SimulatorTab';
import RadarTab from './RadarTab';
import PicklistTab from './PicklistTab';
import TeamHistoryTab from './TeamHistoryTab';

const AnalysisPage = ({ allTeamsData, coprData, teamsDb, assignments, onTeamClick }) => {
  const [activeTab, setActiveTab] = useState('table');
  const [alliance, setAlliance] = useState({
    red: ['', '', ''],
    blue: ['', '', '']
  });
  const [pickLists, setPickLists] = useState({
    all: [],
    watchlist: [],
    pick1: [],
    pick2: []
  });
  const [radarTeams, setRadarTeams] = useState({
    teamA: '',
    teamB: ''
  });

  useEffect(() => {
    if (allTeamsData?.teams && pickLists.all.length === 0) {
      const allNums = Object.keys(allTeamsData.teams).sort((a, b) => a - b);
      setPickLists(prev => ({ ...prev, all: allNums }));
    }
  }, [allTeamsData, pickLists.all.length]);

  const renderContent = () => {
    switch (activeTab) {
      case 'table':
        return <AnalysisTab allTeamsData={allTeamsData} coprData={coprData} teamsDb={teamsDb} onTeamClick={onTeamClick} />;
      case 'simulator':
        return <SimulatorTab allTeamsData={allTeamsData} coprData={coprData} alliance={alliance} teamsDb={teamsDb} setAlliance={setAlliance} />;
      case 'radar':
        return <RadarTab allTeamsData={allTeamsData} coprData={coprData} radarTeams={radarTeams} teamsDb={teamsDb} setRadarTeams={setRadarTeams} />;
      case 'picklist':
        return <PicklistTab allTeamsData={allTeamsData} lists={pickLists} teamsDb={teamsDb} setLists={setPickLists} />;
      case 'history':
        return <TeamHistoryTab coprData={coprData} setActiveTab={() => { }} setSelectedTeam={onTeamClick} />;
      default:
        return null;
    }
  };

  return (
    <div className="analysis-page-wrapper">
      <div className="analysis-container">
        <div className="tab-navigation">
          <button
            className={`btn-nav ${activeTab === 'table' ? 'active' : ''}`}
            onClick={() => setActiveTab('table')}
          >
            <span className="nav-num">1</span> <span className="nav-text">分析表格</span>
          </button>
          <button
            className={`btn-nav ${activeTab === 'simulator' ? 'active' : ''}`}
            onClick={() => setActiveTab('simulator')}
          >
            <span className="nav-num">2</span> <span className="nav-text">聯盟模擬器</span>
          </button>
          <button
            className={`btn-nav ${activeTab === 'radar' ? 'active' : ''}`}
            onClick={() => setActiveTab('radar')}
          >
            <span className="nav-num">3</span> <span className="nav-text">選秀雷達圖</span>
          </button>
          <button
            className={`btn-nav ${activeTab === 'picklist' ? 'active' : ''}`}
            onClick={() => setActiveTab('picklist')}
          >
            <span className="nav-num">4</span> <span className="nav-text">Picks 名單</span>
          </button>
          <button
            className={`btn-nav btn-history ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <span className="nav-num">5</span> <span className="nav-text">賽前情資</span>
          </button>
        </div>

        <div className="content-area">
          {renderContent()}
        </div>
      </div>
      {/* ✨ 內建 style 標籤已移除 */}
    </div>
  );
};

export default AnalysisPage;