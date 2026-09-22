export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field.trim()); field = ''; }
    else if (char === '\n') { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (quoted) throw new Error('CSV 引號未正確結束');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) throw new Error('CSV 沒有資料');
  return rows;
}

export function recordsFromCsv(text) {
  const rows = parseCsv(text);
  const headers = rows[0].map(header => header.trim());
  if (headers.some((header, index) => !header || headers.indexOf(header) !== index)) {
    throw new Error('CSV 欄位名稱空白或重複');
  }
  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV 第 ${index + 2} 列欄位數不符`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}
