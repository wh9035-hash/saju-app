// ============================================================
// 궁합 분석 앱 - 프론트엔드 로직
// ============================================================

(function() {
  const form = document.getElementById('gunghap-form');
  const progressBar = document.getElementById('progress-bar');
  const loadingStatus = document.getElementById('loading-status');

  let gender1 = '남';
  let gender2 = '여';

  // 화면 전환
  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
  }

  // 성별 버튼
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const person = btn.dataset.person;
      document.querySelectorAll(`.gender-btn[data-person="${person}"]`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (person === '1') gender1 = btn.dataset.gender;
      else gender2 = btn.dataset.gender;
    });
  });

  // 폼 제출
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name1 = document.getElementById('name1').value.trim();
    const year1 = parseInt(document.getElementById('birth-year1').value);
    const month1 = parseInt(document.getElementById('birth-month1').value);
    const day1 = parseInt(document.getElementById('birth-day1').value);
    const hour1 = parseInt(document.getElementById('birth-hour1').value);
    const minute1 = parseInt(document.getElementById('birth-minute1').value) || 0;

    const name2 = document.getElementById('name2').value.trim();
    const year2 = parseInt(document.getElementById('birth-year2').value);
    const month2 = parseInt(document.getElementById('birth-month2').value);
    const day2 = parseInt(document.getElementById('birth-day2').value);
    const hour2 = parseInt(document.getElementById('birth-hour2').value);
    const minute2 = parseInt(document.getElementById('birth-minute2').value) || 0;

    if (!name1 || !year1 || !month1 || !day1 || isNaN(hour1) ||
        !name2 || !year2 || !month2 || !day2 || isNaN(hour2)) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    showScreen('loading-screen');
    loadingStatus.textContent = '두 분의 사주를 계산하는 중...';
    progressBar.style.width = '10%';

    await delay(500);

    // 사주 계산
    const person1 = SajuCore.calculate(name1, gender1, year1, month1, day1, hour1, minute1);
    const person2 = SajuCore.calculate(name2, gender2, year2, month2, day2, hour2, minute2);

    progressBar.style.width = '30%';
    loadingStatus.textContent = '궁합을 계산하는 중...';
    await delay(300);

    // 궁합 점수 계산
    const gunghap = SajuCore.calculateGunghap(person1, person2);

    progressBar.style.width = '50%';

    // 결과 화면 렌더링
    renderPersonInfo(person1, person2);
    renderScore(gunghap);
    renderSubScores(gunghap.details);

    showScreen('result-screen');

    // AI 분석
    await fetchGunghapAnalysis(person1, person2, gunghap);
  });

  // 인적 정보 렌더링
  function renderPersonInfo(p1, p2) {
    const s1 = p1.saju;
    const s2 = p2.saju;
    document.getElementById('person-info').innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; gap:16px; flex-wrap:wrap;">
        <div>
          <strong>${p1.name}</strong> (${p1.gender}성)<br>
          <span style="font-family:'Noto Serif KR',serif; letter-spacing:2px;">
            ${s1.day.gan}${s1.day.ji}일
          </span>
        </div>
        <div style="font-size:32px;">💕</div>
        <div>
          <strong>${p2.name}</strong> (${p2.gender}성)<br>
          <span style="font-family:'Noto Serif KR',serif; letter-spacing:2px;">
            ${s2.day.gan}${s2.day.ji}일
          </span>
        </div>
      </div>
    `;
  }

  // 점수 애니메이션
  function renderScore(gunghap) {
    const scoreNum = document.getElementById('score-num');
    const scoreLabel = document.getElementById('score-label');
    const scoreRing = document.getElementById('score-ring');

    const circumference = 2 * Math.PI * 90; // 565.48
    const targetOffset = circumference - (circumference * gunghap.score / 100);

    // 애니메이션
    let current = 0;
    const target = gunghap.score;
    const interval = setInterval(() => {
      current++;
      if (current > target) {
        clearInterval(interval);
        current = target;
      }
      scoreNum.textContent = current;
      const offset = circumference - (circumference * current / 100);
      scoreRing.style.strokeDashoffset = offset;
    }, 20);

    scoreLabel.textContent = gunghap.grade;
  }

  // 세부 점수 렌더링
  function renderSubScores(details) {
    const container = document.getElementById('sub-scores');
    container.innerHTML = details.map(d => `
      <div class="sub-score-item">
        <span class="sub-score-label">${d.label}</span>
        <span class="sub-score-desc">${d.desc}</span>
        <span class="sub-score-value ${d.score > 0 ? 'positive' : d.score < 0 ? 'negative' : ''}">${d.score > 0 ? '+' : ''}${d.score}</span>
      </div>
    `).join('');
  }

  // AI 분석 호출
  async function fetchGunghapAnalysis(person1, person2, gunghap) {
    const sections = ['summary', 'personality', 'love', 'conflict', 'advice'];

    try {
      const response = await fetch('/api/analyze-gunghap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person1, person2, gunghap })
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
      sections.forEach(s => {
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
    ['summary', 'personality', 'love', 'conflict', 'advice'].forEach(s => {
      document.getElementById(`section-${s}-content`).innerHTML =
        '<div class="loading-placeholder">AI가 분석 중입니다...</div>';
    });
    showScreen('input-screen');
  });
})();
