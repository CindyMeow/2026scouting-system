const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
// 可在暫存檔或專案 tests/ 中執行。
const root = process.env.FRC_QR_ROOT || path.resolve(__dirname, '..');
const parserFile = process.env.FRC_QR_PARSER || path.join(root,'src/utils/dataParser.js');
const parser = import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(parserFile,'utf8')).toString('base64'));
test('actual Match encoder round-trips every field through Head parser', async () => {
 const source=fs.readFileSync(path.join(root,'src/ScouterPage.js'),'utf8');
 const expression=source.match(/const compressedData = ([\s\S]*?\.join\('\|'\));/)[1];
 const qr=vm.runInNewContext(expression,{eventKey:'2026test',currentMatchData:{set_number:1,key:'2026test_qm1'},matchNum:1,matchInfo:{team:'9094',station:'Red 1'},autoSuccess:false,
  compressPath:()=> 'P_S',autoPath:[],shotLocations:[],autoFuel:60,autoClimbLevel:1,fuelH:30,missed:0,
  avgCycle:2.3,climbLevel:1,climbTime:2.1,tags:{a:false,b:true,c:true,d:false},ratings:{driver:4,defense:3,stability:5},compLevel:'qm'});
 const d=(await parser).parseQrData(qr);
 assert.equal(d.autoClimbLevel,1); assert.equal(d.fuelH,30); assert.equal(d.missed,0);
 assert.equal(d.avgCycle,2.3); assert.equal(d.climbLevel,'1'); assert.equal(d.climbTime,'2.1');
 assert.equal(d.tags,'0110'); assert.deepEqual(d.ratings,{driver:4,defense:3,stability:5});
 assert.equal(d.rawQr,qr); assert.equal(d.compLevel,'qm');
});
test('old QR without Auto Climb still decodes correctly', async () => {
 const qr='1|11|Red 1|1|P_S|5|20|3|4.5|2|8|1000|4,3,5';
 for(const input of [qr,qr+'|sf']) {
  const d=(await parser).parseQrData(input);
  assert.equal(d.fuelH,20); assert.equal(d.climbLevel,'2'); assert.equal(d.climbTime,'8');
  assert.equal(d.autoClimbLevel,null);
 }
});
test('invalid QR is rejected instead of producing corrupted record', async () => {
 const parse=(await parser).parseQrData;
 assert.throws(()=>parse('1|11'));
 assert.throws(()=>parse('1|11|Red 1|1|P_S|5|20|3|4.5|2.3|8|1000|4,3,5|qm'),/Climb/);
});
