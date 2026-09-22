// server.js
require('dotenv').config(); // 必須放在最上面
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { revision, metrics, normalizeSchedule, mergePit } = require('./lib/scout');
const syncExternal = require('./lib/external');
const { readJson, atomicWriteJson } = require('./lib/storage');
const read = file => readJson(file, null);
let syncing = false;


// ✨ 1. 引入路徑配置檔
// 確保你已經建立了 config/paths.js
const paths = require('./config/paths');

// .env 優先；未指定時讀取上次在畫面選擇的賽事。
const savedRuntime = readJson(paths.RUNTIME_CONFIG_FILE, {});
process.env.CURRENT_YEAR ||= savedRuntime.year || '2026';
process.env.CURRENT_EVENT ||= savedRuntime.eventKey || '2026dal';


const app = express();
// 優先使用 .env 裡的 SERVER_PORT，否則預設 5001（與前端 proxy 一致）
const PORT = process.env.SERVER_PORT || 5001;

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
      atomicWriteJson(file, defaultData, { backup: false });
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

// 所有寫入都使用畫面載入時的賽事與版本，禁止以最新版本掩蓋舊畫面的衝突。
const resources = () => ({
  matchData: read(paths.DB_FILE).matchData || [], pitData: read(paths.DB_FILE).pitData || [],
  schedule: read(paths.SCHEDULE_FILE), teams: read(paths.TEAMS_FILE),
  assignments: read(paths.ASSIGNMENT_FILE), coprData: read(paths.COPR_FILE)
});
const revisions = () => Object.fromEntries(Object.entries(resources()).map(([key, data]) => [key, revision(data)]));
const writeResources = {
  '/api/upload-pit': ['pitData'], '/api/save-pit': ['pitData'],
  '/api/update-score': ['schedule'], '/api/save-schedule': ['schedule'],
  '/api/save-teams': ['teams'], '/api/save-assignments': ['assignments'], '/api/save-copr': ['coprData'],
  '/api/sync-tba-matches': ['schedule'], '/api/sync-external': ['teams', 'coprData']
};
app.use((req, res, next) => {
  const fields = writeResources[req.path];
  if (!fields) return next();
  if (req.method !== 'POST') return res.status(405).json({ error: '此操作請使用 POST' });
  if (req.body.eventKey !== getEvent()) return res.status(409).json({ error: '賽事已變更或未指定，請重新整理後重試' });
  try {
    const current = revisions();
    if (fields.some(field => req.body.revisions?.[field] !== current[field])) {
      return res.status(409).json({ error: '其他裝置已更新資料，請重新整理後重試；本次未覆寫資料' });
    }
    next();
  } catch (err) { res.status(500).json({ error: '無法讀取資料版本，未執行寫入' }); }
});

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
      eventKey: getEvent(),
      revisions: revisions(),
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
    if (!Array.isArray(data) || data.some(r => !r || r.eventKey !== getEvent())) return res.status(400).json({ error: 'Pit 紀錄賽事不符，請先確認每筆紀錄的賽事' });
    const masterData = JSON.parse(fs.readFileSync(paths.DB_FILE, 'utf8'));

    data.forEach(newRecord => {
      const index = (masterData.pitData || []).findIndex(r => String(r.team) === String(newRecord.team));
      const recordWithMeta = { ...newRecord, lastUpdatedBy: scouter, updateTime: new Date().toISOString() };

      if (index !== -1) masterData.pitData[index] = recordWithMeta;
      else (masterData.pitData = masterData.pitData || []).push(recordWithMeta);
    });

    atomicWriteJson(paths.DB_FILE, masterData);
    res.json({ message: "Pit Data Synced", count: masterData.pitData.length });
  } catch (err) {
    res.status(500).send("Pit Upload Error");
  }
});

// 僅儲存本次編輯的集合，舊版本不得覆蓋其他裝置的新資料。
app.post('/api/save', (req, res) => {
  try {
    const master = read(paths.DB_FILE);
    const fields = ['matchData', 'pitData'].filter(k => req.body[k] !== undefined);
    if (!fields.length) return res.status(400).json({ error: '缺少資料' });
    if (req.body.eventKey !== getEvent()) return res.status(409).json({ error: '賽事已切換，請重新整理' });
    for (const field of fields) {
      if (!Array.isArray(req.body[field])) return res.status(400).json({ error: '資料格式錯誤' });
      if (req.body.revisions?.[field] !== revision(master[field] || [])) {
        return res.status(409).json({ error: '其他裝置已更新資料，請重新整理後再修改；本次未覆蓋資料' });
      }
    }
    fields.forEach(field => { master[field] = req.body[field]; });
    atomicWriteJson(paths.DB_FILE, master);
    res.json({ message: '已儲存' });
  } catch (err) { res.status(500).json({ error: '儲存失敗' }); }
});

