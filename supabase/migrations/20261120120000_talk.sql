-- 네이버 톡톡 문의 (챗봇 API webhook으로 받아요)
-- talk_threads  : 손님 한 명(톡톡 사용자 식별값)과의 대화방. 문의함 목록 한 줄.
-- talk_messages : 주고받은 메시지. 손님(in)·어드민 답장(out)·파트너센터 앱 답장(out, echo로 받아요).
-- 손님은 톡톡이 준 익명 식별값으로만 와요(이름·전화번호 없음).

create table public.talk_threads (
  user_id          text primary key,                    -- 톡톡 사용자 식별값(네이버 아이디마다 고정)
  inflow           text,                                -- 처음 들어온 경로: list / button / none
  referer          text,                                -- 들어온 페이지(플레이스 등)
  under14          boolean,
  friend           boolean,
  last_text        text,                                -- 목록 미리보기
  last_at          timestamptz,
  unread           integer not null default 0,          -- 어드민이 아직 안 본 손님 메시지 수
  left_at          timestamptz,                         -- 손님이 채팅방을 나간 때
  memo             text not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index talk_threads_last_idx on public.talk_threads (last_at desc nulls last);

create table public.talk_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references public.talk_threads (user_id) on delete cascade,
  direction   text not null check (direction in ('in', 'out')),
  sender      text not null check (sender in ('customer', 'admin', 'partner_center')),
  kind        text not null default 'text' check (kind in ('text', 'image', 'composite', 'other')),
  text        text,
  image_url   text,
  raw         jsonb not null,                            -- 받은(보낸) 이벤트 원문
  created_at  timestamptz not null default now()
);

create index talk_messages_user_idx on public.talk_messages (user_id, created_at);

alter table public.talk_threads enable row level security;
alter table public.talk_messages enable row level security;
