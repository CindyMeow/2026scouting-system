//ScouterPage.js
import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import AutoPathMap from './AutoPathMap';
import './css/ScouterPage.css';
const compressPath = (pathPoints, shotPoints) => {
  // 將所有點轉為 2 位數格式，並直接串接
  // 範例: [{x:10, y:5}] -> "1005"
  const encodePoints = (points) => {
    return (points || [])
      .map(p => {
        // 確保座標為 2 位數 (00-99)
        const xStr = String(Math.max(0, Math.min(99, p.x))).padStart(2, '0');
        const yStr = String(Math.max(0, Math.min(99, p.y))).padStart(2, '0');
        return `${xStr}${yStr}`;
      })
      .join(''); // ✨ 不使用分隔符號
  };

  const pStr = encodePoints(pathPoints);
  const sStr = encodePoints(shotPoints);

  // 用簡單的符號分隔路徑與射球點
  return `P${pStr}_S${sStr}`;
};

const ScouterPage = () => {

  const [autoClimbLevel, setAutoClimbLevel] = useState(0); // Auto 吊掛
  const [isClimbTimerRunning, setIsClimbTimerRunning] = useState(false); // 攀爬計時開關
  const [climbStart, setClimbStart] = useState(null); // 攀爬開始時間
  // --- 基礎資訊 ---
  const [matchInfo, setMatchInfo] = useState({
    match: '', // 預設留空，等 useEffect 載入 schedule 後自動填入第一場
    team: '',
    station: localStorage.getItem('scouterStation') || 'Red 1'
  });


  const [schedule, setSchedule] = useState({});
  // --- 2. 初始化：從 localStorage 載入賽程 ---
  useEffect(() => {
    // 優先讀取本地緩存，確保斷網可用
    const savedSchedule = localStorage.getItem('frc_schedule');
    if (savedSchedule) {
      setSchedule(JSON.parse(savedSchedule));
    }

    // 如果目前有網路，順便更新一次最新的賽程
    fetch(`http://${window.location.hostname}:5000/api/data`)
      .then(res => res.json())
      .then(data => {
        if (data.schedule) {
          setSchedule(data.schedule);
          localStorage.setItem('frc_schedule', JSON.stringify(data.schedule));
        }
      })
      .catch(err => console.log("離線模式：使用緩存賽程"));
  }, []);


  // --- 3. 自動連動邏輯 (相容 CSV 與 TBA 格式) ---
  useEffect(() => {
    const m = matchInfo.match;
    const s = matchInfo.station; // 例如 "Red 1"

    if (schedule && schedule[m]) {
      const matchData = schedule[m];
      const alliance = s.split(' ')[0].toLowerCase(); // "red"
      const posNum = s.split(' ')[1];                 // "1"

      let autoTeam = "";

      // 1. 檢查 CSV 格式 (具有 red1, red2, blue1... 欄位)
      const csvKey = `${alliance}${posNum}`;
      if (matchData[csvKey]) {
        autoTeam = matchData[csvKey];
      }
      // 2. 檢查 TBA/自定義陣列格式 (具有 red: [], blue: [] 欄位)
      else if (Array.isArray(matchData[alliance])) {
        const idx = parseInt(posNum) - 1;
        autoTeam = matchData[alliance][idx];
      }

      // 如果有抓到隊伍，且與目前顯示的不同，才更新 (避免無限迴圈)
      if (autoTeam && String(autoTeam) !== String(matchInfo.team)) {
        setMatchInfo(prev => ({ ...prev, team: String(autoTeam) }));
      }
    }
  }, [matchInfo.match, matchInfo.station, schedule]);
  // 新增一個 useEffect：當 schedule 載入後，自動選定第一場比賽
  useEffect(() => {
    if (Object.keys(schedule).length > 0 && !matchInfo.match) {
      // 取得排序後的第一個 Key
      const firstMatchKey = Object.entries(schedule).sort(([ka, a], [kb, b]) => {
        const weights = { pt: 0, qm: 1, sf: 2, f: 3 };
        if (weights[a.comp_level] !== weights[b.comp_level]) return weights[a.comp_level] - weights[b.comp_level];
        return (a.match_number || 0) - (b.match_number || 0);
      })[0][0];

      setMatchInfo(prev => ({ ...prev, match: firstMatchKey }));
    }
  }, [schedule]);

  // 保存 Station 設定到本地
  const handleStationChange = (val) => {
    setMatchInfo({ ...matchInfo, station: val });
    localStorage.setItem('scouterStation', val);
  };

  // --- Auto 階段 ---
  const [autoPath, setAutoPath] = useState([]);
  const [autoSuccess, setAutoSuccess] = useState(false);
  const [mapMode, setMapMode] = useState('path'); // 'path' 或 'shot'
  const [autoFuel, setAutoFuel] = useState(0); // 新增：Auto 階段 Fuel 分數
  const [autoCycles, setAutoCycles] = useState([]); // 新增：Auto 階段得分 Cycle

  // --- Teleop 階段 ---
  const [fuelH, setFuelH] = useState(0);
  const [missed, setMissed] = useState(0);
  const [cycles, setCycles] = useState([]);
  const [timerActive, setTimerActive] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [shotLocations, setShotLocations] = useState([]);

  const [currentLoad, setCurrentLoad] = useState(2); // 預設 2 (中量)
  const loadLevels = [
    { label: '少量', value: 3, color: '#81C784' },
    { label: '中量', value: 8, color: '#4CAF50' },
    { label: '大量', value: 15, color: '#2E7D32' }
  ];

  // --- Endgame 階段 ---
  const [climbLevel, setClimbLevel] = useState(0); // 0, 1, 2, 3
  const [climbTime, setClimbTime] = useState("");

  // --- 評價與標記 ---
  const [tags, setTags] = useState({ broken: false, sturdy: false, intake: false, defended: false });
  const [ratings, setRatings] = useState({ driver: 3, defense: 3, stability: 3 });

  const [showQR, setShowQR] = useState(false);


  const handleClimbTimer = () => {
    if (!isClimbTimerRunning) {
      setClimbStart(Date.now());
      setIsClimbTimerRunning(true);
    } else {
      const duration = ((Date.now() - climbStart) / 1000).toFixed(1);
      setClimbTime(duration);
      setIsClimbTimerRunning(false);
    }
  };

  // --- 邏輯計算 ---
  const handleCycleTimer = () => {
    if (!timerActive) {
      setStartTime(Date.now());
      setTimerActive(true);
    } else {
      const duration = (Date.now() - startTime) / 1000;
      const estimatedAdded = loadLevels[currentLoad].value;

      setCycles([...cycles, { time: duration, load: estimatedAdded }]);
      setFuelH(fuelH + estimatedAdded); // 依據載彈量推估加分
      setTimerActive(false);
    }
  };

  const avgCycle = cycles.length > 0
    ? (cycles.reduce((a, b) => a + b.time, 0) / cycles.length).toFixed(1)
    : 0;
  // 預估總分 (假設 2026 權重:  AutoFuel 1, TeleFuel 1, ClimbL3 15)
  const estimatedScore = (autoFuel * 1) + (fuelH * 1) + (climbLevel * 15);
  const currentMatchData = schedule[matchInfo.match] || {};
  const compLevel = currentMatchData.comp_level || 'qm';
  const matchNum = currentMatchData.match_number || matchInfo.match;

  const matchDisplay = isNaN(matchInfo.match)
    ? matchInfo.match                      // 如果是字串 (如 qm1)，直接傳
    : (Number(matchInfo.match) || 0) + 1;  // 如果是純數字(索引)，則加 1

  // 數據打包 (CSV 格式) - 重要：加入 autoFuel 在第 6 個位置
  const compressedData = [
    matchNum,
    matchInfo.team,
    matchInfo.station,
    autoSuccess ? 1 : 0,
    compressPath(autoPath, shotLocations),
    autoFuel,
    autoClimbLevel,
    fuelH,
    missed,
    avgCycle,
    climbLevel,
    climbTime,
    Object.values(tags).map(v => v ? 1 : 0).join(''),
    Object.values(ratings).join(','),
    compLevel
  ].join('|');

  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(compressedData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      alert("複製失敗，請手動選取文字。");
    });
  };
  return (
    <div className="scouter-container">
      <h2 className="scouter-header">2026 Scouter 工作台</h2>

      {/* 基礎資訊卡片 */}
      <div className="scouter-card">
        <div className="scouter-row">
          <div>
            <select
              className="scouter-input"
              value={matchInfo.match}
              onChange={e => setMatchInfo({ ...matchInfo, match: e.target.value })}
            >
              {Object.keys(schedule).length > 0
                ? Object.entries(schedule)
                  // 🏆 排序邏輯：QM -> SF -> F
                  .sort(([keyA, a], [keyB, b]) => {
                    const weights = { qm: 1, sf: 2, f: 3 };
                    const levelA = a.comp_level || 'qm';
                    const levelB = b.comp_level || 'qm';

                    if (weights[levelA] !== weights[levelB]) {
                      return weights[levelA] - weights[levelB];
                    }
                    // 同階段比場次編號
                    return (a.match_number || 0) - (b.match_number || 0);
                  })
                  .map(([mKey, mData]) => {
                    // 🏆 顯示標籤邏輯
                    const level = mData.comp_level || 'qm';
                    const mNum = mData.match_number || mData.match || mKey;
                    const displayLabel =
                      level === 'pt' ? `P${mNum}` :   // Practice 顯示 P1, P2...
                        level === 'qm' ? `Q${mNum}` :
                          level === 'sf' ? `SF${mData.set_number || mNum}` :
                            `F${mNum}`;

                    return (
                      <option key={mKey} value={mKey}>
                        {displayLabel}
                      </option>
                    );
                  })
                : // 若無賽程，預設顯示 Q1-Q100
                Array.from({ length: 100 }, (_, i) => {
                  const val = String(i + 1);
                  return <option key={val} value={val}>Q{val}</option>;
                })
              }
            </select>
          </div>
          <div>
            <input
              className="scouter-input"
              style={{ backgroundColor: '#fff9db', fontWeight: 'bold' }} // 少數動態背景顏色可保留
              type="number"
              value={matchInfo.team}
              placeholder="隊伍"
              onChange={e => setMatchInfo({ ...matchInfo, team: e.target.value })}
            />
          </div>
          <div>
            <select
              className="scouter-input"
              style={{ color: matchInfo.station.startsWith('Red') ? '#e53e3e' : '#3182ce' }}
              value={matchInfo.station}
              onChange={e => handleStationChange(e.target.value)}
            >
              <option>Red 1</option><option>Red 2</option><option>Red 3</option>
              <option>Blue 1</option><option>Blue 2</option><option>Blue 3</option>
            </select>
          </div>
        </div>
      </div>

      {/* Auto 區 */}
      <div className="scouter-card">
        <h3>Autonomous</h3>
        <AutoPathMap
          onPathUpdate={(newPoints) => {
            const paths = newPoints.filter(p => p.type === 'path');
            const shots = newPoints.filter(p => p.type === 'shot');
            setAutoPath(paths);
            setShotLocations(shots);
          }}
          mode={mapMode}
          station={matchInfo.station}
        />

        <p style={{ fontSize: '14px', color: '#666' }}>1. 選擇預計載彈量：</p>
        <div className="scouter-row" style={{ marginBottom: '15px' }}>
          {loadLevels.map((lvl, idx) => (
            <button
              key={lvl.label}
              className="scouter-level-btn"
              style={{
                backgroundColor: currentLoad === idx ? lvl.color : '#eee',
                color: currentLoad === idx ? 'white' : '#333'
              }}
              onClick={() => setCurrentLoad(idx)}
            >
              {lvl.label} (~{lvl.value})
            </button>
          ))}
        </div>


        {/* 修正：Auto 統計區塊 */}
        <div className="scouter-row" style={{ marginTop: '15px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '10px' }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '13px' }}>已完成: <strong>{autoCycles.length}</strong> 次 | 推估 Auto Fuel</p>
            <h2 style={{ margin: 0, color: '#2196F3' }}>{autoFuel}</h2>
          </div>
          {/* 加入手動補錄，以防萬一 */}
          <div className="scouter-counter-box" style={{ marginTop: '15px' }}>
            <p>Auto Fuel: <strong style={{ fontSize: '22px', color: '#2196F3' }}>{autoFuel}</strong></p>
            <div className="scouter-row" style={{ gap: '8px' }}>
              {/* 第一組：單位 1 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button className="scouter-plus-btn" style={{ backgroundColor: '#feb2b2', color: '#9b2c2c', height: '35px', marginBottom: 0 }} onClick={() => setAutoFuel(prev => Math.max(0, prev - 1))}>-1</button>
                <button className="scouter-plus-btn" style={{ height: '50px' }} onClick={() => setAutoFuel(prev => prev + 1)}>+1</button>
              </div>

              {/* 第二組：動態等級 (根據選中的少量/中量/大量) */}
              <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button className="scouter-plus-btn" style={{ backgroundColor: '#fbd38d', color: '#7b341e', height: '35px', marginBottom: 0 }} onClick={() => setAutoFuel(prev => Math.max(0, prev - loadLevels[currentLoad].value))}>
                  取消等級 (-{loadLevels[currentLoad].value})
                </button>
                <button className="scouter-plus-btn" style={{ backgroundColor: '#4CAF50', height: '50px' }} onClick={() => setAutoFuel(prev => prev + loadLevels[currentLoad].value)}>
                  完成一趟 (+{loadLevels[currentLoad].value})
                </button>
              </div>
            </div>
          </div>

        </div>
        <p>Auto Climb Level:</p>
        <div className="scouter-row">
          {[0, 1, 2, 3].map(lvl => (
            <button key={lvl} onClick={() => setAutoClimbLevel(lvl)}
              className="scouter-level-btn"
              style={{ backgroundColor: autoClimbLevel === lvl ? '#4CAF50' : '#eee' }}>L{lvl}</button>
          ))}
        </div>
        <label className="scouter-checkbox-label">
          <input type="checkbox" checked={autoSuccess} onChange={e => setAutoSuccess(e.target.checked)} /> Auto 任務完成
        </label>
      </div>

      {/* Teleop 區 */}
      <div className="scouter-card">
        <h3>Teleoperated</h3>
        {/* 新增：讓 Scouter 決定這一趟載了多少球 */}
        <p style={{ fontSize: '14px', color: '#666' }}>1. 選擇載彈等級：</p>
        <div className="scouter-row" style={{ marginBottom: '15px' }}>
          {loadLevels.map((lvl, idx) => (
            <button
              key={lvl.label}
              className="scouter-level-btn"
              style={{
                backgroundColor: currentLoad === idx ? lvl.color : '#eee',
                color: currentLoad === idx ? 'white' : '#333'
              }}
              onClick={() => setCurrentLoad(idx)}
            >
              {lvl.label}
            </button>
          ))}
        </div>
        <div className="scouter-timer-box">
          <p>平均 Cycle: <strong>{avgCycle}s</strong></p>
          <button
            className="scouter-cycle-btn"
            style={{ backgroundColor: timerActive ? '#ff5722' : '#2196F3' }}
            onClick={handleCycleTimer}
          >
            {timerActive ? "完成射球 (Stop)" : "開始載彈 (Start)"}
          </button>
        </div>
        <div className="scouter-counter">
          <p>推估 Fuel: <strong style={{ fontSize: '22px' }}>{fuelH}</strong></p>
          <div className="scouter-row" style={{ gap: '8px' }}>
            {/* 單位 1 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button className="scouter-plus-btn" style={{ backgroundColor: '#feb2b2', color: '#9b2c2c', height: '35px', marginBottom: 0 }} onClick={() => setFuelH(prev => Math.max(0, prev - 1))}>-1</button>
              <button className="scouter-plus-btn" style={{ height: '50px' }} onClick={() => setFuelH(prev => prev + 1)}>+1</button>
            </div>

            {/* 單位 5 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button className="scouter-plus-btn" style={{ backgroundColor: '#fbd38d', color: '#7b341e', height: '35px', marginBottom: 0 }} onClick={() => setFuelH(prev => Math.max(0, prev - 5))}>-5</button>
              <button className="scouter-plus-btn" style={{ backgroundColor: '#FF9800', height: '50px' }} onClick={() => setFuelH(prev => prev + 5)}>+5</button>
            </div>

            {/* 單位 10 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button className="scouter-plus-btn" style={{ backgroundColor: '#fed7d7', color: '#822727', height: '35px', marginBottom: 0 }} onClick={() => setFuelH(prev => Math.max(0, prev - 10))}>-10</button>
              <button className="scouter-plus-btn" style={{ backgroundColor: '#E65100', height: '50px' }} onClick={() => setFuelH(prev => prev + 10)}>+10</button>
            </div>
          </div>
        </div>
      </div>

      {/* Endgame 區 */}
      <div className="scouter-card">
        <h3>Endgame</h3>
        <p>Climb Level:</p>
        <div className="scouter-row">
          {[0, 1, 2, 3].map(lvl => (
            <button key={lvl} onClick={() => setClimbLevel(lvl)}
              className="scouter-level-btn"
              style={{ backgroundColor: climbLevel === lvl ? '#FFC107' : '#eee' }}>L{lvl}</button>
          ))}
        </div>
        <div className="scouter-timer-box">
          <p>攀爬秒數: <strong>{climbTime}s</strong></p>
          <button
            className="scouter-cycle-btn"
            style={{ backgroundColor: isClimbTimerRunning ? '#f44336' : '#607D8B' }}
            onClick={handleClimbTimer}
          >
            {isClimbTimerRunning ? "停止計時" : "開始攀爬計時"}
          </button>
        </div>
      </div>

      {/* 評分與標記 */}
      <div className="scouter-card">
        <h3>Quick Tags & Rating</h3>
        <div className="scouter-tag-grid">
          {Object.keys(tags).map(tag => (
            <button key={tag} onClick={() => setTags({ ...tags, [tag]: !tags[tag] })}
              className="scouter-tag-btn"
              style={{ backgroundColor: tags[tag] ? '#673AB7' : '#eee', color: tags[tag] ? 'white' : 'black' }}>
              {tag === 'broken' ? '掉零件' : tag === 'sturdy' ? '很耐撞' : tag === 'intake' ? '撿料順' : '被守死'}
            </button>
          ))}
        </div>
        {Object.keys(ratings).map(r => {
          // 定義等級 1~5 的顏色漸層 (紅 -> 橙 -> 黃 -> 淺綠 -> 深綠)
          const colors = ['#e53e3e', '#dd6b20', '#d69e2e', '#68d391', '#38a169'];

          return (
            <div key={r} style={{ margin: '20px 0', textAlign: 'left' }}>
              <label style={{ fontWeight: 'bold', fontSize: '15px' }}>
                {r === 'driver' ? '👤 駕駛技術' : r === 'defense' ? '🛡️ 防守能力' : '🤖 機器穩定度'}:
                <span style={{ marginLeft: '10px', color: colors[ratings[r] - 1], fontSize: '18px' }}>
                  Level {ratings[r]}
                </span>
              </label>

              <div className="rating-group">
                {[1, 2, 3, 4, 5].map(lvl => (
                  <button
                    key={lvl}
                    className={`rating-btn ${ratings[r] === lvl ? 'active' : ''}`}
                    style={{
                      backgroundColor: ratings[r] === lvl ? colors[lvl - 1] : '#eee',
                      color: ratings[r] === lvl ? '#fff' : '#666'
                    }}
                    onClick={() => setRatings({ ...ratings, [r]: lvl })}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部懸浮欄 */}
      <footer className="scouter-footer">
        <div style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: '14px' }}>預計總分</p>
          <h2 style={{ margin: 0, color: '#f44336' }}>{estimatedScore}</h2>
        </div>
        <button className="scouter-submit-btn" onClick={() => setShowQR(true)}>生成 QR Code</button>
      </footer>

      {/* QR Code 彈窗 */}
      {showQR && (
        <div className="scouter-overlay" onClick={() => { setShowQR(false); setCopied(false); }}>
          <div className="scouter-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>數據生成成功</h3>
            <div style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '10px', display: 'inline-block' }}>
              <QRCodeCanvas value={compressedData} size={280} level="M" includeMargin={true} />
            </div>
            <p className="scouter-data-text">{compressedData}</p>
            <div className="scouter-row" style={{ marginTop: '15px' }}>
              <button
                className="scouter-copy-btn"
                style={{ backgroundColor: copied ? '#4CAF50' : '#2196F3' }}
                onClick={copyToClipboard}
              >
                {copied ? "✅ 已複製" : "📋 複製字串"}
              </button>
              <button className="scouter-close-btn" onClick={() => { setShowQR(false); setCopied(false); }}>
                返回修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ScouterPage;