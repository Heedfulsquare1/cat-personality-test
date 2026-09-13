/**
 * 猫咪性格测试 - 完成人数计数器（Cloudflare Pages Function）
 * 同域名 /api/counter
 *   GET  -> 返回当前已完成测试的小猫咪数量 {count}
 *   POST -> 原子 +1 并返回最新 {count}
 * 复用项目已有的 D1 绑定（DB）。表 counter 在首次调用时自动创建，并初始化为 295。
 */

const NAME = 'completed';
const INIT = 295;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const JSON_HEADERS = (extra = {}) => ({ ...CORS, 'Content-Type': 'application/json', 'cache-control': 'no-store', ...extra });

async function ensureTable(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS counter (name TEXT PRIMARY KEY, value INTEGER NOT NULL DEFAULT 0)"
  ).run();
  await db.prepare(
    "INSERT OR IGNORE INTO counter (name, value) VALUES (?, ?)"
  ).bind(NAME, INIT).run();
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestGet({ env }) {
  try {
    const db = env.DB;
    await ensureTable(db);
    const row = await db.prepare("SELECT value FROM counter WHERE name = ?").bind(NAME).first();
    const count = row ? row.value : INIT;
    return new Response(JSON.stringify({ count }), { headers: JSON_HEADERS() });
  } catch (e) {
    // 后端异常时前端仍显示初始值，不影响用户体验
    return new Response(JSON.stringify({ count: INIT, error: e.message }), { headers: JSON_HEADERS() });
  }
}

export async function onRequestPost({ env }) {
  try {
    const db = env.DB;
    await ensureTable(db);
    await db.prepare("UPDATE counter SET value = value + 1 WHERE name = ?").bind(NAME).run();
    const row = await db.prepare("SELECT value FROM counter WHERE name = ?").bind(NAME).first();
    const count = row ? row.value : INIT + 1;
    return new Response(JSON.stringify({ count }), { headers: JSON_HEADERS() });
  } catch (e) {
    return new Response(JSON.stringify({ count: INIT, error: e.message }), { headers: JSON_HEADERS() });
  }
}
