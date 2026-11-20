/**
 * 씬오브제주 · 네이버 예약 메일 → 어드민
 *
 * 네이버 예약 메일을 받는 reservation@earth-2-space.com(Google Workspace) 계정으로 로그인해서
 * Google Apps Script(script.google.com)에 새 프로젝트를 만들고 붙여 넣어 써요. 자동 전달은 필요 없어요.
 * 5분마다 아직 안 보낸 네이버 예약 메일을 찾아 어드민 /api/naver-mail 로 보내고,
 * 보낸 스레드에는 "soj/보냄" 라벨을 붙여 다시 보내지 않아요.
 *
 * 처음 한 번:
 *   1. 프로젝트 설정 → 스크립트 속성에 두 값을 넣어요
 *        SOJ_ENDPOINT  https://<어드민 주소>/api/naver-mail
 *        SOJ_SECRET    어드민 환경변수 NAVER_MAIL_SECRET 과 같은 값
 *   2. 함수 install 을 한 번 실행해요(권한 허용 → 5분 트리거가 생겨요)
 *   3. 실행 기록(왼쪽 "실행")에서 "stored"가 찍히는지 확인해요
 *
 * 메일 검색 조건(SEARCH): 네이버(naver.com·navercorp.com)가 보낸, 제목·본문에 "예약"이 있는 메일.
 * 예약 메일이 안 잡히면 실제 메일의 보낸 사람 주소를 보고 SEARCH만 고치면 돼요.
 */

var SEARCH = '(from:naver.com OR from:navercorp.com) 예약 -label:soj/보냄 newer_than:14d';
var SENT_LABEL = 'soj/보냄';
var MAX_PER_RUN = 30;

function install() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pushNaverMails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pushNaverMails').timeBased().everyMinutes(5).create();
  pushNaverMails();
}

function pushNaverMails() {
  var props = PropertiesService.getScriptProperties();
  var endpoint = props.getProperty('SOJ_ENDPOINT');
  var secret = props.getProperty('SOJ_SECRET');
  if (!endpoint || !secret) throw new Error('스크립트 속성 SOJ_ENDPOINT, SOJ_SECRET 을 먼저 넣어 주세요.');

  var label = GmailApp.getUserLabelByName(SENT_LABEL) || GmailApp.createLabel(SENT_LABEL);
  var threads = GmailApp.search(SEARCH, 0, MAX_PER_RUN);
  if (threads.length === 0) return;

  var mails = [];
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (m) {
      mails.push({
        id: m.getId(),
        subject: m.getSubject(),
        from: m.getFrom(),
        receivedAt: m.getDate().toISOString(),
        text: m.getPlainBody(),
        html: m.getBody(),
      });
    });
  });

  var res = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-soj-secret': secret },
    payload: JSON.stringify({ mails: mails }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    // 라벨을 안 붙였으니 5분 뒤에 다시 보내요. 같은 메일은 어드민에서 한 번만 들어가요.
    throw new Error('어드민 응답 ' + res.getResponseCode() + ': ' + res.getContentText());
  }
  label.addToThreads(threads);
  console.log(res.getContentText());
}
