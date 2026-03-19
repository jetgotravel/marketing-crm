const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const API_KEY = process.env.CRM_API_KEY;

export async function proxyGet(path, searchParams) {
  const url = new URL(`/api/v1${path}`, BASE_URL);

  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": API_KEY },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || res.statusText, status: res.status };
  }

  return res.json();
}

export async function proxyPatch(path, body) {
  const url = new URL(`/api/v1${path}`, BASE_URL);

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      "x-api-key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: data.error || res.statusText, status: res.status };
  }

  return res.json();
}
