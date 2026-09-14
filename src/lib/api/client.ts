// Small shared wrapper around the `getToken()` + `Authorization: Bearer`
// pattern already established in `index.tsx` / `onboarding/profile.tsx`,
// factored out because every booking-flow screen needs it identically.
type GetToken = () => Promise<string | null>;

export async function authedFetch(getToken: GetToken, path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers });
}

export async function authedFetchJson<T>(getToken: GetToken, path: string, init?: RequestInit): Promise<T> {
  const res = await authedFetch(getToken, path, init);
  if (!res.ok) {
    const body = await res.text();
    let code: string | undefined;
    try {
      code = JSON.parse(body)?.error;
    } catch {
      // not JSON — leave code undefined, message falls back to the raw body
    }
    throw new ApiError(code || body || `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
