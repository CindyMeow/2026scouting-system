// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config(); // 必須放在最上面

// ✨ 1. 引入路徑配置檔
// 確保你已經建立了 config/paths.js
const paths = require('./config/paths');


const app = express();
// 優先使用 .env 裡的 PORT，否則預設 5000
const PORT = process.env.PORT || 5000;

// 解析設定
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true }));
app.use(cors());

// --- 初始化目錄與檔案區塊 ---
const initSystem = () => {
  // 確保所有子目錄都存在
  const dirs = [
    path.dirname(paths.SCHEDULE_FILE),
    path.dirname(paths.DB_FILE),
    path.dirname(paths.COPR_FILE)
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const initFile = (file, defaultData) => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
    }
  };

  // 根據新的路徑配置初始化檔案
  initFile(paths.DB_FILE, { matchData: [], pitData: [] });
  initFile(paths.ASSIGNMENT_FILE, { assignments: [], scouterList: [] });
  initFile(paths.COPR_FILE, []);
  initFile(paths.SCHEDULE_FILE, {});
  initFile(paths.TEAMS_FILE, {});
};

initSystem();

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
    const response = await axios.get(`https://api.statbotics.io/v3/team_year/${teamNum}/2026`);
    const data = response.data;
    
    // 對應 V3 結構回傳
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

//同步TBA路由
app.get('/api/sync-external', async (req, res) => {
  try {
    // 1. 讀取賽程以獲取隊伍名單
    const scheduleData = JSON.parse(fs.readFileSync(paths.SCHEDULE_FILE, 'utf8'));
    const teamSet = new Set();
    const matches = Array.isArray(scheduleData) ? scheduleData : Object.values(scheduleData);

    matches.forEach(m => {
      [m.red1, m.red2, m.red3, m.blue1, m.blue2, m.blue3].forEach(t => {
        if (t) teamSet.add(Number(t));
      });
    });

    const teamList = Array.from(teamSet);
    const syncResults = [];

    console.log(`📡 使用 Statbotics V3 API 同步 ${teamList.length} 支隊伍...`);

    // 2. 遍歷隊伍抓取 V3 數據
    for (const teamNum of teamList) {
      try {
        const cleanNumber = String(teamNum).replace('frc', '');
        const response = await axios.get(`https://api.statbotics.io/v3/team_year/${cleanNumber}/2026`);
        const data = response.data;

        // V3 的結構通常是 data.epa.breakdown 或 data.epa.total
        // 為了安全，我們使用可選鏈運算符 (?.) 並提供備份欄位
        const totalEpa = data.epa?.total || data.epa_end || 0;
        const autoEpa = data.epa?.auto || data.auto_epa_end || 0;

        syncResults.push({
          team_number: Number(cleanNumber),
          EPA: Number(totalEpa.toFixed(1)),
          auto_EPA: Number(autoEpa.toFixed(1)),
          teleop_EPA: Number((totalEpa - autoEpa).toFixed(1)),
          OPR: 0,
          last_updated: new Date().toISOString()
        });
      } catch (err) {
        // 如果該隊伍在 2026 真的完全還沒有 EPA 數據，我們記錄為 0
        syncResults.push({ team_number: teamNum, EPA: 0, auto_EPA: 0, teleop_EPA: 0, OPR: 0 });
      }
    }

    // 3. 寫入到路徑配置指向的檔案
    fs.writeFileSync(paths.COPR_FILE, JSON.stringify(syncResults, null, 2));

    // 💡 同時寫入一份到根目錄的 copr_data.json 以防萬一
    fs.writeFileSync('./copr_data.json', JSON.stringify(syncResults, null, 2));

    res.json({ message: "2026 數據同步完成", count: syncResults.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running!`);
  console.log(`🏠 Local: http://localhost:${PORT}`);
  // 這裡可以手動印出你的電腦 IP，方便隊友連線
});