"use server";

import readXlsxFile from "read-excel-file/node";
import { isAdmin } from "@/lib/session";
import { decryptOfficeFile, isEncryptedOffice, WrongPasswordError } from "@/lib/naver-import/decrypt";
import { sheetToTable } from "@/lib/naver-import/read";

export type UnlockResult = { table: string[][] } | { error: string };

// 서버 액션 본문은 기본 1MB까지예요. 네이버 엑셀은 예약 14건에 15KB 정도라 넉넉해요.
const MAX_SIZE = 900 * 1024;

/**
 * 비밀번호가 걸린 네이버 엑셀을 풀어 표로 돌려줘요.
 * 비밀번호와 파일은 이 요청 안에서만 쓰고 어디에도 저장하지 않아요.
 */
export async function unlockNaverExcel(formData: FormData): Promise<UnlockResult> {
  if (!(await isAdmin())) return { error: "다시 로그인해 주세요." };

  const file = formData.get("file");
  const password = formData.get("password");
  if (!(file instanceof File) || typeof password !== "string" || !password) {
    return { error: "파일과 비밀번호를 함께 보내 주세요." };
  }
  if (file.size > MAX_SIZE) return { error: "파일이 너무 커요. 기간을 나눠서 내려받아 주세요." };

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const plain = isEncryptedOffice(buf) ? decryptOfficeFile(buf, password) : buf;
    const [sheet] = await readXlsxFile(plain);
    return { table: sheetToTable(sheet?.data ?? []) };
  } catch (e) {
    if (e instanceof WrongPasswordError) return { error: e.message };
    return { error: e instanceof Error ? `파일을 못 열었어요: ${e.message}` : "파일을 못 열었어요." };
  }
}
