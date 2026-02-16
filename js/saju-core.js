// ============================================================
// 사주 만세력 계산 엔진
// saju-data.js가 먼저 로드되어 있어야 함
// ============================================================

const SajuCore = (function() {
  const D = window.SajuData;

  // ============================================================
  // 절기 정밀 데이터 (1900~2100 범위 커버)
  // 각 년도별 절기 시각을 정확하게 계산하기 위한 근사 알고리즘
  // ============================================================

  /**
   * 특정 년도의 절기 날짜 계산 (근사값)
   * @param {number} year - 양력 년도
   * @param {number} monthIndex - 절기 월 인덱스 (0=입춘, 1=경칩, ...)
   * @returns {{ month: number, day: number }} 양력 월/일
   */
  function getJeolgiDate(year, monthIndex) {
    // 절기별 기본 양력 월과 일
    const baseData = [
      { solarMonth: 2, baseDay: 4.0 },   // 입춘 (2월)
      { solarMonth: 3, baseDay: 6.0 },   // 경칩 (3월)
      { solarMonth: 4, baseDay: 5.0 },   // 청명 (4월)
      { solarMonth: 5, baseDay: 6.0 },   // 입하 (5월)
      { solarMonth: 6, baseDay: 6.0 },   // 망종 (6월)
      { solarMonth: 7, baseDay: 7.0 },   // 소서 (7월)
      { solarMonth: 8, baseDay: 7.5 },   // 입추 (8월)
      { solarMonth: 9, baseDay: 8.0 },   // 백로 (9월)
      { solarMonth: 10, baseDay: 8.5 },  // 한로 (10월)
      { solarMonth: 11, baseDay: 7.5 },  // 입동 (11월)
      { solarMonth: 12, baseDay: 7.0 },  // 대설 (12월)
      { solarMonth: 1, baseDay: 6.0 }    // 소한 (1월, 다음해 축월)
    ];

    const bd = baseData[monthIndex];
    // 윤년 보정 등 간단한 근사
    let day = Math.round(bd.baseDay);

    // 년도에 따른 미세 보정
    const yearMod = year % 4;
    if (yearMod === 0) day = Math.round(bd.baseDay - 0.5);

    return { month: bd.solarMonth, day: day };
  }

  // ============================================================
  // 진태양시(眞太陽時) 보정
  // KST(동경 135도)를 서울 실제 경도(127도) 기준으로 보정
  // ============================================================

  /**
   * 진태양시 계산
   * @param {number} year - 년
   * @param {number} month - 월
   * @param {number} day - 일
   * @param {number} hour - 시 (0~23)
   * @param {number} minute - 분 (0~59)
   * @returns {{ hour, minute, correction, originalHour, originalMinute }}
   */
  function getTrueSolarTime(year, month, day, hour, minute) {
    // 1. 1월 1일부터의 일수(N) 계산
    const date = new Date(year, month - 1, day);
    const jan1 = new Date(year, 0, 1);
    const N = Math.floor((date - jan1) / (1000 * 60 * 60 * 24)) + 1;

    // 2. 균시차(Equation of Time) 계산
    //    B = 360/365 × (N - 81) (도 단위)
    //    EoT = 9.87×sin(2B) - 7.53×cos(B) - 1.5×sin(B) (분 단위)
    const B = (360 / 365) * (N - 81);
    const Brad = B * Math.PI / 180; // 라디안 변환
    const EoT = 9.87 * Math.sin(2 * Brad) - 7.53 * Math.cos(Brad) - 1.5 * Math.sin(Brad);

    // 3. 경도 보정
    //    서울(127°E)과 표준자오선(135°E)의 차이
    //    (127 - 135) × 4분/도 = -32분
    const localLongitude = 127;
    const standardLongitude = 135;
    const longitudeCorrection = (localLongitude - standardLongitude) * 4; // -32분

    // 4. 총 보정값 (분)
    const totalCorrection = longitudeCorrection + EoT;
    const correctionRounded = Math.round(totalCorrection);

    // 5. 보정된 시간 계산
    let totalMinutes = hour * 60 + minute + correctionRounded;

    // 날짜 넘김 처리
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    if (totalMinutes >= 24 * 60) totalMinutes -= 24 * 60;

    const correctedHour = Math.floor(totalMinutes / 60);
    const correctedMinute = totalMinutes % 60;

    return {
      hour: correctedHour,
      minute: correctedMinute,
      correction: correctionRounded,
      originalHour: hour,
      originalMinute: minute
    };
  }

  // ============================================================
  // 핵심: 년주, 월주, 일주, 시주 계산
  // ============================================================

  /**
   * 양력 날짜의 일주 간지 계산
   * 기준일: 1900년 1월 1일 = 경자일 (갑자로부터 36번째)
   */
  function getDayGanji(year, month, day) {
    // 율리우스적일수(JDN) 계산
    const jdn = getJulianDayNumber(year, month, day);
    // 1900-01-01 JDN = 2415020, 이 날은 갑술일 = 갑자+10
    const baseJdn = 2415020;
    const baseGanjiIndex = 10; // 갑술

    let diff = jdn - baseJdn;
    let index = ((baseGanjiIndex + diff) % 60 + 60) % 60;

    return {
      gan: D.CHEONGAN[index % 10],
      ji: D.JIJI[index % 12],
      ganIndex: index % 10,
      jiIndex: index % 12,
      ganjiIndex: index
    };
  }

  /**
   * 율리우스 적일수 계산
   */
  function getJulianDayNumber(year, month, day) {
    if (month <= 2) {
      year -= 1;
      month += 12;
    }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5);
  }

  /**
   * 년주 계산
   * 주의: 입춘(2월 4일경) 전이면 전년도 년주 사용
   */
  function getYearGanji(year, month, day) {
    // 입춘 확인
    const ipchun = getJeolgiDate(year, 0); // 입춘
    let effectiveYear = year;

    if (month < ipchun.month || (month === ipchun.month && day < ipchun.day)) {
      effectiveYear = year - 1;
    }

    // 년주 계산: (년도 - 4) % 60 = 갑자부터의 인덱스
    let index = ((effectiveYear - 4) % 60 + 60) % 60;

    return {
      gan: D.CHEONGAN[index % 10],
      ji: D.JIJI[index % 12],
      ganIndex: index % 10,
      jiIndex: index % 12,
      ganjiIndex: index,
      effectiveYear: effectiveYear
    };
  }

  /**
   * 월주 계산
   * 절기에 따라 월이 결정됨
   */
  function getMonthGanji(year, month, day, yearGan) {
    // 해당 날짜가 속하는 월건(인묘진사오미신유술해자축) 결정
    let sajuMonth = getSajuMonth(year, month, day);

    // 월지 인덱스 (인=2부터 시작, 1월=인(2), 2월=묘(3), ...)
    let jiIndex = (sajuMonth.monthNum + 1) % 12; // 1월→인(2), 2월→묘(3)...

    // 월간 계산
    let ganStart = D.WOLGAN_START[yearGan];
    let ganIndex = (ganStart + sajuMonth.monthNum - 1) % 10;

    return {
      gan: D.CHEONGAN[ganIndex],
      ji: D.JIJI[jiIndex],
      ganIndex: ganIndex,
      jiIndex: jiIndex,
      monthNum: sajuMonth.monthNum,
      jeolgiName: sajuMonth.jeolgiName
    };
  }

  /**
   * 절기로 사주 월 결정
   * @returns {{ monthNum: number, jeolgiName: string }}
   * monthNum: 1=인월, 2=묘월, ... 12=축월
   */
  function getSajuMonth(year, month, day) {
    // 절기 기반 월 결정
    // 입춘(2월)~경칩 전 = 1월(인), 경칩(3월)~청명 전 = 2월(묘), ...

    const jeolgiDates = [];
    for (let i = 0; i < 12; i++) {
      const jd = getJeolgiDate(year, i);
      jeolgiDates.push(jd);
    }

    // 현재 날짜가 어느 절기 구간에 속하는지 확인
    // 역순으로 확인 (대설(12월) → ... → 입춘(2월))

    // 소한(1월)은 다음해 축월이므로 특별 처리
    // 대설(12월 7일경) 이후 = 자월(11월건)
    // 소한(1월 6일경) 이후 = 축월(12월건)

    if (month === 1) {
      const sohan = getJeolgiDate(year, 11); // 소한
      if (day >= sohan.day) {
        return { monthNum: 12, jeolgiName: '소한' };
      } else {
        // 전년 대설 이후 = 자월
        return { monthNum: 11, jeolgiName: '대설' };
      }
    }

    // 2월~12월
    for (let i = 11; i >= 0; i--) {
      const jd = jeolgiDates[i];
      if (jd.month === 1) continue; // 소한은 위에서 처리

      if (month > jd.month || (month === jd.month && day >= jd.day)) {
        return { monthNum: i + 1, jeolgiName: D.JEOLGI_DATES[i].name };
      }
    }

    // 입춘 전 = 전년 축월
    return { monthNum: 12, jeolgiName: '소한' };
  }

  /**
   * 시주 계산
   */
  function getHourGanji(hour, minute, dayGan) {
    // 시간 → 시지
    let jiIndex;
    let totalMinutes = hour * 60 + minute;

    if (totalMinutes >= 23 * 60 || totalMinutes < 1 * 60) {
      jiIndex = 0; // 자시
    } else if (totalMinutes < 3 * 60) {
      jiIndex = 1; // 축시
    } else if (totalMinutes < 5 * 60) {
      jiIndex = 2; // 인시
    } else if (totalMinutes < 7 * 60) {
      jiIndex = 3; // 묘시
    } else if (totalMinutes < 9 * 60) {
      jiIndex = 4; // 진시
    } else if (totalMinutes < 11 * 60) {
      jiIndex = 5; // 사시
    } else if (totalMinutes < 13 * 60) {
      jiIndex = 6; // 오시
    } else if (totalMinutes < 15 * 60) {
      jiIndex = 7; // 미시
    } else if (totalMinutes < 17 * 60) {
      jiIndex = 8; // 신시
    } else if (totalMinutes < 19 * 60) {
      jiIndex = 9; // 유시
    } else if (totalMinutes < 21 * 60) {
      jiIndex = 10; // 술시
    } else {
      jiIndex = 11; // 해시
    }

    // 시간 계산
    let ganStart = D.SIGAN_START[dayGan];
    let ganIndex = (ganStart + jiIndex) % 10;

    return {
      gan: D.CHEONGAN[ganIndex],
      ji: D.JIJI[jiIndex],
      ganIndex: ganIndex,
      jiIndex: jiIndex
    };
  }

  // ============================================================
  // 십성 계산
  // ============================================================

  /**
   * 일간 기준으로 대상 천간의 십성 계산
   */
  function getSipsung(dayGan, targetGan) {
    const myOhaeng = D.CHEONGAN_OHAENG[dayGan];
    const targetOhaeng = D.CHEONGAN_OHAENG[targetGan];
    const myEumyang = D.CHEONGAN_EUMYANG[dayGan];
    const targetEumyang = D.CHEONGAN_EUMYANG[targetGan];
    const sameEumyang = (myEumyang === targetEumyang);

    if (myOhaeng === targetOhaeng) {
      return sameEumyang ? '비견' : '겁재';
    }
    if (D.OHAENG_SANGSAENG[myOhaeng] === targetOhaeng) {
      return sameEumyang ? '식신' : '상관';
    }
    if (D.OHAENG_SANGGEUK[myOhaeng] === targetOhaeng) {
      return sameEumyang ? '편재' : '정재';
    }
    if (D.OHAENG_SANGGEUK[targetOhaeng] === myOhaeng) {
      return sameEumyang ? '편관' : '정관';
    }
    if (D.OHAENG_SANGSAENG[targetOhaeng] === myOhaeng) {
      return sameEumyang ? '편인' : '정인';
    }
    return '';
  }

  // ============================================================
  // 십이운성 계산
  // ============================================================

  /**
   * 천간이 지지에서의 십이운성 계산
   */
  function getSibiUnsung(gan, ji) {
    const ganIndex = D.CHEONGAN.indexOf(gan);
    const jiIndex = D.JIJI.indexOf(ji);
    const startJi = D.SIBI_UNSUNG_START[gan];
    const isYang = D.CHEONGAN_EUMYANG[gan] === '양';

    let unsungIndex;
    if (isYang) {
      unsungIndex = ((jiIndex - startJi) % 12 + 12) % 12;
    } else {
      unsungIndex = ((startJi - jiIndex) % 12 + 12) % 12;
    }

    return D.SIBI_UNSUNG_NAMES[unsungIndex];
  }

  // ============================================================
  // 신살 계산
  // ============================================================

  /**
   * 12신살 계산 (년지 또는 일지 기준)
   */
  function get12Sinsal(baseJi) {
    const startIndex = D.SINSAL_12_GROUP[baseJi];
    const result = {};

    for (let i = 0; i < 12; i++) {
      const jiIndex = (startIndex + i) % 12;
      result[D.SINSAL_12_NAMES[i]] = D.JIJI[jiIndex];
    }

    return result;
  }

  /**
   * 사주 내 신살 확인
   */
  function checkSinsal(yearJi, monthJi, dayJi, hourJi) {
    const allJi = [
      { name: '년지', ji: yearJi },
      { name: '월지', ji: monthJi },
      { name: '일지', ji: dayJi },
      { name: '시지', ji: hourJi }
    ];

    const sinsals = [];

    // 년지 기준 12신살 확인
    const yearSinsal = get12Sinsal(yearJi);
    const daySinsal = get12Sinsal(dayJi);

    // 각 지지에서 신살 확인
    allJi.forEach(({ name, ji }) => {
      // 도화살
      if (D.DOHWASAL[yearJi] === ji || D.DOHWASAL[dayJi] === ji) {
        sinsals.push({ name: '도화살', position: name, ji: ji });
      }
      // 역마살
      if (D.YEOKMASAL[yearJi] === ji || D.YEOKMASAL[dayJi] === ji) {
        sinsals.push({ name: '역마살', position: name, ji: ji });
      }
      // 화개살
      if (D.HWAGAESAL[yearJi] === ji || D.HWAGAESAL[dayJi] === ji) {
        sinsals.push({ name: '화개살', position: name, ji: ji });
      }
    });

    // 귀문관살 (일지 기준)
    allJi.forEach(({ name, ji }) => {
      if (name !== '일지' && D.GWIMUNGWANSAL[dayJi] === ji) {
        sinsals.push({ name: '귀문관살', position: name, ji: ji });
      }
    });

    // 년지 기준 12신살에서 사주 내 해당하는 것 찾기
    D.SINSAL_12_NAMES.forEach(sinsalName => {
      const targetJi = yearSinsal[sinsalName];
      allJi.forEach(({ name, ji }) => {
        if (ji === targetJi && name !== '년지') {
          sinsals.push({ name: sinsalName + '(년기준)', position: name, ji: ji });
        }
      });
    });

    return sinsals;
  }

  // ============================================================
  // 삼재 계산
  // ============================================================

  function checkSamjae(yearJi, currentYear) {
    const samjaeYears = D.SAMJAE[yearJi];
    const result = [];

    for (let y = currentYear - 1; y <= currentYear + 10; y++) {
      const yearIndex = ((y - 4) % 12 + 12) % 12;
      const yJi = D.JIJI[yearIndex];
      if (samjaeYears.includes(yJi)) {
        const pos = samjaeYears.indexOf(yJi);
        let type = pos === 0 ? '들삼재' : pos === 1 ? '눌삼재' : '날삼재';
        result.push({ year: y, ji: yJi, type: type });
      }
    }

    return result;
  }

  // ============================================================
  // 오행 분석 (사주 내 오행 분포)
  // ============================================================

  function analyzeOhaeng(yearGan, yearJi, monthGan, monthJi, dayGan, dayJi, hourGan, hourJi) {
    const count = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };

    // 천간 오행
    [yearGan, monthGan, dayGan, hourGan].forEach(g => {
      count[D.CHEONGAN_OHAENG[g]]++;
    });

    // 지지 오행
    [yearJi, monthJi, dayJi, hourJi].forEach(j => {
      count[D.JIJI_OHAENG[j]]++;
    });

    // 지장간 오행도 포함
    const jijangganCount = { '목': 0, '화': 0, '토': 0, '금': 0, '수': 0 };
    [yearJi, monthJi, dayJi, hourJi].forEach(j => {
      D.JIJANGGAN[j].forEach(g => {
        jijangganCount[D.CHEONGAN_OHAENG[g]]++;
      });
    });

    return { main: count, jijanggan: jijangganCount };
  }

  // ============================================================
  // 신강/신약 판단
  // ============================================================

  function judgeSingang(dayGan, ohaengAnalysis, monthJi) {
    const myOhaeng = D.CHEONGAN_OHAENG[dayGan];
    const helpOhaeng = Object.keys(D.OHAENG_SANGSAENG).find(k => D.OHAENG_SANGSAENG[k] === myOhaeng); // 나를 생하는 오행

    let myPower = 0;

    // 비겁(같은 오행) + 인성(나를 생하는 오행) 합산
    myPower += ohaengAnalysis.main[myOhaeng] * 2;
    if (helpOhaeng) myPower += ohaengAnalysis.main[helpOhaeng] * 1.5;

    // 월지 득령 체크 (가장 중요)
    const monthOhaeng = D.JIJI_OHAENG[monthJi];
    if (monthOhaeng === myOhaeng || monthOhaeng === helpOhaeng) {
      myPower += 3;
    }

    let otherPower = 0;
    Object.keys(ohaengAnalysis.main).forEach(oh => {
      if (oh !== myOhaeng && oh !== helpOhaeng) {
        otherPower += ohaengAnalysis.main[oh];
      }
    });

    const isStrong = myPower > otherPower;

    return {
      isStrong: isStrong,
      label: isStrong ? '신강' : '신약',
      myPower: myPower,
      otherPower: otherPower,
      description: isStrong
        ? '일간의 힘이 강하여 자기주장이 뚜렷하고 추진력이 있습니다.'
        : '일간의 힘이 약하여 협조적이고 유연한 성격입니다.'
    };
  }

  // ============================================================
  // 격국 판단
  // ============================================================

  function judgeGyeokguk(dayGan, monthJi) {
    // 월지의 지장간 중 본기(첫 번째)로 격국 결정
    const jijanggan = D.JIJANGGAN[monthJi];
    const bongi = jijanggan[0]; // 본기

    // 일간과 본기의 십성으로 격국 결정
    const sipsung = getSipsung(dayGan, bongi);

    // 건록격/양인격 특수 처리
    const dayGanIndex = D.CHEONGAN.indexOf(dayGan);
    const monthJiIndex = D.JIJI.indexOf(monthJi);

    // 건록: 양간은 건록 위치의 지지가 월지일 때
    const geonrokMap = { '갑': '인', '을': '묘', '병': '사', '정': '오', '무': '사', '기': '오', '경': '신', '신': '유', '임': '해', '계': '자' };
    if (geonrokMap[dayGan] === monthJi) {
      return { name: '건록격', description: '월지가 일간의 건록 자리에 있어 자수성가하는 격' };
    }

    // 양인격: 겁재가 월지에 있을 때
    const yanginMap = { '갑': '묘', '병': '오', '무': '오', '경': '유', '임': '자' };
    if (yanginMap[dayGan] === monthJi) {
      return { name: '양인격', description: '월지가 양인 자리에 있어 강인하고 결단력이 있는 격' };
    }

    return {
      name: sipsung + '격',
      description: `월지 본기 ${bongi}(${D.CHEONGAN_OHAENG[bongi]})이 일간에 대해 ${sipsung}이므로 ${sipsung}격`
    };
  }

  // ============================================================
  // 용신 판단
  // ============================================================

  function judgeYongsin(dayGan, singang, ohaengAnalysis) {
    const myOhaeng = D.CHEONGAN_OHAENG[dayGan];
    const saengMe = Object.keys(D.OHAENG_SANGSAENG).find(k => D.OHAENG_SANGSAENG[k] === myOhaeng);
    const iSaeng = D.OHAENG_SANGSAENG[myOhaeng];
    const iGeuk = D.OHAENG_SANGGEUK[myOhaeng];
    const geukMe = Object.keys(D.OHAENG_SANGGEUK).find(k => D.OHAENG_SANGGEUK[k] === myOhaeng);

    let yongsin, huisin, gisin, gusin, hansin;

    if (singang.isStrong) {
      // 신강: 설기/극기 필요 → 식상/재성/관성이 용신
      yongsin = iSaeng;  // 식상 (설기)
      huisin = iGeuk;    // 재성
      gisin = myOhaeng;  // 비겁
      gusin = saengMe;   // 인성
      hansin = geukMe;   // 관성 (보조)
    } else {
      // 신약: 생조 필요 → 인성/비겁이 용신
      yongsin = saengMe; // 인성 (생조)
      huisin = myOhaeng; // 비겁
      gisin = iGeuk;     // 재성
      gusin = iSaeng;    // 식상
      hansin = geukMe;   // 관성
    }

    return {
      yongsin: { ohaeng: yongsin, label: '용신(用神)', description: '가장 필요한 오행' },
      huisin: { ohaeng: huisin, label: '희신(喜神)', description: '용신을 돕는 오행' },
      gisin: { ohaeng: gisin, label: '기신(忌神)', description: '피해야 할 오행' },
      gusin: { ohaeng: gusin, label: '구신(仇神)', description: '기신을 돕는 오행' },
      hansin: { ohaeng: hansin, label: '한신(閑神)', description: '영향이 적은 오행' }
    };
  }

  // ============================================================
  // 대운 계산
  // ============================================================

  function calculateDaeun(yearGan, yearJi, monthGanIndex, monthJiIndex, gender, birthYear, birthMonth, birthDay) {
    const yearEumyang = D.CHEONGAN_EUMYANG[yearGan];

    // 순행/역행 결정
    // 남자+양년 또는 여자+음년 → 순행
    // 남자+음년 또는 여자+양년 → 역행
    const isForward = (gender === '남' && yearEumyang === '양') || (gender === '여' && yearEumyang === '음');

    // 대운 시작 나이 계산 (간략화: 보통 1~9세 사이)
    // 생일에서 다음(또는 이전) 절기까지의 일수 / 3 = 대운 시작 나이
    let daeunStartAge = calculateDaeunStartAge(birthYear, birthMonth, birthDay, isForward);

    const daeuns = [];
    for (let i = 0; i < 10; i++) { // 10개 대운
      let ganIdx, jiIdx;
      if (isForward) {
        ganIdx = (monthGanIndex + i + 1) % 10;
        jiIdx = (monthJiIndex + i + 1) % 12;
      } else {
        ganIdx = ((monthGanIndex - i - 1) % 10 + 10) % 10;
        jiIdx = ((monthJiIndex - i - 1) % 12 + 12) % 12;
      }

      daeuns.push({
        age: daeunStartAge + (i * 10),
        startYear: birthYear + daeunStartAge + (i * 10),
        gan: D.CHEONGAN[ganIdx],
        ji: D.JIJI[jiIdx],
        ganIndex: ganIdx,
        jiIndex: jiIdx
      });
    }

    return {
      isForward: isForward,
      startAge: daeunStartAge,
      daeuns: daeuns
    };
  }

  /**
   * 대운 시작 나이 계산 (간략화)
   */
  function calculateDaeunStartAge(year, month, day, isForward) {
    // 현재 월의 절기와 다음(또는 이전) 절기까지 일수 계산
    const sajuMonth = getSajuMonth(year, month, day);
    let nextJeolgiDays;

    if (isForward) {
      // 다음 절기까지의 일수
      let nextMonthIdx = sajuMonth.monthNum % 12; // 다음 월 절기 인덱스
      const nextJeolgi = getJeolgiDate(year, nextMonthIdx);
      let nextDate = new Date(year, nextJeolgi.month - 1, nextJeolgi.day);
      let birthDate = new Date(year, month - 1, day);
      if (nextDate <= birthDate) {
        // 다음 해 절기
        nextDate = new Date(year + 1, nextJeolgi.month - 1, nextJeolgi.day);
      }
      nextJeolgiDays = Math.round((nextDate - birthDate) / (1000 * 60 * 60 * 24));
    } else {
      // 이전 절기까지의 일수
      let prevMonthIdx = sajuMonth.monthNum - 1;
      if (prevMonthIdx < 0) prevMonthIdx = 11;
      const prevJeolgi = getJeolgiDate(year, prevMonthIdx);
      let prevDate = new Date(year, prevJeolgi.month - 1, prevJeolgi.day);
      let birthDate = new Date(year, month - 1, day);
      if (prevDate > birthDate) {
        prevDate = new Date(year - 1, prevJeolgi.month - 1, prevJeolgi.day);
      }
      nextJeolgiDays = Math.round((birthDate - prevDate) / (1000 * 60 * 60 * 24));
    }

    // 3일 = 1년으로 계산
    let startAge = Math.round(nextJeolgiDays / 3);
    if (startAge < 1) startAge = 1;
    if (startAge > 10) startAge = 10;

    return startAge;
  }

  // ============================================================
  // 세운 계산 (특정 년도의 운)
  // ============================================================

  function calculateSeun(startYear, count) {
    const seuns = [];
    for (let i = 0; i < count; i++) {
      const y = startYear + i;
      const index = ((y - 4) % 60 + 60) % 60;
      seuns.push({
        year: y,
        gan: D.CHEONGAN[index % 10],
        ji: D.JIJI[index % 12],
        ganIndex: index % 10,
        jiIndex: index % 12
      });
    }
    return seuns;
  }

  // ============================================================
  // 합충형파해 분석
  // ============================================================

  function analyzeRelations(yearJi, monthJi, dayJi, hourJi) {
    const positions = [
      { name: '년지', ji: yearJi },
      { name: '월지', ji: monthJi },
      { name: '일지', ji: dayJi },
      { name: '시지', ji: hourJi }
    ];

    const relations = [];

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];

        // 육합
        if (D.JIJI_YUKHAP[a.ji] === b.ji) {
          relations.push({ type: '육합', positions: [a.name, b.name], jis: [a.ji, b.ji] });
        }
        // 충
        if (D.JIJI_CHUNG[a.ji] === b.ji) {
          relations.push({ type: '충', positions: [a.name, b.name], jis: [a.ji, b.ji] });
        }
        // 형
        if (D.JIJI_HYUNG[a.ji] === b.ji) {
          relations.push({ type: '형', positions: [a.name, b.name], jis: [a.ji, b.ji] });
        }
      }
    }

    // 삼합 체크
    D.JIJI_SAMHAP.forEach(samhap => {
      const jiList = positions.map(p => p.ji);
      const matchCount = samhap.members.filter(m => jiList.includes(m)).length;
      if (matchCount >= 2) {
        const matched = samhap.members.filter(m => jiList.includes(m));
        relations.push({
          type: matchCount === 3 ? '삼합' : '반합',
          jis: matched,
          ohaeng: samhap.ohaeng
        });
      }
    });

    return relations;
  }

  // ============================================================
  // 메인 계산 함수: 모든 것을 한 번에 계산
  // ============================================================

  function calculate(name, gender, year, month, day, hour, minute) {
    // 0. 진태양시 보정 (KST → 서울 실제 태양시)
    const trueSolar = getTrueSolarTime(year, month, day, hour, minute);
    const correctedHour = trueSolar.hour;
    const correctedMinute = trueSolar.minute;

    // 1. 사주 (년월일시)
    const yearGanji = getYearGanji(year, month, day);
    const dayGanji = getDayGanji(year, month, day);

    // 자시(23시 이후) 처리: 일진을 다음날로 넘김
    // 자시는 다음날의 시작이므로 시주 천간 계산 시 다음날 일간을 기준으로 함
    let hourDayGanji = dayGanji;
    if (correctedHour >= 23) {
      // 다음날의 일주를 구해서 시주 천간 계산에 사용
      const nextDate = new Date(year, month - 1, day + 1);
      hourDayGanji = getDayGanji(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
    }

    const monthGanji = getMonthGanji(year, month, day, yearGanji.gan);
    const hourGanji = getHourGanji(correctedHour, correctedMinute, hourDayGanji.gan);

    // 2. 오행 분석
    const ohaeng = analyzeOhaeng(
      yearGanji.gan, yearGanji.ji,
      monthGanji.gan, monthGanji.ji,
      dayGanji.gan, dayGanji.ji,
      hourGanji.gan, hourGanji.ji
    );

    // 3. 십성
    const sipsung = {
      year: { gan: getSipsung(dayGanji.gan, yearGanji.gan), ji: getSipsung(dayGanji.gan, D.JIJANGGAN[yearGanji.ji][0]) },
      month: { gan: getSipsung(dayGanji.gan, monthGanji.gan), ji: getSipsung(dayGanji.gan, D.JIJANGGAN[monthGanji.ji][0]) },
      day: { gan: '일원', ji: getSipsung(dayGanji.gan, D.JIJANGGAN[dayGanji.ji][0]) },
      hour: { gan: getSipsung(dayGanji.gan, hourGanji.gan), ji: getSipsung(dayGanji.gan, D.JIJANGGAN[hourGanji.ji][0]) }
    };

    // 4. 십이운성
    const sibiUnsung = {
      year: getSibiUnsung(dayGanji.gan, yearGanji.ji),
      month: getSibiUnsung(dayGanji.gan, monthGanji.ji),
      day: getSibiUnsung(dayGanji.gan, dayGanji.ji),
      hour: getSibiUnsung(dayGanji.gan, hourGanji.ji)
    };

    // 5. 지장간
    const jijanggan = {
      year: D.JIJANGGAN[yearGanji.ji],
      month: D.JIJANGGAN[monthGanji.ji],
      day: D.JIJANGGAN[dayGanji.ji],
      hour: D.JIJANGGAN[hourGanji.ji]
    };

    // 6. 신강/신약
    const singang = judgeSingang(dayGanji.gan, ohaeng, monthGanji.ji);

    // 7. 격국
    const gyeokguk = judgeGyeokguk(dayGanji.gan, monthGanji.ji);

    // 8. 용신
    const yongsin = judgeYongsin(dayGanji.gan, singang, ohaeng);

    // 9. 신살
    const sinsals = checkSinsal(yearGanji.ji, monthGanji.ji, dayGanji.ji, hourGanji.ji);

    // 10. 합충형파해
    const relations = analyzeRelations(yearGanji.ji, monthGanji.ji, dayGanji.ji, hourGanji.ji);

    // 11. 대운
    const daeun = calculateDaeun(
      yearGanji.gan, yearGanji.ji,
      monthGanji.ganIndex, monthGanji.jiIndex,
      gender, year, month, day
    );

    // 12. 세운 (올해부터 10년)
    const currentYear = new Date().getFullYear();
    const seun = calculateSeun(currentYear, 10);

    // 13. 삼재
    const samjae = checkSamjae(yearGanji.ji, currentYear);

    // 14. 음양 분석
    const eumyangCount = { '양': 0, '음': 0 };
    [yearGanji.gan, monthGanji.gan, dayGanji.gan, hourGanji.gan].forEach(g => {
      eumyangCount[D.CHEONGAN_EUMYANG[g]]++;
    });
    [yearGanji.ji, monthGanji.ji, dayGanji.ji, hourGanji.ji].forEach(j => {
      eumyangCount[D.JIJI_EUMYANG[j]]++;
    });

    // 띠
    const animal = D.ANIMALS[D.JIJI.indexOf(yearGanji.ji)];

    return {
      // 기본 정보
      name, gender,
      birthInfo: { year, month, day, hour, minute },
      trueSolarTime: trueSolar,
      animal,

      // 사주 원국
      saju: {
        year: yearGanji,
        month: monthGanji,
        day: dayGanji,
        hour: hourGanji
      },

      // 분석
      ohaeng,
      eumyang: eumyangCount,
      sipsung,
      sibiUnsung,
      jijanggan,
      singang,
      gyeokguk,
      yongsin,
      sinsals,
      relations,
      daeun,
      seun,
      samjae
    };
  }

  // ============================================================
  // 궁합 계산
  // ============================================================

  function calculateGunghap(person1Data, person2Data) {
    let score = 50; // 기본 점수
    const details = [];

    const p1DayGan = person1Data.saju.day.gan;
    const p2DayGan = person2Data.saju.day.gan;
    const p1DayJi = person1Data.saju.day.ji;
    const p2DayJi = person2Data.saju.day.ji;
    const p1YearJi = person1Data.saju.year.ji;
    const p2YearJi = person2Data.saju.year.ji;

    const p1DayOhaeng = D.CHEONGAN_OHAENG[p1DayGan];
    const p2DayOhaeng = D.CHEONGAN_OHAENG[p2DayGan];

    // 1. 일간 오행 관계 (상생/상극)
    if (D.OHAENG_SANGSAENG[p1DayOhaeng] === p2DayOhaeng || D.OHAENG_SANGSAENG[p2DayOhaeng] === p1DayOhaeng) {
      score += 15;
      details.push({ label: '일간 오행', desc: '상생 관계 (+15)', score: 15 });
    } else if (D.OHAENG_SANGGEUK[p1DayOhaeng] === p2DayOhaeng || D.OHAENG_SANGGEUK[p2DayOhaeng] === p1DayOhaeng) {
      score -= 10;
      details.push({ label: '일간 오행', desc: '상극 관계 (-10)', score: -10 });
    } else if (p1DayOhaeng === p2DayOhaeng) {
      score += 5;
      details.push({ label: '일간 오행', desc: '같은 오행 (+5)', score: 5 });
    } else {
      details.push({ label: '일간 오행', desc: '보통', score: 0 });
    }

    // 2. 일간 천간합 (갑기, 을경, 병신, 정임, 무계)
    const cheonganHapPairs = [['갑','기'], ['을','경'], ['병','신'], ['정','임'], ['무','계']];
    const isCheonganHap = cheonganHapPairs.some(pair =>
      (p1DayGan === pair[0] && p2DayGan === pair[1]) || (p1DayGan === pair[1] && p2DayGan === pair[0])
    );
    if (isCheonganHap) {
      score += 15;
      details.push({ label: '천간합', desc: '일간이 천간합! (+15)', score: 15 });
    }

    // 3. 일지 육합
    if (D.JIJI_YUKHAP[p1DayJi] === p2DayJi) {
      score += 20;
      details.push({ label: '일지 육합', desc: `${p1DayJi}${p2DayJi} 육합! (+20)`, score: 20 });
    }

    // 4. 일지 충
    if (D.JIJI_CHUNG[p1DayJi] === p2DayJi) {
      score -= 15;
      details.push({ label: '일지 충', desc: `${p1DayJi}${p2DayJi} 충 (-15)`, score: -15 });
    }

    // 5. 년지 삼합/반합
    for (const samhap of D.JIJI_SAMHAP) {
      const hasP1 = samhap.members.includes(p1YearJi);
      const hasP2 = samhap.members.includes(p2YearJi);
      if (hasP1 && hasP2 && p1YearJi !== p2YearJi) {
        score += 10;
        details.push({ label: '년지 삼합', desc: `${samhap.ohaeng}의 삼합/반합 (+10)`, score: 10 });
        break;
      }
    }

    // 6. 년지 충
    if (D.JIJI_CHUNG[p1YearJi] === p2YearJi) {
      score -= 8;
      details.push({ label: '년지 충', desc: `${p1YearJi}${p2YearJi} 충 (-8)`, score: -8 });
    }

    // 7. 오행 보완 관계 (상대가 나의 부족 오행을 채워주는지)
    const p1Ohaeng = person1Data.ohaeng.main;
    const p2Ohaeng = person2Data.ohaeng.main;
    let complementScore = 0;
    for (const oh of ['목', '화', '토', '금', '수']) {
      if (p1Ohaeng[oh] === 0 && p2Ohaeng[oh] >= 2) complementScore += 3;
      if (p2Ohaeng[oh] === 0 && p1Ohaeng[oh] >= 2) complementScore += 3;
    }
    if (complementScore > 0) {
      score += Math.min(complementScore, 10);
      details.push({ label: '오행 보완', desc: `부족한 오행 보완 (+${Math.min(complementScore, 10)})`, score: Math.min(complementScore, 10) });
    }

    // 점수 범위 제한 (0~100)
    score = Math.max(0, Math.min(100, score));

    // 점수별 등급
    let grade;
    if (score >= 85) grade = '천생연분';
    else if (score >= 70) grade = '좋은 궁합';
    else if (score >= 55) grade = '무난한 궁합';
    else if (score >= 40) grade = '노력이 필요한 궁합';
    else grade = '주의가 필요한 궁합';

    return { score, grade, details };
  }

  // 공개 API
  return {
    calculate,
    calculateGunghap,
    getTrueSolarTime,
    getSipsung,
    getSibiUnsung,
    getDayGanji,
    getYearGanji,
    getMonthGanji,
    getHourGanji,
    get12Sinsal,
    calculateDaeun,
    calculateSeun
  };
})();
