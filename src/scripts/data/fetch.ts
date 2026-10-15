/**
 * Runtime (browser) JSON fetching from the data repo the site serves at
 * `/WRFrontiersDB-Data/`, shared by the pages' scripts.
 */

const jsonCache = new Map<string, Promise<unknown>>();

/** Fetch and parse a JSON file once per page; later calls share the result. */
export function fetchJson<T>(url: string): Promise<T> {
  let promise = jsonCache.get(url);
  if (!promise) {
    promise = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res.json();
    });
    jsonCache.set(url, promise);
    // A failed fetch may be retried later.
    promise.catch(() => jsonCache.delete(url));
  }
  return promise as Promise<T>;
}
