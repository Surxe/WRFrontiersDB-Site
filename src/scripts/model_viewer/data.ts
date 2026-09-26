/**
 * Runtime JSON fetching (with a shared promise cache) and object-ref helpers.
 */

const cache = new Map<string, Promise<unknown>>();

export function fetchJSON<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached) return cached as Promise<T>;
  const promise = fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
      return res.json() as Promise<T>;
    });
  cache.set(path, promise);
  return promise;
}

export function refToId(ref: string): string {
  return ref.includes('::') ? ref.split('::')[1] : ref;
}
