// style={{ "--x": "..." }} 처럼 CSS 변수를 인라인으로 쓸 수 있게 한다 (시안 생성기가 만든 궤도·장면 마크업)
import "react";

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}
