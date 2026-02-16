const fs = require('fs');
const path = require('path');

// .env 파일에서 환경변수 로드
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}

const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Claude API 클라이언트 (환경변수 ANTHROPIC_API_KEY 사용)
const anthropic = new Anthropic();

// ============================================================
// 섹션별 프롬프트 템플릿
// ============================================================

function buildSajuContext(sajuData) {
  const s = sajuData.saju;
  return `
[사주 원국]
이름: ${sajuData.name} (${sajuData.gender}성)
생년월일시: ${sajuData.birthInfo.year}년 ${sajuData.birthInfo.month}월 ${sajuData.birthInfo.day}일 ${sajuData.birthInfo.hour}시 ${sajuData.birthInfo.minute}분
띠: ${sajuData.animal}띠

시주: ${s.hour.gan}${s.hour.ji} | 일주: ${s.day.gan}${s.day.ji} | 월주: ${s.month.gan}${s.month.ji} | 년주: ${s.year.gan}${s.year.ji}

[오행 분포]
목: ${sajuData.ohaeng.main['목']}개, 화: ${sajuData.ohaeng.main['화']}개, 토: ${sajuData.ohaeng.main['토']}개, 금: ${sajuData.ohaeng.main['금']}개, 수: ${sajuData.ohaeng.main['수']}개

[음양] 양: ${sajuData.eumyang['양']}개, 음: ${sajuData.eumyang['음']}개

[십성]
년주 천간: ${sajuData.sipsung.year.gan}, 년주 지지: ${sajuData.sipsung.year.ji}
월주 천간: ${sajuData.sipsung.month.gan}, 월주 지지: ${sajuData.sipsung.month.ji}
일주 천간: 일원(본인), 일주 지지: ${sajuData.sipsung.day.ji}
시주 천간: ${sajuData.sipsung.hour.gan}, 시주 지지: ${sajuData.sipsung.hour.ji}

[십이운성]
년: ${sajuData.sibiUnsung.year}, 월: ${sajuData.sibiUnsung.month}, 일: ${sajuData.sibiUnsung.day}, 시: ${sajuData.sibiUnsung.hour}

[신강/신약] ${sajuData.singang.label} (내 힘: ${sajuData.singang.myPower.toFixed(1)}, 상대 힘: ${sajuData.singang.otherPower.toFixed(1)})
[격국] ${sajuData.gyeokguk.name}
[용신] ${sajuData.yongsin.yongsin.ohaeng}(용신), ${sajuData.yongsin.huisin.ohaeng}(희신), ${sajuData.yongsin.gisin.ohaeng}(기신)

[신살] ${sajuData.sinsals.map(s => s.name).join(', ') || '없음'}
[합충형] ${sajuData.relations.map(r => `${r.type}(${r.jis ? r.jis.join('') : ''})`).join(', ') || '없음'}
`.trim();
}

// 공통 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 한국에서 가장 센스있는 사주 전문가입니다.
- 제목은 반드시 자극적이고 비유가 담긴 한 줄로 작성 (유튜브 썸네일 스타일)
- 본문 시작은 바로 이 사람의 핵심을 찔러주세요
- 비유를 풍부하게 사용 (자동차, 음식, 동물, 일상 상황 등)
- 명리학 근거를 반드시 포함하되 쉽게 풀어서 설명
- 톤: "~거든요", "~잖아요" 같은 구어체 + "~입니다" 존댓말 자연스럽게 혼합
- 마지막에 현실적이고 구체적인 조언 필수
- 이름을 자연스럽게 포함 (OO 님)
- 마크다운 형식: ## 제목 후 본문`;

