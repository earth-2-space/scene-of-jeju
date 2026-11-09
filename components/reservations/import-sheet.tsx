"use client";

import { useState } from "react";
import { Sheet, SheetHeader } from "@/components/ui/sheet";
import { dotMonthDay, toISODate } from "@/lib/dates";
import { NAVER_FIELDS } from "@/lib/naver-import/columns";
import { NAVER_FIELD_GUIDE } from "@/lib/naver/types";
import { parseNaverSheet } from "@/lib/naver-import/parse";
import { readSheetFile, sampleNaverTable } from "@/lib/naver-import/read";
import { reservationStore, useReservations, type ImportResult } from "@/lib/reservations/store";
import { RitualLabel, optionSummary } from "./marks";

type Parsed = ReturnType<typeof parseNaverSheet> & { fileName: string };

export function NaverImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="네이버 엑셀 올리기" wide>
      <SheetHeader
        title="네이버 엑셀 올리기"
        sub="스마트플레이스에서 내려받은 예약 목록을 올리면, 같은 예약번호는 갱신하고 새 건만 더해요."
        onClose={onClose}
      />
      <ImportFlow onClose={onClose} />
    </Sheet>
  );
}

function ImportFlow({ onClose }: { onClose: () => void }) {
  const existing = useReservations() ?? [];
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setParsed({ ...parseNaverSheet(await readSheetFile(file)), fileName: file.name });
    } catch (e) {
      setParsed(null);
      setError(e instanceof Error ? e.message : "파일을 읽지 못했어요.");
    }
  }

  if (result) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-6 py-8">
        <p className="text-[22px] font-semibold tracking-[-0.02em]">
          새 예약 {result.added}건, 갱신 {result.updated}건
        </p>
        <p className="text-[14px] text-ink-2">
          네이버 바로확정이라 “확정”으로 들어오고 “새 예약” 표시가 붙어요. 보드에서 확인을 누르면 카카오 안내가 대기열에 올라가요.
        </p>
        <button type="button" className="btn btn-fill self-start" onClick={onClose}>
          보드로 돌아가기
        </button>
      </div>
    );
  }

  const known = new Set(existing.map((r) => r.naverBookingId).filter(Boolean));

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-fill cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-jjok">
          파일 고르기
          <input
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          className="text-[13px] text-jjok underline-offset-2 hover:underline"
          onClick={() => {
            setError(null);
            setParsed({ ...parseNaverSheet(sampleNaverTable(toISODate(new Date()))), fileName: "예시 파일" });
          }}
        >
          예시 파일로 흐름 보기
        </button>
        <span className="hint">지금은 CSV · 엑셀(.xlsx)은 샘플을 받은 뒤 열어요</span>
      </div>

      {error && <p className="rounded-lg bg-jjok-soft px-3 py-2 text-[13px] text-jjok">{error}</p>}

      {!parsed && <NaverFieldGuide />}

      {parsed && (
        <>
          <section>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-[13px] font-semibold">열 맞추기</h3>
              <span className="hint">{parsed.fileName}</span>
            </div>
            <table className="w-full border-t border-line text-[13px]">
              <tbody>
                {NAVER_FIELDS.map(({ field, label, required }) => {
                  const header = parsed.match.header[field];
                  return (
                    <tr key={field} className="border-b border-line-2">
                      <th scope="row" className="w-36 py-1.5 text-left font-normal text-ink-2">
                        {label}
                        {required && <span className="ml-1 text-jjok">*</span>}
                      </th>
                      <td className={header ? "" : required ? "font-semibold text-jjok" : "text-ink-3"}>
                        {header ?? (required ? "못 찾았어요" : "없음")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {parsed.match.unused.length > 0 && (
              <p className="mt-2 text-[12px] text-ink-3">쓰지 않는 열: {parsed.match.unused.join(", ")}</p>
            )}
            {parsed.match.missingRequired.length > 0 && (
              <p className="mt-2 text-[12.5px] text-jjok">
                꼭 필요한 열을 못 찾았어요. 열 이름이 다르면 lib/naver-import/columns.ts에 후보를 더해 주세요.
              </p>
            )}
          </section>

          {parsed.rows.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold">들어올 예약 {parsed.rows.length}건</h3>
              <ul className="border-t border-line">
                {parsed.rows.map((r) => {
                  const isUpdate = known.has(r.naverBookingId);
                  return (
                    <li
                      key={r.naverBookingId}
                      className="grid grid-cols-[88px_1fr_auto] items-baseline gap-3 border-b border-line-2 py-2 text-[13px]"
                    >
                      <span className="text-ink-2">
                        {dotMonthDay(r.date)} {r.time}
                      </span>
                      <span className="truncate">
                        <b className="font-semibold">{r.customer.name}</b>
                        <span className="ml-2 text-ink-2">
                          <RitualLabel r={r} /> · {r.people}명
                          {optionSummary(r).map((o) => ` · ${o}`)}
                        </span>
                      </span>
                      <span className={`text-[12px] ${isUpdate ? "text-ink-3" : "font-semibold text-jjok"}`}>
                        {isUpdate ? "갱신" : "새 예약"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {parsed.errors.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-semibold">건너뛸 줄 {parsed.errors.length}</h3>
              <ul className="flex flex-col gap-1 text-[12.5px] text-ink-2">
                {parsed.errors.map((e) => (
                  <li key={e.row}>
                    {e.row}번째 줄 · {e.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-auto flex items-center gap-3 border-t border-line pt-4">
            <p className="hint mr-auto">메모와 보낸 안내 내역은 그대로 둬요.</p>
            <button
              type="button"
              className="btn btn-fill px-6"
              disabled={parsed.rows.length === 0}
              onClick={() => setResult(reservationStore.importNaver(parsed.rows))}
            >
              {parsed.rows.length}건 가져오기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** 네이버에서 받을 수 있는 항목. 확인된 것과 계정 연결 후 확인할 것을 나눠 보여줘요. */
function NaverFieldGuide() {
  return (
    <section>
      <h3 className="mb-1 text-[13px] font-semibold">네이버에서 받는 항목</h3>
      <p className="hint mb-3">
        네이버 예약 API는 제휴 심사가 필요해서 아직 명세를 못 봤어요. 연동 사례와 예약 알림 메일 기준으로 잡았어요.
      </p>
      <ul className="divide-y divide-line-2 rounded-lg border border-line text-[13px]">
        {NAVER_FIELD_GUIDE.map((f) => (
          <li key={f.label} className="grid grid-cols-[1fr_auto] items-baseline gap-3 px-3 py-2">
            <span>
              {f.label}
              <span className="ml-2 text-[12px] text-ink-3">{f.note}</span>
            </span>
            <span className={`text-[12px] ${f.confirmed ? "text-moss" : "text-ink-3"}`}>
              {f.confirmed ? "연동 사례에서 확인" : "계정 연결 후 확인"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
