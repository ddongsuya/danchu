import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  confidentiality: "일반",
  signed: null as string | null,
  session: null as unknown,
  expired: false,
  status: "sent",
  signedUrl: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ sessionOrNull: async () => fixture.session }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data:
            table === "rfq_files"
              ? {
                  id: "file",
                  rfq_id: "request",
                  uploaded_at: "2026-01-01",
                  storage_path: "private.pdf",
                  file_name: "private.pdf",
                }
              : table === "rfq_requests"
                ? {
                    id: "request",
                    user_id: "owner",
                    email: "owner@example.invalid",
                    confidentiality: fixture.confidentiality,
                  }
                : {
                    id: "invite",
                    cda_signed_at: fixture.signed,
                    status: fixture.status,
                    expires_at: fixture.expired ? "2000-01-01" : "2099-01-01",
                  },
        }),
      };
      return query;
    },
    storage: { from: () => ({ createSignedUrl: fixture.signedUrl }) },
  }),
}));
import { GET } from "@/app/api/files/[id]/route";
const fetchFile = () =>
  GET(
    new Request(
      "https://example.invalid/api/files/00000000-0000-4000-8000-000000000001?token=test",
    ),
    { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) },
  );
beforeEach(() => {
  fixture.confidentiality = "일반";
  fixture.signed = null;
  fixture.session = null;
  fixture.expired = false;
  fixture.status = "sent";
  fixture.signedUrl
    .mockReset()
    .mockResolvedValue({
      data: { signedUrl: "https://storage.example.invalid/file" },
    });
});
describe("첨부 API 정보 공개 경계", () => {
  it.each(["CDA 필요 (단추 표준 CDA)", "자체 CDA 사용"])(
    "미체결 %s 토큰은 첨부 접근 불가",
    async (confid) => {
      fixture.confidentiality = confid;
      expect((await fetchFile()).status).toBe(403);
      expect(fixture.signedUrl).not.toHaveBeenCalled();
    },
  );
  it("체결 확인한 초대만 서명 다운로드 발급", async () => {
    fixture.confidentiality = "자체 CDA 사용";
    fixture.signed = "2026-01-01";
    expect((await fetchFile()).status).toBe(302);
    expect(fixture.signedUrl).toHaveBeenCalledTimes(1);
  });
  it("만료 토큰은 체결 후에도 접근 불가", async () => {
    fixture.signed = "2026-01-01";
    fixture.expired = true;
    expect((await fetchFile()).status).toBe(403);
  });
  it("CRO 계정에도 같은 CDA 정책 적용", async () => {
    fixture.session = {
      userId: "cro",
      email: "cro@example.invalid",
      profile: { role: "cro", cro_org_id: "org" },
    };
    fixture.confidentiality = "자체 CDA 사용";
    expect((await fetchFile()).status).toBe(403);
  });
  it("의뢰자 본인은 미체결이어도 자신의 첨부 열람", async () => {
    fixture.session = {
      userId: "owner",
      email: "owner@example.invalid",
      profile: { role: "requester" },
    };
    fixture.confidentiality = "자체 CDA 사용";
    expect((await fetchFile()).status).toBe(302);
  });
});
