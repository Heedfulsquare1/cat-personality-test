# 猫咪测试兑换码后端（Cloudflare Workers + D1）

## 功能
- 一码一用（同一设备刷新可复用）
- 原子占用，防止并发重复兑换
- 每个码限制最多 2 只猫
- 跨域支持你的 Pages 域名

## 部署步骤

### 1. 安装 Wrangler（命令行工具）
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler login
```
浏览器会弹出授权，点 Allow。

### 3. 创建 D1 数据库
```bash
cd cloudflare-worker
wrangler d1 create cat-personality-codes-db
```

复制返回的 `database_id`，粘贴到 `wrangler.toml` 里替换 `REPLACE_WITH_YOUR_D1_DATABASE_ID`。

### 4. 初始化表结构
```bash
wrangler d1 execute cat-personality-codes-db --file=./schema.sql
```

### 5. 导入兑换码
编辑 `seed.sql`，把示例码换成你真正的兑换码，然后：
```bash
wrangler d1 execute cat-personality-codes-db --file=./seed.sql
```

> 批量生成防猜码：回到项目根目录运行 `python gen_codes.py --count 100 --export codes.csv`

### 6. 部署 Worker
```bash
wrangler deploy
```

部署成功后会显示 Worker URL，例如：
```
https://cat-personality-codes.your-account.workers.dev
```

### 7. 修改前端 `index.html`
把下面这行：
```js
const CLOUD_URL='';
```
改成你的 Worker URL：
```js
const CLOUD_URL='https://cat-personality-codes.your-account.workers.dev';
```

然后 push 到 GitHub，Cloudflare Pages 自动重新部署。

### 8. 生产环境建议
- 把 `wrangler.toml` 里的 `ALLOWED_ORIGIN` 从 `*` 改成你的 Pages 域名，防止其他网站盗用 API
- 定期用 D1 查询 `SELECT code, used, usedBy, usedAt FROM codes;` 看兑换情况
