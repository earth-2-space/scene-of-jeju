import { addDays, dotMonthDay } from "@/lib/dates";

/**
 * 파일 → 표(줄 × 칸). 지금은 CSV만 읽어요.
 * 네이버에서 .xlsx로 내려받는다면, 샘플을 받은 뒤 엑셀 읽는 라이브러리를 여기에만 붙이면 돼요.
 * (엑셀에서 "다른 이름으로 저장 → CSV UTF-8"로 저장하면 지금도 올릴 수 있어요)
 */
export async function readSheetFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(await file.text());
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    throw new Error(
      "엑셀 파일(.xlsx)은 네이버 샘플을 받은 뒤에 열어요. 지금은 엑셀에서 CSV(UTF-8)로 저장해서 올려 주세요.",
    );
  }
  throw new Error("CSV 파일을 골라 주세요.");
}

/** 따옴표·줄바꿈·BOM을 처리하는 작은 CSV 파서 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** 샘플을 받기 전, 흐름을 확인해 보는 예시 표(마스킹한 이름) */
export function sampleNaverTable(today: string): string[][] {
  const day = (n: number) => addDays(today, n).replaceAll("-", ".");
  const booked = addDays(today, -1).replaceAll("-", ".");
  return [
    ["예약번호", "예약자명", "전화번호", "이용일", "이용시간", "상품명", "인원", "옵션", "결제금액", "예약상태", "신청일시", "요청사항"],
    ["1183824101", "배○○", "010-****-4120", day(2), "오후 2:00", "블루 리추얼 (타이다이)", "2", "풍경한입(2), 현장픽업(2), 한국어(2)", "128,000", "확정", `${booked} 21:02`, "커플이에요"],
    ["1183824188", "송○○", "010-****-7781", day(4), "오전 10:00", "플라워 리추얼 [꽃염색]", "1", "방문픽업(1), English(1)", "60,000", "확정", `${booked} 22:40`, ""],
    ["1183822471", "오○○", "010-****-3305", day(2), "오전 10:00", "플라워 리추얼 [꽃염색]", "3", "풍경한입(3), 보물찾기(3)", "192,000", "확정", `${booked} 09:15`, "인원 한 명 늘었어요"],
    ["1183824230", "류○○", "010-****-0912", day(6), "오후 1:00", "씬오브유 리추얼 (나만의 풍경 물들이기)", "1", "택배발송(1), 日本語(1)", "515,000", "확정", `${booked} 23:51`, ""],
    ["1183824299", "남○○", "010-****-5530", `${dotMonthDay(today)}?`, "", "스페셜 클래스", "2", "", "", "확정", "", ""],
  ];
}
