const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function proxyGet(path, searchParams, apiKey) {
  const url = new URL(`/api/v1${path}`, BASE_URL);

  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { "x-api-key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || res.statusText, status: res.status };
  }

  return res.json();
}

export async function proxyPost(path, body, apiKey) {
  const url = new URL(`/api/v1${path}`, BASE_URL);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
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

export async function proxyDelete(path, searchParams, apiKey) {
  const url = new URL(`/api/v1${path}`, BASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { "x-api-key": apiKey },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: data.error || res.statusText, status: res.status };
  }

  return res.json();
}

export async function proxyPatch(path, body, apiKey) {
  const url = new URL(`/api/v1${path}`, BASE_URL);

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      "x-api-key": apiKey,
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
