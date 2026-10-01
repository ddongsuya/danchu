// node --experimental-strip-types 로 lib/*.ts 를 바로 불러오기 위한 확장자 보정 훅 (빌드 스크립트 전용)
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
export async function resolve(specifier, context, next) {
  if ((specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("@/")) && !/\.[a-z]+$/.test(specifier)) {
    const base = specifier.startsWith("@/") ? pathToFileURL(process.cwd() + "/" + specifier.slice(2)).href : new URL(specifier, context.parentURL).href;
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      if (existsSync(fileURLToPath(base + ext))) return next(base + ext, context);
    }
  }
  return next(specifier, context);
}
