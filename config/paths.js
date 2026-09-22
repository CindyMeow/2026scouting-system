// config/paths.js
const path = require('path');

const getDataRoot = () => process.env.SCOUT_DATA_DIR || path.join(__dirname, '..', 'Data');

// 取得目前的賽事代碼，例如 '2026dal'
const getEventBase = () => {
  const eventKey = process.env.CURRENT_EVENT || '2026dal';
  return path.join(getDataRoot(), eventKey);
};

module.exports = {
  get DATA_ROOT() { return getDataRoot(); },
  get RUNTIME_CONFIG_FILE() { return path.join(getDataRoot(), 'system_config.json'); },
  // 核心目錄 Getter
  get EVENT_DIR() { return getEventBase(); },
  
  // 1. Static: 賽程與原始隊伍清單 (該賽事專屬)
  get SCHEDULE_FILE() { return path.join(getEventBase(), 'static', 'schedule.json'); },
  get TEAMS_FILE() { return path.join(getEventBase(), 'static', 'teams_db.json'); },
  
  // 2. Dynamic: 本地 Scouting 數據與排班
  get DB_FILE() { return path.join(getEventBase(), 'dynamic', 'head_master_db.json'); },
  get ASSIGNMENT_FILE() { return path.join(getEventBase(), 'dynamic', 'assignments.json'); },
  
  // 3. External: 外部 API 快取 (TBA/Statbotics)
  get COPR_FILE() { return path.join(getEventBase(), 'external', 'copr_data.json'); }
};
