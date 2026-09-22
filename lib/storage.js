const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const readJson = (file, fallback) => {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return text ? JSON.parse(text) : fallback;
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};

function atomicWriteJson(file, value, { backup = true, keep = 20 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let descriptor;
  try {
    descriptor = fs.openSync(temp, 'wx');
    fs.writeFileSync(descriptor, content, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    if (backup && fs.existsSync(file)) {
      const backupDir = path.join(path.dirname(file), '.backups');
      fs.mkdirSync(backupDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync(file, path.join(backupDir, `${path.basename(file)}.${stamp}.bak`));
      const backups = fs.readdirSync(backupDir)
        .filter(name => name.startsWith(`${path.basename(file)}.`) && name.endsWith('.bak'))
        .sort().reverse();
      backups.slice(keep).forEach(name => fs.unlinkSync(path.join(backupDir, name)));
    }
    fs.renameSync(temp, file);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
    throw error;
  }
}

module.exports = { readJson, atomicWriteJson };
