export async function readJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || '讀取失敗');
  return body;
}
export async function writeJson(url, body, context) {
  if (!context?.eventKey || !context?.revisions) throw new Error('資料尚未載入，請重新整理');
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, eventKey: context.eventKey, revisions: context.revisions }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `儲存失敗 (${response.status})`);
  return result;
}
