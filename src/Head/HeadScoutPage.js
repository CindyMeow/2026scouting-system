import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useScoutData } from '../hooks/useScoutData';
import { parseQrData } from '../utils/dataParser';

// 導入分頁組件
import ImportTab from './import';
import PitViewTab from './pitView';
import MatchVerifyTab from './matchVerify';
import ProfileTab from './profile';
import ScheduleTab from './scheduleTab';
import AssignmentTab from './assignmentTab';

import '../css/HeadScout.css';

const HeadScoutPage = ({ teams: tbaTeams, setTeams, externalTeam }) => {
  // 1. 使用自定義 Hook 管理數據與同步
  const {
    matchData,
    pitData,
    schedule,
    updateMatchData,
    updatePitData,
    updateSchedule,
    handleSyncOfficial
  } = useScoutData();


  // 2. 定義 handleFileImport (處理 CSV 匯入並同步至後端)
  const handleFileImport = async (data) => {
    if (!data || (Array.isArray(data) && data.length === 0)) return;

    try {
      let endpoint = '';
      let payload = {};

      // 1. 判定資料類型
      // 判定是否為賽程 (CSV 轉過來的或是官方賽程)
      const isSchedule = data[0]?.match || data[0]?.match_key || data[0]?.red1;

      // 判定是否為 Pit 資料 (通常 JSON 格式會有 'drive' 或 'autoPath' 等欄位)
      const isPit = data[0]?.drive || data[0]?.photo || data[0]?.confidence;

      if (isSchedule) {
        endpoint = '/api/save-schedule';
        payload = { schedule: data };
      } else if (isPit) {
        endpoint = '/api/save-pit';  // ✨ 補上 Pit 的路徑
        payload = { pitData: data };
      } else {
        endpoint = '/api/save-teams';
        payload = { teams: data };
      }

      console.log(`📡 正在發送數據到: ${endpoint}`, data);

      const response = await fetch(`http://${window.location.hostname}:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        if (isSchedule) {
          updateSchedule(data);
          alert(`🗓️ 成功匯入 ${data.length} 場賽程`);
        } else if (isPit) {
          updatePitData(data); // 更新 Hook 裡的狀態
          alert(`🛠️ 成功匯入 ${data.length} 筆 Pit 數據`);
        } else {
          setTeams(data);
          alert(`✅ 成功匯入 ${data.length} 支隊伍官方資料`);
        }
      } else {
        const errText = await response.text();
        alert(`❌ 伺服器儲存失敗 (狀態碼: ${response.status})\n路徑: ${endpoint}`);
      }
    } catch (err) {
      console.error("Import error:", err);
      alert("匯入過程中發生錯誤，請檢查後端是否已啟動或 API 路徑是否正確");
    }
  };

  // 3. UI 狀態管理
  const [activeSubTab, setActiveSubTab] = useState('import');
  const [qrInput, setQrInput] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [pendingPitData, setPendingPitData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const canvasRef = useRef(null);
  const modalCanvasRef = useRef(null);

  // 4. 處理外部跳轉
  useEffect(() => {
    if (externalTeam) {
      setSelectedTeam(String(externalTeam));
      setActiveSubTab('profile');
    }
  }, [externalTeam]);

  // 5. 核心業務邏輯處理
  const handleQrScan = () => {
    if (!qrInput) return;
    try {
      // 1. 解析原始數據
      const newEntry = parseQrData(qrInput);

      // 2. ✨ 強化：從原始字串中提取 compLevel (最後一項)
      const parts = qrInput.split('|');
      const levelFromQr = parts[parts.length - 1]; // 取得最後一項，例如 'sf'

      // 3. 補強物件資訊
      const finalEntry = {
        ...newEntry,
        compLevel: levelFromQr || 'qm', // 如果沒有則預設 qm
        matchKey: `${levelFromQr || 'qm'}_${newEntry.match}` // 生成唯一 Key 如 "sf_1"
      };

      // 檢查重複 (這裡也要加入 compLevel 判斷)
      const isDuplicate = matchData.some(d =>
        String(d.match) === String(finalEntry.match) &&
        (d.compLevel || 'qm') === finalEntry.compLevel &&
        String(d.team) === String(finalEntry.team)
      );

      if (isDuplicate && !window.confirm("偵測到同一場次的重複資料，確定匯入？")) return;

      // 更新狀態 (useScoutData Hook 會自動同步到後端的 /api/save)
      updateMatchData([finalEntry, ...matchData]);

      setQrInput("");
      const label = (finalEntry.compLevel === 'sf' ? 'SF' : finalEntry.compLevel === 'f' ? 'F' : 'Q');
      alert(`✅ Team ${finalEntry.team} ${label}${finalEntry.match} 匯入成功`);
    } catch (e) {
      console.error("QR Parse Error:", e);
      alert("QR 解析失敗，請確認格式");
    }
  };

  const handleTeamJump = (teamNumber) => {
    setSelectedTeam(String(teamNumber));
    setActiveSubTab('profile');
  };

  // 6. 數據分析與 Profile 計算
  const getAnalysis = useMemo(() => {
    const teamsObj = {};
    matchData.forEach(d => {
      const t = String(d.team);
      if (!teamsObj[t]) teamsObj[t] = [];
      teamsObj[t].push(d);
    });

    return Object.keys(teamsObj)
      .filter(num => num.includes(filterTeam))
      .map(num => {
        const teamMatches = teamsObj[num];
        const mCount = teamMatches.length;
        const totalAuto = teamMatches.reduce((s, m) => s + (Number(m.autoFuel) || 0), 0);
        const totalTele = teamMatches.reduce((s, m) => s + (Number(m.fuelH) || 0), 0);
        return {
          team: num,
          matches: mCount,
          avgAutoFuel: (totalAuto / mCount).toFixed(1),
          avgFuel: (totalTele / mCount).toFixed(1),
          avgTotal: ((totalAuto + totalTele) / mCount).toFixed(1),
          autoPct: ((teamMatches.filter(m => m.autoSuccess).length / mCount) * 100).toFixed(0) + "%"
        };
      }).sort((a, b) => b.avgFuel - a.avgFuel);
  }, [matchData, filterTeam]);
  const profileData = useMemo(() => {
    if (!selectedTeam) return null;

    const history = matchData
      .filter(d => String(d.team) === String(selectedTeam))
      .sort((a, b) => {
        // ✨ 修正排序邏輯：按階段排序 (qm -> sf -> f)
        const levelOrder = { qm: 1, sf: 2, f: 3 };
        const levelA = a.compLevel || 'qm';
        const levelB = b.compLevel || 'qm';
        if (levelOrder[levelA] !== levelOrder[levelB]) {
          return levelOrder[levelA] - levelOrder[levelB];
        }
        return parseInt(a.match) - parseInt(b.match);
      });

    const pitInfo = pitData.find(p => String(p.team) === String(selectedTeam));
    return { history, pitInfo };
  }, [matchData, pitData, selectedTeam]);

  // 7. 繪圖邏輯
  const drawAutoPaths = (targetCanvas, isFullScale = false, filterMatchId = null) => {
    const canvas = targetCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    canvas.width = rect.width;
    canvas.height = rect.height;

    const bgImg = new Image();
    bgImg.src = process.env.PUBLIC_URL + '/field-full.png';

    bgImg.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.3;
      ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;

      let pathsToDraw = [];
      if (filterMatchId === 'pit') {
        const pitInfo = pitData.find(p => String(p.team) === String(selectedTeam));
        if (pitInfo?.autoPath) pathsToDraw = [{ autoPath: pitInfo.autoPath, isPit: true }];
      } else if (filterMatchId) {
        pathsToDraw = matchData.filter(d => d.id === filterMatchId && d.autoPath);
      } else {
        pathsToDraw = matchData.filter(d => String(d.team) === String(selectedTeam) && d.autoPath);
      }

      const scaleX = canvas.width / 100;
      const scaleY = canvas.height / 100;

      pathsToDraw.forEach((m, idx) => {
        const points = (m.autoPath || "").split(';').map(p => {
          const coords = p.split('-');
          return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
        }).filter(p => !isNaN(p.x) && !isNaN(p.y));

        if (points.length < 2) return;

        const color = m.isPit ? '#00ff88' : `hsla(${(idx * 135) % 360}, 80%, 60%, 0.9)`;

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = isFullScale ? 5 : 3;
        ctx.setLineDash(m.isPit ? [10, 8] : []);
        ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);

        for (let i = 1; i < points.length - 1; i++) {
          const xc = (points[i].x + points[i + 1].x) / 2 * scaleX;
          const yc = (points[i].y + points[i + 1].y) / 2 * scaleY;
          ctx.quadraticCurveTo(points[i].x * scaleX, points[i].y * scaleY, xc, yc);
        }
        ctx.lineTo(points[points.length - 1].x * scaleX, points[points.length - 1].y * scaleY);
        ctx.stroke();

        // 箭頭
        const p2 = points[points.length - 1];
        const p1 = points[points.length - 2];
        const angle = Math.atan2((p2.y - p1.y) * scaleY, (p2.x - p1.x) * scaleX);
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(p2.x * scaleX, p2.y * scaleY);
        ctx.lineTo(p2.x * scaleX - 12 * Math.cos(angle - 0.5), p2.y * scaleY - 12 * Math.sin(angle - 0.5));
        ctx.lineTo(p2.x * scaleX - 12 * Math.cos(angle + 0.5), p2.y * scaleY - 12 * Math.sin(angle + 0.5));
        ctx.fill();

        // 起點
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(points[0].x * scaleX, points[0].y * scaleY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.stroke();
      });
    };
  };

  // 8. 分頁配置
  const renderTabContent = () => {
    const commonProps = {
      setSelectedTeam,
      setActiveSubTab,
      selectedTeam
    };

    switch (activeSubTab) {
      case 'import':
        return (
          <ImportTab
            qrInput={qrInput}
            setQrInput={setQrInput}
            handleQrScan={handleQrScan}
            pendingPitData={pendingPitData}
            handleFileImport={handleFileImport}
            setTeams={setTeams}
          />
        );
      case 'pitView':
        return <PitViewTab teams={tbaTeams} pitData={pitData} updatePitData={updatePitData} {...commonProps} />;
      case 'matchVerify':
        return (<MatchVerifyTab
          matchData={matchData}
          onUpdateMatch={updateMatchData} // 這是你代碼中用來更新的函數
          toggleVerify={(id) => {
            // 這裡實作切換驗證狀態的邏輯
            const newData = matchData.map(d =>
              d.id === id ? { ...d, verified: !d.verified } : d
            );
            updateMatchData(newData);
          }}
          deleteMatch={(id) => {
            if (window.confirm("確定要刪除這筆比賽紀錄嗎？")) {
              const newData = matchData.filter(d => d.id !== id);
              updateMatchData(newData);
            }
          }}
          {...commonProps}
        />);
      case 'schedule':
        return <ScheduleTab schedule={schedule} setSchedule={updateSchedule} onTeamClick={handleTeamJump} onSyncOfficial={handleSyncOfficial} />;
      case 'analysis':
        return <AnalysisTab matchData={matchData} filterTeam={filterTeam} setFilterTeam={setFilterTeam} {...commonProps} />;
      case 'profile':
        return (
          <ProfileTab
            profile={profileData}
            schedule={schedule}
            onUpdateMatch={updateMatchData}
            drawAutoPaths={drawAutoPaths}
            setIsModalOpen={setIsModalOpen}
            {...commonProps}
          />
        );
      case 'assignment':
        return <AssignmentTab schedule={schedule} />;
      default:
        return null;
    }
  };
  const handleSync = async () => {
    if (!window.confirm("這將會連線至 TBA 與 Statbotics 抓取最新 EPA 資料，確定開始？")) return;

    setIsSyncing(true);
    try {
      const response = await fetch(`http://${window.location.hostname}:5000/api/sync-external`);
      const result = await response.json();
      if (response.ok) {
        alert(`✅ 同步成功！已更新 ${result.count} 支隊伍數據。`);
        // 建議這裡重新調用 fetchAllData() 來更新 AnalysisTab 的顯示
      } else {
        alert(`❌ 錯誤: ${result.error}`);
      }
    } catch (error) {
      alert("無法連線至後端伺服器");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="head-scout-container">
      <div className="head-sidebar">
        <div className="head-sidebar-header">
          <h2>FRC 2026</h2>
          <p>Head Scout System</p>
        </div>
        {[
          { id: 'import', label: '📥 資料匯入' },
          { id: 'pitView', label: '🛠️ Pit 資料庫' },
          { id: 'matchVerify', label: '✅ 資料稽核' },
          { id: 'schedule', label: '🗓️ 賽程管理' },
          { id: 'profile', label: '🔍 隊伍紀錄' },
          { id: 'assignment', label: '📋 排班管理' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`head-tab-btn ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.label}
          </button>

        ))}

        <button
          onClick={handleSync}
          className="sync-btn"
          disabled={isSyncing}
        >
          {isSyncing ? "⏳ 同步中..." : "🔄 同步 TBA/Statbotics 數據"}
        </button>
      </div>
      <div className="head-main-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default HeadScoutPage;