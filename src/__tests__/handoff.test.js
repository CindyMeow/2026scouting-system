import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import ProfileTab from '../Head/profile';
import AnalysisPage from '../Analysis/AnalysisPage';
import { parseQrData } from '../utils/dataParser';
import { sameMatch, replaceMatch, totalFuel, updateMatchNotes } from '../utils/matchIdentity';
import { buildTeamHistory } from '../utils/teamHistory';
import { allianceEstimate } from '../utils/simulation';
import { writeJson } from '../utils/api';
import { useScoutData } from '../hooks/useScoutData';
import { parseCsv, recordsFromCsv } from '../utils/csv';
import { eventStorageKey, loadStored, saveStored } from '../utils/eventStorage';

global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => { container=document.createElement('div'); document.body.appendChild(container); root=createRoot(container); localStorage.clear(); window.alert=jest.fn(); });
afterEach(() => { act(()=>root.unmount()); container.remove(); jest.restoreAllMocks(); });
const render = async element => { await act(async()=>root.render(element)); };
const click = async text => { const element=[...container.querySelectorAll('button')].find(b=>b.textContent.includes(text)); expect(element).toBeTruthy(); await act(async()=>element.dispatchEvent(new MouseEvent('click',{bubbles:true}))); };
const record={id:1,team:'9094',match:'1',compLevel:'qm',fuelH:30,autoFuel:60,climbLevel:'1',climbTime:'2.1',ratings:{driver:3,defense:3,stability:3},headNotes:'old'};

test('notes modal closes only after a successful save and shows total fuel',async()=>{
 const save=jest.fn().mockResolvedValue(false);
 await render(<ProfileTab selectedTeam="9094" profile={{history:[record]}} schedule={{}} drawAutoPaths={()=>{}} onUpdateMatch={save} />);
 expect(container.textContent).toContain('90');
 await click('✏️');
 const area=container.querySelector('textarea');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'new note');area.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('保存更新');
 expect(save).toHaveBeenCalledWith(expect.objectContaining({id:1,headNotes:'new note'}));
 expect(container.querySelector('textarea')).not.toBeNull();
 expect(window.alert).not.toHaveBeenCalledWith('備註已更新');
 save.mockResolvedValue(true); await click('保存更新');
 expect(container.querySelector('textarea')).toBeNull();
 expect(window.alert).toHaveBeenCalledWith('備註已更新');
});
test('note update changes only selected record and duplicate reimport replaces rather than adds',()=>{
 const other={...record,id:2,team:'11'};
 expect(updateMatchNotes([record,other],1,'new')[1]).toBe(other);
 const updated=replaceMatch([record,other],{...record,id:100,fuelH:40});
 expect(updated).toHaveLength(2);expect(updated[0].id).toBe(1);expect(totalFuel(updated[0])).toBe(100);
 expect(updated[0].headNotes).toBe('old');expect(updated[0].verified).toBe(false);
});
const qrTail='1|9094|Red 1|0|P_S|60|1|30|0|2.3|1|2.1|0110|3,3,3|sf';
test('new QR retains playoff set identity through import and schedule history',()=>{
 const a=parseQrData('FRC3|2026test|1|2026test_sf1m1|'+qrTail);
 const b=parseQrData('FRC3|2026test|2|2026test_sf2m1|'+qrTail);
 expect(sameMatch(a,b)).toBe(false);
 expect(replaceMatch([a],b)).toHaveLength(2);
 const schedule=[1,2].map(set_number=>({key:`2026test_sf${set_number}m1`,comp_level:'sf',match_number:1,set_number,red:['9094']}));
 const history=buildTeamHistory(schedule,[a,b],'9094');
 expect(history.map(r=>r.match)).toEqual(['SF1','SF2']);
 expect(history.every(r=>r.scouterData&&r.scheduled)).toBe(true);
});
test('Pick List survives remount, does not repopulate assigned teams, and is isolated by event',async()=>{
 const props={allTeamsData:{eventKey:'2026a',teams:{9094:{}}},coprData:[]};
 await render(<AnalysisPage {...props}/>);await click('Picks');await click('Add');
 expect(container.querySelectorAll('.team-num')).toHaveLength(1);
 await render(<div/>);await render(<AnalysisPage {...props}/>);await click('Picks');
 expect(container.querySelectorAll('.team-num')).toHaveLength(1);
 expect([...container.querySelectorAll('button')].some(b=>b.textContent==='Add')).toBe(false);
 await render(<AnalysisPage {...props} allTeamsData={{...props.allTeamsData,eventKey:'2026b'}}/>);
 expect([...container.querySelectorAll('button')].some(b=>b.textContent==='Add')).toBe(true);
 await render(<AnalysisPage {...props}/>);
 expect([...container.querySelectorAll('button')].some(b=>b.textContent==='Add')).toBe(false);
});
test('alliance totals count OPR or EPA once and refuse missing, stale or duplicate values',()=>{
 const data=[1,2,3].map(team_number=>({team_number,OPR:10,EPA:20,auto_EPA:5,endgame_EPA:8}));
 expect(allianceEstimate(['1','2','3'],data,'OPR').total).toBe(30);
 expect(allianceEstimate(['1','2','3'],data,'EPA').total).toBe(60);
 expect(allianceEstimate(['1','2','4'],data,'EPA').total).toBeNull();
 expect(allianceEstimate(['1','1','2'],data,'EPA').total).toBeNull();
 data[0].sync_warnings=['Statbotics EPA 查詢失敗'];
 expect(allianceEstimate(['1','2','3'],data,'EPA').total).toBeNull();
 expect(allianceEstimate(['1','2','3'],data,'OPR').total).toBe(30);
});
test('write client transmits original page context and rejects a conflict',async()=>{
 global.fetch=jest.fn().mockResolvedValue({ok:false,status:409,json:async()=>({error:'版本衝突'})});
 await expect(writeJson('/api/save-teams',{teams:{}},{eventKey:'2026old',revisions:{teams:'old'}})).rejects.toThrow('版本衝突');
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({teams:{},eventKey:'2026old',revisions:{teams:'old'}});
});
test('successful save followed by failed refresh is not reported as failed write',async()=>{
 let hook;
 function Probe(){hook=useScoutData();return null;}
 const snapshot={eventKey:'2026a',revisions:{matchData:'version'},matchData:[record],pitData:[],schedule:{}};
 global.fetch=jest.fn().mockResolvedValueOnce({ok:true,json:async()=>snapshot})
  .mockResolvedValueOnce({ok:true,json:async()=>({})}).mockRejectedValueOnce(new Error('offline'));
 await render(<Probe/>);
 let success;
 await act(async()=>{success=await hook.updateMatchData([record]);});
 expect(success).toBe(true);
 expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('資料已儲存'));
});
test('quoted CSV fields and embedded line breaks parse without shifting columns',()=>{
 const text='team_number,team_name,notes\r\n9094,"Robots, Inc.","line 1\nline 2"';
 expect(recordsFromCsv(text)).toEqual([{team_number:'9094',team_name:'Robots, Inc.',notes:'line 1\nline 2'}]);
 expect(()=>parseCsv('a,b\n"broken,b')).toThrow('引號');
 expect(()=>recordsFromCsv('a,a\n1,2')).toThrow('重複');
});
test('browser caches are separated by event and malformed cache falls back safely',()=>{
 saveStored('schedule','2026a',{1:{team:11}});
 saveStored('schedule','2026b',{1:{team:22}});
 expect(loadStored('schedule','2026a',{})).toEqual({1:{team:11}});
 expect(loadStored('schedule','2026b',{})).toEqual({1:{team:22}});
 localStorage.setItem(eventStorageKey('schedule','2026bad'),'{bad');
 expect(loadStored('schedule','2026bad',{})).toEqual({});
});

