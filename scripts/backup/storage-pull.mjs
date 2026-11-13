#!/usr/bin/env node
/**
 * Supabase Storage 의 모든 버킷 파일을 폴더로 내려받는다 (매일 백업용. DB 백업에는 파일이 들어가지 않는다).
 * 사용: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node storage-pull.mjs <받을 폴더>
 * 파일 이름과 내용은 출력하지 않는다. 개수와 크기만 적는다 (실행 기록이 공개될 수 있다).
 */
import fs from "node:fs";
import path from "node:path";

const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const out = process.argv[2];
if (!url || !key || !out) { console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, 받을 폴더가 필요해요."); process.exit(2); }
const H = { Authorization: `Bearer ${key}`, apikey: key };

async function call(p, init = {}) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${url}/storage/v1${p}`, { ...init, headers: { ...H, ...(init.headers || {}) } });
      if (r.ok) return r;
      if (r.status < 500 || i >= 3) throw new Error(`storage ${r.status}`);
    } catch (e) { if (i >= 3) throw e; }
    await new Promise((res) => setTimeout(res, 1000 * 2 ** i));
  }
}

/** 버킷 안의 모든 파일 경로 (폴더는 id 가 없다) */
async function walk(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await call(`/object/list/${encodeURIComponent(bucket)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }) });
    const rows = await r.json();
    for (const x of rows) {
      const p = prefix ? `${prefix}/${x.name}` : x.name;
      if (x.id) files.push(p); else files.push(...(await walk(bucket, p)));
    }
    if (rows.length < 1000) return files;
  }
}

// 백업을 올리는 버킷이 같은 프로젝트에 있으면 백업이 백업을 다시 담는다. BACKUP_SKIP_BUCKETS(쉼표)로 뺀다
const skip = new Set((process.env.BACKUP_SKIP_BUCKETS || "").split(",").map((x) => x.trim()).filter(Boolean));
const buckets = (await (await call("/bucket")).json()).filter((b) => !skip.has(b.id));
let count = 0, bytes = 0;
for (const b of buckets) {
  const files = await walk(b.id);
  for (const f of files) {
    const dest = path.join(out, b.id, f);
    // 버킷 밖으로 나가는 경로는 쓰지 않는다
    if (!path.resolve(dest).startsWith(path.resolve(out, b.id) + path.sep)) throw new Error("잘못된 파일 경로");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const r = await call(`/object/${encodeURIComponent(b.id)}/${f.split("/").map(encodeURIComponent).join("/")}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(dest, buf);
    count++; bytes += buf.length;
  }
}
fs.mkdirSync(out, { recursive: true });
console.log(`storage: 버킷 ${buckets.length}개, 파일 ${count}개, ${(bytes / 1048576).toFixed(1)}MB`);
