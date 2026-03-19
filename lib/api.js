export async function apiFetch(path, options = {}) {
  const res = await fetch(`/api/dashboard${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function apiGet(path, params) {
  const url = params
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path;
  return apiFetch(url);
}

export function apiPatch(path, body) {
  return apiFetch(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
