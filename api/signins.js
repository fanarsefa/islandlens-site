// Private sign-in log for the Forge family, read by admin.html.
//
// Every Forge product appends sign-ins and runs to one shared Upstash Redis
// list, "forge:events" (newest first, capped at 20,000 entries). Each entry is
// JSON: t (epoch ms), p (product), e ("signin" or "run"), n (name typed at
// sign in), c (short code hint, never the code), k (tier), and for trial runs
// u (runs used) and l (limit).
//
// Environment variables (Vercel, Project Settings, Environment Variables):
//   ISLANDLENS_ADMIN_CODE      admin code for this page, 12 or more characters
//   FORGE_ACTIVITY_REST_URL    REST URL of the shared Forge activity database
//   FORGE_ACTIVITY_REST_TOKEN  its REST token (read and write)
const crypto = require("node:crypto");

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const MAX_FAILS = 10;
const FAIL_WINDOW_S = 600;

async function pipeline(commands) {
  const r = await fetch(process.env.FORGE_ACTIVITY_REST_URL.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.FORGE_ACTIVITY_REST_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error("Activity database returned " + r.status);
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error("Activity database error");
    return x.result;
  });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST." });

  const admin = process.env.ISLANDLENS_ADMIN_CODE || "";
  const url = process.env.FORGE_ACTIVITY_REST_URL || "";
  if (admin.length < 12 || !url.startsWith("https://") || !process.env.FORGE_ACTIVITY_REST_TOKEN) {
    return res.status(503).json({ error: "Set ISLANDLENS_ADMIN_CODE (12 or more characters), FORGE_ACTIVITY_REST_URL and FORGE_ACTIVITY_REST_TOKEN, then redeploy." });
  }

  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
  const failKey = "forge:adminfail:" + sha(ip).toString("hex").slice(0, 16);
  const body = req.body && typeof req.body === "object" ? req.body : {};

  try {
    const [fails] = await pipeline([["GET", failKey]]);
    if (Number(fails || 0) >= MAX_FAILS) return res.status(429).json({ error: "Too many attempts. Try again in ten minutes." });

    // Compare digests so the comparison takes the same time whatever was typed.
    if (!crypto.timingSafeEqual(sha(body.code || ""), sha(admin))) {
      await pipeline([["INCR", failKey], ["EXPIRE", failKey, FAIL_WINDOW_S]]);
      return res.status(401).json({ error: "Incorrect admin code." });
    }

    const limit = Math.min(Math.max(parseInt(body.limit, 10) || 3000, 1), 20000);
    const [rows, total] = await pipeline([["LRANGE", "forge:events", 0, limit - 1], ["LLEN", "forge:events"]]);
    const events = (rows || []).map((row) => {
      try { return JSON.parse(row); } catch { return null; }
    }).filter((e) => e && typeof e.t === "number");
    return res.status(200).json({ events, total: Number(total || 0), now: Date.now() });
  } catch (err) {
    console.error(err);
    return res.status(503).json({ error: "The activity database is unavailable. Try again shortly." });
  }
};
