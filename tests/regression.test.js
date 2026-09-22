const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { metrics, normalizeSchedule } = require('../lib/scout');
const sync = require('../lib/external');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-test-'));
process.env.SCOUT_DATA_DIR = tmp;
process.env.CURRENT_EVENT = '2026test';
process.env.TBA_API_KEY = 'test-only';
const app = require('../server');
let server, base;
before(async () => { server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening',r)); base = `http://127.0.0.1:${server.address().port}`; });
after(() => server.close());
async function rawApi(url, body) {
 const response = await fetch(base+url, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 return { status:response.status, data:await response.json() };
}
async function api(url, body) {
 if (body !== undefined || url.startsWith('/api/sync-')) {
  const context = (await rawApi('/api/data')).data;
  return rawApi(url, { eventKey:context.eventKey, revisions:context.revisions, ...body });
 }
 return rawApi(url);
}
test('EPA uses mean and preserves legitimate zero', () => {
 assert.equal(metrics({epa:{total_points:{mean:0},breakdown:{auto_points:0},ranks:{total:{percentile:0}}}}).EPA,0);
 assert.equal(metrics({epa:{total_points:{mean:42}}}).EPA,42);
 assert.throws(() => metrics({}),/EPA/);
});
test('schedules keep qualification and playoff identity separate', () => {
 const d = normalizeSchedule([{match_number:1,comp_level:'qm'}, {match_number:1,comp_level:'sf',set_number:1},{match_number:1,comp_level:'sf',set_number:2}]);
 assert.deepEqual(Object.keys(d),['1','sf1m1','sf2m1']);
});
test('stale match save cannot overwrite new records or unrelated Pit records', async () => {
 const initial = (await api('/api/data')).data;
 await api('/api/save-pit',{pitData:[{team:11,climb:'Level1'}]});
 const saved = await api('/api/save',{eventKey:initial.eventKey,revisions:initial.revisions,matchData:[{id:1,team:11}]});
 assert.equal(saved.status,200);
 assert.equal((await api('/api/data')).data.pitData.length,1);
 const conflict = await api('/api/save',{eventKey:initial.eventKey,revisions:initial.revisions,matchData:[]});
 assert.equal(conflict.status,409);
 assert.equal((await api('/api/data')).data.matchData.length,1);
});
test('Pit import merges teams without deleting existing records', async () => {
 assert.equal((await api('/api/save-pit',{pitData:[{team:22,climb:'Level2'}]})).status,200);
 assert.equal((await api('/api/data')).data.pitData.length,2);
});
test('schedule save persists, and score update targets exact key', async () => {
 await api('/api/save-schedule',{schedule:[{match:1,red1:11},{match:2,red1:22}]});
 assert.equal((await api('/api/update-score',{matchKey:'2',redScore:100})).status,200);
 const s = (await api('/api/data')).data.schedule;
 assert.equal(s['2'].scores.red,100);
 assert.equal(s['1'].scores,undefined);
});
const team = {team_number:11,nickname:'Test'};
function mock({failEPA=false,failTBA=false,empty=false}={}) { return { get:async url => {
 if (url.endsWith('/teams')) return {data:empty?[]:[team]};
 if (url.includes('statbotics')) { if(failEPA) throw Error('500'); return {data:{epa:{total_points:{mean:42},breakdown:{auto_points:12}}}}; }
 if(failTBA) throw Error('503');
 if(url.endsWith('/statuses')) return {data:{a:{qual:{ranking:{sort_orders:[99],rank:1}}},b:{qual:{ranking:{}}}}};
 if(url.includes('/event/a/')) return {data:{oprs:{frc11:-2}}};
 if(url.includes('/event/b/')) return {data:{oprs:{frc11:0}}};
 throw Error('unexpected URL');
 }}; }
const args = { key:'fake',event:'2026test',year:'2026',teams:{},previous:[] };
test('OPR uses actual OPR including zero and negative values',async () => {
 const r = await sync({...args,axios:mock()});
 assert.equal(r.data[0].OPR,-1); assert.equal(r.data[0].EPA,42); assert.equal(r.failed,0);
});
test('Statbotics failure preserves old EPA and reports partial failure',async () => {
 const r = await sync({...args,previous:[{team_number:11,EPA:50}],axios:mock({failEPA:true})});
 assert.equal(r.data[0].EPA,50); assert.equal(r.data[0].OPR,-1); assert.equal(r.failed,1);
});
test('total source failure never fabricates successful count',async () => {
 const r = await sync({...args,previous:[{team_number:11,EPA:50,OPR:20}],axios:mock({failEPA:true,failTBA:true})});
 assert.equal(r.count,0); assert.equal(r.data[0].EPA,50); assert.equal(r.data[0].OPR,20);
});
test('empty event and missing key reject', async () => {
 await assert.rejects(sync({...args,axios:mock({empty:true})}),/隊伍/);
 await assert.rejects(sync({...args,key:'',axios:mock()}),/TBA_API_KEY/);
});
test('failed sync route preserves the exact cache file', async () => {
 const axios = require('axios'), originalGet = axios.get;
 const file = path.join(tmp,'2026test/external/copr_data.json');
 fs.writeFileSync(file,JSON.stringify([{team_number:11,EPA:50,OPR:20}]));
 const before = fs.readFileSync(file,'utf8');
 axios.get = mock({failEPA:true,failTBA:true}).get;
 try {
  const result = await api('/api/sync-external');
  assert.equal(result.status,502);
  assert.equal(fs.readFileSync(file,'utf8'),before);
 } finally { axios.get = originalGet; }
});
test('official sync populates empty schedule and uses scores consumed by UI', async () => {
 const axios = require('axios'), originalGet = axios.get;
 fs.writeFileSync(path.join(tmp,'2026test/static/schedule.json'),'{}');
 axios.get = async () => ({data:[{key:'2026test_qm1',match_number:1,comp_level:'qm',
  alliances:{red:{team_keys:['frc11'],score:40},blue:{team_keys:['frc22'],score:30}},score_breakdown:{red:{rp:3}}}]});
 try {
  assert.equal((await api('/api/sync-tba-matches')).status,200);
  const match = (await api('/api/data')).data.schedule['2026test_qm1'];
  assert.equal(match.scores.red,40); assert.deepEqual(match.red,['11']);
 } finally { axios.get = originalGet; }
});

test('notes persist and unrelated match stays unchanged', async () => {
 const snapshot = (await api('/api/data')).data;
 const matches = [{id:100,team:11,headNotes:'old'},{id:101,team:22,headNotes:'keep'}];
 assert.equal((await api('/api/save',{matchData:matches})).status,200);
 const current=(await api('/api/data')).data;
 const next=current.matchData.map(m=>m.id===100?{...m,headNotes:'saved note'}:m);
 assert.equal((await rawApi('/api/save',{eventKey:current.eventKey,revisions:current.revisions,matchData:next})).status,200);
 const reread=(await api('/api/data')).data;
 assert.equal(reread.matchData[0].headNotes,'saved note');
 assert.deepEqual(reread.matchData[1],matches[1]);
 assert.equal((await rawApi('/api/save',{eventKey:current.eventKey,revisions:current.revisions,matchData:matches})).status,409);
});
test('all guarded write routes reject wrong events, missing and stale revisions without changing files', async () => {
 const bodies={
  '/api/upload-pit':{data:[{team:11,eventKey:'2026test'}]}, '/api/save-pit':{pitData:[]},
  '/api/update-score':{matchKey:'2026test_qm1',redScore:999}, '/api/save-schedule':{schedule:{}},
  '/api/save-teams':{teams:{}}, '/api/save-assignments':{assignments:[],scouterList:[]},
  '/api/save-copr':{coprData:[]}, '/api/sync-tba-matches':{}, '/api/sync-external':{}
 };
 const context=(await api('/api/data')).data;
 const before=JSON.stringify(context);
 for(const [url,body] of Object.entries(bodies)) {
  assert.equal((await rawApi(url,{...body,eventKey:'2026wrong',revisions:context.revisions})).status,409,url);
  assert.equal((await rawApi(url,{...body,eventKey:context.eventKey})).status,409,url);
  assert.equal((await rawApi(url,{...body,eventKey:context.eventKey,revisions:Object.fromEntries(Object.keys(context.revisions).map(k=>[k,'stale']))})).status,409,url);
 }
 assert.equal(JSON.stringify((await api('/api/data')).data),before);
});
test('Pit, scores, teams, assignments and COPR accept matching versions then reject replay',async()=>{
 const cases=[
  ['/api/upload-pit',{data:[{team:11,eventKey:'2026test',notes:'new'}],scouter:'test'}],
  ['/api/save-pit',{pitData:[{team:33,notes:'pit'}]}],
  ['/api/update-score',{matchKey:'2026test_qm1',redScore:99}],
  ['/api/save-schedule',{schedule:[{match:5,red1:11}]}],
  ['/api/save-teams',{teams:{11:{team_name:'Test'}}}],
  ['/api/save-assignments',{assignments:[{head:'Test'}],scouterList:['Test']}],
  ['/api/save-copr',{coprData:[{team_number:11,OPR:55}]}]
 ];
 for(const [url,payload] of cases){
  const snapshot=(await api('/api/data')).data;
  const body={...payload,eventKey:snapshot.eventKey,revisions:snapshot.revisions};
  assert.equal((await rawApi(url,body)).status,200,url);
  assert.equal((await rawApi(url,body)).status,409,url+' replay');
 }
});
test('switching event invalidates old clients',async()=>{
 const context=(await api('/api/data')).data;
 assert.equal((await rawApi('/api/system/switch-event',{year:'2026',eventKey:'2026other',expectedEventKey:context.eventKey})).status,200);
 assert.equal((await rawApi('/api/save-teams',{teams:{},eventKey:context.eventKey,revisions:context.revisions})).status,409);
 assert.equal((await api('/api/data')).data.eventKey,'2026other');
 assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp,'system_config.json'))), {year:'2026',eventKey:'2026other'});
 assert.equal((await rawApi('/api/system/switch-event',{year:'2026',eventKey:'2026test',expectedEventKey:'2026test'})).status,409);
});
test('complete backup export contains current event data and no API key',async()=>{
 const result=await rawApi('/api/system/export');
 assert.equal(result.status,200);
 assert.equal(result.data.format,'frc-scout-backup-v1');
 assert.equal(result.data.eventKey,'2026other');
 assert.ok(Array.isArray(result.data.matchData));
 assert.equal(JSON.stringify(result.data).includes('test-only'),false);
});
