import type { Metadata } from "next";
import { Site } from "@/components/site/Site";
import "./page.css";

export const metadata: Metadata = {
  title: "서비스 소개 · 단추",
  description: "한번의 요청으로 여러 기관에. 비임상 시험 견적을 같은 양식으로 받아 편하게 비교하세요.",
};

export default function Page() {
  return (
    <Site current="/about" next={{ href: "/how-it-works", label: "이용 안내" }}>
<section className="ph2" aria-labelledby="t">
<h1 id="t">단추는?</h1>
<p className="lead">단추는 다양한 비임상시험 비교 견적을 제공합니다.</p>
</section>
<div className="bandw fwrap"><section className="film big player" style={{ "--T": "24s", "--F": "-20.5s" }} aria-label="요청 한 번이 여러 기관으로 가고, 같은 양식의 회신이 비교표로 모이는 과정">
<div className="fside">
<div className="cap"><p><span className="cl" aria-label="기관마다"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab100", "--cd": "0ms" }}>기</span><span className="fe ch" style={{ "--n": "ab100", "--cd": "16ms" }}>관</span><span className="fe ch" style={{ "--n": "ab100", "--cd": "32ms" }}>마</span><span className="fe ch" style={{ "--n": "ab100", "--cd": "48ms" }}>다</span></span></span></span><span className="cl mu" aria-label="따로 묻고,"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab101", "--cd": "0ms" }}>따</span><span className="fe ch" style={{ "--n": "ab101", "--cd": "16ms" }}>로</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab101", "--cd": "48ms" }}>묻</span><span className="fe ch" style={{ "--n": "ab101", "--cd": "64ms" }}>고</span><span className="fe ch" style={{ "--n": "ab101", "--cd": "80ms" }}>,</span></span></span></span></p><p><span className="cl" aria-label="제각각 받은 견적,"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab102", "--cd": "0ms" }}>제</span><span className="fe ch" style={{ "--n": "ab102", "--cd": "16ms" }}>각</span><span className="fe ch" style={{ "--n": "ab102", "--cd": "32ms" }}>각</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab102", "--cd": "64ms" }}>받</span><span className="fe ch" style={{ "--n": "ab102", "--cd": "80ms" }}>은</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab102", "--cd": "112ms" }}>견</span><span className="fe ch" style={{ "--n": "ab102", "--cd": "128ms" }}>적</span><span className="fe ch" style={{ "--n": "ab102", "--cd": "144ms" }}>,</span></span></span></span><span className="cl mu" aria-label="비교가 번거롭죠."><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab103", "--cd": "0ms" }}>비</span><span className="fe ch" style={{ "--n": "ab103", "--cd": "16ms" }}>교</span><span className="fe ch" style={{ "--n": "ab103", "--cd": "32ms" }}>가</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab103", "--cd": "64ms" }}>번</span><span className="fe ch" style={{ "--n": "ab103", "--cd": "80ms" }}>거</span><span className="fe ch" style={{ "--n": "ab103", "--cd": "96ms" }}>롭</span><span className="fe ch" style={{ "--n": "ab103", "--cd": "112ms" }}>죠</span><span className="fe ch" style={{ "--n": "ab103", "--cd": "128ms" }}>.</span></span></span></span></p><p><span className="cl" aria-label="번거로운 비교견적,"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab104", "--cd": "0ms" }}>번</span><span className="fe ch" style={{ "--n": "ab104", "--cd": "16ms" }}>거</span><span className="fe ch" style={{ "--n": "ab104", "--cd": "32ms" }}>로</span><span className="fe ch" style={{ "--n": "ab104", "--cd": "48ms" }}>운</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab104", "--cd": "80ms" }}>비</span><span className="fe ch" style={{ "--n": "ab104", "--cd": "96ms" }}>교</span><span className="fe ch" style={{ "--n": "ab104", "--cd": "112ms" }}>견</span><span className="fe ch" style={{ "--n": "ab104", "--cd": "128ms" }}>적</span><span className="fe ch" style={{ "--n": "ab104", "--cd": "144ms" }}>,</span></span></span></span><span className="cl mu" aria-label="단추에서 편하게 하세요."><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab105", "--cd": "0ms" }}>단</span><span className="fe ch" style={{ "--n": "ab105", "--cd": "16ms" }}>추</span><span className="fe ch" style={{ "--n": "ab105", "--cd": "32ms" }}>에</span><span className="fe ch" style={{ "--n": "ab105", "--cd": "48ms" }}>서</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab105", "--cd": "80ms" }}>편</span><span className="fe ch" style={{ "--n": "ab105", "--cd": "96ms" }}>하</span><span className="fe ch" style={{ "--n": "ab105", "--cd": "112ms" }}>게</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab105", "--cd": "144ms" }}>하</span><span className="fe ch" style={{ "--n": "ab105", "--cd": "160ms" }}>세</span><span className="fe ch" style={{ "--n": "ab105", "--cd": "176ms" }}>요</span><span className="fe ch" style={{ "--n": "ab105", "--cd": "192ms" }}>.</span></span></span></span></p><p><span className="cl" aria-label="한번의 요청으로"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab106", "--cd": "0ms" }}>한</span><span className="fe ch" style={{ "--n": "ab106", "--cd": "16ms" }}>번</span><span className="fe ch" style={{ "--n": "ab106", "--cd": "32ms" }}>의</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab106", "--cd": "64ms" }}>요</span><span className="fe ch" style={{ "--n": "ab106", "--cd": "80ms" }}>청</span><span className="fe ch" style={{ "--n": "ab106", "--cd": "96ms" }}>으</span><span className="fe ch" style={{ "--n": "ab106", "--cd": "112ms" }}>로</span></span></span></span><span className="cl mu" aria-label="여러 기관에."><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab107", "--cd": "0ms" }}>여</span><span className="fe ch" style={{ "--n": "ab107", "--cd": "16ms" }}>러</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab107", "--cd": "48ms" }}>기</span><span className="fe ch" style={{ "--n": "ab107", "--cd": "64ms" }}>관</span><span className="fe ch" style={{ "--n": "ab107", "--cd": "80ms" }}>에</span><span className="fe ch" style={{ "--n": "ab107", "--cd": "96ms" }}>.</span></span></span></span></p><p><span className="cl" aria-label="회신 받은 내용을"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab108", "--cd": "0ms" }}>회</span><span className="fe ch" style={{ "--n": "ab108", "--cd": "16ms" }}>신</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab108", "--cd": "48ms" }}>받</span><span className="fe ch" style={{ "--n": "ab108", "--cd": "64ms" }}>은</span></span> <span className="wd"><span className="fe ch" style={{ "--n": "ab108", "--cd": "96ms" }}>내</span><span className="fe ch" style={{ "--n": "ab108", "--cd": "112ms" }}>용</span><span className="fe ch" style={{ "--n": "ab108", "--cd": "128ms" }}>을</span></span></span></span><span className="cl mu" aria-label="비교표로"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab109", "--cd": "0ms" }}>비</span><span className="fe ch" style={{ "--n": "ab109", "--cd": "16ms" }}>교</span><span className="fe ch" style={{ "--n": "ab109", "--cd": "32ms" }}>표</span><span className="fe ch" style={{ "--n": "ab109", "--cd": "48ms" }}>로</span></span></span></span></p><p><span className="cl" aria-label="비교표로"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab110", "--cd": "0ms" }}>비</span><span className="fe ch" style={{ "--n": "ab110", "--cd": "16ms" }}>교</span><span className="fe ch" style={{ "--n": "ab110", "--cd": "32ms" }}>표</span><span className="fe ch" style={{ "--n": "ab110", "--cd": "48ms" }}>로</span></span></span></span><span className="cl mu" aria-label="간단하게"><span aria-hidden="true"><span className="wd"><span className="fe ch" style={{ "--n": "ab111", "--cd": "0ms" }}>간</span><span className="fe ch" style={{ "--n": "ab111", "--cd": "16ms" }}>단</span><span className="fe ch" style={{ "--n": "ab111", "--cd": "32ms" }}>하</span><span className="fe ch" style={{ "--n": "ab111", "--cd": "48ms" }}>게</span></span></span></span></p></div>

