// ============================================================
// 2026 신년운세 앱 - 프론트엔드 로직
// ============================================================

(function() {
  const form = document.getElementById('unse-form');
  const progressBar = document.getElementById('progress-bar');
  const loadingStatus = document.getElementById('loading-status');

  let currentGender = '남';
  let sajuResult = null;

  // 화면 전환
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
  }

  // 성별 버튼
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGender = btn.dataset.gender;
    });
  });

  // 폼 제출
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

    showScreen('loading-screen');
    loadingStatus.textContent = '사주를 계산하는 중...';
    progressBar.style.width = '10%';

    await delay(500);

    sajuResult = SajuCore.calculate(name, currentGender, year, month, day, hour, minute);

    progressBar.style.width = '30%';
    loadingStatus.textContent = '2026년 운세를 분석하는 중...';
    await delay(300);

    // 월별 운세 그리드 렌더링
    renderPersonInfo(sajuResult);
    renderMonthlyGrid(sajuResult);

    progressBar.style.width = '50%';

    showScreen('result-screen');

    // AI 분석
    await fetchUnseAnalysis(sajuResult);
  });

  // 인적 정보 렌더링
  function renderPersonInfo(data) {
    const s = data.saju;
    document.getElementById('person-info').innerHTML = `
      <div><strong>${data.name}</strong> (${data.gender}성) · ${data.animal}띠</div>
      <div style="margin-top:4px; font-family:'Noto Serif KR',serif; letter-spacing:2px;">
        ${s.year.gan}${s.year.ji}년 ${s.month.gan}${s.month.ji}월 ${s.day.gan}${s.day.ji}일 ${s.hour.gan}${s.hour.ji}시
      </div>
    `;
  }

  // 월별 운세 그리드
  function renderMonthlyGrid(data) {
    const D = window.SajuData;
    const months = [];

    for (let m = 1; m <= 12; m++) {
      // 2026년 각 월의 세운 간지 계산
      const yearIndex = ((2026 - 4) % 60 + 60) % 60;
      const yearGan = D.CHEONGAN[yearIndex % 10];

      // 월간 계산 (년간에 따른 월간 시작점)
      const ganStart = D.WOLGAN_START[yearGan];
      const ganIndex = (ganStart + m - 1) % 10;
      const jiIndex = (m + 1) % 12; // 1월=인(2), 2월=묘(3)...

      const monthGan = D.CHEONGAN[ganIndex];
      const monthJi = D.JIJI[jiIndex];

      // 일간과 월간의 관계로 점수 산출
      const dayGan = data.saju.day.gan;
      const myOhaeng = D.CHEONGAN_OHAENG[dayGan];
      const monthOhaeng = D.CHEONGAN_OHAENG[monthGan];
      const monthJiOhaeng = D.JIJI_OHAENG[monthJi];

      let score = 60; // 기본점수
      // 용신 오행과 맞으면 +
      if (data.yongsin.yongsin.ohaeng === monthOhaeng || data.yongsin.yongsin.ohaeng === monthJiOhaeng) score += 20;
      if (data.yongsin.huisin.ohaeng === monthOhaeng || data.yongsin.huisin.ohaeng === monthJiOhaeng) score += 10;
      // 기신 오행이면 -
      if (data.yongsin.gisin.ohaeng === monthOhaeng || data.yongsin.gisin.ohaeng === monthJiOhaeng) score -= 15;
      if (data.yongsin.gusin.ohaeng === monthOhaeng || data.yongsin.gusin.ohaeng === monthJiOhaeng) score -= 10;

      score = Math.max(30, Math.min(95, score));

      months.push({ month: m, gan: monthGan, ji: monthJi, score: score });
    }

    const grid = document.getElementById('monthly-grid');
    grid.innerHTML = months.map(m => {
      const scoreClass = m.score >= 75 ? 'good' : m.score >= 55 ? 'normal' : 'caution';
      return `
        <div class="monthly-card ${scoreClass}">
          <div class="monthly-month">${m.month}월</div>
          <div class="monthly-ganji">${m.gan}${m.ji}</div>
          <div class="monthly-score">${m.score}점</div>
          <div class="monthly-bar">
            <div class="monthly-bar-fill" style="width:${m.score}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // AI 분석 호출
  async function fetchUnseAnalysis(data) {
    try {
      const response = await fetch('/api/analyze-unse', {
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
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') return;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.result) {
                const html = markdownToHtml(parsed.result);
                document.getElementById(`section-${parsed.section}-content`).innerHTML = html;
              } else if (parsed.error) {
                document.getElementById(`section-${parsed.section}-content`).innerHTML =
                  `<p style="color: #E53E3E">분석 중 오류: ${parsed.error}</p>`;
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error('AI 분석 에러:', error);
      ['total', 'detail'].forEach(s => {
        const el = document.getElementById(`section-${s}-content`);
        if (el && el.querySelector('.loading-placeholder')) {
          el.innerHTML = '<p style="color: #E53E3E">AI 서버에 연결할 수 없습니다.</p>';
        }
      });
    }
  }

  // 마크다운 → HTML
  function markdownToHtml(text) {
    let html = text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, '<hr>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    html = html.replace(/(<li>.*?<\/li>(\s*<br>)?)+/g, (match) => {
      return '<ul>' + match.replace(/<br>/g, '') + '</ul>';
    });
    return '<p>' + html + '</p>';
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 다시 분석하기
  document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('section-total-content').innerHTML =
      '<div class="loading-placeholder">AI가 분석 중입니다...</div>';
    document.getElementById('section-detail-content').innerHTML =
      '<div class="loading-placeholder">AI가 분석 중입니다...</div>';
    showScreen('input-screen');
  });
})();
