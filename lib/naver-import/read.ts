import { addDays, dotMonthDay } from "@/lib/dates";

/**
 * 파일 → 표(줄 × 칸). CSV와 엑셀(.xlsx)을 읽어요.
 * 네이버에서 내려받은 엑셀은 비밀번호가 걸려 있어요. 그런 파일은 LockedFileError를 던지고,
 * 화면에서 비밀번호를 받아 서버(unlockNaverExcel)에서 풀어요.
 */
export class LockedFileError extends Error {
  constructor() {
    super("비밀번호가 걸린 엑셀이에요. 내려받을 때 정한 비밀번호를 적어 주세요.");
  }
}

const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export async function readSheetFile(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return parseCsv(await file.text());
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (OLE_MAGIC.every((b, i) => head[i] === b)) throw new LockedFileError();
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const [sheet] = await readXlsxFile(file);
    return sheetToTable(sheet?.data ?? []);
  }
  throw new Error("CSV나 엑셀(.xlsx) 파일을 골라 주세요.");
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 엑셀 칸 → 글자. 날짜 칸은 "2026.04.10 15:05"로 바꿔요.
 * 엑셀 날짜엔 시간대가 없어서 UTC 값 그대로가 제주 현지 시각이에요.
 */
export function sheetToTable(data: unknown[][]): string[][] {
  return data.map((row) =>
    row.map((c) => {
      if (c === null || c === undefined) return "";
      if (c instanceof Date) {
        return `${c.getUTCFullYear()}.${pad(c.getUTCMonth() + 1)}.${pad(c.getUTCDate())} ${pad(c.getUTCHours())}:${pad(c.getUTCMinutes())}`;
      }
      return String(c);
    }),
  );
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
