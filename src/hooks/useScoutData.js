import { useState, useEffect, useCallback } from 'react';

export const useScoutData = () => {
  const [matchData, setMatchData] = useState([]);
  const [pitData, setPitData] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [loading, setLoading] = useState(false);

  // 1. 從伺服器抓取所有原始數據
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:5000/api/data`);
      const data = await res.json();
      if (data.matchData) setMatchData(data.matchData);
      if (data.pitData) setPitData(data.pitData);
      if (data.schedule) setSchedule(data.schedule);
    } catch (err) {
      console.error("無法連線至本地資料庫伺服器", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. 同步數據到磁碟 (Node.js Server)
  const syncToDisk = async (currentMatches, currentPits, currentSchedule = schedule) => {
    try {
      const response = await fetch(`http://${window.location.hostname}:5000/api/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          matchData: currentMatches, 
          pitData: currentPits, 
          schedule: currentSchedule 
        })
      });
      if (!response.ok) throw new Error("網路回應不正常");
      console.log("💾 磁碟同步成功");
    } catch (err) {
      console.error("磁碟寫入失敗:", err);
      alert("磁碟同步失敗！請確認 Node.js Server 是否運行中。");
    }
  };

  // 3. 更新 Match 數據的統一入口 (自動觸發同步)
  const updateMatchData = async (newData) => {
    setMatchData(newData);
    await syncToDisk(newData, pitData);
  };

  // 4. 更新 Pit 數據的統一入口 (自動觸發同步)
  const updatePitData = async (newData) => {
    setPitData(newData);
    await syncToDisk(matchData, newData);
  };

  // 5. 更新 Schedule 數據 (例如手動輸入比分後)
  const updateSchedule = async (newSchedule) => {
    setSchedule(newSchedule);
    await syncToDisk(matchData, pitData, newSchedule);
  };

  // 初次加載
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    matchData,
    pitData,
    schedule,
    loading,
    updateMatchData,
    updatePitData,
    updateSchedule,
    refresh: fetchData // 讓 UI 可以手動重新整理
  };
};