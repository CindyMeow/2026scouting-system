const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { readJson, atomicWriteJson } = require('../lib/storage');

test('atomic JSON writes remain readable and create a recoverable backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-storage-'));
  const file = path.join(dir, 'data.json');
  atomicWriteJson(file, { version: 1 });
  atomicWriteJson(file, { version: 2 });
  assert.deepEqual(readJson(file), { version: 2 });
  const backups = fs.readdirSync(path.join(dir, '.backups'));
  assert.equal(backups.length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, '.backups', backups[0]))), { version: 1 });
  assert.equal(fs.readdirSync(dir).some(name => name.endsWith('.tmp')), false);
});

test('backup retention removes only older backups for the same file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scout-retention-'));
  const file = path.join(dir, 'data.json');
  atomicWriteJson(file, { version: 0 });
  for (let version = 1; version <= 5; version += 1) atomicWriteJson(file, { version }, { keep: 2 });
  assert.ok(fs.readdirSync(path.join(dir, '.backups')).length <= 2);
  assert.deepEqual(readJson(file), { version: 5 });
});
