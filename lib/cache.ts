const PREFIX = 'sg:';

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch {
    // Quota exceeded or unavailable — degrade silently.
  }
}

/** Removes every cache entry. Called on sign-out so one user's data is not
 * left readable in localStorage on a shared device. */
export function clearCache(): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Unavailable — nothing to clear.
  }
}
