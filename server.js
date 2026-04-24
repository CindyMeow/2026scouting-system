// server.js
require('dotenv').config(); // 必須放在最上面
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');


// ✨ 1. 引入路徑配置檔
// 確保你已經建立了 config/paths.js
const paths = require('./config/paths');


const app = express();
// 優先使用 .env 裡的 PORT，否則預設 5000
const PORT = process.env.SERVER_PORT || 5000;

// 解析設定
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(cors());

// --- 初始化目錄與檔案區塊 ---
const initSystem = () => {
  // 取得基礎目錄 (e.g., data/2026dal)
  const baseDir = paths.EVENT_DIR;

  // 定義需要建立的子目錄結構
  const subDirs = [
    path.join(baseDir, 'static'),
    path.join(baseDir, 'dynamic'),
    path.join(baseDir, 'external')
  ];

  // 建立目錄
  subDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 已建立目錄: ${dir}`);
    }
  });

  const initFile = (file, defaultData) => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
    }
  };

  // 初始化各分類下的檔案
  initFile(paths.DB_FILE, { matchData: [], pitData: [] });
  initFile(paths.ASSIGNMENT_FILE, { assignments: [], scouterList: [] });
  initFile(paths.COPR_FILE, []);
  initFile(paths.SCHEDULE_FILE, {});
  initFile(paths.TEAMS_FILE, {});
};

// 務必在 API 定義前執行一次
initSystem();
const getYear = () => process.env.CURRENT_YEAR || '2026';
const getEvent = () => process.env.CURRENT_EVENT || '2026dal';

// TBA 設定
const TBA_API_KEY = process.env.TBA_API_KEY;
const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';

// --- API 路由 ---

// 1. 取得所有核心資料
app.get('/api/data', (req, res) => {
  try {
    const readJSON = (file, defaultVal) => {
      try {
        if (!fs.existsSync(file)) return defaultVal;
        const content = fs.readFileSync(file, 'utf8');
        return content ? JSON.parse(content) : defaultVal;
      } catch (e) { return defaultVal; }
    };

    res.json({
      matchData: readJSON(paths.DB_FILE, { matchData: [] }).matchData || [],
      pitData: readJSON(paths.DB_FILE, { pitData: [] }).pitData || [],
      schedule: readJSON(paths.SCHEDULE_FILE, {}),
      teams: readJSON(paths.TEAMS_FILE, {})
    });
  } catch (err) {
    res.status(500).json({ error: "Read Data Error", message: err.message });
  }
});

// 2. 處理 Pit Scouting 上傳
app.post('/api/upload-pit', (req, res) => {
  try {
    const { scouter, data } = req.body;
    const masterData = JSON.parse(fs.readFileSync(paths.DB_FILE, 'utf8'));

    data.forEach(newRecord => {
      const index = (masterData.pitData || []).findIndex(r => String(r.team) === String(newRecord.team));
      const recordWithMeta = { ...newRecord, lastUpdatedBy: scouter, updateTime: new Date().toISOString() };

      if (index !== -1) masterData.pitData[index] = recordWithMeta;
      else (masterData.pitData = masterData.pitData || []).push(recordWithMeta);
    });

    fs.writeFileSync(paths.DB_FILE, JSON.stringify(masterData, null, 2));
    res.json({ message: "Pit Data Synced", count: masterData.pitData.length });
  } catch (err) {
    res.status(500).send("Pit Upload Error");
  }
});

// 3. 儲存 Match 數據
app.post('/api/save', (req, res) => {
  try {
    const { matchData, pitData } = req.body;
    const masterData = JSON.parse(fs.readFileSync(paths.DB_FILE, 'utf8'));

    if (matchData && Array.isArray(matchData)) {
      masterData.matchData = matchData.map(record => {
        const level = record.compLevel || 'qm';
        return {
          ...record,
          compLevel: level,
          matchKey: record.matchKey || `${level}_${record.match}`,
          updatedAt: new Date().toISOString()
        };
      });
    }
    if (pitData) masterData.pitData = pitData;

    fs.writeFileSync(paths.DB_FILE, JSON.stringify(masterData, null, 2));
    res.json({ message: "Success", receivedCount: matchData ? matchData.length : 0 });
  } catch (err) {
    res.status(500).json({ error: "Save Error" });
  }
});

// 4. 更新單場比分
app.post('/api/update-score', (req, res) => {
  try {
    const { matchNum, redScore, blueScore, redRP, blueRP } = req.body;
    const scheduleData = JSON.parse(fs.readFileSync(paths.SCHEDULE_FILE, 'utf8'));
    const mKey = String(matchNum);

    if (scheduleData[mKey]) {
      scheduleData[mKey].scores = {
        red: parseInt(redScore) || 0,
        blue: parseInt(blueScore) || 0,
        redRP: parseInt(redRP) || 0,
        blueRP: parseInt(blueRP) || 0
      };
      fs.writeFileSync(paths.SCHEDULE_FILE, JSON.stringify(scheduleData, null, 2));
      res.json({ message: "Score Updated" });
    } else {
      res.status(400).send("Match not found");
    }
  } catch (err) {
    res.status(500).send("Update Score Error");
  }
});

// 5. 儲存官方 Teams 清單
app.post('/api/save-teams', (req, res) => {
  try {
    fs.writeFileSync(paths.TEAMS_FILE, JSON.stringify(req.body.teams, null, 2));
    res.json({ message: "Teams DB Saved" });
  } catch (err) { res.status(500).send("Save Teams Error"); }
});

// 6. 儲存賽程
app.post('/api/save-schedule', (req, res) => {
  try {
    fs.writeFileSync(paths.SCHEDULE_FILE, JSON.stringify(req.body.schedule, null, 2));
    res.json({ message: "Schedule Saved" });
  } catch (err) { res.status(500).send("Save Schedule Error"); }
});

// 7. COPR/TBA 快取管理
app.get('/api/copr', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(paths.COPR_FILE, 'utf8'));
    res.json(data);
  } catch (err) { res.json([]); }
});
// 取得排班與 Scouter 名單
app.get('/api/assignments', (req, res) => {
  try {
    if (!fs.existsSync(paths.ASSIGNMENT_FILE)) {
      return res.json({ assignments: [], scouterList: [] });
    }
    const data = JSON.parse(fs.readFileSync(paths.ASSIGNMENT_FILE, 'utf8'));
    res.json({
      assignments: data.assignments || [],
      scouterList: data.scouterList || []
    });
  } catch (err) {
    console.error("Fetch Assignments Error:", err);
    res.json({ assignments: [], scouterList: [] });
  }
});

// 儲存排班與 Scouter 名單
app.post('/api/save-assignments', (req, res) => {
  try {
    const dataToSave = {
      ...req.body,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(paths.ASSIGNMENT_FILE, JSON.stringify(dataToSave, null, 2));
    res.json({ message: "Assignments Saved Success" });
  } catch (err) {
    console.error("Save Assignments Error:", err);
    res.status(500).send("Save Assignments Error");
  }
});

app.post('/api/save-copr', (req, res) => {
  try {
    fs.writeFileSync(paths.COPR_FILE, JSON.stringify(req.body.coprData, null, 2));
    res.json({ message: "COPR Saved" });
  } catch (err) { res.status(500).send("Save Error"); }
});

// 8. TBA 往績查詢
app.get('/api/tba/team-history/:teamNumber', async (req, res) => {
  const teamKey = `frc${req.params.teamNumber}`;
  try {
    const config = { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } };
    const statusRes = await axios.get(`${TBA_BASE_URL}/team/${teamKey}/events/2026/statuses`, config);
    const events = Object.keys(statusRes.data);
    const historyData = [];

    for (const eventKey of events) {
      const oprRes = await axios.get(`${TBA_BASE_URL}/event/${eventKey}/oprs`, config);
      const teamOpr = oprRes.data.oprs[teamKey] || 0;
      const rank = statusRes.data[eventKey]?.qual?.ranking?.rank || "-";
      historyData.push({ event: eventKey, rank, opr: teamOpr.toFixed(1) });
    }
    res.json({ team: req.params.teamNumber, history: historyData });
  } catch (error) {
    res.status(500).send("TBA API Error");
  }
});

// 9. Statbotics EPA 查詢
app.get('/api/stats/team-epa/:teamNumber', async (req, res) => {
  try {
    const teamNum = req.params.teamNumber.replace('frc', '');
    const year = getYear(); // ✨ 動態取得年度
    const response = await axios.get(`https://api.statbotics.io/v3/team_year/${teamNum}/${year}`);
    const data = response.data;

    res.json({
      total_epa: data.epa?.total || 0,
      auto_epa: data.epa?.auto || 0,
      teleop_epa: (data.epa?.total || 0) - (data.epa?.auto || 0),
      percentile: data.percentile || 0
    });
  } catch (error) {
    res.status(500).send("EPA V3 Error");
  }
});