const SECTION_PROMPTS = {
  // 섹션 1: 총론 (한마디 요약)
  section1: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "총론 (한마디 요약)" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **한마디 정의**: 이 사주를 한 문장으로 정의 (비유 필수. 예: "당신은 고급 세단 같은 사주입니다")
2. **사주 구성 핵심 해석**: 년월일시 네 기둥이 만들어내는 전체적인 그림을 쉽게 풀어서
3. **이 사주의 핵심 키워드**: 3~4개 키워드로 요약
4. **인생 전체를 관통하는 핵심 조언**: 구체적이고 현실적인 한 줄 조언

제목 예시: "터보 엔진 달린 경주마, 근데 브레이크가 좀 약하다?!" 같은 느낌으로 자극적이게.
분량: 800~1200자`
  }),

  // 섹션 2: 오행 분석
  section2: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "오행 분석" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **오행 비율 시각적 비유**: 오행 분포를 음식 레시피나 칵테일 배합 같은 비유로 설명
2. **가장 강한 오행의 영향**: 어떤 성향을 만들어내는지
3. **부족한 오행 분석**: 부족한 게 뭔지, 어떤 영향을 미치는지
4. **부족한 기운 채우기**: 색상, 음식, 활동, 방향 등 구체적 방법
5. **오행 밸런스 조언**: 조화를 위해 어떻게 해야 하는지

제목은 "물이 넘치는데 불은 어디 갔어?!" 같은 느낌으로.
분량: 600~1000자`
  }),

  // 섹션 3: 일주 해석
  section3: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "일주 해석" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **일주(일간+일지) 특성**: 이 일주가 어떤 사람인지 동물이나 캐릭터에 비유해서
2. **내면 vs 외면**: 겉으로 보이는 모습과 속마음의 차이
3. **십성 기반 해석**: 주요 십성이 만들어내는 성격 패턴
4. **일주의 강점과 매력 포인트**: 다른 일주와 차별되는 매력
5. **일주가 주는 인생 과제**: 이 일주가 풀어야 할 숙제

제목은 "겉은 차가운데 속은 용암?! OO일주의 반전 매력" 같은 느낌으로.
분량: 600~1000자`
  }),

  // 섹션 4: 행동/실행력
  section4: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "행동/실행력" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **실행력 진단**: 식상(식신/상관) 유무와 강약으로 행동력 진단
2. **인성 과다 여부**: 생각만 많고 실행 안 하는 타입인지 팩폭
3. **의사결정 스타일**: 결정을 빨리 하는지, 고민을 많이 하는지
4. **실행력 높이는 방법**: 구체적이고 실용적인 팁
5. **주의할 점**: 이 사주가 행동에서 빠지기 쉬운 함정

제목은 "생각은 100개인데 실행은 3개?! 당신의 실행력 점수는" 같은 느낌으로 팩폭 스타일.
분량: 600~1000자`
  }),

  // 섹션 5: 강점/가치
  section5: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "강점/가치" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **타고난 강점 TOP 3**: 사주에서 드러나는 핵심 강점을 구체적으로
2. **숨겨진 매력**: 본인도 모르는 숨은 능력
3. **주변에서 인정받는 점**: 다른 사람 눈에 비치는 장점
4. **강점을 극대화하는 법**: 실생활에서 활용하는 구체적 방법
5. **격려와 응원**: 긍정 에너지 가득한 마무리

이 섹션은 특히 긍정적이고 힘이 되는 톤으로! 자존감 올려주는 느낌.
제목은 "당신이 모르는 당신의 숨겨진 무기 3가지" 같은 느낌으로.
분량: 600~1000자`
  }),

  // 섹션 6: 성격 심층
  section6: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "성격 심층 분석" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **신살 기반 성격 분석**: 도화살, 역마살, 화개살 등 신살이 만드는 성격 특성
2. **십성 조합 성격**: 비겁, 식상, 재성, 관성, 인성의 배합이 만드는 복합 성격
3. **스트레스 받을 때 반응**: 이 사주가 힘들 때 보이는 행동 패턴
4. **성격의 양면성**: 장점이 될 수도 있고 단점이 될 수도 있는 특성
5. **성격 업그레이드 팁**: 단점을 보완하는 구체적 조언

제목은 "겉으로는 착한데 속으로는 욕하는 타입?!" 같은 느낌으로 찔러주는 스타일.
분량: 600~1000자`
  }),

  // 섹션 7: 직업운
  section7: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "직업운" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **격국으로 본 직업 적성**: 이 사주에 딱 맞는 업종/분야
