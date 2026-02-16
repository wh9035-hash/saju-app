# 사주풀이 웹서비스 프로젝트

## 목표
사주아이(saju-kid.com) 스타일의 유료 사주 분석 웹서비스 구축

## 타겟 레퍼런스
- https://saju-kid.com/ (990원 사주 분석, 100만명 이용)
- 서비스: 사주 분석 / 궁합 / 신년운세

---

## 현재 보유 자산
- [x] 사주 만세력 계산 엔진 (`saju-core.js`)
- [x] 진태양시 보정 기능
- [x] AI 분석 (Claude API 연동, 13개 섹션)
- [x] 기본 UI (입력 → 로딩 → 결과)
- [x] 공유/저장 기능 (이미지, PDF, 텍스트)

---

## 개발 로드맵

### Phase 1: 랜딩 페이지 리뉴얼
- [ ] 메인 히어로 섹션 (사주아이 스타일)
- [ ] 서비스 카드 (사주 / 궁합 / 운세)
- [ ] 이용자 후기 섹션
- [ ] 가격 안내 (990원~)
- [ ] 모바일 최적화

### Phase 2: 결제 시스템
- [ ] 포트원(PortOne) 연동 (카카오페이 + 카드결제)
- [ ] 결제 흐름: 입력 → 결제 → AI 분석 → 결과
- [ ] 결제 완료 후 고유 URL 생성 (결과 재방문 가능)
- [ ] 서버 측 결제 검증 (위변조 방지)

### Phase 3: 서비스 확장
- [ ] 궁합 서비스 (두 사람 사주 비교)
- [ ] 2026 신년운세 서비스
- [ ] 결과 페이지 디자인 고도화

### Phase 4: 배포 & 운영
- [ ] 도메인 구매 & 연결
- [ ] Vercel 또는 Railway로 배포
- [ ] Google Analytics 연동
- [ ] SEO 최적화
- [ ] Google AdSense 광고 (추가 수익)

---

## 기술 스택

| 분류 | 기술 | 이유 |
|------|------|------|
| 프론트엔드 | HTML/CSS/JS (현재) | 이미 구축됨 |
| 백엔드 | Node.js + Express | 현재 server.js 활용 |
| AI | Claude API | 이미 연동됨 |
| 결제 | 포트원(PortOne) | 카카오페이/카드/네이버페이 통합 |
| 배포 | Vercel or Railway | 무료 티어 가능 |
| DB | SQLite or Supabase | 결제 기록 저장 |

---

## 결제 흐름 설계

```
사용자 흐름:
1. 랜딩 페이지 → "사주 보기" 클릭
2. 생년월일/시간 입력
3. 무료 미리보기 (사주 원국 + 총론 일부)
4. "전체 분석 보기 - 990원" 버튼
5. 카카오페이/카드 결제
6. 결제 완료 → 전체 13개 섹션 AI 분석 표시
7. 고유 URL 발급 (재방문 가능)
```

---

## 카카오페이 연동 방법 (포트원 사용)

### 필요 준비물
1. **카카오 개발자 계정** - developers.kakao.com
2. **포트원 계정** - portone.io 가입
3. **사업자등록증** - 실결제 시 필수 (테스트는 없어도 됨)

### 연동 코드 예시 (프론트엔드)
```javascript
// 포트원 SDK 로드 후
const IMP = window.IMP;
IMP.init("가맹점식별코드");

IMP.request_pay({
  pg: "kakaopay",
  pay_method: "card",
  merchant_uid: "order_" + new Date().getTime(),
  name: "사주풀이 분석",
  amount: 990,
  buyer_name: "사용자이름"
}, function(response) {
  if (response.success) {
    // 서버에 결제 검증 요청
    // 검증 성공 시 → 전체 분석 페이지로 이동
  }
});
```

### 서버 검증 (백엔드)
```javascript
// 포트원 API로 결제 검증
const response = await fetch(`https://api.iamport.kr/payments/${imp_uid}`);
// 금액 일치 확인 후 결과 페이지 접근 허용
```

---

## 가격 정책 (안)

| 서비스 | 가격 | 내용 |
|--------|------|------|
| 사주 분석 | 990원 | 13개 섹션 전체 분석 |
| 궁합 | 990원 | 두 사람 궁합 + 조언 |
| 신년운세 | 990원 | 2026년 월별 운세 |
| 사주+궁합 패키지 | 1,500원 | 할인 패키지 |

---

## 폴더 구조 (계획)

```
saju-app/
├── index.html          # 랜딩 페이지 (리뉴얼)
├── saju.html           # 사주 분석 페이지
├── gunghap.html        # 궁합 페이지
├── unse.html           # 운세 페이지
├── css/
│   ├── style.css       # 기존 스타일
│   └── landing.css     # 랜딩 페이지 스타일
├── js/
│   ├── saju-data.js    # 사주 데이터
│   ├── saju-core.js    # 사주 계산 엔진
│   ├── app.js          # 앱 로직
│   └── payment.js      # 결제 로직
├── server.js           # 백엔드 (API + 결제검증)
├── package.json
├── PROJECT.md          # 이 파일
└── CLAUDE.md           # Claude 지시사항
```

---

## 메모
- 사업자등록증 없으면 테스트 모드로 먼저 개발
- 포트원 테스트 모드에서 실제 결제 없이 전체 흐름 테스트 가능
- 나중에 사업자 등록 후 실결제로 전환
