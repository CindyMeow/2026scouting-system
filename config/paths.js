// config/paths.js
const path = require('path');

const ROOT_DATA = path.join(__dirname, '..', 'data');

module.exports = {
  // 核心目錄
  DATA_DIR: ROOT_DATA,
  
  // 靜態資料 (賽程與隊伍清單)
  SCHEDULE_FILE: path.join(ROOT_DATA, 'static', 'schedule.json'),
  TEAMS_FILE: path.join(ROOT_DATA, 'static', 'teams_db.json'),
  
  // 動態資料 (Scouting 數據與排班)
  DB_FILE: path.join(ROOT_DATA, 'dynamic', 'head_master_db.json'),
  ASSIGNMENT_FILE: path.join(ROOT_DATA, 'dynamic', 'assignments.json'),
  
  // 外部快取 (TBA/Statbotics)
  COPR_FILE: path.join(ROOT_DATA, 'external', 'copr_data.json')
};