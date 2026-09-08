-- 兑换码表
CREATE TABLE IF NOT EXISTS codes (
  code TEXT PRIMARY KEY,
  used INTEGER DEFAULT 0,
  usedBy TEXT,
  usedAt TEXT,
  maxCats INTEGER DEFAULT 2,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 可选：查看所有码的使用情况
-- SELECT code, used, usedBy, usedAt, maxCats FROM codes;