2. **구체적 추천 직업 5~7개**: 이유와 함께 제시
3. **사업 vs 직장**: 어디서 더 빛나는지, 근거와 함께
4. **커리어 치트키**: 이 사주만의 성공 전략
5. **절대 피해야 할 직업**: 안 맞는 유형과 이유

제목은 "이 직업 하면 대박, 저 직업 하면 쪽박?!" 같은 느낌으로.
분량: 800~1200자`
  }),

  // 섹션 8: 재물운
  section8: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "재물운" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **돈 버는 패턴**: 재성의 위치와 강약으로 본 수입 스타일 (월급형 vs 사업형 vs 투잡형)
2. **돈 쓰는 패턴**: 소비 습관과 돈에 대한 태도
3. **투자 성향**: 주식/부동산/코인 등 어떤 투자가 맞는지
4. **재물운이 트이는 시기**: 언제 돈이 들어오는지
5. **돈 관련 주의사항**: 재물 누수 포인트와 방지법

제목은 "통장이 텅장 되는 이유, 사주에 다 써있다?!" 같은 느낌으로.
분량: 800~1200자`
  }),

  // 섹션 9: 연애운
  section9: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "연애운" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **연애 스타일**: 밀당형? 올인형? 느린형? 구체적으로
2. **이상형**: 오행으로 본 잘 맞는 상대 유형 (외모, 성격, 직업까지)
3. **연애할 때 매력 포인트**: 상대가 반하는 포인트
4. **연애 중 주의점**: 이 사주가 연애에서 실수하는 패턴
5. **배우자운**: 일지로 본 미래 배우자 성격과 만남 시기

성별에 맞춰서 작성 (남성이면 여자친구/아내 관점, 여성이면 남자친구/남편 관점).
제목은 "연애하면 집착충 될 수 있는 사주?!" 같은 느낌으로 자극적이게.
분량: 800~1200자`
  }),

  // 섹션 10: 가족관계
  section10: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "가족관계" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **부모와의 관계**: 년주와 월주로 본 부모와의 관계 패턴
2. **형제/자매 관계**: 비겁으로 본 형제 관계
3. **가족 안에서의 역할**: 리더형? 중재자형? 막내 포지션?
4. **독립 시기**: 언제 독립하면 좋은지
5. **가족 관계 개선 팁**: 구체적인 관계 개선 조언

제목은 "엄마한테 잔소리 들을 수밖에 없는 사주?!" 같은 느낌으로 공감 유발.
분량: 600~1000자`
  }),

  // 섹션 11: 친구/인간관계
  section11: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "친구/인간관계" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **교우 관계 스타일**: 넓고 얕은 인맥형? 좁고 깊은 소수정예형?
2. **사회생활 패턴**: 회사/학교에서의 포지션
3. **잘 맞는 친구 유형**: 어떤 사주의 사람과 케미가 좋은지
4. **주의할 인간관계**: 이 사주가 만나면 에너지 빨리는 유형
5. **인간관계 레벨업 팁**: 더 좋은 인간관계를 위한 조언

제목은 "친구는 많은데 진짜 내 편은 몇 명일까?" 같은 느낌으로.
분량: 600~1000자`
  }),

  // 섹션 12: 개운 장소
  section12: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "개운 장소" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **좋은 방위**: 용신 오행에 맞는 방위와 이유
2. **국내 추천 지역**: 구체적인 도시/지역명 3~5개
3. **해외 추천 나라**: 여행이나 유학, 이민에 좋은 나라
4. **인테리어/공간 꾸미기**: 집이나 사무실에 놓으면 좋은 것들 (색상, 소품, 식물 등)
5. **피해야 할 방위/장소**: 기신 방위와 주의사항

제목은 "이사 가면 인생 역전?! 당신의 개운 방위는" 같은 느낌으로.
분량: 600~1000자`
  }),

  // 섹션 13: 마무리 격려
  section13: (ctx) => ({
    system: SYSTEM_PROMPT,
    user: `${ctx}

위 사주를 바탕으로 "마무리 격려" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **전체 종합 정리**: 이 사주의 핵심을 3줄로 요약
2. **가장 중요한 인생 조언**: 딱 하나만 기억할 것
3. **힘이 되는 명언**: 이 사주에 딱 맞는 명언 1~2개 (동양/서양 불문)
4. **앞으로의 응원 메시지**: 따뜻하고 진심어린 격려

이 섹션은 읽는 사람이 눈물 날 정도로 감동적이고 힘이 되게 작성!
제목은 "OO님, 당신의 사주를 한마디로 정리하면..." 같은 느낌으로 감성적이게.
분량: 800~1200자`
  })
};