app.post('/api/save-pit', (req, res) => {
  try {
    const master = read(paths.DB_FILE);
    if (req.body.pitData?.some?.(r => r.eventKey && r.eventKey !== getEvent())) return res.status(400).json({ error: 'Pit 匯入檔包含其他賽事' });
    master.pitData = mergePit(master.pitData || [], req.body.pitData);
    atomicWriteJson(paths.DB_FILE, master);
    res.json({ count: req.body.pitData.length });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// 4. 更新單場比分
app.post('/api/update-score', (req, res) => {
  try {
    const { matchKey, redScore, blueScore, redRP, blueRP } = req.body;
    const scheduleData = JSON.parse(fs.readFileSync(paths.SCHEDULE_FILE, 'utf8'));
    const mKey = String(matchKey);

    if (scheduleData[mKey]) {
      scheduleData[mKey].scores = {
        red: parseInt(redScore) || 0,
        blue: parseInt(blueScore) || 0,
        redRP: parseInt(redRP) || 0,
        blueRP: parseInt(blueRP) || 0
      };
      atomicWriteJson(paths.SCHEDULE_FILE, scheduleData);
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
    if (!req.body.teams || typeof req.body.teams !== 'object' || Array.isArray(req.body.teams)) {
      return res.status(400).json({ error: '隊伍資料格式錯誤' });
    }
    atomicWriteJson(paths.TEAMS_FILE, req.body.teams);
    res.json({ message: "Teams DB Saved" });
  } catch (err) { res.status(500).send("Save Teams Error"); }
});

// 6. 儲存賽程
app.post('/api/save-schedule', (req, res) => {
  try {
    if (req.body.eventKey && req.body.eventKey !== getEvent()) return res.status(409).json({ error: '賽事已切換，請重新整理' });
    if (req.body.revisions?.schedule && req.body.revisions.schedule !== revision(read(paths.SCHEDULE_FILE))) return res.status(409).json({ error: '賽程已由其他裝置更新，請重新整理' });
    atomicWriteJson(paths.SCHEDULE_FILE, normalizeSchedule(req.body.schedule));
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
      eventKey: getEvent(), revisions: revisions(),
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
    if (!Array.isArray(req.body.assignments) || !Array.isArray(req.body.scouterList)) {
      return res.status(400).json({ error: '排班資料格式錯誤' });
    }
    const dataToSave = {
      assignments: req.body.assignments, scouterList: req.body.scouterList,
      lastUpdated: new Date().toISOString()
    };
    atomicWriteJson(paths.ASSIGNMENT_FILE, dataToSave);
    res.json({ message: "Assignments Saved Success" });
  } catch (err) {
    console.error("Save Assignments Error:", err);
    res.status(500).send("Save Assignments Error");
  }
});

app.post('/api/save-copr', (req, res) => {
  try {
    if (!Array.isArray(req.body.coprData)) return res.status(400).json({ error: '分析資料格式錯誤' });
    atomicWriteJson(paths.COPR_FILE, req.body.coprData);
    res.json({ message: "COPR Saved" });
  } catch (err) { res.status(500).send("Save Error"); }
});

// 8. TBA 往績查詢
app.get('/api/tba/team-history/:teamNumber', async (req, res) => {
  const teamKey = `frc${req.params.teamNumber}`;
  try {
    const config = { headers: { 'X-TBA-Auth-Key': TBA_API_KEY }, timeout: 15000 };
    const statusRes = await axios.get(`${TBA_BASE_URL}/team/${teamKey}/events/${getYear()}/statuses`, config);
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
    const response = await axios.get(`https://api.statbotics.io/v3/team_year/${teamNum}/${year}`, { timeout: 15000 });
    const data = response.data;

    const values = metrics(data);
    res.json({ total_epa: values.EPA, auto_epa: values.auto_EPA,
      teleop_epa: values.teleop_EPA, percentile: values.percentile });
  } catch (error) {
    res.status(500).send("EPA V3 Error");
  }
});

// 同步時固定賽事及檔案路徑，避免切換賽事導致跨賽事寫入。
app.post('/api/sync-tba-matches', async (req, res) => {
  if (syncing) return res.status(409).json({ error: '另一項同步正在進行' });
  if (!TBA_API_KEY) return res.status(400).json({ error: '請設定 TBA_API_KEY 並重啟後端' });
  syncing = true;
  const file = paths.SCHEDULE_FILE, event = getEvent(), original = fs.readFileSync(file, 'utf8');
  try {
    const response = await axios.get(`${TBA_BASE_URL}/event/${event}/matches`, {
      headers: { 'X-TBA-Auth-Key': TBA_API_KEY }, timeout: 15000
    });
    if (!Array.isArray(response.data) || !response.data.length) throw new Error('TBA 尚無此賽事的賽程');
    const schedule = normalizeSchedule(response.data);
    for (const m of Object.values(schedule)) {
      m.scores = { red: m.alliances.red.score, blue: m.alliances.blue.score,
        redRP: m.score_breakdown?.red?.rp ?? 0, blueRP: m.score_breakdown?.blue?.rp ?? 0 };
      m.is_official = m.alliances.red.score >= 0 && m.alliances.blue.score >= 0;
    }
    if (fs.readFileSync(file, 'utf8') !== original) return res.status(409).json({ error: '同步期間賽程已變更，請重試' });
    atomicWriteJson(file, schedule);
    res.json({ count: response.data.length });
  } catch (err) { res.status(502).json({ error: `官方賽程同步失敗：${err.response?.status || err.message}` }); }
  finally { syncing = false; }
});

app.post('/api/sync-external', async (req, res) => {
  if (syncing) return res.status(409).json({ error: '另一項同步正在進行' });
  syncing = true;
  const coprFile = paths.COPR_FILE, teamsFile = paths.TEAMS_FILE;
  const original = fs.readFileSync(coprFile, 'utf8');
  const originalTeams = fs.readFileSync(teamsFile, 'utf8');
  try {
    const result = await syncExternal({ axios, key: TBA_API_KEY, event: getEvent(), year: getYear(),
      teams: JSON.parse(originalTeams), previous: JSON.parse(original) });
    if (!result.count) return res.status(502).json({ error: '所有隊伍查詢失敗，原資料未變更', ...result, data: undefined, teams: undefined });
    if (fs.readFileSync(coprFile, 'utf8') !== original || fs.readFileSync(teamsFile, 'utf8') !== originalTeams) {
      return res.status(409).json({ error: '同步期間資料已變更，請重試；原資料未覆蓋' });
    }
    atomicWriteJson(coprFile, result.data);
    atomicWriteJson(teamsFile, result.teams);
    res.json({ count: result.count, failed: result.failed, total: result.total, warnings: result.warnings });
  } catch (err) { res.status(502).json({ error: `同步失敗：${err.response?.status || err.message}；原資料未變更` }); }
  finally { syncing = false; }
});
// A. 取得目前配置
app.get('/api/system/config', (req, res) => {
  res.json({
    year: process.env.CURRENT_YEAR || '2026',
    eventKey: process.env.CURRENT_EVENT || '2026dal'
  });
});

// 下載單一、可攜的賽事備份；不包含 API 金鑰。
app.get('/api/system/export', (req, res) => {
  try {
    const eventKey = getEvent();
    const bundle = {
      format: 'frc-scout-backup-v1',
      exportedAt: new Date().toISOString(),
      year: getYear(),
      eventKey,
      ...resources()
    };
    res.setHeader('Content-Disposition', `attachment; filename="${eventKey}-scouting-backup.json"`);
    res.json(bundle);
  } catch (err) {
    res.status(500).json({ error: '無法建立備份檔' });
  }
});

// B. 執行切換賽事
app.post('/api/system/switch-event', (req, res) => {
  if (syncing) return res.status(409).json({ error: '請等待同步完成後再切換賽事' });
  if (req.body.expectedEventKey !== getEvent()) return res.status(409).json({ error: '賽事已由其他裝置切換，請重新整理' });
  const { year, eventKey } = req.body;
  
  if (!/^\d{4}$/.test(String(year)) || !/^\d{4}[a-z0-9]+$/.test(String(eventKey)) || !String(eventKey).startsWith(String(year))) return res.status(400).json({ error: "缺少參數" });

  try {
    // 1. 更新執行中的環境變數
    process.env.CURRENT_YEAR = year;
    process.env.CURRENT_EVENT = eventKey;

    // 2. 重新觸發目錄初始化 (確保新賽事的 Data/XXXX 資料夾被建立)
    // 這裡需要確保你的 paths.js 是動態讀取 process.env 的
    initSystem(); 
    atomicWriteJson(paths.RUNTIME_CONFIG_FILE, { year, eventKey });

    console.log(`🚀 系統已切換至賽事: ${eventKey} (${year})`);
    res.json({ message: `成功切換至 ${eventKey}`, currentEvent: eventKey });
  } catch (err) {
    res.status(500).json({ error: "切換失敗", message: err.message });
  }
});

if (require.main === module) app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running!`);
  console.log(`🏠 Local: http://localhost:${PORT}`);
  // 這裡可以手動印出你的電腦 IP，方便隊友連線
});
module.exports = app;
