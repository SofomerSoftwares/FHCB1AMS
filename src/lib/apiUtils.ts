/**
 * Safe JSON parsing helper for fetch responses.
 * Prevents "SyntaxError: Unexpected token '<', '<!doctype '... is not valid JSON"
 * when a network error, proxy, gateway, or unexpected endpoint returns HTML.
 */
export async function safeJson<T = any>(
  res: Response,
  fallback: T = {} as T
): Promise<{ ok: boolean; data: T; status: number }> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      // Try to parse text in case header was missing or generic
      try {
        const parsed = JSON.parse(text);
        return { ok: res.ok, data: parsed, status: res.status };
      } catch {
        return { ok: false, data: fallback, status: res.status };
      }
    }
    const data = await res.json();
    return { ok: res.ok, data, status: res.status };
  } catch (err) {
    return { ok: false, data: fallback, status: res.status };
  }
}