// ============================================================
// API 엔드포인트
// ============================================================

app.post('/api/analyze', async (req, res) => {
  try {
    const { sajuData, section } = req.body;

    if (!sajuData || !section) {
      return res.status(400).json({ error: '사주 데이터와 섹션 번호가 필요합니다.' });
    }

    const ctx = buildSajuContext(sajuData);
    const promptFn = SECTION_PROMPTS[section];

    if (!promptFn) {
      return res.status(400).json({ error: '잘못된 섹션 번호입니다.' });
    }

    const { system, user } = promptFn(ctx);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: system,
      messages: [{ role: 'user', content: user }]
    });

    const text = message.content[0].text;
    res.json({ result: text });

  } catch (error) {
    console.error('API 에러:', error.message);
    res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + error.message });
  }
});

// 모든 섹션 한 번에 분석
app.post('/api/analyze-all', async (req, res) => {
  try {
    const { sajuData } = req.body;
    if (!sajuData) {
      return res.status(400).json({ error: '사주 데이터가 필요합니다.' });
    }

    const sections = [
      'section1', 'section2', 'section3', 'section4', 'section5',
      'section6', 'section7', 'section8', 'section9', 'section10',
      'section11', 'section12', 'section13'
    ];

    // 스트리밍 응답 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const ctx = buildSajuContext(sajuData);

    for (const section of sections) {
      const promptFn = SECTION_PROMPTS[section];
      if (!promptFn) continue;

      const { system, user } = promptFn(ctx);

      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2000,
          system: system,
          messages: [{ role: 'user', content: user }]
        });

        const text = message.content[0].text;
        res.write(`data: ${JSON.stringify({ section, result: text })}\n\n`);
      } catch (err) {
        res.write(`data: ${JSON.stringify({ section, error: err.message })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('전체 분석 에러:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 궁합 분석 API
// ============================================================

function buildGunghapContext(person1, person2, gunghap) {
  const s1 = person1.saju;
  const s2 = person2.saju;
  return `
[궁합 분석 데이터]

■ ${person1.name} (${person1.gender}성, ${person1.animal}띠)
생년월일시: ${person1.birthInfo.year}년 ${person1.birthInfo.month}월 ${person1.birthInfo.day}일 ${person1.birthInfo.hour}시
사주: ${s1.year.gan}${s1.year.ji}년 ${s1.month.gan}${s1.month.ji}월 ${s1.day.gan}${s1.day.ji}일 ${s1.hour.gan}${s1.hour.ji}시
일간 오행: ${person1.saju.day.gan}(${CHEONGAN_OHAENG_SERVER[person1.saju.day.gan]})
신강/신약: ${person1.singang.label}
격국: ${person1.gyeokguk.name}
오행분포 - 목:${person1.ohaeng.main['목']} 화:${person1.ohaeng.main['화']} 토:${person1.ohaeng.main['토']} 금:${person1.ohaeng.main['금']} 수:${person1.ohaeng.main['수']}

■ ${person2.name} (${person2.gender}성, ${person2.animal}띠)
생년월일시: ${person2.birthInfo.year}년 ${person2.birthInfo.month}월 ${person2.birthInfo.day}일 ${person2.birthInfo.hour}시
사주: ${s2.year.gan}${s2.year.ji}년 ${s2.month.gan}${s2.month.ji}월 ${s2.day.gan}${s2.day.ji}일 ${s2.hour.gan}${s2.hour.ji}시
일간 오행: ${person2.saju.day.gan}(${CHEONGAN_OHAENG_SERVER[person2.saju.day.gan]})
신강/신약: ${person2.singang.label}
격국: ${person2.gyeokguk.name}
오행분포 - 목:${person2.ohaeng.main['목']} 화:${person2.ohaeng.main['화']} 토:${person2.ohaeng.main['토']} 금:${person2.ohaeng.main['금']} 수:${person2.ohaeng.main['수']}

■ 궁합 점수: ${gunghap.score}점 (${gunghap.grade})
세부:
${gunghap.details.map(d => `- ${d.label}: ${d.desc}`).join('\n')}
`.trim();
}

// 서버사이드용 오행 매핑
const CHEONGAN_OHAENG_SERVER = {
  '갑': '목', '을': '목', '병': '화', '정': '화', '무': '토',
  '기': '토', '경': '금', '신': '금', '임': '수', '계': '수'
};

const GUNGHAP_SYSTEM = `당신은 한국에서 가장 센스있는 궁합 전문가입니다.
- 두 사람의 사주를 비교하여 궁합을 분석합니다
- 재미있고 구체적인 비유를 사용하세요
- 명리학 근거를 포함하되 쉽게 풀어서 설명
- 톤: "~거든요", "~잖아요" 같은 구어체 + 존댓말 혼합
- 두 사람의 이름을 자연스럽게 사용
- 마크다운 형식: ## 제목 후 본문`;

const GUNGHAP_SECTIONS = {
  summary: (ctx) => ({
    system: GUNGHAP_SYSTEM,
    user: `${ctx}\n\n위 궁합 데이터를 바탕으로 "총평" 섹션을 작성해주세요.\n\n다음을 포함:\n1. 이 커플을 한마디로 정의 (비유 필수)\n2. 궁합의 핵심 포인트 3가지\n3. 두 사람이 만났을 때 일어나는 케미\n4. 전체 관계 전망\n\n제목은 자극적이고 재미있게. 분량: 600~1000자`
  }),
  personality: (ctx) => ({
    system: GUNGHAP_SYSTEM,
    user: `${ctx}\n\n위 궁합 데이터를 바탕으로 "성격 궁합" 섹션을 작성해주세요.\n\n다음을 포함:\n1. 각자의 성격 특성 (일간, 격국 기반)\n2. 성격적으로 잘 맞는 부분\n3. 성격적으로 안 맞는 부분\n4. 서로에게 배울 수 있는 점\n\n분량: 600~1000자`
  }),
  love: (ctx) => ({
    system: GUNGHAP_SYSTEM,
    user: `${ctx}\n\n위 궁합 데이터를 바탕으로 "연애 스타일" 섹션을 작성해주세요.\n\n다음을 포함:\n1. 각자의 연애 스타일 (밀당형? 올인형?)\n2. 연애 시 케미가 폭발하는 순간\n3. 연애 중 서로에게 끌리는 포인트\n4. 장기 연애/결혼 시 전망\n\n분량: 600~1000자`
  }),
  conflict: (ctx) => ({
    system: GUNGHAP_SYSTEM,
    user: `${ctx}\n\n위 궁합 데이터를 바탕으로 "갈등 포인트" 섹션을 작성해주세요.\n\n다음을 포함:\n1. 가장 많이 싸울 수 있는 주제 TOP 3\n2. 각자의 화내는 패턴\n3. 싸운 후 화해 스타일 차이\n4. 갈등 예방법\n\n솔직하고 팩폭 스타일로. 분량: 600~1000자`
  }),
  advice: (ctx) => ({
    system: GUNGHAP_SYSTEM,
    user: `${ctx}\n\n위 궁합 데이터를 바탕으로 "관계 조언" 섹션을 작성해주세요.\n\n다음을 포함:\n1. 이 관계를 잘 유지하기 위한 핵심 조언 3가지\n2. 서로에게 해주면 좋은 말/행동\n3. 절대 하면 안 되는 말/행동\n4. 응원 메시지\n\n따뜻하고 실용적으로. 분량: 600~1000자`
  })
};

app.post('/api/analyze-gunghap', async (req, res) => {
  try {
    const { person1, person2, gunghap } = req.body;
    if (!person1 || !person2 || !gunghap) {
      return res.status(400).json({ error: '궁합 데이터가 필요합니다.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const ctx = buildGunghapContext(person1, person2, gunghap);
    const sections = ['summary', 'personality', 'love', 'conflict', 'advice'];

    for (const section of sections) {
      const promptFn = GUNGHAP_SECTIONS[section];
      const { system, user } = promptFn(ctx);

      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2000,
          system,
          messages: [{ role: 'user', content: user }]
        });
        const text = message.content[0].text;
        res.write(`data: ${JSON.stringify({ section, result: text })}\n\n`);
      } catch (err) {
        res.write(`data: ${JSON.stringify({ section, error: err.message })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('궁합 분석 에러:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 운세 분석 API
// ============================================================

const UNSE_SYSTEM = `당신은 한국에서 가장 센스있는 운세 전문가입니다.
- 2026년 병오(丙午)년의 운세를 분석합니다
- 재미있고 구체적인 비유를 사용하세요
- 명리학 근거를 포함하되 쉽게 풀어서 설명
- 톤: "~거든요", "~잖아요" 같은 구어체 + 존댓말 혼합
- 이름을 자연스럽게 사용
- 마크다운 형식: ## 제목 후 본문
- 월별 운세는 각 월에 대해 구체적으로 작성`;

app.post('/api/analyze-unse', async (req, res) => {
  try {
    const { sajuData } = req.body;
    if (!sajuData) {
      return res.status(400).json({ error: '사주 데이터가 필요합니다.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const ctx = buildSajuContext(sajuData);

    // 총운
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 3000,
        system: UNSE_SYSTEM,
        messages: [{ role: 'user', content: `${ctx}\n\n위 사주를 바탕으로 2026년(병오년) 총운을 작성해주세요.\n\n다음을 포함:\n1. 2026년 한마디 정의 (비유 필수)\n2. 올해의 핵심 키워드 3가지\n3. 가장 좋은 시기와 주의할 시기\n4. 재물운, 직업운, 연애운 각각 한줄 요약\n5. 올해 반드시 기억할 조언\n\n제목은 자극적이게. 분량: 800~1200자` }]
      });
      res.write(`data: ${JSON.stringify({ section: 'total', result: message.content[0].text })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ section: 'total', error: err.message })}\n\n`);
    }

    // 월별 상세 분석
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        system: UNSE_SYSTEM,
        messages: [{ role: 'user', content: `${ctx}\n\n위 사주를 바탕으로 2026년(병오년) 월별 운세를 작성해주세요.\n\n1월부터 12월까지 각 월에 대해:\n- 해당 월의 핵심 키워드\n- 좋은 점과 주의할 점\n- 한줄 조언\n\n추가로 아래 영역도 상세하게 작성:\n1. 2026년 재물운 상세\n2. 2026년 직업/학업운 상세\n3. 2026년 연애/결혼운 상세\n4. 2026년 건강운\n5. 올해의 개운법 (색상, 방위, 숫자 등)\n\n분량: 2000~3000자` }]
      });
      res.write(`data: ${JSON.stringify({ section: 'detail', result: message.content[0].text })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ section: 'detail', error: err.message })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('운세 분석 에러:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 아이콘 생성 (SVG → PNG 대체: SVG를 그대로 사용)
app.get('/icon-192.png', (req, res) => {
  // SVG 아이콘을 반환 (브라우저가 알아서 처리)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
    <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/><stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient></defs>
    <rect width="192" height="192" rx="40" fill="url(#bg)"/>
    <text x="96" y="110" font-size="90" text-anchor="middle" fill="white">🔮</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

app.get('/icon-512.png', (req, res) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/><stop offset="100%" style="stop-color:#764ba2"/>
    </linearGradient></defs>
    <rect width="512" height="512" rx="100" fill="url(#bg)"/>
    <text x="256" y="300" font-size="240" text-anchor="middle" fill="white">🔮</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// 0.0.0.0으로 바인딩 → 같은 WiFi의 폰에서 접속 가능
app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let localIP = 'localhost';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }

  console.log('');
  console.log('  🔮 사주풀이 서버가 실행 중입니다!');
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  💻 PC에서 접속:   http://localhost:${PORT}`);
  console.log(`  📱 폰에서 접속:   http://${localIP}:${PORT}`);
  console.log('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  같은 WiFi에 연결된 폰에서 위 주소로 접속하세요!');
  console.log('');
});
