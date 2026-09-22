import { emptyPicks, reconcilePicks, pickStorageKey } from '../utils/pickLists';
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
  const eventKey = allTeamsData?.eventKey;
  const [pickState, setPickState] = useState({ event: null, lists: emptyPicks(), error: '' });
  const pickLists = pickState.event === eventKey ? pickState.lists : emptyPicks();
  const setPickLists = update => setPickState(prev => {
    if (prev.event !== eventKey || !eventKey) return prev;
    const proposed = typeof update === 'function' ? update(prev.lists) : update;
    const lists = reconcilePicks(proposed, Object.keys(allTeamsData?.teams || {}));
    try { localStorage.setItem(pickStorageKey(eventKey), JSON.stringify(lists)); }
    catch { return { ...prev, lists, error: '無法儲存選秀清單，請勿關閉頁面並檢查瀏覽器儲存空間' }; }
    return { ...prev, lists, error: '' };
  });
  const [radarTeams, setRadarTeams] = useState({
    teamA: '',
    teamB: ''
  });

  useEffect(() => {
    if (!eventKey) return;
    setPickState(prev => {
      const teams = Object.keys(allTeamsData?.teams || {});
      if (prev.event === eventKey) return { ...prev, lists: reconcilePicks(prev.lists, teams) };
      try {
        const saved = JSON.parse(localStorage.getItem(pickStorageKey(eventKey)) || 'null');
        return { event: eventKey, lists: reconcilePicks(saved, teams), error: '' };
      } catch { return { event: eventKey, lists: reconcilePicks(null, teams), error: '舊選秀清單無法讀取，尚未覆寫；請先備份瀏覽器資料' }; }
    });
  }, [eventKey, allTeamsData?.teams]);

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
          {pickState.error && <p role="alert">{pickState.error}</p>}
          {renderContent()}
        </div>
      </div>
      {/* ✨ 內建 style 標籤已移除 */}
    </div>
  );
};

export default AnalysisPage;