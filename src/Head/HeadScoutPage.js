import { sameMatch, replaceMatch, updateMatchNotes } from '../utils/matchIdentity';
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
import EventSwitcher from './EventSwitcher';

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
    handleSyncOfficial,
    refresh, context, write
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
        if (data.some(r => r.eventKey && r.eventKey !== context?.eventKey)) throw new Error('Pit 檔案包含其他賽事');
        if (data.some(r => !r.eventKey) && !window.confirm(`確認未標示賽事的 Pit 紀錄屬於 ${context?.eventKey}？`)) return;
        endpoint = '/api/save-pit';  // ✨ 補上 Pit 的路徑
        payload = { pitData: data };
      } else {
        endpoint = '/api/save-teams';
        payload = { teams: data };
      }

      console.log(`📡 正在發送數據到: ${endpoint}`, data);

      await write(endpoint, payload);
      alert(`✅ 成功匯入 ${Array.isArray(data) ? data.length : Object.keys(data).length} 筆資料`);
    } catch (err) {
      console.error("Import error:", err);
      alert(`匯入失敗：${err.message}`);
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
  const handleQrScan = async () => {
    if (!qrInput) return;
    try {
      // 1. 解析原始數據
      const newEntry = parseQrData(qrInput);

      if (!context) throw new Error('資料尚未載入');
      if (newEntry.eventKey && newEntry.eventKey !== context.eventKey) throw new Error('QR 的賽事與目前賽事不同，未匯入');
      if (!newEntry.eventKey && !window.confirm(`舊版 QR 未包含賽事，確認屬於 ${context.eventKey}？`)) return;
      if (!['qm','pt'].includes(newEntry.compLevel) && !newEntry.set_number) {
        throw new Error('此淘汰賽 QR 缺少組別，請由新版 Match 頁面重新產生');
      }
      const finalEntry = { ...newEntry, eventKey: context.eventKey };
      const duplicate = matchData.some(d => sameMatch(d, finalEntry));
      if (duplicate && !window.confirm('已存在同隊同場紀錄，是否取代？原備註會保留，核准狀態將重設。')) return;
      if (!await updateMatchData(replaceMatch(matchData, finalEntry))) return;

      setQrInput("");
      const label = (finalEntry.compLevel === 'sf' ? 'SF' : finalEntry.compLevel === 'f' ? 'F' : 'Q');
      alert(`✅ Team ${finalEntry.team} ${label}${finalEntry.match} 匯入成功`);
    } catch (e) {
      console.error("QR Parse Error:", e);
      alert(`QR 匯入失敗：${e.message}`);
    }
  };

  const handleTeamJump = (teamNumber) => {
    setSelectedTeam(String(teamNumber));
    setActiveSubTab('profile');
  };

  // 6. 數據分析與 Profile 計算
  const getAnalysis = useMemo(() => {
    const teamsObj = {};
    if (!Array.isArray(matchData)) {
      return [];
    }
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
            write={write}
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
        return <ScheduleTab schedule={schedule} onSaved={refresh} write={write} onTeamClick={handleTeamJump} onSyncOfficial={handleSyncOfficial} />;
      case 'analysis':
        return <AnalysisTab matchData={matchData} filterTeam={filterTeam} setFilterTeam={setFilterTeam} {...commonProps} />;
      case 'profile':
        return (
          <ProfileTab
            profile={profileData}
            schedule={schedule}
            onUpdateMatch={record => updateMatchData(records => updateMatchNotes(records, record.id, record.headNotes))}
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
      const result = await write('/api/sync-external', {});
      alert(result.failed
        ? `⚠️ 已更新 ${result.count}/${result.total} 支隊伍；${result.failed} 支有來源失敗，舊資料已保留。`
        : `✅ 同步成功！已更新 ${result.count} 支隊伍數據。`);
    } catch (error) {
      alert(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const downloadBackup = async () => {
    try {
      const response = await fetch('/api/system/export');
      if (!response.ok) throw new Error('備份建立失敗');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${context?.eventKey || 'frc'}-scouting-backup.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="head-scout-container">
      <div className="head-sidebar">
        <div className="head-sidebar-header">
          <h2>FRC 2026</h2>
          <p>Head Scout System</p>
        </div>
        <div className="sidebar-switcher-section" style={{ padding: '0 10px 15px 10px' }}>
          <EventSwitcher />
        </div>
        <div className="sidebar-divider" style={{ height: '1px', background: '#ffffff22', margin: '0 15px 15px 15px' }}></div>
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
        <button onClick={downloadBackup} className="sync-btn" style={{ background: '#475569' }}>
          💾 下載完整賽事備份
        </button>
      </div>
      <div className="head-main-content">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default HeadScoutPage;
