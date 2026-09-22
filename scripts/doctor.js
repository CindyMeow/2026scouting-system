const fs = require('fs');
const path = require('path');
require('dotenv').config();

const root = path.join(__dirname, '..');
const results = [];
const check = (label, ok, detail, optional = false) => results.push({ label, ok, detail, optional });
const major = Number(process.versions.node.split('.')[0]);
check('Node.js 版本', major >= 18, process.version);
const hasEnv = fs.existsSync(path.join(root, '.env'));
const hasTbaKey = Boolean(process.env.TBA_API_KEY);
check('.env 設定檔', hasEnv, hasEnv ? '已找到' : '請從 .env.example 複製');
check('TBA API Key', hasTbaKey, hasTbaKey ? '已設定' : '外部同步需要此設定');
check('前端套件', fs.existsSync(path.join(root, 'node_modules')), fs.existsSync(path.join(root, 'node_modules')) ? '已安裝' : '缺少時執行 npm install');

const dataRoot = process.env.SCOUT_DATA_DIR || path.join(root, 'Data');
const eventKey = process.env.CURRENT_EVENT || '2026dal';
const files = [
  ['核心資料', path.join(dataRoot, eventKey, 'dynamic', 'head_master_db.json')],
  ['賽程', path.join(dataRoot, eventKey, 'static', 'schedule.json')],
  ['隊伍名單', path.join(dataRoot, eventKey, 'static', 'teams_db.json')]
];
for (const [label, file] of files) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')); check(label, true, file); }
  catch (error) { check(label, false, `${file}: ${error.code === 'ENOENT' ? '首次啟動時會建立' : error.message}`, error.code === 'ENOENT'); }
}

for (const result of results) console.log(`${result.ok ? '✅' : result.optional ? 'ℹ️' : '❌'} ${result.label}: ${result.detail}`);
if (results.some(result => !result.ok && !result.optional)) process.exitCode = 1;
