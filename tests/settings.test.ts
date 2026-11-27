import { describe, expect, it } from "vitest";
import { notiFailText, phoneError } from "@/lib/settings";

describe("설정 화면 문구와 칸 검사 (시안 r-set-noti · r-set-company)", () => {
  it("켜지 못하면 꺼짐으로, 끄지 못하면 켜짐으로 되돌렸다고 알린다", () => {
    expect(notiFailText("문자 알림", true)).toBe("문자 알림을 켜지 못했어요. 꺼짐으로 되돌렸어요.");
    expect(notiFailText("진행 상황 이메일", false)).toBe("진행 상황 이메일을 끄지 못했어요. 켜짐으로 되돌렸어요.");
  });
  it("휴대전화는 비우거나 휴대전화 번호여야 한다", () => {
    expect(phoneError("")).toBeNull();
    expect(phoneError("010-1234-5678")).toBeNull();
    expect(phoneError("010-12")).toBe("휴대전화 번호를 확인해 주세요.");
    expect(phoneError("02-123-4567")).toBe("휴대전화 번호를 확인해 주세요.");
  });
});
