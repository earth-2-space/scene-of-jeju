-- 씬오브제주 예약 DB (1차)
-- 기준: 스마트플레이스 "예약자관리" 엑셀(2026.11.18 내려받기) 열 구성.
-- 네이버 예약은 두 층으로 둬요.
--   naver_bookings : 네이버가 준 원본. 예약번호 하나에 한 줄. 엑셀·메일 어느 쪽으로 받아도 예약번호로 합쳐요.
--   reservations   : 어드민이 쓰는 예약(상태·확인·메모·안내). 네이버 예약이면 naver_booking_id로 원본과 이어져요.
-- 화면은 서버(비밀 키)로만 읽고 써요. RLS를 켜고 정책을 두지 않아 공개 키로는 못 읽어요.

create table public.naver_bookings (
  booking_id          text primary key,                 -- 예약번호
  order_no            text,                             -- 주문번호
  product_order_no    text,                             -- 상품주문번호
  status              text not null
                      check (status in ('confirmed', 'completed', 'canceled', 'no_show')),
  status_text         text,                             -- 상태 원문: 확정 / 이용완료 / 취소 …
  booking_type        text,                             -- 예약유형: 일반 …
  channel             text,                             -- 유입경로: 네이버 플레이스 - 검색 목록 …
  booker_name         text,                             -- 예약자 (엑셀은 김*수처럼 가려져요)
  booker_phone        text,                             -- 전화번호 (가리지 않은 번호만. 메일 등에서 받으면 채워요)
  booker_phone_masked text,                             -- 전화번호 (가려진 값: ******1234)
  booker_email        text,                             -- 이메일 (가려진 값일 수 있어요)
  visitor_name        text,                             -- 방문자
  visitor_phone       text,                             -- 방문자전화번호
  product_name        text not null,                    -- 상품
  slot_at             timestamptz not null,             -- 이용일시
  people              integer not null check (people > 0),
  options             jsonb not null default '[]',      -- 가격분류·옵션·필수 [{group, name, count, price}]
  answers             jsonb not null default '[]',      -- 예약자입력정보 [{question, answer}]
  request             text,                             -- 요청사항(메일) + 예약자입력정보 요약
  pay_amount          integer,                          -- 결제금액
  coupon_discount     integer,                          -- 쿠폰적용금액
  card_discount       integer,                          -- 카드할인금액
  paid_amount         integer,                          -- 실결제금액
  pay_method          text,                             -- 결제수단
  pay_status          text,                             -- 결제상태: 결제완료 / 환불완료
  refund_amount       integer,                          -- 환불금액
  cancel_fee          integer,                          -- 취소수수료
  staff_memo          text,                             -- 직원메모(네이버 쪽)
  requested_at        timestamptz,                      -- 예약신청일시
  confirmed_at        timestamptz,                      -- 예약확정일시
  completed_at        timestamptz,                      -- 이용완료일시
  canceled_at         timestamptz,                      -- 예약취소일시
  cancel_reason       text,                             -- 취소사유
  sources             text[] not null default '{}',     -- 받은 경로: excel, mail
  raw                 jsonb,                            -- 마지막으로 받은 엑셀 한 줄(열 이름 → 값)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.reservations (
  id                uuid primary key default gen_random_uuid(),
  date              date not null,
  time              text not null check (time ~ '^\d{2}:\d{2}$'),
  ritual_id         text,                               -- lib/rituals.ts의 id. 씬오브유는 현장에서 정해 비어 있을 수 있어요
  private_class     boolean not null default false,
  people            integer not null default 1 check (people > 0),
  add_ons           jsonb not null default '{"landscapeBite": 0, "extraWork": 0, "treasureHunt": 0}',
  pickup            text not null default 'onsite' check (pickup in ('onsite', 'visit', 'delivery')),
  lang              text not null default 'ko' check (lang in ('ko', 'en', 'ja', 'zh')),
  status            text not null
                    check (status in ('inquiry', 'pending', 'confirmed', 'visited', 'no_show', 'canceled')),
  reviewed          boolean not null default false,     -- 대표님 확인. 확인해야 카카오 안내가 잡혀요
  source            text not null check (source in ('naver', 'form', 'manual')),
  naver_booking_id  text unique references public.naver_bookings (booking_id) on delete set null,
  customer_name     text not null default '',
  customer_phone    text,                               -- 안내를 보낼 수 있는 번호만
  customer_email    text,
  memo              text not null default '',
  messages          jsonb not null default '[]',        -- 1차: 발송 계획. 이후 message 테이블로 나눠요
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index reservations_date_idx on public.reservations (date);

-- 받은 네이버 예약 메일 기록. 같은 메일은 한 번만 처리하고, 못 읽은 메일은 어드민에 보여줘요.
create table public.naver_mails (
  mail_id      text primary key,                        -- Gmail message id
  subject      text not null default '',
  from_addr    text,
  received_at  timestamptz,
  kind         text,                                    -- new / change / cancel / unknown
  ok           boolean not null,
  reason       text,                                    -- 못 읽은 까닭
  booking_id   text,
  dismissed    boolean not null default false,          -- 대표님이 직접 확인하고 지운 것
  raw          jsonb not null,                          -- 메일 원문(제목·본문)
  created_at   timestamptz not null default now()
);

create index naver_mails_failed_idx on public.naver_mails (created_at) where not ok and not dismissed;

alter table public.naver_bookings enable row level security;
alter table public.reservations enable row level security;
alter table public.naver_mails enable row level security;