<div className="fctl"><span className="fbar" aria-hidden="true"><i className="fe" style={{ "--n": "ab113" }}></i><b style={{ left: "17.5%" }}></b><b style={{ left: "35.0%" }}></b><b style={{ left: "45.0%" }}></b><b style={{ left: "65.0%" }}></b></span></div>
</div>
<div className="fst" role="img" aria-label="요청 한 번이 여러 기관으로 가고, 같은 양식의 회신이 비교표로 모이는 과정">
<div className="shk fe" style={{ "--n": "ab114" }}>
<div className="cam fe" style={{ "--n": "ab0" }}>
<div className="grid fe" style={{ "--n": "ab112" }}></div>
<div className="fe who" style={{ "--n": "ab1", left: "38.5cqw", top: "7.2cqw", width: "23.0cqw", height: "7.6cqw" }}>의뢰자</div>
<div className="fe nd" style={{ "--n": "ab2", left: "5.0cqw", top: "77.2cqw", width: "26.0cqw", height: "9.6cqw" }}><span className="mo">A</span>기관 A</div>
<div className="fe nd on" style={{ "--n": "ab3", left: "5.0cqw", top: "77.2cqw", width: "26.0cqw", height: "9.6cqw" }}><span className="mo">A</span>기관 A</div>
<div className="fe st" style={{ "--n": "ab4", left: "5.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>회신 대기</div>
<div className="fe st" style={{ "--n": "ab5", left: "5.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>형식 제각각</div>
<div className="fe st ac" style={{ "--n": "ab6", left: "5.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>요청 받음</div>
<div className="fe st ac" style={{ "--n": "ab7", left: "5.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>회신 완료</div>
<div className="fe nd" style={{ "--n": "ab8", left: "37.0cqw", top: "77.2cqw", width: "26.0cqw", height: "9.6cqw" }}><span className="mo">B</span>기관 B</div>
<div className="fe nd on" style={{ "--n": "ab9", left: "37.0cqw", top: "77.2cqw", width: "26.0cqw", height: "9.6cqw" }}><span className="mo">B</span>기관 B</div>
<div className="fe st" style={{ "--n": "ab10", left: "37.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>회신 대기</div>
<div className="fe st" style={{ "--n": "ab11", left: "37.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>형식 제각각</div>
<div className="fe st ac" style={{ "--n": "ab12", left: "37.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>요청 받음</div>
<div className="fe st ac" style={{ "--n": "ab13", left: "37.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>회신 완료</div>
<div className="fe nd" style={{ "--n": "ab14", left: "69.0cqw", top: "77.2cqw", width: "26.0cqw", height: "9.6cqw" }}><span className="mo">C</span>기관 C</div>
<div className="fe nd on" style={{ "--n": "ab15", left: "69.0cqw", top: "77.2cqw", width: "26.0cqw", height: "9.6cqw" }}><span className="mo">C</span>기관 C</div>
<div className="fe st" style={{ "--n": "ab16", left: "69.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>회신 대기</div>
<div className="fe st" style={{ "--n": "ab17", left: "69.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>형식 제각각</div>
<div className="fe st ac" style={{ "--n": "ab18", left: "69.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>요청 받음</div>
<div className="fe st ac" style={{ "--n": "ab19", left: "69.0cqw", top: "88.0cqw", width: "26.0cqw", height: "4.0cqw", justifyContent: "center" }}>회신 완료</div>
<div className="fe ln d" style={{ "--n": "ab20", left: "50.0cqw", top: "14.8cqw", width: "70.12674240259561cqw" }}></div>
<div className="fe tg" style={{ "--n": "ab21", left: "25.1cqw", top: "44.7cqw", width: "11.0cqw", height: "4.6cqw" }}>메일</div>
<div className="fe sht gh" style={{ "--n": "ab22", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht gh" style={{ "--n": "ab23", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht" style={{ "--n": "ab24", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe ln d" style={{ "--n": "ab25", left: "50.0cqw", top: "14.8cqw", width: "62.4cqw" }}></div>
<div className="fe tg" style={{ "--n": "ab26", left: "44.5cqw", top: "40.7cqw", width: "11.0cqw", height: "4.6cqw" }}>전화</div>
<div className="fe sht gh" style={{ "--n": "ab27", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht gh" style={{ "--n": "ab28", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht" style={{ "--n": "ab29", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe ln d" style={{ "--n": "ab30", left: "50.0cqw", top: "14.8cqw", width: "70.12674240259561cqw" }}></div>
<div className="fe tg" style={{ "--n": "ab31", left: "63.9cqw", top: "44.7cqw", width: "11.0cqw", height: "4.6cqw" }}>메신저</div>
<div className="fe sht gh" style={{ "--n": "ab32", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht gh" style={{ "--n": "ab33", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht" style={{ "--n": "ab34", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe cd" style={{ "--n": "ab35", left: "8.5cqw", top: "33.0cqw", width: "30.0cqw", height: "20.0cqw" }}><em>PDF</em><span>합계 3억 1,200만</span><s>항목별 없음</s></div>
<div className="fe cd" style={{ "--n": "ab36", left: "35.0cqw", top: "37.0cqw", width: "30.0cqw", height: "20.0cqw" }}><em>엑셀</em><span>반복투여 9,200만</span><span className="w">TK 없음</span></div>
<div className="fe cd" style={{ "--n": "ab37", left: "61.5cqw", top: "32.0cqw", width: "30.0cqw", height: "20.0cqw" }}><em>메일 본문</em><span>반복투여 1억 600만</span><s>TK는 별도 문의</s></div>
<div className="fe mk" style={{ "--n": "ab38", left: "38.5cqw", top: "35.5cqw", width: "23.0cqw", height: "23.0cqw" }}><span className="mark" aria-hidden="true" style={{ "--d": "23.0cqw" }}><i></i><i></i><i></i><i></i></span></div>
<div className="fe hole" style={{ "--n": "ab39", left: "43.19199999999999cqw", top: "40.19199999999999cqw", width: "5.244000000000001cqw", height: "5.244000000000001cqw" }}></div>
<div className="fe hole" style={{ "--n": "ab40", left: "51.564cqw", top: "40.19199999999999cqw", width: "5.244000000000001cqw", height: "5.244000000000001cqw" }}></div>
<div className="fe hole" style={{ "--n": "ab41", left: "51.564cqw", top: "48.564cqw", width: "5.244000000000001cqw", height: "5.244000000000001cqw" }}></div>
<div className="fe hole" style={{ "--n": "ab42", left: "43.19199999999999cqw", top: "48.564cqw", width: "5.244000000000001cqw", height: "5.244000000000001cqw" }}></div>
<div className="fe rp " style={{ "--n": "ab43", left: "40.0cqw", top: "37.0cqw", width: "20.0cqw", height: "20.0cqw" }}></div>
<div className="fe rp " style={{ "--n": "ab44", left: "34.0cqw", top: "31.0cqw", width: "32.0cqw", height: "32.0cqw" }}></div>
<div className="fe rp " style={{ "--n": "ab45", left: "24.0cqw", top: "21.0cqw", width: "52.0cqw", height: "52.0cqw" }}></div>
<div className="fe ln " style={{ "--n": "ab46", left: "50.0cqw", top: "14.8cqw", width: "20.4cqw" }}></div>
<div className="fe sht gh" style={{ "--n": "ab47", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht gh" style={{ "--n": "ab48", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht" style={{ "--n": "ab49", left: "46.4cqw", top: "15.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe ln " style={{ "--n": "ab50", left: "50.0cqw", top: "58.8cqw", width: "36.912870384189844cqw" }}></div>
<div className="fe sht ac gh" style={{ "--n": "ab51", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab52", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac" style={{ "--n": "ab53", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab54", left: "14.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab55", left: "14.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac" style={{ "--n": "ab56", left: "14.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe pu " style={{ "--n": "ab57", left: "17.1cqw", top: "76.3cqw", width: "1.8cqw", height: "1.8cqw" }}></div>
<div className="fe ln " style={{ "--n": "ab58", left: "50.0cqw", top: "58.8cqw", width: "18.4cqw" }}></div>
<div className="fe sht ac gh" style={{ "--n": "ab59", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab60", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac" style={{ "--n": "ab61", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab62", left: "46.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab63", left: "46.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac" style={{ "--n": "ab64", left: "46.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe pu " style={{ "--n": "ab65", left: "49.1cqw", top: "76.3cqw", width: "1.8cqw", height: "1.8cqw" }}></div>
<div className="fe ln " style={{ "--n": "ab66", left: "50.0cqw", top: "58.8cqw", width: "36.912870384189844cqw" }}></div>
<div className="fe sht ac gh" style={{ "--n": "ab67", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab68", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac" style={{ "--n": "ab69", left: "46.4cqw", top: "56.3cqw", width: "7.2cqw", height: "9.4cqw" }}><b>요청서</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab70", left: "78.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac gh" style={{ "--n": "ab71", left: "78.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe sht ac" style={{ "--n": "ab72", left: "78.4cqw", top: "68.8cqw", width: "7.2cqw", height: "9.4cqw" }}><b>회신</b><i></i><i></i><i className="s"></i></div>
<div className="fe pu " style={{ "--n": "ab73", left: "81.1cqw", top: "76.3cqw", width: "1.8cqw", height: "1.8cqw" }}></div>
<div className="fe rp " style={{ "--n": "ab74", left: "37.0cqw", top: "34.0cqw", width: "26.0cqw", height: "26.0cqw" }}></div>
<div className="fe bx" style={{ "--n": "ab75", left: "7.0cqw", top: "50.0cqw", width: "86.0cqw", height: "10.0cqw" }}></div>
<div className="fe tx h" style={{ "--n": "ab76", left: "28.5cqw", top: "23.0cqw", width: "21.5cqw", height: "7.0cqw" }}>기관 A</div>
<div className="fe tx h" style={{ "--n": "ab77", left: "50.0cqw", top: "23.0cqw", width: "21.5cqw", height: "7.0cqw" }}>기관 B</div>
<div className="fe tx h" style={{ "--n": "ab78", left: "71.5cqw", top: "23.0cqw", width: "21.5cqw", height: "7.0cqw" }}>기관 C</div>
<div className="fe ln " style={{ "--n": "ab79", left: "7.0cqw", top: "30.0cqw", width: "86.0cqw" }}></div>
<div className="fe tx k" style={{ "--n": "ab80", left: "7.0cqw", top: "30.0cqw", width: "21.5cqw", height: "10.0cqw" }}>반복투여 4주</div>
<div className="fe tx" style={{ "--n": "ab81", left: "28.5cqw", top: "30.0cqw", width: "21.5cqw", height: "10.0cqw" }}>9,800만</div>
<div className="fe tx" style={{ "--n": "ab82", left: "50.0cqw", top: "30.0cqw", width: "21.5cqw", height: "10.0cqw" }}>9,200만</div>
<div className="fe tx" style={{ "--n": "ab83", left: "71.5cqw", top: "30.0cqw", width: "21.5cqw", height: "10.0cqw" }}>1억 600만</div>
<div className="fe ln f" style={{ "--n": "ab84", left: "7.0cqw", top: "40.0cqw", width: "86.0cqw" }}></div>
<div className="fe tx k" style={{ "--n": "ab85", left: "7.0cqw", top: "40.0cqw", width: "21.5cqw", height: "10.0cqw" }}>Ames</div>
<div className="fe tx" style={{ "--n": "ab86", left: "28.5cqw", top: "40.0cqw", width: "21.5cqw", height: "10.0cqw" }}>1,100만</div>
<div className="fe tx" style={{ "--n": "ab87", left: "50.0cqw", top: "40.0cqw", width: "21.5cqw", height: "10.0cqw" }}>1,050만</div>
<div className="fe tx" style={{ "--n": "ab88", left: "71.5cqw", top: "40.0cqw", width: "21.5cqw", height: "10.0cqw" }}>1,250만</div>
<div className="fe ln f" style={{ "--n": "ab89", left: "7.0cqw", top: "50.0cqw", width: "86.0cqw" }}></div>
<div className="fe tx k" style={{ "--n": "ab90", left: "7.0cqw", top: "50.0cqw", width: "21.5cqw", height: "10.0cqw" }}>TK 분석</div>
<div className="fe tx" style={{ "--n": "ab91", left: "28.5cqw", top: "50.0cqw", width: "21.5cqw", height: "10.0cqw" }}>포함</div>
<div className="fe tx" style={{ "--n": "ab92", left: "50.0cqw", top: "50.0cqw", width: "21.5cqw", height: "10.0cqw" }}><span className="w">없음</span></div>
<div className="fe tx" style={{ "--n": "ab93", left: "71.5cqw", top: "50.0cqw", width: "21.5cqw", height: "10.0cqw" }}>포함</div>
<div className="fe ln f" style={{ "--n": "ab94", left: "7.0cqw", top: "60.0cqw", width: "86.0cqw" }}></div>
<div className="fe tx k" style={{ "--n": "ab95", left: "7.0cqw", top: "60.0cqw", width: "21.5cqw", height: "10.0cqw" }}>합계</div>
<div className="fe tx b" style={{ "--n": "ab96", left: "28.5cqw", top: "60.0cqw", width: "21.5cqw", height: "10.0cqw" }}>3억 1,200만</div>
<div className="fe tx b" style={{ "--n": "ab97", left: "50.0cqw", top: "60.0cqw", width: "21.5cqw", height: "10.0cqw" }}>2억 9,800만</div>
<div className="fe tx b" style={{ "--n": "ab98", left: "71.5cqw", top: "60.0cqw", width: "21.5cqw", height: "10.0cqw" }}>3억 4,500만</div>
<div className="fe ln f" style={{ "--n": "ab99", left: "7.0cqw", top: "70.0cqw", width: "86.0cqw" }}></div>
</div>
</div>
</div>
</section></div>
<section className="say scene" aria-label="단추로 바뀌는 것"><p className="sv" style={{ "--k": "litc", "--r": "entry 40% cover 38%" }}>한번의 요청으로 여러 기관에.</p><p className="sv" style={{ "--k": "litc", "--r": "entry 52% cover 46%" }}>편하게 비교하세요.</p></section>
<section className="lavc" aria-labelledby="go"><div><h2 id="go" className="huge">지금 견적을<br /><span>요청해보세요.</span></h2></div><div className="act"><div><p className="actk">어떤 시험이 필요하세요?</p><div className="pick"><a href="/request/new?start=manual">일반독성</a><a href="/request/new?start=manual">유전독성</a><a href="/request/new?start=manual">안전성약리</a><a href="/request/new?start=manual">생식발생독성</a><a href="/request/new?start=manual">발암성</a><a href="/request/new?start=manual">국소내성</a></div></div><div className="ctas"><a className="btn solid" href="/request">견적 요청하기 <span className="ar">→</span></a><a className="btn ghost" href="/request/new?start=advisor">제안부터 받기</a></div></div></section>
    </Site>
  );
}