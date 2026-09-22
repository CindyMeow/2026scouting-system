import { writeJson } from '../utils/api';
import { useState, useEffect, useCallback, useRef } from 'react';

export const useScoutData = () => {
  const [matchData, setMatchData] = useState([]);
  const [pitData, setPitData] = useState([]);
  const [schedule, setSchedule] = useState({});
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(false);
  const snapshot = useRef(null);
  const saving = useRef(false);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('載入資料失敗');
      const data = await response.json();
      snapshot.current = data;
      setContext({ eventKey: data.eventKey, revisions: data.revisions });
      setMatchData(data.matchData || []);
      setPitData(data.pitData || []);
      setSchedule(data.schedule || {});
      window.dispatchEvent(new Event('scout-data-updated'));
    } finally { setLoading(false); }
  }, []);

  const save = async (field, value) => {
    if (!snapshot.current || saving.current) { alert('資料尚在載入或儲存中，請稍後再試'); return false; }
    saving.current = true;
    try {
      const next = typeof value === 'function' ? value(snapshot.current[field]) : value;
      await writeJson(field === 'schedule' ? '/api/save-schedule' : '/api/save', { [field]: next }, snapshot.current);
      await fetchData().catch(() => alert('資料已儲存，但重新載入失敗，請重新整理；勿重複送出'));
      return true;
    } catch (err) { alert(err.message); return false; }
    finally { saving.current = false; }
  };
  const handleSyncOfficial = async () => {
    if (saving.current) return;
    saving.current = true;
    setLoading(true);
    try {
      const result = await writeJson('/api/sync-tba-matches', {}, snapshot.current);
      await fetchData();
      alert(`已同步 ${result.count} 場官方賽程`);
    } catch (err) { alert(err.message); }
    finally { saving.current = false; setLoading(false); }
  };
  useEffect(() => { fetchData().catch(err => console.error(err)); }, [fetchData]);
  const write = async (url, body) => {
    if (saving.current) throw new Error('另一筆資料正在儲存，請稍後再試');
    saving.current = true;
    try {
      const result = await writeJson(url, body, snapshot.current);
      await fetchData().catch(() => alert('資料已儲存，但重新載入失敗，請重新整理'));
      return result;
    } finally { saving.current = false; }
  };
  return { matchData, pitData, schedule, loading, context, write,
    updateMatchData: value => save('matchData', value),
    updatePitData: value => save('pitData', value),
    updateSchedule: value => save('schedule', value),
    handleSyncOfficial, refresh: fetchData };
};
