// ============================================================
// 사주풀이 앱 - 프론트엔드 로직
// ============================================================

(function() {
  const D = window.SajuData;

  // 화면 요소
  const inputScreen = document.getElementById('input-screen');
  const loadingScreen = document.getElementById('loading-screen');
  const resultScreen = document.getElementById('result-screen');
  const form = document.getElementById('saju-form');
  const progressBar = document.getElementById('progress-bar');
  const loadingStatus = document.getElementById('loading-status');
  const loadingSection = document.getElementById('loading-section');
  const restartBtn = document.getElementById('restart-btn');

  let currentGender = '남';
  let sajuResult = null;

  // ============================================================
  // 화면 전환
  // ============================================================
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
  }

  // ============================================================
  // 성별 버튼
  // ============================================================
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGender = btn.dataset.gender;
    });
  });

  // ============================================================
  // 폼 제출
  // ============================================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const year = parseInt(document.getElementById('birth-year').value);
    const month = parseInt(document.getElementById('birth-month').value);
    const day = parseInt(document.getElementById('birth-day').value);
    const hour = parseInt(document.getElementById('birth-hour').value);
    const minute = parseInt(document.getElementById('birth-minute').value) || 0;

    if (!name || !year || !month || !day || isNaN(hour)) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    // 사주 계산
    showScreen('loading-screen');
    loadingStatus.textContent = '사주 팔자를 계산하는 중...';
    progressBar.style.width = '5%';

    // 약간의 딜레이로 UI 업데이트
    await delay(500);

    sajuResult = SajuCore.calculate(name, currentGender, year, month, day, hour, minute);
    console.log('사주 계산 결과:', sajuResult);

    progressBar.style.width = '15%';
    loadingStatus.textContent = '사주 원국을 그리는 중...';
    await delay(300);

    // 결과 화면 렌더링 (차트 부분)
    renderPersonInfo(sajuResult);
    renderSajuChart(sajuResult);
    renderOhaengChart(sajuResult);
    renderDaeunChart(sajuResult);

    progressBar.style.width = '20%';

    // 결과 화면 표시
    showScreen('result-screen');

    // AI 분석 시작
    await fetchAllSections(sajuResult);
  });

  // ============================================================
  // 결과 렌더링: 인적 정보
  // ============================================================
  function renderPersonInfo(data) {
    const s = data.saju;
    const ts = data.trueSolarTime;
    const sign = ts.correction >= 0 ? '+' : '';
    const correctionText = `${ts.originalHour}시 ${String(ts.originalMinute).padStart(2,'0')}분 → 진태양시 ${ts.hour}시 ${String(ts.minute).padStart(2,'0')}분 (${sign}${ts.correction}분)`;

    document.getElementById('person-info').innerHTML = `
      <div><strong>${data.name}</strong> (${data.gender}성) · ${data.animal}띠</div>
      <div>${data.birthInfo.year}년 ${data.birthInfo.month}월 ${data.birthInfo.day}일 ${data.birthInfo.hour}시 ${data.birthInfo.minute}분 (양력)</div>
      <div style="margin-top:4px; font-size:13px; color:#8B5CF6; background:#F5F3FF; padding:4px 10px; border-radius:6px; display:inline-block;">
        ⏱ ${correctionText}
      </div>
      <div style="margin-top:8px; font-size:20px; font-family:'Noto Serif KR',serif; letter-spacing:4px;">
        ${s.year.gan}${s.year.ji}년 ${s.month.gan}${s.month.ji}월 ${s.day.gan}${s.day.ji}일 ${s.hour.gan}${s.hour.ji}시
      </div>
    `;
  }

  // ============================================================
  // 결과 렌더링: 사주 차트
  // ============================================================
  function renderSajuChart(data) {
    const s = data.saju;
    const pillars = [
      { label: '시주(時柱)', gan: s.hour.gan, ji: s.hour.ji, sipGan: data.sipsung.hour.gan, sipJi: data.sipsung.hour.ji, unsung: data.sibiUnsung.hour, jijanggan: data.jijanggan.hour, isDay: false },
      { label: '일주(日柱)', gan: s.day.gan, ji: s.day.ji, sipGan: '일원', sipJi: data.sipsung.day.ji, unsung: data.sibiUnsung.day, jijanggan: data.jijanggan.day, isDay: true },
      { label: '월주(月柱)', gan: s.month.gan, ji: s.month.ji, sipGan: data.sipsung.month.gan, sipJi: data.sipsung.month.ji, unsung: data.sibiUnsung.month, jijanggan: data.jijanggan.month, isDay: false },
      { label: '년주(年柱)', gan: s.year.gan, ji: s.year.ji, sipGan: data.sipsung.year.gan, sipJi: data.sipsung.year.ji, unsung: data.sibiUnsung.year, jijanggan: data.jijanggan.year, isDay: false }
    ];

    const html = pillars.map(p => {
      const ganOhaeng = D.CHEONGAN_OHAENG[p.gan];
      const jiOhaeng = D.JIJI_OHAENG[p.ji];

      return `
        <div class="saju-pillar ${p.isDay ? 'day-pillar' : ''}">
          <div class="pillar-label">${p.label}</div>
          <div class="pillar-sub">
            <span class="pillar-sipsung">${p.sipGan}</span>
          </div>
          <div class="pillar-gan" style="color: ${p.isDay ? 'white' : getOhaengColor(ganOhaeng)}">
            ${p.gan}
            <div style="font-size:11px; font-weight:400; color:${p.isDay ? 'rgba(255,255,255,0.7)' : '#999'}">${ganOhaeng}(${D.CHEONGAN_EUMYANG[p.gan]})</div>
          </div>
          <div class="pillar-ji" style="color: ${getOhaengColor(jiOhaeng)}">
            ${p.ji}
            <div style="font-size:11px; font-weight:400; color:#999">${jiOhaeng}(${D.JIJI_EUMYANG[p.ji]})</div>
          </div>
          <div class="pillar-sub">
            <span class="pillar-sipsung">${p.sipJi}</span> · <span class="pillar-unsung">${p.unsung}</span>
          </div>
          <div class="pillar-sub" style="font-size:10px; color:#bbb">
            [${p.jijanggan.join(' ')}]
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('saju-chart').innerHTML = html;
  }

  // ============================================================
  // 결과 렌더링: 오행 차트
  // ============================================================
  function renderOhaengChart(data) {
    const ohaengList = ['목', '화', '토', '금', '수'];
    const maxCount = Math.max(...ohaengList.map(o => data.ohaeng.main[o]), 1);

    const html = ohaengList.map(oh => {
      const count = data.ohaeng.main[oh];
      const heightPercent = (count / maxCount) * 100;
      const color = getOhaengColor(oh);
      const emoji = D.OHAENG_EMOJI[oh];

      return `
        <div class="ohaeng-item" style="background: ${color}15">
          <span class="ohaeng-name" style="color: ${color}">${emoji} ${oh}</span>
          <div class="ohaeng-bar">
            <div class="ohaeng-bar-fill" style="height: ${heightPercent}%; background: ${color}"></div>
          </div>
          <span class="ohaeng-count" style="color: ${color}">${count}</span>
        </div>
      `;
    }).join('');

    document.getElementById('ohaeng-chart').innerHTML = html;
  }

  // ============================================================
  // 결과 렌더링: 대운 차트
  // ============================================================
  function renderDaeunChart(data) {
    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - data.birthInfo.year;

    const html = data.daeun.daeuns.map(d => {
      const isCurrent = currentAge >= d.age && currentAge < d.age + 10;
      return `
        <div class="daeun-item ${isCurrent ? 'current' : ''}">
          <div class="daeun-age">${d.age}~${d.age + 9}세</div>
          <div class="daeun-ganji">${d.gan}${d.ji}</div>
          <div class="daeun-year">${d.startYear}~${d.startYear + 9}</div>
        </div>
      `;
    }).join('');

    document.getElementById('daeun-chart').innerHTML = html;
  }

  // ============================================================
  // AI 분석 호출 (SSE)
  // ============================================================
  async function fetchAllSections(data) {
    const sectionNames = [
      '✨ 총론 (한마디 요약)',
      '🌊 오행 분석',
      '🏔️ 일주 해석',
      '🔥 행동/실행력',
      '💎 강점/가치',
      '😎 성격 심층',
      '💼 직업운',
      '💰 재물운',
      '💕 연애운',
      '🏠 가족관계',
      '👥 친구/인간관계',
      '🗺️ 개운 장소',
      '💪 마무리 격려'
    ];

    try {
      const response = await fetch('/api/analyze-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sajuData: data })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // 마지막 불완전 라인 유지

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();

            if (dataStr === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const sectionNum = parseInt(parsed.section.replace('section', ''));

              if (parsed.result) {
                // 마크다운을 HTML로 변환
                const html = markdownToHtml(parsed.result);
                document.getElementById(`section${sectionNum}-content`).innerHTML = html;

                // 해당 섹션으로 스크롤 (첫 번째 섹션만)
                if (sectionNum === 1) {
                  document.getElementById('section1').scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              } else if (parsed.error) {
                document.getElementById(`section${sectionNum}-content`).innerHTML =
                  `<p style="color: #E53E3E">분석 중 오류가 발생했습니다: ${parsed.error}</p>`;
              }
            } catch (e) {
              // JSON 파싱 실패 무시
            }
          }
        }
      }
    } catch (error) {
      console.error('AI 분석 에러:', error);
      // 각 섹션에 에러 메시지 표시
      for (let i = 1; i <= 13; i++) {
        const el = document.getElementById(`section${i}-content`);
        if (el && el.querySelector('.loading-placeholder')) {
          el.innerHTML = `<p style="color: #E53E3E">AI 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하고, ANTHROPIC_API_KEY가 설정되어 있는지 확인해주세요.</p>`;
        }
      }
    }
  }

  // ============================================================
  // 간단한 마크다운 → HTML 변환
  // ============================================================
  function markdownToHtml(text) {
    let html = text
      // 제목
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // 굵게
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 기울임
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // 구분선
      .replace(/^---$/gm, '<hr>')
      // 리스트
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      // 줄바꿈
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    // li 태그들을 ul로 감싸기
    html = html.replace(/(<li>.*?<\/li>(\s*<br>)?)+/g, (match) => {
      return '<ul>' + match.replace(/<br>/g, '') + '</ul>';
    });

    return '<p>' + html + '</p>';
  }

  // ============================================================
  // 유틸리티
  // ============================================================
  function getOhaengColor(ohaeng) {
    const colors = {
      '목': '#48BB78',
      '화': '#FC8181',
      '토': '#D69E2E',
      '금': '#718096',
      '수': '#63B3ED'
    };
    return colors[ohaeng] || '#333';
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================
  // 다시 분석하기
  // ============================================================
  restartBtn.addEventListener('click', () => {
    // 섹션 내용 초기화
    for (let i = 1; i <= 13; i++) {
      document.getElementById(`section${i}-content`).innerHTML =
        '<div class="loading-placeholder">AI가 분석 중입니다...</div>';
    }
    showScreen('input-screen');
  });

  // ============================================================
  // PWA 서비스 워커 등록
  // ============================================================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // ============================================================
  // 공유/저장 기능
  // ============================================================
  function showToast(msg) {
    const toast = document.getElementById('share-toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // 결과 텍스트 추출
  function getResultText() {
    if (!sajuResult) return '';
    const s = sajuResult.saju;
    let text = `🔮 사주풀이 리포트\n`;
    text += `━━━━━━━━━━━━━━━\n`;
    text += `${sajuResult.name} (${sajuResult.gender}성) · ${sajuResult.animal}띠\n`;
    text += `${sajuResult.birthInfo.year}년 ${sajuResult.birthInfo.month}월 ${sajuResult.birthInfo.day}일 ${sajuResult.birthInfo.hour}시 ${sajuResult.birthInfo.minute}분\n`;
    text += `${s.year.gan}${s.year.ji}년 ${s.month.gan}${s.month.ji}월 ${s.day.gan}${s.day.ji}일 ${s.hour.gan}${s.hour.ji}시\n`;
    text += `━━━━━━━━━━━━━━━\n\n`;

    const sectionTitles = [
      '총론 (한마디 요약)',
      '오행 분석',
      '일주 해석',
      '행동/실행력',
      '강점/가치',
      '성격 심층',
      '직업운',
      '재물운',
      '연애운',
      '가족관계',
      '친구/인간관계',
      '개운 장소',
      '마무리 격려'
    ];

    for (let i = 1; i <= 13; i++) {
      const el = document.getElementById(`section${i}-content`);
      if (el && !el.querySelector('.loading-placeholder')) {
        text += `\n【 ${sectionTitles[i-1]} 】\n`;
        text += el.innerText + '\n';
      }
    }

    text += '\n━━━━━━━━━━━━━━━\n';
    text += '🔮 AI 사주풀이로 생성됨\n';
    return text;
  }

  // 공유하기 (Web Share API - 폰에서 카톡 등으로 바로 공유)
  document.getElementById('btn-share').addEventListener('click', async () => {
    const text = getResultText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${sajuResult.name}님의 사주풀이`,
          text: text
        });
      } catch (e) {
        // 사용자가 취소한 경우
      }
    } else {
      // Web Share API 미지원 시 클립보드 복사
      await navigator.clipboard.writeText(text);
      showToast('결과가 클립보드에 복사되었습니다!');
    }
  });

  // 텍스트 복사
  document.getElementById('btn-copy-text').addEventListener('click', async () => {
    const text = getResultText();
    try {
      await navigator.clipboard.writeText(text);
      showToast('클립보드에 복사되었습니다!');
    } catch (e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('클립보드에 복사되었습니다!');
    }
  });

  // 이미지 저장 (결과 영역을 캡처)
  document.getElementById('btn-save-image').addEventListener('click', async () => {
    showToast('이미지 생성 중...');
    try {
      // html2canvas 동적 로드
      if (!window.html2canvas) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
        });
      }

      const target = document.querySelector('.result-container');
      const canvas = await html2canvas(target, {
        backgroundColor: '#FAF5FF',
        scale: 2,
        useCORS: true,
        logging: false
      });

      // 다운로드
      const link = document.createElement('a');
      link.download = `사주풀이_${sajuResult.name}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('이미지가 저장되었습니다!');
    } catch (e) {
      showToast('이미지 생성에 실패했습니다.');
      console.error(e);
    }
  });

  // PDF 저장 (브라우저 인쇄 기능 활용)
  document.getElementById('btn-save-pdf').addEventListener('click', () => {
    window.print();
  });

  // ============================================================
  // 테스트용: 기본값 채우기 (개발 시 편의)
  // ============================================================
  if (window.location.search.includes('test')) {
    document.getElementById('name').value = '조현제';
    document.getElementById('birth-year').value = '1994';
    document.getElementById('birth-month').value = '3';
    document.getElementById('birth-day').value = '3';
    document.getElementById('birth-hour').value = '10';
    document.getElementById('birth-minute').value = '23';
  }

})();
