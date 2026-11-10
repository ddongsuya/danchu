#!/usr/bin/env node
// 운영 DB 의 표·함수 타입을 Supabase 에서 받아 lib/db-generated.ts 로 적는다 (손으로 고치지 않는 파일).
// 앱 코드는 여전히 lib/db-types.ts(손으로 좁힌 타입)를 쓴다. lib/db-types.check.ts 가 두 파일의 표·열 이름이 같은지 tsc 로 본다.
// 실행: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... npm run gen:db-types  (마이그레이션을 운영에 적용한 뒤)
import { writeFileSync } from "node:fs";

const ref = process.env.SUPABASE_PROJECT_REF || (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!ref || !token) {
  console.error("SUPABASE_PROJECT_REF(또는 NEXT_PUBLIC_SUPABASE_URL)와 SUPABASE_ACCESS_TOKEN 이 필요해요.");
  process.exit(2);
}
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/types/typescript?included_schemas=public`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`타입을 받지 못했어요: ${res.status} ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
const { types } = await res.json();
if (typeof types !== "string" || !types.includes("export type Database")) {
  console.error("받은 내용이 타입 파일이 아니에요.");
  process.exit(1);
}
const head = "// 자동 생성: npm run gen:db-types (scripts/gen-db-types.mjs). 손으로 고치지 않는다.\n// 마이그레이션을 운영 DB 에 적용한 뒤 다시 만든다.\n/* eslint-disable */\n";
writeFileSync(new URL("../lib/db-generated.ts", import.meta.url), head + types.trimEnd() + "\n");
console.log(`lib/db-generated.ts 를 적었어요 (${types.length.toLocaleString()}자).`);
