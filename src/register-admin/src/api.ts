// Liten fetch-klient. Token lagras i sessionStorage – rensas när fliken stängs.
const TOKEN_KEY = 'rs_token';

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (t: string) => sessionStorage.setItem(TOKEN_KEY, t),
  clear: () => sessionStorage.removeItem(TOKEN_KEY)
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });

  if (res.status === 401 && !url.endsWith('/api/auth/login')) {
    tokenStore.clear();
    onUnauthorized?.();
    throw new ApiError(401, 'Du har blivit utloggad. Logga in igen.');
  }
  if (!res.ok) {
    let msg = `Fel ${res.status}`;
    let data: unknown;
    try {
      data = await res.json();
      const d = data as { title?: string; detail?: string; errors?: Record<string, string[]> };
      const fieldErrors = d.errors ? Object.values(d.errors).flat().join(' ') : '';
      msg = [d.title, d.detail, fieldErrors].filter(Boolean).join(' – ') || msg;
    } catch { /* inget JSON-svar */ }
    if (res.status === 403) msg = 'Du saknar behörighet för detta.';
    throw new ApiError(res.status, msg, data);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, body),
  del: <T>(url: string) => request<T>('DELETE', url)
};

export function toQuery(params: object): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Laddar ner en fil från API:t med token (t.ex. CSV eller registerutdrag). */
export async function download(url: string, fallbackName: string) {
  const token = tokenStore.get();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, `Nedladdningen misslyckades (${res.status}).`);
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = match ? decodeURIComponent(match[1]) : fallbackName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
