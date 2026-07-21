// GET /api/list?prefix=X -> { keys: ["exam:abc", "exam:def", ...] }
const { Redis } = require("@upstash/redis");
const redis = Redis.fromEnv();

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");
  const prefix = req.query.prefix || "";

  let keys = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await redis.scan(cursor, { match: `${prefix}*`, count: 1000 });
    keys = keys.concat(batch);
    cursor = Number(nextCursor);
  } while (cursor !== 0);

  return res.status(200).json({ keys });
};
