export async function onRequestGet(context) {
  const { request, env } = context;
  const KV = env.KV || env.Kv || env.kv;
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || "";

  const result = await KV.list({ prefix, limit: 1000 });
  const keys = result.keys.map((k) => k.name);

  return new Response(JSON.stringify({ keys }), {
    headers: { "Content-Type": "application/json" },
  });
}