// 3. 官方比分同步 (從 TBA 抓取真實結果)
app.get('/api/sync-tba-matches', async (req, res) => {
    try {
        const eventKey = getEvent();
        const config = { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } };
        
        const response = await axios.get(`${TBA_BASE_URL}/event/${eventKey}/matches`, config);
        const tbaMatches = response.data;
        let localSchedule = JSON.parse(fs.readFileSync(paths.SCHEDULE_FILE, 'utf8'));

        tbaMatches.forEach(tbaMatch => {
            const mNum = tbaMatch.match_number;
            const mKey = String(mNum);
            
            if (localSchedule[mKey]) {
                localSchedule[mKey] = {
                    ...localSchedule[mKey],
                    red_score: tbaMatch.alliances.red.score,
                    blue_score: tbaMatch.alliances.blue.score,
                    redRP: tbaMatch.score_breakdown?.red?.rp || 0,
                    blueRP: tbaMatch.score_breakdown?.blue?.rp || 0,
                    is_official: true
                };
            }
        });

        fs.writeFileSync(paths.SCHEDULE_FILE, JSON.stringify(localSchedule, null, 2));
        res.json({ message: "Official scores synced", count: tbaMatches.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
//同步TBA路由

app.get('/api/sync-external', async (req, res) => {
  try {
    const year = getYear();
    const config = { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } };
    
    let teamList = [];
    if (fs.existsSync(paths.TEAMS_FILE)) {
        const teamsData = JSON.parse(fs.readFileSync(paths.TEAMS_FILE, 'utf8'));
        teamList = Array.isArray(teamsData) ? teamsData : Object.keys(teamsData);
    }

    const syncResults = [];
    console.log(`📡 深度同步開始...`);

    for (const team of teamList) {
      try {
        const teamNum = typeof team === 'object' ? (team.team_number || team.number) : team;
        const teamKey = `frc${teamNum}`;
        
        const [epaRes, tbaRes, statusRes] = await Promise.all([
          axios.get(`https://api.statbotics.io/v3/team_year/${teamNum}/${year}`).catch(() => null),
          axios.get(`${TBA_BASE_URL}/team/${teamKey}`, config).catch(() => null),
          axios.get(`${TBA_BASE_URL}/team/${teamKey}/events/${year}/statuses`, config).catch(() => ({ data: {} }))
        ]);

        const sData = epaRes?.data || {};
        const epaB = sData.epa?.breakdown || {}; // Statbotics V3 主要數據區
        const ranks = sData.epa?.ranks?.total || {};

        // ✨ 修正：從參賽紀錄中計算平均 OPR (如果有的話)
        const eventStatuses = statusRes.data || {};
        let totalOPR = 0;
        let eventCount = 0;

        const history = Object.keys(eventStatuses).map(eKey => {
            const status = eventStatuses[eKey];
            // 試著從 status 獲取該賽事的 OPR (有些 API 會直接附帶)
            const opr = status?.qual?.ranking?.sort_orders?.[0] || 0; 
            if (opr > 0) { totalOPR += opr; eventCount++; }

            return {
                event: eKey,
                rank: status?.qual?.ranking?.rank || "-",
                record: status?.qual?.ranking?.record || { wins: 0, losses: 0, ties: 0 },
                opr: opr.toFixed(1)
            };
        });

        // 🛠️ 核心修正：確保 EPA 路徑正確
        const calculatedTotal = Number(epaB.total_points || sData.epa?.total || 0);

        syncResults.push({
          team_number: Number(teamNum),
          nickname: tbaRes?.data?.nickname || sData.name || `Team ${teamNum}`,
          country: tbaRes?.data?.country || sData.country || "/",
          state: tbaRes?.data?.state_prov || sData.state || "/",
          world_rank: ranks.rank || "-", 
          percentile: ranks.percentile ? (ranks.percentile * 100).toFixed(1) + "%" : "N/A",

          // 📊 關鍵數據 (確保 Key 名稱與前端 Table 對齊)
          EPA: Number(calculatedTotal.toFixed(1)), 
          auto_EPA: Number((epaB.auto_points || 0).toFixed(1)),
          teleop_EPA: Number((epaB.teleop_points || 0).toFixed(1)),
          endgame_EPA: Number((epaB.endgame_points || 0).toFixed(1)),
          OPR: eventCount > 0 ? (totalOPR / eventCount).toFixed(1) : "0.0",
          
          history: history,
          last_updated: new Date().toISOString()
        });

        process.stdout.write(`✅ ${teamNum} `);
        await new Promise(r => setTimeout(r, 200)); 
      } catch (err) { console.error(`\n❌ Team ${team} 失敗:`, err.message); }
    }

    fs.writeFileSync(paths.COPR_FILE, JSON.stringify(syncResults, null, 2));
    res.json({ message: "深度同步完成", count: syncResults.length });

  } catch (err) { res.status(500).json({ error: err.message }); }
});
// A. 取得目前配置
app.get('/api/system/config', (req, res) => {
  res.json({
    year: process.env.CURRENT_YEAR || '2026',
    eventKey: process.env.CURRENT_EVENT || '2026dal'
  });
});

// B. 執行切換賽事
app.post('/api/system/switch-event', (req, res) => {
  const { year, eventKey } = req.body;
  
  if (!year || !eventKey) return res.status(400).json({ error: "缺少參數" });

  try {
    // 1. 更新執行中的環境變數
    process.env.CURRENT_YEAR = year;
    process.env.CURRENT_EVENT = eventKey;

    // 2. 重新觸發目錄初始化 (確保新賽事的 Data/XXXX 資料夾被建立)
    // 這裡需要確保你的 paths.js 是動態讀取 process.env 的
    initSystem(); 

    console.log(`🚀 系統已切換至賽事: ${eventKey} (${year})`);
    res.json({ message: `成功切換至 ${eventKey}`, currentEvent: eventKey });
  } catch (err) {
    res.status(500).json({ error: "切換失敗", message: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running!`);
  console.log(`🏠 Local: http://localhost:${PORT}`);
  // 這裡可以手動印出你的電腦 IP，方便隊友連線
});