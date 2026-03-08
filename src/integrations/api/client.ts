const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const token = localStorage.getItem("fm_token");

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const ct = res.headers.get("content-type") || "";
  const raw = await res.text();

  const parsed = ct.includes("application/json") && raw ? JSON.parse(raw) : raw;

  if (!res.ok) {
    const msg =
      typeof parsed === "object" && parsed && "error" in parsed
        ? (parsed as any).error
        : typeof parsed === "string" && parsed
          ? parsed
          : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: any) => request<T>("POST", path, body),
  put: <T>(path: string, body?: any) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};