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
  let parts = qrInput.trim().split('|');
  const metadata = {};
  if (parts[0] === 'FRC3') {
    if (parts.length !== 19 || !/^\d{4}[a-z0-9]+$/.test(parts[1]) || !/^[1-9]\d*$/.test(parts[2])) throw new Error('新版 QR 賽事或組別格式無效');
    metadata.eventKey = parts[1]; metadata.set_number = Number(parts[2]); metadata.officialMatchKey = parts[3] || undefined;
    parts = parts.slice(4);
  }
  // 目前格式含 Auto Climb（15 欄）；舊格式為 14 欄，或未帶賽事階段的 13 欄。
  if (![13, 14, 15].includes(parts.length)) throw new Error('QR 欄位數不符');
  const hasAutoClimb = parts.length === 15;
  const offset = hasAutoClimb ? 1 : 0;
  const compLevel = parts.length === 13 ? 'qm' : parts[parts.length - 1];
  if (!['pt', 'qm', 'ef', 'qf', 'sf', 'f'].includes(compLevel)) throw new Error('比賽階段無效');
  if (!parts[0] || !/^\d+$/.test(parts[1])) throw new Error('場次或隊伍格式無效');
  const numeric = (index, label, integer = false) => {
    const value = Number(parts[index]);
    if (parts[index] === '' || !Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
      throw new Error(`${label} 格式無效`);
    }
    return value;
  };
  const climb = numeric(9 + offset, 'Climb Level', true);
  if (climb > 3) throw new Error('Climb Level 必須介於 0–3');
  const autoClimb = hasAutoClimb ? numeric(6, 'Auto Climb', true) : null;
  if (autoClimb !== null && autoClimb > 3) throw new Error('Auto Climb 必須介於 0–3');
  const timeText = parts[10 + offset];
  if (timeText !== '') numeric(10 + offset, 'Climb Time');
  const ratingParts = parts[12 + offset].split(',').map(Number);
  if (ratingParts.length !== 3 || ratingParts.some(v => !Number.isInteger(v) || v < 1 || v > 5)) {
    throw new Error('評分必須為三個 1–5 的整數');
  }
  const decoded = decodeAutoData(parts[4]);
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    match: parts[0], team: parts[1], station: parts[2],
    ...metadata, compLevel, matchKey: metadata.officialMatchKey || `${compLevel}_${metadata.set_number ?? '?'}_${parts[0]}`,
    autoSuccess: parts[3] === '1', autoPath: decoded.path,
    autoFuel: numeric(5, 'Auto Fuel', true), autoClimbLevel: autoClimb,
    fuelH: numeric(6 + offset, 'Fuel', true),
    missed: numeric(7 + offset, 'Missed', true),
    avgCycle: numeric(8 + offset, 'Cycle'),
    climbLevel: String(climb), climbTime: timeText,
    tags: parts[11 + offset],
    ratings: { driver: ratingParts[0], defense: ratingParts[1], stability: ratingParts[2] },
    rawQr: qrInput.trim(), qrFormatVersion: metadata.eventKey ? 3 : hasAutoClimb ? 2 : 1,
    headNotes: '', verified: false, updatedAt: new Date().toISOString()
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