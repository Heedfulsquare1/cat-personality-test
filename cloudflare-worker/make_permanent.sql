-- 给 codes 表增加 permanent 字段（永久码：不限制次数/设备，无限复用）
ALTER TABLE codes ADD COLUMN permanent INTEGER DEFAULT 0;

-- 插入永久码 MoonDEMO（permanent=1，最多 2 只猫，任何设备可反复使用）
INSERT OR IGNORE INTO codes (code, maxCats, permanent) VALUES ('MOONDEMO', 2, 1);
