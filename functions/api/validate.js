/**
 * 猫咪性格测试 - 兑换码校验（Cloudflare Pages Function）
 * 部署在站点同域名 /api/validate，避免 workers.dev 被网络限制。
 * 使用 D1 做原子占用，防止并发重复兑换。
 */

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost({ request, env }) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim().toUpperCase();
    const deviceId = String(body.deviceId || '').trim();

    if (!code) return json({ valid: false, message: '缺少兑换码' }, 400);
    if (!deviceId) return json({ valid: false, message: '缺少设备标识' }, 400);

    // 1. 查码是否存在
    const row = await env.DB.prepare('SELECT * FROM codes WHERE code = ?')
      .bind(code)
      .first();
    if (!row) return json({ valid: false, message: '兑换码无效' }, 404);

    // 1.5 永久码：不限制次数 / 设备，直接放行（不占用、不锁定）
    if (row.permanent === 1) {
      return json(
        { valid: true, maxCats: row.maxCats || 2, permanent: true, message: '兑换成功' },
        200
      );
    }

    // 2. 已被使用
    if (row.used === 1) {
      if (row.usedBy === deviceId) {
        return json(
          { valid: true, maxCats: row.maxCats, reused: true, message: '该设备已兑换，可直接使用' },
          200
        );
      }
      return json({ valid: false, message: '兑换码已被其他设备使用' }, 403);
    }

    // 3. 未被使用：原子占用
    const now = new Date().toISOString();
    const result = await env.DB.prepare(
      'UPDATE codes SET used = 1, usedBy = ?, usedAt = ? WHERE code = ? AND used = 0'
    )
      .bind(deviceId, now, code)
      .run();

    if (!result.meta || result.meta.changes !== 1) {
      const fresh = await env.DB.prepare('SELECT * FROM codes WHERE code = ?')
        .bind(code)
        .first();
      if (fresh && fresh.used === 1 && fresh.usedBy === deviceId) {
        return json({ valid: true, maxCats: fresh.maxCats, message: '兑换成功' }, 200);
      }
      return json({ valid: false, message: '兑换码已被其他设备使用' }, 403);
    }

    return json({ valid: true, maxCats: row.maxCats, message: '兑换成功' }, 200);
  } catch (e) {
    return json({ error: 'Server error', message: e.message }, 500);
  }
}
