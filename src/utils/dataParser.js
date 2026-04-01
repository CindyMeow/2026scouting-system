/**
 * 2026 FRC Scouting Data Utility
 * 負責數據解碼、壓縮、校正與準確率計算
 */

// 1. 解碼 Auto Path 座標數據 (Level 1 壓縮還原)
export const decodeAutoData = (rawStr) => {
  if (!rawStr || (!rawStr.startsWith('P') && !rawStr.includes('_'))) {
    return { path: rawStr || "", isNewFormat: false };
  }

  const parts = rawStr.split('_');
  const pathRaw = parts[0]?.replace('P', '') || '';
  
  const parsePoints = (str) => {
    const pts = [];
    for (let i = 0; i < str.length; i += 4) {
      const x = str.substring(i, i + 2);
      const y = str.substring(i + 2, i + 4);
      pts.push(`${parseInt(x)}-${parseInt(y)}`);
    }
    return pts.join(';');
  };

  return {
    path: parsePoints(pathRaw),
    isNewFormat: true
  };
};

// 2. 解析 QR Code 字串並轉化為物件
export const parseQrData = (qrInput) => {
  const parts = qrInput.trim().split('|');
  const ratingParts = parts[12] ? parts[12].split(',') : [3, 3, 3];
  const decoded = decodeAutoData(parts[4]);

  return {
    id: Date.now() + Math.floor(Math.random() * 1000), // 增加隨機值避免同毫秒碰撞
    match: parts[0],
    team: parts[1],
    station: parts[2],
    autoSuccess: parts[3] === '1',
    autoPath: decoded.path,
    autoFuel: parseInt(parts[5]) || 0,
    fuelH: parseInt(parts[6]) || 0,
    missed: parseInt(parts[7]) || 0,
    avgCycle: parseFloat(parts[8]) || 0,
    climbLevel: parts[9] || '0',
    climbTime: parts[10] || "",
    tags: parts[11] || "0000",
    ratings: {
      driver: parseInt(ratingParts[0]) || 3,
      defense: parseInt(ratingParts[1]) || 3,
      stability: parseInt(ratingParts[2]) || 3
    },
    headNotes: "",
    verified: false,
    updatedAt: new Date().toISOString()
  };
};

// 3. ✨ 新增：計算 Scouter 的準確率 (基於官方總分)
export const calculateAccuracy = (scoutedTotal, officialTotal) => {
  if (officialTotal === 0) return scoutedTotal === 0 ? 100 : 0;
  const error = Math.abs(scoutedTotal - officialTotal);
  const accuracy = Math.max(0, 100 - (error / officialTotal) * 100);
  return accuracy.toFixed(1);
};

// 4. ✨ 新增：官方數據加權校正邏輯
// 當 Head Scout 輸入官方總分時，按比例重新分配得分
export const adjustScoresByOfficial = (matchGroup, officialAllianceScore) => {
  const totalScouted = matchGroup.reduce((sum, m) => sum + (m.fuelH || 0), 0);
  if (totalScouted === 0) return matchGroup;

  const ratio = officialAllianceScore / totalScouted;

  return matchGroup.map(m => ({
    ...m,
    adjustedFuelH: (m.fuelH * ratio).toFixed(1), // 儲存校正後的得分
    confidence: calculateAccuracy(totalScouted, officialAllianceScore)
  }));
};