**<span style="font-size:250%">Development Document</span>**

------------------------

# 개선 사항
## 현존하는 문제점
- 이미지가 아닌 파일들도 chat.njk, app.js에서 file이 아닌 img로 처리되고 있음(이후 파일 다운로드 버튼 등 제작 시 문제 발생)
- 파일 업로드 시 다운로드 버튼이 바로 생성되지 않음(새로고침 하거나 다른 클라이언트들은 바로 볼 수 있음) -> chat.njk에서 img 생성할 때 만들도록
- 방 삭제 시 방장 및 다른 연결된 클라이언트들에게 뜨는 메시지 변경 필요(현재 메시지를 아예 삭제한 상태)
- socket.io v2.4.1에서 4.x로 마이그레이션 필요
- mongoose v5.13.15에서 6.x로 마이그레이션 필요
## 추후 수정할 기능들
- MongoDB ODM 로직 개선
- 유저 프로필 사진(혹은 아이콘) 설정
- electron으로 Window app publish / cordova 사용 고려(Android Studio SDK 사용을 원칙으로 하나 구현 실패 시 cordova 사용)
- 파일 구조 개선 필요
- 회원 탈퇴 기능 중 라우팅 구조 수정 필요(/deluser에 GET 요청으로 처리 중)
- 다크 테마
- 채팅 시간 띄우기
- 대화 내역 내보내기(xlsx 사용)
- 메일 서비스를 통해 친구 추가 시 메일 발송 등의 기능 추가하기
- /friend/:id/delete 로직 수정 필요

-----------------------------

# commit 별 수정 사항
## 
- TS를 이용한 UsualChat 리마스터를 위한 첫 커밋