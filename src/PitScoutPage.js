import { readJson, writeJson } from './utils/api';
//PitScoutPage.js
import React, { useState, useEffect } from 'react';
import AutoPathMap from './AutoPathMap';
import './css/PitScout.css';
import { LAST_EVENT_KEY, loadStored, saveStored } from './utils/eventStorage';

const PitScoutPage = () => {
  const rememberedEvent = localStorage.getItem(LAST_EVENT_KEY) || '';
  const [context, setContext] = useState(null);
  const [eventKey, setEventKey] = useState(rememberedEvent);
  const [allTeams, setAllTeams] = useState(() => loadStored('teams', rememberedEvent, []));
  const [searchTerm, setSearchTerm] = useState(''); // 搜尋關鍵字
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // 表單初始狀態
  const initialState = {
    team: '',
    drive: ' ',
    intake: ' ',
    shooter: ' ',
    climb: 'None',
    autoPath: [],
    photo: null,
    notes: ''
  };

  const [pitData, setPitData] = useState(initialState);
  const parsePathString = (pathStr) => {
    if (!pathStr || typeof pathStr !== 'string') return [];
    return pathStr.split(';').map(p => {
      const [x, y] = p.split('-');
      return {
        x: parseFloat(x),
        y: parseFloat(y),
        type: 'path' // 重新編輯時預設設為路徑點
      };
    });
  };
  const [savedRecords, setSavedRecords] = useState(() => loadStored('pit_temp', rememberedEvent, []));
  // 初始化：載入隊伍清單 (與 ScouterPage 邏輯一致)
  useEffect(() => {
    // 嘗試從伺服器更新
    readJson('/api/data')
      .then(data => {
        setContext(data);
        setEventKey(data.eventKey);
        localStorage.setItem(LAST_EVENT_KEY, data.eventKey);
        setSavedRecords(loadStored('pit_temp', data.eventKey, []));
        if (data.teams) {
          const teamList = Object.keys(data.teams);
          setAllTeams(teamList);
          saveStored('teams', data.eventKey, teamList);
        }
      })
      .catch(() => console.log("離線模式：使用緩存隊伍清單"));
  }, []);

  // 過濾符合搜尋條件的隊伍
  const filteredTeams = allTeams
    .filter(t => t.startsWith(searchTerm))
    .slice(0, 5); // 只顯示前 5 筆建議，避免遮擋螢幕

  // 2. 處理照片並壓縮 (關鍵：防止 localStorage 爆掉)
  const handlePhotoUpdate = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // --- 壓縮邏輯 ---
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800; // 限制寬度在 800px 以內
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // 轉成較小的 base64 字串 (使用 JPEG 格式並設定品質 0.7)
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setPitData({ ...pitData, photo: compressedBase64 });
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // 3. 儲存單筆紀錄到本地列表
  const saveToLocal = () => {
    if (!pitData.team) return alert("請輸入隊伍編號！");
    if (!eventKey) return alert('尚未載入賽事，請先連線一次再儲存');

    let formattedPath = "";
    if (Array.isArray(pitData.autoPath) && pitData.autoPath.length > 0) {
      formattedPath = pitData.autoPath.map(p => `${p.x.toFixed(1)}-${p.y.toFixed(1)}`).join(';');
    }

    let updatedRecords;
    if (editingId) {
      // 更新現有紀錄
      updatedRecords = savedRecords.map(r =>
        r.id === editingId ? { ...pitData, autoPath: formattedPath, id: editingId } : r
      );
    } else {
      // 新增紀錄
      const newRecord = { ...pitData, eventKey: eventKey || null, autoPath: formattedPath, id: Date.now() };
      updatedRecords = [...savedRecords, newRecord];
    }

    try {
      saveStored('pit_temp', eventKey, updatedRecords);
    } catch (error) {
      return alert(`本機儲存失敗：${error.message}。照片可能過大，請先匯出既有資料。`);
    }
    setSavedRecords(updatedRecords);
    alert(`隊伍 ${pitData.team} 資料已${editingId ? '更新' : '儲存'}！`);
    setPitData(initialState);
    setEditingId(null);
    setSearchTerm('');
  };

  // 4. 導出 JSON 檔案 (離線方案 - 推薦在場館使用)
  const exportToJson = () => {
    if (savedRecords.length === 0) return alert("目前沒有資料可以導出。");

    const dataStr = JSON.stringify(savedRecords, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const fileName = `PitData_Export_${new Date().toISOString().slice(0, 10)}.json`;

    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', fileName);
    link.click();
  };

  // 5. 上傳到雲端 (有網方案 - 回飯店後使用)
  const uploadToServer = async () => {
    if (!navigator.onLine) return alert("目前沒有網路連線！請連上區網後再同步。");
    if (savedRecords.length === 0) return alert("沒有資料需要上傳。");
    if (!context) return alert('請先連線載入目前賽事');
    if (savedRecords.some(r => r.eventKey && r.eventKey !== context.eventKey)) return alert('暫存紀錄包含其他賽事，請先匯出保存並切換到正確賽事');
    if (savedRecords.some(r => !r.eventKey) && !window.confirm(`舊紀錄未標示賽事，確認這些紀錄全部屬於 ${context.eventKey}？`)) return;

    try {
      const records = savedRecords.map(r => ({ ...r, eventKey: r.eventKey || context.eventKey }));
      await writeJson('/api/upload-pit', { scouter: 'iPad_User_1', data: records }, context);
      setSavedRecords(records);
      saveStored('pit_temp', context.eventKey, records);
      setContext(null);
      try { setContext(await readJson('/api/data')); }
      catch { alert('資料已上傳，請重新整理以載入新版本'); return; }
      alert('☁️ 所有數據已成功同步到伺服器！');
    } catch (error) {
      alert("同步時發生錯誤: " + error.message);
    }
  };
  // 單獨刪除
  const deleteRecord = (id) => {
    if (window.confirm("確定要刪除這筆隊伍資料嗎？")) {
      const updated = savedRecords.filter(r => r.id !== id);
      setSavedRecords(updated);
      saveStored('pit_temp', eventKey, updated);
    }
  };

  // 進入編輯模式
const startEdit = (record) => {
    setEditingId(record.id);
    
    // 將字串轉回陣列格式
    const decodedPath = parsePathString(record.autoPath);
    
    setPitData({
      ...record,
      autoPath: decodedPath // 這裡存入的是 Array [{x, y, type}, ...]
    });
    
    setSearchTerm(record.team);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 取消編輯
  const cancelEdit = () => {
    setEditingId(null);
    setPitData(initialState);
    setSearchTerm('');
  };

  return (
    <div className="pit-container">
      <h2 className="pit-title">🛠️ Pit Scouting 機器勘查</h2>

      {editingId && (
        <div className="edit-banner">
          ⚠️ 正在編輯 Team {pitData.team}
          <button onClick={() => { setEditingId(null); setPitData(initialState); setSearchTerm(''); }} 
                  style={{ marginLeft: '10px', color: '#856404', background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}>
            取消編輯
          </button>
        </div>
      )}

      {/* 隊伍基本資訊 */}
      <div className="pit-card">
        <label className="pit-label">隊伍編號 (Team Number)</label>
        <div style={{ position: 'relative' }}>
          <input
            className="pit-input"
            style={{ 
              borderColor: allTeams.includes(pitData.team) ? '#4CAF50' : '#ddd',
              backgroundColor: allTeams.includes(pitData.team) ? '#f0fff4' : '#fff'
            }}
            type="number"
            value={pitData.team}
            onFocus={() => setShowSuggestions(true)}
            onChange={e => { setSearchTerm(e.target.value); setPitData({ ...pitData, team: e.target.value }); }}
          />
          {showSuggestions && searchTerm && !allTeams.includes(searchTerm) && (
            <div className="suggestion-box">
              {filteredTeams.map(t => (
                <div key={t} className="suggestion-item" onClick={() => { setPitData({ ...pitData, team: t }); setSearchTerm(t); setShowSuggestions(false); }}>
                  🚀 Team {t}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 照片 */}
      <div className="pit-card">
        <label className="pit-label">機型照片</label>
        <div className="photo-container">
          <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpdate} />
          {pitData.photo && <img src={pitData.photo} className="photo-preview" alt="Preview" />}
        </div>
      </div>

      {/* 規格 */}
      <div className="pit-card">
        <label className="pit-label">底盤種類（Chassis）</label>
        <div className="pit-button-group">
          {['Swerve', 'KOP', 'Mecanum', 'Other'].map(type => (
            <button key={type} className="pit-option-btn"
              style={{ backgroundColor: pitData.drive === type ? '#4CAF50' : '#eee', color: pitData.drive === type ? '#fff' : '#333' }}
              onClick={() => setPitData({ ...pitData, drive: type })}>{type}</button>
          ))}
        </div>
      </div>
      {/* --- 新增：Intake 種類 --- */}
      <div className="pit-card">
        <label className="pit-label">吸取機構 (Intake)</label>
        <div className="pit-button-group">
          {['Over Bumper', 'Under Bumper', 'Other', 'None'].map(type => (
            <button key={type} className="pit-option-btn"
              style={{ backgroundColor: pitData.intake === type ? '#FF9800' : '#eee', color: pitData.intake === type ? '#fff' : '#333' }}
              onClick={() => setPitData({ ...pitData, intake: type })}>{type}</button>
          ))}
        </div>
      </div>

      {/* --- 新增：Shooter 種類 --- */}
      <div className="pit-card">
        <label className="pit-label">發射機構 (Shooter)</label>
        <div className="pit-button-group">
          {['Single', 'Double', 'Linear', 'Other'].map(type => (
            <button key={type} className="pit-option-btn"
              style={{ backgroundColor: pitData.shooter === type ? '#9C27B0' : '#eee', color: pitData.shooter === type ? '#fff' : '#333' }}
              onClick={() => setPitData({ ...pitData, shooter: type })}>{type}</button>
          ))}
        </div>
      </div>

      {/* --- 新增：Climb 種類 --- */}
      <div className="pit-card">
        <label className="pit-label">爬升能力 (Climb)</label>
        <div className="pit-button-group">
          {['None', 'Level1', 'Level2', 'Level3'].map(type => (
            <button key={type} className="pit-option-btn"
              style={{ backgroundColor: pitData.climb === type ? '#2196F3' : '#eee', color: pitData.climb === type ? '#fff' : '#333' }}
              onClick={() => setPitData({ ...pitData, climb: type })}>{type}</button>
          ))}
        </div>
      </div>

      {/* 自動路徑 */}
      <div className="pit-card">
        <label className="pit-label">預計 Auto 路徑（Expected auto path）</label>
        <AutoPathMap 
    initialPath={pitData.autoPath} 
    onPathUpdate={(path) => setPitData({ ...pitData, autoPath: path })} 
    mode="path" 
    station="Pit" 
  />
      </div>

      {/* 備註與儲存 */}
      <div className="pit-card">
        <label className="pit-label">觀察備註</label>
        <textarea className="pit-textarea" value={pitData.notes} onChange={e => setPitData({ ...pitData, notes: e.target.value })} />
      </div>

      <button className="save-btn" style={{ backgroundColor: editingId ? '#2196F3' : '#4CAF50' }} onClick={saveToLocal}>
        {editingId ? "🆙 更新隊伍資料" : "💾 儲存這台機器資料"}
      </button>

      {/* 管理面板 */}
      <div className="pit-card" style={{ border: '2px solid #2196F3', backgroundColor: '#e3f2fd', marginTop: '20px' }}>
        <h3>📊 數據管理面板 ({savedRecords.length})</h3>
        <div className="button-row">
          <button className="export-btn" onClick={exportToJson}>📥 導出 JSON</button>
          <button className="sync-btn" onClick={uploadToServer}>☁️ 同步雲端</button>
        </div>
        
        <div style={{ marginTop: '15px' }}>
          <h4>📂 已存隊伍清單</h4>
          {savedRecords.map(record => (
            <div key={record.id} className="record-item">
              <strong>Team {record.team}</strong>
              <div>
                <button className="edit-btn" onClick={() => startEdit(record)}>✏️</button>
                <button className="del-btn" onClick={() => deleteRecord(record.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PitScoutPage;
