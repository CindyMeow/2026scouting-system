import React, { useState, useEffect } from 'react';

const AssignmentTab = ({ schedule }) => {
  const [scouterNames, setScouterNames] = useState(""); 
  const [scouterList, setScouterList] = useState([]);   
  const [shiftsPerBlock, setShiftsPerBlock] = useState(5);
  const [assignments, setAssignments] = useState([]);
  const [isDataReady, setIsDataReady] = useState(false); // 新增：確保資料載入完成

  // --- 載入邏輯：從資料庫獲取現有排班 ---
  useEffect(() => {
    fetch(`http://${window.location.hostname}:5000/api/assignments`)
      .then(res => res.json())
      .then(data => {
        // 1. 先把名單解析出來
        if (data.scouterList && data.scouterList.length > 0) {
          setScouterList(data.scouterList);
          setScouterNames(data.scouterList.join(", "));
        }
        // 2. 設定排班資料
        if (data.assignments && data.assignments.length > 0) {
          setAssignments(data.assignments);
        }
        setIsDataReady(true); // 標記載入完成
      })
      .catch(err => {
        console.error("無法抓取目前排班資料", err);
        setIsDataReady(true);
      });
  }, []);

  const parseNames = (text) => {
    return text.split(/[,，\s\n]/).map(n => n.trim()).filter(n => n !== "");
  };

  // 按下此按鈕才會「覆蓋」目前的畫面顯示新生成的數據
  const generateSchedule = () => {
    const names = parseNames(scouterNames);
    if (names.length < 7) return alert("名單至少需要 7 人！");

    setScouterList(names);

    const matchKeys = Object.keys(schedule).sort((a, b) => parseInt(a) - parseInt(b));
    if (matchKeys.length === 0) return alert("請先匯入賽程！");

    const newAssignments = [];
    let nameIndex = 0;

    for (let i = 0; i < matchKeys.length; i += parseInt(shiftsPerBlock)) {
      const blockMatches = matchKeys.slice(i, i + parseInt(shiftsPerBlock));
      const currentShift = [];
      for (let j = 0; j < 7; j++) {
        currentShift.push(names[(nameIndex + j) % names.length]);
      }

      newAssignments.push({
        range: `Q${blockMatches[0]} - Q${blockMatches[blockMatches.length - 1]}`,
        head: currentShift[0],
        r1: currentShift[1], r2: currentShift[2], r3: currentShift[3],
        b1: currentShift[4], b2: currentShift[5], b3: currentShift[6]
      });
      nameIndex = (nameIndex + 7) % names.length; 
    }
    setAssignments(newAssignments); // 這裡更新 state，畫面就會變
  };

  const handleSelectChange = (index, field, value) => {
    const updated = [...assignments];
    updated[index][field] = value;
    setAssignments(updated);
  };

  const saveAllData = async () => {
    const names = parseNames(scouterNames);
    try {
      const response = await fetch(`http://${window.location.hostname}:5000/api/save-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          assignments: assignments,
          scouterList: names 
        })
      });
      if(response.ok) {
        setScouterList(names);
        alert("✅ 排班與名單已成功同步至資料庫！");
      }
    } catch (err) {
      alert("儲存失敗，請檢查後端是否正常運行");
    }
  };

  if (!isDataReady) return <div style={{padding: '20px'}}>載入中...</div>;

  return (
    <div className="tab-content">
      <div className="head-card">
        <h3>📋 Scouter 排班管理</h3>
        <div style={{ marginBottom: '15px' }}>
          <label className="head-label">Scouter 全員名單 (修改名單後可即時反映在下拉選單)</label>
          <textarea 
            className="head-input" 
            style={{ height: '80px', fontSize: '14px' }}
            placeholder="Apple, Banana, Grava..."
            value={scouterNames}
            onChange={e => setScouterNames(e.target.value)}
            onBlur={() => setScouterList(parseNames(scouterNames))}
          />
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="head-label">每幾場換班</label>
            <input type="number" className="head-input" value={shiftsPerBlock} onChange={e => setShiftsPerBlock(e.target.value)}/>
          </div>
          <button className="btn-action" onClick={generateSchedule} style={{ flex: 2 }}>⚡ 重新生成排班</button>
          <button className="btn-action" onClick={saveAllData} style={{ flex: 1, backgroundColor: '#4CAF50' }}>💾 儲存現有更動</button>
        </div>
      </div>

      {assignments.length > 0 ? (
        <div className="head-card" style={{ marginTop: '20px' }}>
          <h4>📅 目前排班詳情</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="verify-table" style={{ minWidth: '1100px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ width: '120px' }}>場次範圍</th>
                  <th>Head</th>
                  <th style={{ color: '#d32f2f' }}>Red 1</th>
                  <th style={{ color: '#d32f2f' }}>Red 2</th>
                  <th style={{ color: '#d32f2f' }}>Red 3</th>
                  <th style={{ color: '#1976d2' }}>Blue 1</th>
                  <th style={{ color: '#1976d2' }}>Blue 2</th>
                  <th style={{ color: '#1976d2' }}>Blue 3</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item, idx) => (
                  <tr key={idx}>
                    <td><b>{item.range}</b></td>
                    {[ 'head', 'r1', 'r2', 'r3', 'b1', 'b2', 'b3' ].map(field => (
                      <td key={field}>
                        <select 
                          className="table-select"
                          value={item[field] || ""} 
                          onChange={e => handleSelectChange(idx, field, e.target.value)}
                        >
                          <option value="" disabled>請選擇</option>
                          {/* 為了防止舊資料的人名不在新名單中，額外檢查 */}
                          {item[field] && !scouterList.includes(item[field]) && (
                            <option key={item[field]} value={item[field]}>{item[field]} (舊名單)</option>
                          )}
                          {scouterList.map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="head-card" style={{ marginTop: '20px', textAlign: 'center', color: '#666', padding: '40px' }}>
          <p>📭 目前資料庫中沒有排班資料。</p>
          <p style={{fontSize: '13px'}}>請在上方輸入名單並點擊「重新生成排班」。</p>
        </div>
      )}
    </div>
  );
};

export default AssignmentTab;