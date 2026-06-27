const API_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  (import.meta.env.PROD ? "http://admin.hity.mionix.pl" : "http://localhost:6969");

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Blad polaczenia z API");
  }
  return (await response.json()) as T;
}

export { API_URL };
