import React, { useState, useMemo } from 'react';

const PicklistTab = ({ allTeamsData, lists, setLists }) => {
  const [searchTerm, setSearchTerm] = useState("");

  // --- 拖放邏輯 ---
  const onDragStart = (e, team, sourceList) => {
    e.dataTransfer.setData("team", team);
    e.dataTransfer.setData("source", sourceList);
  };

  const onDrop = (e, targetList) => {
    const team = e.dataTransfer.getData("team");
    const source = e.dataTransfer.getData("source");

    if (source === targetList) return;

    setLists(prev => {
      const newSourceList = prev[source].filter(t => t !== team);
      const newTargetList = [...prev[targetList], team];
      return { ...prev, [source]: newSourceList, [targetList]: newTargetList };
    });
  };

  const moveItem = (team, source, target) => {
    setLists(prev => ({
      ...prev,
      [source]: prev[source].filter(t => t !== team),
      [target]: [...prev[target], team]
    }));
  };

  const shiftOrder = (listKey, index, direction) => {
    const newList = [...lists[listKey]];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
    setLists({ ...lists, [listKey]: newList });
  };

  // 篩選「所有隊伍」
  const filteredAll = lists.all.filter(t => t.includes(searchTerm));

  // --- 子元件：渲染列表卡片 ---
  const TeamCard = ({ team, listKey, index }) => (
    <div 
      className="pick-card" 
      draggable 
      onDragStart={(e) => onDragStart(e, team, listKey)}
    >
      <span className="team-num">#{team}</span>
      <div className="card-controls">
        {listKey !== 'all' && (
          <>
            <button onClick={() => shiftOrder(listKey, index, -1)}>↑</button>
            <button onClick={() => shiftOrder(listKey, index, 1)}>↓</button>
            <button className="del-btn" onClick={() => moveItem(team, listKey, 'all')}>✕</button>
          </>
        )}
        {listKey === 'all' && (
          <button onClick={() => moveItem(team, 'all', 'watchlist')}>Add</button>
        )}
      </div>
    </div>
  );

  return (
    <div className="picklist-container">
      {/* 區塊 A: 所有隊伍 */}
      <div className="list-column all-teams" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'all')}>
        <h3>📦 所有隊伍庫</h3>
        <input 
          type="text" 
          placeholder="搜尋隊伍..." 
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="scroll-area">
          {filteredAll.map(t => <TeamCard key={t} team={t} listKey="all" />)}
        </div>
      </div>

      {/* 區塊 B: 候選區 */}
      <div className="list-column watchlist" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'watchlist')}>
        <h3>👀 候選區 (Watch)</h3>
        <div className="scroll-area">
          {lists.watchlist.map((t, i) => <TeamCard key={t} team={t} listKey="watchlist" index={i} />)}
          {lists.watchlist.length === 0 && <p className="placeholder">拖放隊伍至此...</p>}
        </div>
      </div>

      {/* 區塊 C: 正式排序區 */}
      <div className="list-column pick-final">
        <div className="sub-column" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'pick1')}>
          <h3 className="pick1-header">🥇 Pick 1 (Scoring)</h3>
          <div className="scroll-area">
            {lists.pick1.map((t, i) => <TeamCard key={t} team={t} listKey="pick1" index={i} />)}
          </div>
        </div>
        <div className="sub-column" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, 'pick2')}>
          <h3 className="pick2-header">🛡️ Pick 2 (Defense)</h3>
          <div className="scroll-area">
            {lists.pick2.map((t, i) => <TeamCard key={t} team={t} listKey="pick2" index={i} />)}
          </div>
        </div>
      </div>

      <style>{`
        .picklist-container { display: flex; gap: 15px; height: 75vh; align-items: flex-start; }
        .list-column { flex: 1; background: #f4f7f6; border-radius: 12px; display: flex; flex-direction: column; height: 100%; border: 1px solid #ddd; }
        .pick-final { flex: 2; display: flex; gap: 10px; background: none; border: none; }
        .sub-column { flex: 1; background: #fff; border-radius: 12px; border: 2px solid #eee; display: flex; flex-direction: column; }
        
        h3 { padding: 15px; margin: 0; font-size: 16px; border-bottom: 1px solid #eee; }
        .pick1-header { color: #d35400; border-bottom: 3px solid #e67e22; }
        .pick2-header { color: #2980b9; border-bottom: 3px solid #3498db; }
        
        .scroll-area { flex: 1; overflow-y: auto; padding: 10px; min-height: 200px; }
        .search-input { margin: 10px; padding: 8px; border-radius: 6px; border: 1px solid #ddd; }
        
        .pick-card { 
          background: white; padding: 12px; margin-bottom: 8px; border-radius: 8px; 
          box-shadow: 0 2px 5px rgba(0,0,0,0.05); display: flex; justify-content: space-between; 
          align-items: center; cursor: grab; border: 1px solid #eee;
        }
        .pick-card:active { cursor: grabbing; border-color: #3498db; }
        .team-num { font-weight: bold; font-size: 16px; }
        
        .card-controls button { margin-left: 4px; padding: 2px 6px; cursor: pointer; border: 1px solid #ddd; background: #fff; border-radius: 4px; }
        .del-btn { color: #e74c3c; border-color: #fab1a0; }
        .placeholder { color: #bbb; text-align: center; margin-top: 50px; font-style: italic; }
      `}</style>
    </div>
  );
};

export default PicklistTab;