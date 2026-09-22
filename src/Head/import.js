import React from 'react';
import { parseCsv, recordsFromCsv } from '../utils/csv';
// ✨ 這是對應 ScouterPage.js 的 P00112233_S4455 的解碼器
const decodeAutoData = (rawStr) => {
  if (!rawStr || !rawStr.includes('_')) return { path: [], shots: [] };

  const parts = rawStr.split('_');
  const pathRaw = parts[0]?.replace('P', '') || '';
  const shotsRaw = parts[1]?.replace('S', '') || '';

  const parsePoints = (str) => {
    const pts = [];
    for (let i = 0; i < str.length; i += 4) {
      pts.push({
        x: parseInt(str.substring(i, i + 2)),
        y: parseInt(str.substring(i + 2, i + 4))
      });
    }
    return pts;
  };

  return {
    path: parsePoints(pathRaw),
    shots: parsePoints(shotsRaw)
  };
};

const ImportTab = ({
    qrInput, setQrInput, handleQrScan,
    handleFileImport, pendingPitData, resolveConflict, setTeams, write
}) => {
    // --- 1. 定義解析 COPR CSV 的函數 ---
    const processCOPRCSV = async (csvText) => {
        try {
            const rows = recordsFromCsv(csvText);
            const coprData = rows.map(row => Object.fromEntries(Object.entries(row).map(([header, value]) =>
                [header, header.toLowerCase().includes('team') ? String(value) : (Number(value) || 0)])));
            if (!coprData.length || !window.confirm(`即將匯入 ${coprData.length} 筆分析資料，確定繼續？`)) return;

            // 發送到後端儲存
            await write('/api/save-copr', { coprData });
            alert(`✅ 成功匯入 ${coprData.length} 筆 COPR 分析數據！`);
        } catch (err) {
            console.error("COPR 匯入失敗:", err);
            alert(`匯入失敗：${err.message}`);
        }
    };
    // --- 新增：處理隊伍清單 CSV 並同步至後端 ---
    const processTeamListCSV = async (csvText) => {
        const rows = recordsFromCsv(csvText);
        const teamData = {};
        for (const row of rows) {
            const teamNum = row.team_number;
            if (!/^\d+$/.test(teamNum || '')) throw new Error(`隊號格式錯誤：${teamNum || '空白'}`);
            teamData[teamNum] = {
                team_name: row.team_name || row.nickname || "",
                city: row.city || "", state: row.state || row.state_prov || "",
                country: row.country || "", robot_image_url: row.robot_image_url || null
            };
        }
        if (!Object.keys(teamData).length || !window.confirm(`即將匯入 ${Object.keys(teamData).length} 支隊伍，確定繼續？`)) return;

        // 更新前端 State


        // 同步存檔到伺服器
        try {
            await write('/api/save-teams', { teams: teamData });
            setTeams(teamData);
            alert(`✅ 成功匯入 ${Object.keys(teamData).length} 支隊伍官方資料！`);
        } catch (err) {
            console.error("隊伍資料存檔失敗:", err);
            alert(`隊伍資料未匯入：${err.message}`);
        }
    };

// --- 新增：處理官方賽程 CSV ---
    const processScheduleCSV = (csvText) => {
        const scheduleData = recordsFromCsv(csvText).map(row => {
            const obj = Object.fromEntries(Object.entries(row).map(([header, val]) =>
                [header.trim(), val !== '' && Number.isFinite(Number(val)) ? Number(val) : val]));
            // 確保有 match 欄位供 HeadScoutPage 判定
            obj.match = obj.match_number; 
            return obj;
        });
        if (!scheduleData.length || !window.confirm(`即將匯入 ${scheduleData.length} 場賽程，會取代目前賽程，確定繼續？`)) return;
        // 呼叫父組件傳進來的 handleFileImport，傳入解析好的陣列
        handleFileImport(scheduleData);
    };

    // --- 修改後的檔案入口判定 ---
    const onFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 1. 處理 JSON (Pit 數據)
        if (file.name.endsWith('.json')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    handleFileImport(data); // 傳入解析後的物件/陣列
                } catch (err) {
                    alert("JSON 格式錯誤");
                }
            };
            reader.readAsText(file);
            return;
        }

        // 2. 處理 CSV
        if (file.name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const text = event.target.result;
                let firstLine;
                try { firstLine = parseCsv(text)[0].join(',').toLowerCase(); }
                catch (error) { alert(`CSV 格式錯誤：${error.message}`); return; }
                try {
                    if (firstLine.includes('opr') || firstLine.includes('component')) await processCOPRCSV(text);
                    else if (firstLine.includes('team_number')) await processTeamListCSV(text);
                    else if (firstLine.includes('match_key') || firstLine.includes('red1')) await processScheduleCSV(text);
                    else alert("無法識別的 CSV 格式");
                } catch (error) {
                    alert(`CSV 匯入失敗：${error.message}`);
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* 衝突處理區 (保持不變) */}
            {pendingPitData.length > 0 && (
                <div className="scout-card" style={{ border: '2px solid #e74c3c' }}>
                    <h3 className="scout-card-title" style={{ color: '#e74c3c' }}>
                        ⚠️ 數據衝突待處理 ({pendingPitData.length})
                    </h3>
                    {pendingPitData.map((item, idx) => (
                        <div key={idx} className="conflict-box">
                            <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '10px' }}>
                                Team {item.incoming.team}
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div className="version-card">
                                    <div className="version-label">現有版本</div>
                                    {item.existing.photo ? (
                                        <img src={item.existing.photo} className="version-img" alt="old" />
                                    ) : (
                                        <div className="pit-no-img">無照片</div>
                                    )}
                                    <p className="pit-text">底盤: {item.existing.drive}</p>
                                    <button className="btn-keep" onClick={() => resolveConflict(idx, 'existing')}>
                                        保留舊版
                                    </button>
                                </div>

                                <div className="version-card" style={{ borderColor: '#3498db' }}>
                                    <div className="version-label" style={{ backgroundColor: '#3498db', color: '#fff' }}>
                                        匯入新版
                                    </div>
                                    {item.incoming.photo ? (
                                        <img src={item.incoming.photo} className="version-img" alt="new" />
                                    ) : (
                                        <div className="pit-no-img">無照片</div>
                                    )}
                                    <p className="pit-text">底盤: {item.incoming.drive}</p>
                                    <button className="btn-primary" onClick={() => resolveConflict(idx, 'incoming')}>
                                        採用新版
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Match QR 匯入 (保持不變) */}
            <div className="scout-card">
                <h3 className="scout-card-title">📥 匯入比賽數據 (Match)</h3>
                <textarea
                    className="scout-textarea"
                    placeholder="貼上 QR 字串..."
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleQrScan()}
                />
                <button className="btn-primary" onClick={handleQrScan}>確認匯入紀錄</button>
            </div>

            {/* 檔案匯入區 (套用智能判定) */}
            <div className="scout-card" style={{ border: '2px dashed #3498db', backgroundColor: '#f8fbff' }}>
                <h3 className="scout-card-title">📁 匯入中心 (Pit / TBA / Schedule)</h3>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                    支援：<b>.json</b> (Pit 數據)、<b>TBA 隊伍表 .csv</b> 或 <b>官方賽程 .csv</b>
                </p>
                <input
                    type="file"
                    accept=".json,.csv"
                    onChange={onFileChange}
                    style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px', backgroundColor: '#fff' }}
                />
            </div>
        </div>
    );
};

export default ImportTab;
