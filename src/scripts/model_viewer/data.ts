/**
 * Runtime JSON fetching with a shared promise cache.
 *
 * (Object-ref parsing uses the shared `refToId` from `src/utils/object_reference`.)
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
