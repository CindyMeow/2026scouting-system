export const LAST_EVENT_KEY = 'frc_last_event';
export const eventStorageKey = (name, eventKey) => `frc_${name}:${eventKey}`;

export function loadStored(name, eventKey, fallback) {
  if (!eventKey) return fallback;
  try {
    const raw = localStorage.getItem(eventStorageKey(name, eventKey));
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveStored(name, eventKey, value) {
  if (!eventKey) throw new Error('尚未選擇賽事');
  localStorage.setItem(eventStorageKey(name, eventKey), JSON.stringify(value));
}
