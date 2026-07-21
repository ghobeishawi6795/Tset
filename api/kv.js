// GET  /api/kv?key=X   -> { v: <value> }  (404 if missing)
// POST /api/kv  {k, v} -> stores v under k
// DELETE /api/kv?key=X -> deletes k
const { Redis } = require("@upstash/redis");
const redis = Redis.fromEnv();

module.exports = async (req, res) => {
  if (req.method === "GET") {
    const key = req.query.key;
    if (!key) return res.status(400).send("Missing key");
    const value = await redis.get(key);
    if (value === null || value === undefined) return res.status(404).send("Not found");
    return res.status(200).json({ v: value });
  }

  if (req.method === "POST") {
    const { k, v } = req.body || {};
    if (!k) return res.status(400).send("Missing k");
    await redis.set(k, v);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const key = req.query.key;
    if (!key) return res.status(400).send("Missing key");
    await redis.del(key);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).send("Method not allowed");
};
