/**
 * 손으로 적은 lib/db-types.ts 와 운영 DB 에서 받은 lib/db-generated.ts 의 표·열 이름이 같은지 컴파일에서 본다.
 * 값의 타입은 보지 않는다 (손으로 적은 쪽이 jsonb·상태 값을 일부러 더 좁혔다). 이름만 본다.
 * 어긋나면 아래 Missing* 타입에 어긋난 "표.열" 이 드러나 tsc 가 실패한다.
 * 새 마이그레이션은 운영 적용 뒤 `npm run gen:db-types` 로 다시 만든다. 적용 전에 코드가 먼저 올라가는 열은 PENDING 에 잠깐 적는다.
 */
import type { Database as Hand } from "./db-types";
import type { Database as Gen } from "./db-generated";

type H = Hand["public"]["Tables"];
type G = Gen["public"]["Tables"];

/** 운영 DB 에 아직 적용하지 않은 마이그레이션의 열. 적용하고 다시 만든 뒤 지운다 */
type PENDING = never;

/** 손으로 적은 열 가운데 DB 에 없는 것 */
type MissingInDb = { [T in keyof H & string]: T extends keyof G ? `${T}.${Exclude<keyof H[T]["Row"] & string, keyof G[T]["Row"]>}` : `${T} (표 없음)` }[keyof H & string];
/** DB 에 있는데 손으로 적은 쪽에 없는 열 */
type MissingInHand = { [T in keyof G & string]: T extends keyof H ? `${T}.${Exclude<keyof G[T]["Row"] & string, keyof H[T]["Row"]>}` : `${T} (표 없음)` }[keyof G & string];

type Expect<T extends never> = T;
export type DbTypesInSync = [Expect<Exclude<MissingInDb, PENDING>>, Expect<MissingInHand>];
