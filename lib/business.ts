/**
 * 운영자(사업자) 정보. 이용약관·개인정보처리방침 맨 아래와 개인정보 보호책임자 칸이 이 값을 쓴다.
 * 빈 값은 화면에 나오지 않는다. 대표 성명·사업자등록번호·주소가 정해지면 여기만 채우면 된다.
 */
export const BUSINESS = {
  name: "단추",
  /** 대표 성명 */
  owner: "임정모",
  /** 사업자등록번호 */
  bizNo: "",
  /** 사업장 주소 */
  address: "",
  email: "hello@danchu.kr",
  /** 개인정보 보호책임자 성명. 비우면 대표 성명을 쓴다 */
  privacyOfficer: "",
} as const;

/** 개인정보 보호책임자 이름 (보호책임자 → 대표 순, 둘 다 비면 빈 문자열) */
export function privacyOfficerName(): string {
  return BUSINESS.privacyOfficer || BUSINESS.owner;
}
