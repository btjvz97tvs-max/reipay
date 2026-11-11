// ITF（インターリーブド 2 of 5）バーコードの作成と読み取り。数字だけを表せる1次元バーコード。
// 1文字は「太い線2本・細い線3本」の組み合わせで表し、2文字を「黒い線」と「白いすき間」に交互に織り込む。

const PATTERNS = {
  0: 'nnwwn',
  1: 'wnnnw',
  2: 'nwnnw',
  3: 'wwnnn',
  4: 'nnwnw',
  5: 'wnwnn',
  6: 'nwwnn',
  7: 'nnnww',
  8: 'wnnwn',
  9: 'nwnwn',
};
const DIGIT_BY_PATTERN = Object.fromEntries(
  Object.entries(PATTERNS).map(([digit, pattern]) => [pattern, digit]),
);

export const WIDE_TO_NARROW_RATIO = 3;
export const QUIET_ZONE_UNITS = 10;

const START_PATTERN = 'nnnn';
const STOP_PATTERN = 'wnn';
const ELEMENTS_PER_PAIR = 10;
const MIN_WIDE_NARROW_RATIO = 1.5;
const START_WIDTH_TOLERANCE = 0.5;
const MIN_CONTRAST = 40;
const HYSTERESIS_RATIO = 0.08;

// 数字の列を、線とすき間の太さ（単位数）の列にする。偶数番目が黒、奇数番目が白。
export function encodeItf(digits) {
  if (!/^\d+$/.test(digits) || digits.length % 2 !== 0) {
    throw new Error('ITF にできるのは偶数けたの数字だけです');
  }

  const toWidth = (element) => (element === 'w' ? WIDE_TO_NARROW_RATIO : 1);
  const elements = [...START_PATTERN];
  for (let index = 0; index < digits.length; index += 2) {
    const barPattern = PATTERNS[digits[index]];
    const spacePattern = PATTERNS[digits[index + 1]];
    for (let position = 0; position < 5; position += 1) {
      elements.push(barPattern[position], spacePattern[position]);
    }
  }
  elements.push(...STOP_PATTERN);
  return elements.map(toWidth);
}

// 5つの幅のうち太い2つを w、残りを n にする。太さの差がはっきりしなければ null。
function classifyFive(widths) {
  const sorted = [...widths].sort((left, right) => right - left);
  const narrowestWide = sorted[1];
  const widestNarrow = sorted[2];
  if (narrowestWide < widestNarrow * MIN_WIDE_NARROW_RATIO) {
    return null;
  }
  return widths.map((width) => (width >= narrowestWide ? 'w' : 'n')).join('');
}

function isStartPattern(runs, index) {
  const widths = runs.slice(index, index + 4).map((run) => run.width);
  const average = widths.reduce((total, width) => total + width, 0) / widths.length;
  const isEven = widths.every(
    (width) => Math.abs(width - average) <= average * START_WIDTH_TOLERANCE,
  );
  const quietZone = index === 0 ? Infinity : runs[index - 1].width;
  return runs[index].isBar && isEven && quietZone >= average * 3;
}

function decodeFromStart(runs, startIndex, digitCount) {
  const narrowWidth =
    runs.slice(startIndex, startIndex + 4).reduce((total, run) => total + run.width, 0) / 4;
  let index = startIndex + 4;
  let digits = '';

  for (let pair = 0; pair < digitCount / 2; pair += 1) {
    const elements = runs.slice(index, index + ELEMENTS_PER_PAIR);
    if (elements.length < ELEMENTS_PER_PAIR) {
      return null;
    }
    const widths = elements.map((run) => run.width);
    const barPattern = classifyFive(widths.filter((_, position) => position % 2 === 0));
    const spacePattern = classifyFive(widths.filter((_, position) => position % 2 === 1));
    const first = DIGIT_BY_PATTERN[barPattern];
    const second = DIGIT_BY_PATTERN[spacePattern];
    if (first === undefined || second === undefined) {
      return null;
    }
    digits += first + second;
    index += ELEMENTS_PER_PAIR;
  }

  const [stopBar, stopSpace, lastBar] = runs.slice(index, index + 3);
  if (!stopBar || !lastBar || !stopBar.isBar) {
    return null;
  }
  const isStopValid =
    stopBar.width >= narrowWidth * MIN_WIDE_NARROW_RATIO &&
    stopSpace.width < narrowWidth * MIN_WIDE_NARROW_RATIO &&
    lastBar.width < narrowWidth * MIN_WIDE_NARROW_RATIO;
  return isStopValid ? digits : null;
}

// カメラ映像のざらつきで線が細かく割れないよう、両隣と平均してならす。
function smooth(luminances) {
  return Array.from(luminances, (value, index) => {
    const previous = luminances[index - 1] ?? value;
    const next = luminances[index + 1] ?? value;
    return (previous + value * 2 + next) / 4;
  });
}

// 明るさの列を「黒が何ピクセル、白が何ピクセル」の列にする。
// margin でしきい値の上下に少し幅（ヒステリシス）を持たせ、境目でのちらつきを防ぐ。
function toRuns(values, hysteresisRatio) {
  let min = 255;
  let max = 0;
  for (const value of values) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (max - min < MIN_CONTRAST) {
    return [];
  }

  const threshold = (min + max) / 2;
  const margin = (max - min) * hysteresisRatio;
  const runs = [];
  let isBar = values[0] < threshold;
  for (const value of values) {
    if (isBar && value > threshold + margin) {
      isBar = false;
    } else if (!isBar && value < threshold - margin) {
      isBar = true;
    }
    const last = runs[runs.length - 1];
    if (last && last.isBar === isBar) {
      last.width += 1;
    } else {
      runs.push({ isBar, width: 1 });
    }
  }
  return runs;
}

function decodeRuns(runs, digitCount, isValid) {
  for (let index = 0; index + 4 <= runs.length; index += 1) {
    if (isStartPattern(runs, index)) {
      const digits = decodeFromStart(runs, index, digitCount);
      if (digits && isValid(digits)) {
        return digits;
      }
    }
  }
  return null;
}

// 横1列分の明るさ（0〜255）からバーコードを探す。
// 細かい線がつぶれにくい「そのまま」と、ざらつきに強い「ならしてから」の2通りで読み、
// 逆さまに写っていても読めるよう反対向きも試す。チェック用の数字が合ったものだけを返す。
export function decodeItfRow(luminances, { digitCount, isValid }) {
  const attempts = [toRuns(luminances, 0), toRuns(smooth(luminances), HYSTERESIS_RATIO)];
  for (const runs of attempts) {
    const digits =
      decodeRuns(runs, digitCount, isValid) ??
      decodeRuns([...runs].reverse(), digitCount, isValid);
    if (digits) {
      return digits;
    }
  }
  return null;
}

// 画像（ImageData）の何か所かの横線を読んでみる。
export function decodeItfImage(imageData, options) {
  const { data, width, height } = imageData;
  const rowCount = 15;
  const luminances = new Uint8Array(width);

  for (let step = 0; step < rowCount; step += 1) {
    const y = Math.floor(height * (0.2 + (0.6 * step) / (rowCount - 1)));
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      luminances[x] = (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000;
    }
    const digits = decodeItfRow(luminances, options);
    if (digits) {
      return digits;
    }
  }
  return null;
}
