export const BAR_STORAGE_KEY = "rtpg_active_bar_id";

export function getStoredBarId(): string | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  return localStorage.getItem(BAR_STORAGE_KEY);
}

export function setStoredBarId(id: string) {
  localStorage.setItem(BAR_STORAGE_KEY, id);
}

export function clearStoredBarId() {
  localStorage.removeItem(BAR_STORAGE_KEY);
}
