import React from 'react';
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
    handleFileImport, pendingPitData, resolveConflict, setTeams
}) => {
    // --- 1. 定義解析 COPR CSV 的函數 ---
    const processCOPRCSV = async (csvText) => {
        try {
            const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
            if (lines.length < 2) return;

            const headers = lines[0].split(',').map(h => h.trim());
            const coprData = [];

            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                if (values.length < headers.length) continue;

                const row = {};
                headers.forEach((header, index) => {
                    const val = values[index];
                    // 只有 team_number 存成字串，其餘數據轉為數字
                    row[header] = (header.toLowerCase().includes('team')) ? String(val) : (parseFloat(val) || 0);
                });
                coprData.push(row);
            }

            // 發送到後端儲存
            const response = await fetch(`http://${window.location.hostname}:5000/api/save-copr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coprData })
            });

            if (response.ok) {
                alert(`✅ 成功匯入 ${coprData.length} 筆 COPR 分析數據！`);
            }
        } catch (err) {
            console.error("COPR 匯入失敗:", err);
            alert("匯入失敗，請檢查主控台錯誤訊息");
        }
    };
    // --- 新增：處理隊伍清單 CSV 並同步至後端 ---
    const processTeamListCSV = async (csvText) => {
        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
        const teamData = {};

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length < 2) continue;

            const teamNum = values[0]; // team_number
            teamData[teamNum] = {
                team_name: values[1] || "",
                city: values[2] || "",
                state: values[3] || "",
                country: values[4] || "",
                robot_image_url: values[5]?.trim() || null
            };
        }

        // 更新前端 State
        setTeams(teamData);

        // 同步存檔到伺服器
        try {
            await fetch(`http://${window.location.hostname}:5000/api/save-teams`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teams: teamData })
            });
            alert(`✅ 成功匯入 ${Object.keys(teamData).length} 支隊伍官方資料！`);
        } catch (err) {
            console.error("隊伍資料存檔失敗:", err);
            alert("隊伍資料匯入成功，但伺服器存檔失敗。");
        }
    };

// --- 新增：處理官方賽程 CSV ---
    const processScheduleCSV = (csvText) => {
        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) return;

        const headers = lines[0].split(',');
        const scheduleData = lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, i) => {
                const val = values[i];
                // 嘗試將數字字串轉為純數字
                obj[header] = isNaN(val) ? val : parseInt(val);
            });
            // 確保有 match 欄位供 HeadScoutPage 判定
            obj.match = obj.match_number; 
            return obj;
        });

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
            reader.onload = (event) => {
                const text = event.target.result;
                const firstLine = text.split('\n')[0].toLowerCase();

                if (firstLine.includes('opr') || firstLine.includes('component')) {
                    processCOPRCSV(text);
                }
                else if (firstLine.includes('team_number')) {
                    processTeamListCSV(text);
                }
                // ✨ 關鍵修正：識別賽程 CSV
                else if (firstLine.includes('match_key') || firstLine.includes('red1')) {
                    processScheduleCSV(text);
                }
                else {
                    alert("無法識別的 CSV 格式");
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