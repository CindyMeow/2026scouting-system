import React, { useState } from 'react';
import { allianceEstimate, metricValue } from '../utils/simulation';

const SimulatorTab = ({ allTeamsData, coprData = [], alliance, setAlliance }) => {
  const [metric, setMetric] = useState('OPR');
  const options = Object.keys(allTeamsData?.teams || {}).sort((a,b) => Number(a)-Number(b));
  const red = allianceEstimate(alliance.red, coprData, metric);
  const blue = allianceEstimate(alliance.blue, coprData, metric);
  const selected = [...alliance.red, ...alliance.blue].filter(Boolean);
  const duplicate = new Set(selected).size !== selected.length;
  const format = value => value == null ? '資料不足' : value.toFixed(1);
  return <div className="scout-card">
    <h3>聯盟數據比較</h3>
    <label>比較依據：<select value={metric} onChange={e => setMetric(e.target.value)}><option value="OPR">平均 OPR</option><option value="EPA">EPA</option></select></label>
    <p>同一聯盟三隊的 {metric} 相加作為參考，總值已包含各得分階段，不再加上爬升分數。這不是經驗證的比賽勝率，未加入防守、犯規或配合效果。</p>
    {metric === 'OPR' && <p>目前 OPR 為各隊年度參賽賽事的平均值，跨賽事比較僅供參考。</p>}
    {duplicate && <p role="alert">六個位置不能重複選擇同一隊伍。</p>}
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {['red','blue'].map(color => <section key={color} style={{ flex: 1, minWidth: 240 }}>
        <h3>{color === 'red' ? '🔴 Red Alliance' : '🔵 Blue Alliance'}</h3>
        {alliance[color].map((team, index) => {
          const record = coprData.find(r => String(r.team_number) === String(team));
          return <div key={index} style={{ marginBottom: 12 }}>
            <select aria-label={`${color} ${index+1}`} value={team} onChange={e => { const value = e.target.value; setAlliance(prev => ({ ...prev, [color]: prev[color].map((t,i) => i === index ? value : t) })); }}>
              <option value="">選擇隊伍</option>{options.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {team && <span> {metric}: {format(metricValue(record, metric))}</span>}
            {team && record?.sync_warnings?.length > 0 && <small style={{ display: 'block' }}>{record.sync_warnings.join('；')}</small>}
          </div>;
        })}
        <strong>{metric} 合計：{duplicate ? '隊伍重複' : format((color === 'red' ? red : blue).total)}</strong>
      </section>)}
    </div>
    {!duplicate && red.ready && blue.ready && <p>紅方 − 藍方：{(red.total-blue.total).toFixed(1)}（{metric}）</p>}
  </div>;
};
export default SimulatorTab;