test('Head page duplicate QR flow sends one replacement with original id',async()=>{
 const HeadScoutPage=require('../Head/HeadScoutPage').default;
 let data={eventKey:'2026test',revisions:{matchData:'v1'},matchData:[record],pitData:[],schedule:{},teams:{}};
 global.fetch=jest.fn(async(url,options)=>{
  if(url==='/api/system/config')return {ok:true,json:async()=>({eventKey:'2026test',year:'2026'})};
  if(url==='/api/data')return {ok:true,json:async()=>data};
  if(url==='/api/save') {const body=JSON.parse(options.body);data={...data,matchData:body.matchData};return {ok:true,json:async()=>({})};}
  throw Error(url);
 });
 window.confirm=jest.fn(()=>true);
 await render(<HeadScoutPage teams={{}} setTeams={()=>{}}/>);
 const area=container.querySelector('textarea');
 const qr='FRC3|2026test|1|2026test_qm1|'+qrTail.replace(/\|sf$/,'|qm');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,qr);area.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('確認匯入紀錄');
 expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('取代'));
 expect(data.matchData).toHaveLength(1);expect(data.matchData[0].id).toBe(1);
 expect(data.matchData[0].headNotes).toBe('old');
 expect(data.matchData[0].qrFormatVersion).toBe(3);
});
test('Head page note callback saves the full collection and preserves other teams',async()=>{
 const HeadScoutPage=require('../Head/HeadScoutPage').default;
 jest.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({});
 const other={...record,id:2,team:'11'};
 let data={eventKey:'2026test',revisions:{matchData:'v1'},matchData:[record,other],pitData:[],schedule:{},teams:{}};
 global.fetch=jest.fn(async(url,options)=>{
  if(url==='/api/system/config')return {ok:true,json:async()=>({eventKey:'2026test',year:'2026'})};
  if(url==='/api/data')return {ok:true,json:async()=>data};
  if(url==='/api/save') {const body=JSON.parse(options.body);expect(Array.isArray(body.matchData)).toBe(true);data={...data,matchData:body.matchData};return {ok:true,json:async()=>({})};}
  throw Error(url);
 });
 await render(<HeadScoutPage teams={{}} setTeams={()=>{}} externalTeam="9094"/>);
 await click('✏️');
 const area=container.querySelector('textarea');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(area,'persistent note');area.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('保存更新');
 expect(data.matchData[0].headNotes).toBe('persistent note');
 expect(data.matchData[1]).toEqual(other);
 expect(container.textContent).toContain('persistent note');
});
