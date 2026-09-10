# 🤖 2026 FRC Scouting System

這是一個專為 2026 FRC 賽季開發的全方位觀賽與數據分析系統。整合了 **The Blue Alliance (TBA)** 與 **Statbotics V3** 的即時數據，並提供現場離線記錄功能。

---

## 🚀 快速開始 (Quick Start)

如果你是第一次拿到這個專案，請依照以下步驟設定你的開發環境：

### 1. 環境需求
* **Node.js**: 建議版本 `v18.0.0` 以上 ( [下載地址](https://nodejs.org/) )
* **Git**: 用於克隆專案

### 2. 安裝與啟動
在終端機 (Terminal/CMD) 依序執行以下指令：

```bash
# 1. 複製專案
git clone [https://github.com/CindyMeow/2026-scouting-system.git](https://github.com/CindyMeow/2026-scouting-system.git)
cd 2026-scouting-system

# 2. 一鍵安裝所有套件 (前端 + 後端)
npm install

# 3. 同時啟動前後端服務
npm start

### 🔑 API 密鑰設定
本專案不包含 API 密鑰。請在根目錄手動建立 `.env` 檔案並加入以下內容：
`TBA_API_KEY=你的TBA_Key`

🛠️ 主要功能
Match Scouting: 現場紀錄每場比賽的 Fuel 進球數、攀爬時間與防守評價。

Pit Scouting: 紀錄隊伍機器人規格與照片。

Data Audit: 數據稽核分頁，由 Head Scouter 確認數據準確性。

Analysis Tab:

自動計算 OPR (TBA) 與 EPA (Statbotics V3)。

提供 Pick List 排序功能。

Sync System: 一鍵從 TBA 抓取最新賽程與隊伍實力指標。

📂 專案結構
Plaintext
.
├── server.js            # 後端 Express 伺服器 (核心邏輯)
├── config/
│   └── paths.js         # 全域檔案路徑配置
├── data/                # 數據存儲目錄 (JSON 檔案)
│   ├── static/          # 靜位資料 (賽程、隊伍名單)
│   ├── dynamic/         # 動態資料 (比賽紀錄、Pit 紀錄)
│   └── external/        # 外部 API 快取 (TBA/Statbotics 數據)
├── src/                 # React 前端原始碼
└── package.json         # 套件定義與啟動腳本


⚠️ 開發注意事項
修改後端: 若修改了 server.js，建議使用 nodemon 讓伺服器自動重啟。

Proxy 設定: 前端請求會透過 package.json 中的 proxy 轉發至 Port 5000，無需手動處理 CORS。

資料保存: 所有的紀錄皆以 JSON 格式儲存在 data/ 目錄下，請勿隨意刪除該目錄內的檔案。

Developer: Cindy Liu

Scouting Team: 2026 FRC Team Members
