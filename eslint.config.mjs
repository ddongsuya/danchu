import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// 검사: npm run lint (CI 에서도 돈다). 규칙은 Next 기본(core-web-vitals + typescript).
// 2026-11-10 처음 켤 때 이미 있던 코드에서 걸린 규칙은 경고로 낮춰 두었다 (아래 BASELINE). 새 코드에서는 경고도 남기지 않는다.
// 경고를 다 고친 규칙은 이 목록에서 지워 다시 오류로 올린다.
const BASELINE = {
  "react/no-unescaped-entities": "warn",
  "react-hooks/set-state-in-effect": "warn",
  "react-hooks/purity": "warn",
  "react-hooks/static-components": "warn",
  "react-hooks/immutability": "warn",
  "@next/next/no-html-link-for-pages": "warn",
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...BASELINE,
      // 일부러 안 쓰는 값은 _ 로 시작한다 (테스트 목, 구조 분해에서 버리는 값)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  { files: ["**/*.cjs", "scripts/**/*.js"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "lib/db-generated.ts", "tools/**", "replica/**", ".claude/**", "public/**"]),
]);
