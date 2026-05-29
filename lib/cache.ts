const PREFIX = 'sg:';

// Cached entries are stamped with the app version. When the app updates, any
// entry written by an older version is treated as a miss instead of being
// deserialized into a possibly-incompatible shape (which would crash the UI on
// first paint, before network revalidation could correct it).
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

interface Envelope<T> {
  v: string;
  data: T;
}

export function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (parsed?.v !== VERSION) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const envelope: Envelope<T> = { v: VERSION, data };
    localStorage.setItem(PREFIX + key, JSON.stringify(envelope));
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
