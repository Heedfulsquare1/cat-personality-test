/**
 * 猫咪性格测试 - 兑换码校验 Worker
 * 使用 Cloudflare D1 做原子占用，防止并发重复兑换
 */

const CORS_HEADERS = (origin) => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = CORS_HEADERS(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      if (url.pathname === '/validate' && request.method === 'POST') {
        return await handleValidate(request, env, cors);
      }

      if (url.pathname === '/health' && request.method === 'GET') {
        return json({ ok: true }, 200, cors);
      }

      return json({ error: 'Not found' }, 404, cors);
    } catch (e) {
      return json({ error: 'Server error', message: e.message }, 500, cors);
    }
  },
};

async function handleValidate(request, env, cors) {
  const body = await request.json().catch(() => ({}));
  const code = String(body.code || '').trim().toUpperCase();
  const deviceId = String(body.deviceId || '').trim();

  if (!code) {
    return json({ valid: false, message: '缺少兑换码' }, 400, cors);
  }
  if (!deviceId) {
    return json({ valid: false, message: '缺少设备标识' }, 400, cors);
  }

  // 1. 查码是否存在
  const row = await env.DB.prepare('SELECT * FROM codes WHERE code = ?')
    .bind(code)
    .first();

  if (!row) {
    return json({ valid: false, message: '兑换码无效' }, 404, cors);
  }

  // 2. 已被使用
  if (row.used === 1) {
    // 同一设备可放行（刷新/重进）
    if (row.usedBy === deviceId) {
      return json(
        {
          valid: true,
          maxCats: row.maxCats,
          reused: true,
          message: '该设备已兑换，可直接使用',
        },
        200,
        cors
      );
    }
    return json({ valid: false, message: '兑换码已被其他设备使用' }, 403, cors);
  }

  // 3. 未被使用：原子占用
  const now = new Date().toISOString();
  const result = await env.DB.prepare(
    'UPDATE codes SET used = 1, usedBy = ?, usedAt = ? WHERE code = ? AND used = 0'
  )
    .bind(deviceId, now, code)
    .run();

  // D1 返回 meta.changes 表示实际更新了几行
  if (!result.meta || result.meta.changes !== 1) {
    // 说明被其他并发请求抢先占用了，重新查询一次返回准确状态
    const fresh = await env.DB.prepare('SELECT * FROM codes WHERE code = ?')
      .bind(code)
      .first();
    if (fresh && fresh.used === 1 && fresh.usedBy === deviceId) {
      return json(
        { valid: true, maxCats: fresh.maxCats, message: '兑换成功' },
        200,
        cors
      );
    }
    return json({ valid: false, message: '兑换码已被其他设备使用' }, 403, cors);
  }

  return json(
    { valid: true, maxCats: row.maxCats, message: '兑换成功' },
    200,
    cors
  );
}
