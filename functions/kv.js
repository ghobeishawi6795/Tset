export async function onRequestGet(context) {
  const { request, env } = context;
  const KV = env.KV || env.Kv || env.kv;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("missing key", { status: 400 });

  const value = await KV.get(key, "json");
  if (value === null) return new Response("not found", { status: 404 });

  return new Response(JSON.stringify({ v: value }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const KV = env.KV || env.Kv || env.kv;
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("invalid body", { status: 400 });
  }
  if (!body || typeof body.k !== "string") {
    return new Response("missing key", { status: 400 });
  }

  await KV.put(body.k, JSON.stringify(body.v));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const KV = env.KV || env.Kv || env.kv;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!key) return new Response("missing key", { status: 400 });

  await KV.delete(key);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
      }
