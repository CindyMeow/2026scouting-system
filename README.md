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
```

### 🔑 API 密鑰設定
本專案不包含 API 密鑰。請在根目錄手動建立 `.env` 檔案並加入以下內容：
`TBA_API_KEY=你的TBA_Key`

建議直接複製 `.env.example`，填入 TBA Read API Key，然後執行 `npm run doctor` 檢查環境。正式使用後端可執行 `npm run server:production`；開發時使用 `npm start`。

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

Proxy 設定: 前端請求會透過 package.json 中的 proxy 轉發至 Port 5001，無需手動處理 CORS。

資料保存: 所有的紀錄皆以 JSON 格式儲存在 data/ 目錄下，請勿隨意刪除該目錄內的檔案。

Developer: Cindy Liu

Scouting Team: 2026 FRC Team Members
### 本機連線設定
前端使用 `/api/...` 相對路徑，由開發伺服器轉送至 `http://localhost:5001`。後端預設使用 5001，避開 macOS 可能佔用的 5000。若 `.env` 有設定 `SERVER_PORT`，請保持與 `package.json` 的 `proxy` 埠號一致。變更 proxy 後須重新執行 `npm start`。

正式部署時，也需要將同網域的 `/api` 請求轉送至後端；`package.json` 的 proxy 僅用於開發環境。


### 同步與資料保護
- 同步外部資料會取得目前賽事的 TBA 隊伍名單。OPR 為該年度有 OPR 資料的參賽賽事平均值（含 0 與負值）。
- TBA 或 Statbotics 部分失敗時，保留該來源上次資料並顯示警告；全部查詢失敗時不覆寫快取。舊的零值在來源恢復前不代表真實 EPA。
- Match/Pit 編輯使用版本檢查；若其他裝置先修改同類資料，請重新整理後重做修改。
- Pit JSON 匯入以隊號合併；未出現在匯入檔的隊伍不會刪除。
- 官方賽程同步會載入完整官方賽程與比分；手動匯入的賽程會由官方版本取代。
- `npm run test:regression` 使用暫存資料目錄及模擬 API，測試不會修改正式資料或連線 TBA。


### 2026-09-22 操作修正
- 新版 QR 使用 FRC3，包含賽事、組別與官方場次代碼；Head 仍接受舊版資格賽 QR，但需確認賽事。缺少組別的舊淘汰賽 QR 不會自動猜測場次，請使用新版 Match 頁面重新產生。所有裝置更新後請重新整理。
- 同隊同場 QR 再次匯入會詢問是否取代，保留原備註、重設核准狀態，不重複計算平均值。
- 所有資料寫入需帶目前賽事及載入時的版本；遇到衝突請先備份尚未送出的內容，再重新整理。同步 API 改為 POST，舊版用戶端請重新整理。
- Head 備註只有在儲存成功後才會關閉；稽核及隊伍歷史中的 Fuel 都是 Auto + Teleop，命中率仍明確標示為 Teleop。
- Pick List 保存在目前瀏覽器，依賽事分開；可離開 Analysis 再返回。此清單尚未跨裝置同步，清除瀏覽器資料會移除清單。
- 聯盟比較可選 OPR 或 EPA，僅加總三隊同一指標；不額外加入爬升、不顯示未驗證勝率。缺少資料或同步失敗時顯示資料不足。
- `npm run test:regression` 驗證 API、QR 及歷史資料；`npm run test:ui` 驗證表單操作、重複匯入、Pick List 保存及指標計算。API 測試使用獨立暫存資料與模擬外部服務。

### 資料備份與離線使用

- Head 側欄的「下載完整賽事備份」會匯出目前賽事的 Match、Pit、賽程、隊伍、排班及分析資料，檔案不包含 TBA Key。比賽日建議每個時段及閉館前各下載一次。
- 每次伺服器寫入 JSON 前，舊版會自動保存在同資料夾的 `.backups/`，每個檔案保留最近 20 份。正式資料仍在 `Data/<賽事代碼>/`。
- Match 賽程、Pit 暫存、隊伍名單及 Pick List 都按賽事分開保存在瀏覽器。清除網站資料前，務必先匯出 Pit JSON 與完整賽事備份。
- Production build 會快取已載入的介面資源，斷網後可重新開啟已使用過的頁面；API 不會快取。離線資料需留在裝置上，恢復主機連線後再同步。
- 切換賽事會保存到 `Data/system_config.json`，後端重啟後沿用。`.env` 若明確指定 `CURRENT_EVENT`，則以 `.env` 為準。
