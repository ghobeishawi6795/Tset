// POST /api/reset-password  { token, newPassword }
const { Redis } = require("@upstash/redis");
const redis = Redis.fromEnv();

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const token = ((req.body && req.body.token) || "").trim();
  const newPassword = (req.body && req.body.newPassword) || "";
  if (!token || !newPassword || newPassword.length < 4) {
    return res.status(400).send("Invalid request");
  }

  const resetEntry = await redis.get(`reset:${token}`);
  if (!resetEntry) return res.status(400).send("Invalid or expired token");
  const { username } = resetEntry;

  const teacher = await redis.get(`teacher:${username}`);
  if (!teacher) return res.status(400).send("Account not found");

  teacher.password = newPassword;
  await redis.set(`teacher:${username}`, teacher);
  await redis.del(`reset:${token}`);

  return res.status(200).json({ ok: true });
};
