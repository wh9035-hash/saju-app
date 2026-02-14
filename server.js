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

const SECTION_PROMPTS = {
  // 섹션 1: 사주원국 & 음양/일주해설
  section1: (ctx) => `당신은 한국 최고의 사주 전문가입니다. 펀사주 스타일로 친근하고 재미있게, 하지만 전문적으로 풀이해주세요.

${ctx}

위 사주를 바탕으로 "사주원국 & 음양/일주해설" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **사주 원국 해석**: 년월일시 각 기둥의 의미와 전체적인 조합 해석
2. **음양 분석**: 음양 비율에 따른 성격 특성
3. **일주(일간+일지) 상세 해설**: 일주의 특성, 성격, 기질을 자세히 설명

톤: 따뜻하고 친근한 말투로, "~하시는 분이에요", "~한 매력이 있답니다" 등의 표현 사용.
분량: 800~1200자`,

  // 섹션 2: 사주강약에 따른 특성
  section2: (ctx) => `당신은 한국 최고의 사주 전문가입니다. 펀사주 스타일로 풀이해주세요.

${ctx}

위 사주를 바탕으로 "사주강약에 따른 특성" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **신강/신약 판단 근거**: 왜 신강(또는 신약)인지 상세 설명
2. **성격 특성**: 신강/신약에 따른 구체적 성격
3. **대인관계 스타일**: 사람들과의 관계에서의 특징
4. **강점과 약점**: 이 사주의 장단점

톤: 긍정적이면서도 현실적인 조언 포함.
분량: 600~1000자`,

  // 섹션 3: 격국으로 보는 직업운
  section3: (ctx) => `당신은 한국 최고의 사주 전문가입니다. 펀사주 스타일로 풀이해주세요.

${ctx}

위 사주를 바탕으로 "격국으로 보는 직업운" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **격국 해설**: 이 사람의 격국이 의미하는 바
2. **적성 직업**: 구체적인 직업 5~7개 추천 (이유 포함)
3. **사업 vs 직장**: 어떤 형태가 더 맞는지
4. **재물운**: 돈과의 관계, 재물 패턴
5. **커리어 조언**: 성공을 위한 구체적 조언

톤: 실용적이고 구체적인 조언 위주.
분량: 800~1200자`,

  // 섹션 4: 연애운 & 배우자운
  section4: (ctx) => `당신은 한국 최고의 사주 전문가입니다. 펀사주 스타일로 풀이해주세요.

${ctx}

위 사주를 바탕으로 "연애운 & 배우자운" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **연애 스타일**: 이 사주의 연애 패턴과 특징
2. **이상형**: 오행으로 본 잘 맞는 상대 유형
3. **배우자운**: 일지로 본 배우자의 성격과 관계
4. **결혼 시기**: 좋은 시기 추천
5. **연애 조언**: 관계에서 주의할 점

톤: 설레고 재미있는 톤으로, 공감을 이끌어내는 문체.
분량: 800~1200자`,

  // 섹션 5: 용신과 개운법
  section5: (ctx) => `당신은 한국 최고의 사주 전문가입니다. 펀사주 스타일로 풀이해주세요.

${ctx}

위 사주를 바탕으로 "용신과 개운법" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **용신 설명**: 왜 이 오행이 용신인지 쉽게 설명
2. **희신/기신/구신/한신**: 각각의 역할 설명
3. **개운법 (구체적)**:
   - 색상: 옷, 소품 등에 활용할 색
   - 방위: 좋은 방향
   - 숫자: 행운의 숫자
   - 음식: 도움이 되는 음식
   - 직업/활동: 용신에 맞는 활동
4. **피해야 할 것**: 기신에 해당하는 것들

톤: 실생활에 바로 적용할 수 있는 실용적 조언.
분량: 800~1200자`,

  // 섹션 6: 살풀이 & 삼재
  section6: (ctx, samjaeInfo) => `당신은 한국 최고의 사주 전문가입니다. 펀사주 스타일로 풀이해주세요.

${ctx}

[삼재 정보]
${samjaeInfo}

위 사주를 바탕으로 "살풀이 & 삼재" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **주요 신살 해설**: 사주에 있는 각 신살의 의미와 영향
2. **도화살**: 있으면 상세 해설
3. **역마살**: 있으면 상세 해설
4. **삼재 분석**: 삼재 년도와 대처법
5. **살 극복법**: 각 신살의 긍정적 활용법

톤: 무섭게 하지 말고, "이런 살이 있지만 이렇게 활용하면 좋아요" 식으로.
분량: 600~1000자`,

  // 섹션 7: 시기별 운세
  section7: (ctx, daeunInfo, seunInfo) => `당신은 한국 최고의 사주 전문가입니다. 펀사주 스타일로 풀이해주세요.

${ctx}

[대운 정보]
${daeunInfo}

[향후 10년 세운]
${seunInfo}

위 사주를 바탕으로 "시기별 운세" 섹션을 작성해주세요.

다음 내용을 포함해야 합니다:
1. **현재 대운 해석**: 지금 겪고 있는 대운의 의미
2. **향후 10년 세운 풀이**: 각 년도별 2~3줄씩 핵심 운세
   - 재물운, 직업운, 건강운, 연애운 중 중요한 것 위주
3. **특히 좋은 해**: 기회가 오는 해 강조
4. **주의할 해**: 조심해야 할 해와 대처법

톤: 희망적이면서도 현실적인 조언.
분량: 1000~1500자`
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
    let prompt;

    switch (section) {
      case 'section1':
        prompt = SECTION_PROMPTS.section1(ctx);
        break;
      case 'section2':
        prompt = SECTION_PROMPTS.section2(ctx);
        break;
      case 'section3':
        prompt = SECTION_PROMPTS.section3(ctx);
        break;
      case 'section4':
        prompt = SECTION_PROMPTS.section4(ctx);
        break;
      case 'section5':
        prompt = SECTION_PROMPTS.section5(ctx);
        break;
      case 'section6': {
        const samjaeInfo = sajuData.samjae.map(s => `${s.year}년(${s.ji}): ${s.type}`).join('\n');
        prompt = SECTION_PROMPTS.section6(ctx, samjaeInfo);
        break;
      }
      case 'section7': {
        const daeunInfo = sajuData.daeun.daeuns.map(d =>
          `${d.age}세~${d.age + 9}세 (${d.startYear}~${d.startYear + 9}년): ${d.gan}${d.ji}`
        ).join('\n');
        const seunInfo = sajuData.seun.map(s =>
          `${s.year}년: ${s.gan}${s.ji}`
        ).join('\n');
        prompt = SECTION_PROMPTS.section7(ctx, daeunInfo, seunInfo);
        break;
      }
      default:
        return res.status(400).json({ error: '잘못된 섹션 번호입니다.' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
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

    const sections = ['section1', 'section2', 'section3', 'section4', 'section5', 'section6', 'section7'];

    // 스트리밍 응답 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const ctx = buildSajuContext(sajuData);

    for (const section of sections) {
      let prompt;
      switch (section) {
        case 'section1': prompt = SECTION_PROMPTS.section1(ctx); break;
        case 'section2': prompt = SECTION_PROMPTS.section2(ctx); break;
        case 'section3': prompt = SECTION_PROMPTS.section3(ctx); break;
        case 'section4': prompt = SECTION_PROMPTS.section4(ctx); break;
        case 'section5': prompt = SECTION_PROMPTS.section5(ctx); break;
        case 'section6': {
          const samjaeInfo = sajuData.samjae.map(s => `${s.year}년(${s.ji}): ${s.type}`).join('\n');
          prompt = SECTION_PROMPTS.section6(ctx, samjaeInfo);
          break;
        }
        case 'section7': {
          const daeunInfo = sajuData.daeun.daeuns.map(d =>
            `${d.age}세~${d.age + 9}세 (${d.startYear}~${d.startYear + 9}년): ${d.gan}${d.ji}`
          ).join('\n');
          const seunInfo = sajuData.seun.map(s => `${s.year}년: ${s.gan}${s.ji}`).join('\n');
          prompt = SECTION_PROMPTS.section7(ctx, daeunInfo, seunInfo);
          break;
        }
      }

      try {
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }]
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
