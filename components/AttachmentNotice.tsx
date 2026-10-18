/**
 * 요청서 3단계(기밀·첨부)의 안내. 일반 요청과 CDA 요청에서 첨부가 언제 누구에게 가는지는 다르지만,
 * 첨부파일 내용이 그대로 전달된다는 점은 같다. 그래서 회사 정보 제거 안내(ATTACHMENT_WARNING)는 두 경우에 똑같이 보여 준다
 * (2026-10-18 보안 검토 #1: 선정 전 기관에는 파일명만 가리고 파일 내용은 원본 그대로 전달한다).
 */
export const ATTACHMENT_FLOW_GENERAL =
  "요청 내용과 첨부는 견적에 참여하는 기관에 전달됩니다. 회사명과 담당자 연락처는 어떤 기관에도 미리 공개되지 않고, 비교표에서 선정한 기관에만 전달됩니다.";
export const ATTACHMENT_FLOW_CDA =
  "초대받은 기관에는 시험 개요를 먼저 전달합니다. 회사명과 담당자 연락처는 선정한 기관에만, 첨부파일은 해당 기관의 CDA 체결을 운영자가 확인한 뒤 공개합니다. 다만 기관과 직접 체결하는 CDA 문서에 적힌 회사명은 그 기관에 전달됩니다. 비공개 정보는 물질명·추가 설명에 적지 마세요.";
export const ATTACHMENT_WARNING_TITLE = "첨부하기 전에 회사 정보를 지워 주세요";
export const ATTACHMENT_WARNING =
  "선정 전에는 첨부 파일명만 가려지고, 파일 안의 내용은 올린 그대로 기관에 전달됩니다. 본문, 이미지(로고, 직인, 스캔한 서명 등), 문서 속성(작성자, 회사, 관리자 같은 파일 정보)에 들어 있는 회사명과 담당자 이름·이메일·전화번호를 지운 뒤 올려 주세요.";

export function AttachmentNotice({ cda }: { cda: boolean }) {
  return (
    <>
      <div className="note note--tint">{cda ? ATTACHMENT_FLOW_CDA : ATTACHMENT_FLOW_GENERAL}</div>
      <div className="note note--warn" role="note" data-attachment-warning style={{ flexDirection: "column", gap: 4 }}>
        <b style={{ fontWeight: 600 }}>{ATTACHMENT_WARNING_TITLE}</b>
        <span>{ATTACHMENT_WARNING}</span>
      </div>
    </>
  );
}
