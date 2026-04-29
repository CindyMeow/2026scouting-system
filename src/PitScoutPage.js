//PitScoutPage.js
import React, { useState, useEffect } from 'react';
import AutoPathMap from './AutoPathMap';
import './css/PitScout.css';

const PitScoutPage = () => {
  const [allTeams, setAllTeams] = useState([]); // 存放所有官方隊伍
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
  const [savedRecords, setSavedRecords] = useState([]);
  // 初始化：載入隊伍清單 (與 ScouterPage 邏輯一致)
  useEffect(() => {
    const savedTeams = localStorage.getItem('frc_teams_list');
    if (savedTeams) {
      setAllTeams(JSON.parse(savedTeams));
    }

    // 嘗試從伺服器更新
    fetch(`http://${window.location.hostname}:5000/api/data`) // 替換為你的電腦 IP
      .then(res => res.json())
      .then(data => {
        if (data.teams) {
          const teamList = Object.keys(data.teams);
          setAllTeams(teamList);
          localStorage.setItem('frc_teams_list', JSON.stringify(teamList));
        }
      })
      .catch(() => console.log("離線模式：使用緩存隊伍清單"));
  }, []);

  // 過濾符合搜尋條件的隊伍
  const filteredTeams = allTeams
    .filter(t => t.startsWith(searchTerm))
    .slice(0, 5); // 只顯示前 5 筆建議，避免遮擋螢幕

  // 1. 初始化：從本地載入已存過的紀錄
  useEffect(() => {
    const saved = localStorage.getItem('scouter_pit_temp');
    if (saved) {
      try {
        setSavedRecords(JSON.parse(saved));
      } catch (e) {
        console.error("解析本地資料失敗", e);
      }
    }
  }, []);

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
      alert(`隊伍 ${pitData.team} 資料已更新！`);
    } else {
      // 新增紀錄
      const newRecord = { ...pitData, autoPath: formattedPath, id: Date.now() };
      updatedRecords = [...savedRecords, newRecord];
      alert(`隊伍 ${pitData.team} 資料已儲存！`);
    }

    setSavedRecords(updatedRecords);
    localStorage.setItem('scouter_pit_temp', JSON.stringify(updatedRecords));
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

    try {
      // 這裡請替換成你們團隊實際的 API 網址
      const response = await fetch(`http://${window.location.hostname}:5000/api/upload-pit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
          scouter: "iPad_User_1", // 這裡可以改成 Scouter 姓名
          data: savedRecords
      })
    });

      if (response.ok) {
        alert("☁️ 所有數據已成功同步到伺服器！");
      } else {
        alert("同步失敗，伺服器回傳錯誤。");
      }
    } catch (error) {
      alert("同步時發生錯誤: " + error.message);
    }
  };
  // 單獨刪除
  const deleteRecord = (id) => {
    if (window.confirm("確定要刪除這筆隊伍資料嗎？")) {
      const updated = savedRecords.filter(r => r.id !== id);
      setSavedRecords(updated);
      localStorage.setItem('scouter_pit_temp', JSON.stringify(updated));
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