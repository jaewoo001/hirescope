/**
 * Builds the 5-minute presentation.
 *
 *   node scripts/demo-deck.js
 *
 * Twelve slides, one function each, roughly 25 seconds apiece. Every image is a
 * real screenshot of the running app from `npm run demo:shots` — nothing here is
 * a mockup, and the deck says so.
 *
 * The palette is the product's own (near-black navy, brass lamp, ice text),
 * which is the point: the slides should look like the thing they are explaining.
 * Text is kept to a title and one line because the screenshot is the argument —
 * a slide the audience has to read is a slide they are not watching you for.
 */

const pptxgen = require("pptxgenjs");
const path = require("path");

const SHOTS = path.resolve(__dirname, "..", "demo", "shots");
const OUT = path.resolve(__dirname, "..", "demo", "hirescope-5min.pptx");

// The app's tokens, lifted straight from globals.css.
const BG = "080A12";
const PANEL = "0D1020";
const BRASS = "F2B544";
const INK = "CFE0FF";
const DIM = "8FA3CC";
const FAINT = "5D6E9E";

const KR = "Malgun Gothic";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.3 x 7.5
pres.author = "HireScope";
pres.title = "HireScope — 기능 소개";

/** Every content slide is the same frame: label, title, one line, screenshot. */
function contentSlide({ chip, title, line, image, notes, chipColor = BRASS }) {
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addText(chip, {
    x: 0.55, y: 0.34, w: 4.5, h: 0.3,
    fontFace: KR, fontSize: 11, bold: true, color: chipColor,
    charSpacing: 2, isTextBox: true, margin: 0,
  });

  s.addText(title, {
    x: 0.55, y: 0.66, w: 8.6, h: 0.62,
    fontFace: KR, fontSize: 30, bold: true, color: INK,
    isTextBox: true, margin: 0,
  });

  s.addText(line, {
    x: 0.55, y: 1.32, w: 11.9, h: 0.42,
    fontFace: KR, fontSize: 15, color: DIM,
    isTextBox: true, margin: 0,
  });

  // The screenshot sits in a panel so it reads as a window into the product
  // rather than a picture floating on a dark field.
  s.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.92, w: 12.3, h: 5.1,
    fill: { color: PANEL }, line: { color: "2A3454", width: 1 },
  });
  s.addImage({
    path: path.join(SHOTS, image),
    x: 0.62, y: 2.02, w: 12.06, h: 4.9,
    sizing: { type: "contain", w: 12.06, h: 4.9 },
  });

  if (notes) s.addNotes(notes);
  return s;
}

/* ── 1. title ─────────────────────────────────────────────────────────── */
{
  const s = pres.addSlide();
  s.background = { color: BG };
  s.addText("HIRESCOPE", {
    x: 0.9, y: 2.25, w: 11.5, h: 1.5,
    fontFace: "Courier New", fontSize: 72, bold: true, color: BRASS,
    charSpacing: 8, isTextBox: true, margin: 0,
  });
  s.addText("이력서를 먼저 읽는 면접", {
    x: 0.95, y: 3.75, w: 11.5, h: 0.6,
    fontFace: KR, fontSize: 26, color: INK, isTextBox: true, margin: 0,
  });
  s.addText("모든 판단은 기록을 남깁니다", {
    x: 0.95, y: 4.4, w: 11.5, h: 0.45,
    fontFace: KR, fontSize: 15, color: DIM, isTextBox: true, margin: 0,
  });
  s.addText("5분 · 기능 중심 · 모든 화면은 실제 동작", {
    x: 0.95, y: 6.35, w: 11.5, h: 0.4,
    fontFace: KR, fontSize: 12, color: FAINT, isTextBox: true, margin: 0,
  });
  s.addNotes("5분, 기능 위주. 화면은 전부 실제로 돌아가는 앱입니다.");
}

/* ── 2. the front door ────────────────────────────────────────────────── */
contentSlide({
  chip: "01  들어가는 문",
  title: "지원자와 채용팀, 두 갈래",
  line: "이력서를 내고 면접을 보거나, 평가가 끝난 사람을 찾거나. 둘 중 하나입니다.",
  image: "01-landing.png",
  notes: "오는 사람은 둘 중 하나. 그래서 문도 두 개만 뒀습니다. (20초)",
});

/* ── 3. criteria live in files ────────────────────────────────────────── */
contentSlide({
  chip: "02  평가 기준",
  title: "직무 기준은 코드가 아니라 파일",
  line: "criteria/*.md 를 HR이 직접 씁니다. 현재 20개 직무 · 역량 163개. 파일을 고치면 다음 면접이 바뀝니다.",
  image: "02-apply-roles.png",
  notes: "핵심 차별점 1. 기준이 코드에 박혀 있지 않습니다. 파일을 고치면 재배포 없이 바뀝니다. (30초)",
});

/* ── 4. consent ───────────────────────────────────────────────────────── */
contentSlide({
  chip: "03  동의",
  title: "목적별로 나눠 받고, 버전과 함께 기록",
  line: "면접 · 무결성 모니터링 · 링크 확인 · 타 직무 검토. 각각 따로, 거절해도 평가에 불이익 없음.",
  image: "03-consent.png",
  notes: "동의를 뭉뚱그리지 않습니다. 지원자가 본 정책 버전까지 저장됩니다. (25초)",
});

/* ── 5. the interview ─────────────────────────────────────────────────── */
contentSlide({
  chip: "04  면접",
  title: "질문은 그 사람의 이력서에서 나옵니다",
  line: "답변마다 즉시 채점하고, 그 답을 근거로 다음 질문을 정합니다. 면접관은 모델이 생각하는 동안 함께 움직입니다.",
  image: "04-interview.png",
  notes: "적응형 면접. 한 번의 모델 호출이 직전 답변 채점과 다음 질문 결정을 같이 합니다. (30초)",
});

/* ── 6-7. AI Search ───────────────────────────────────────────────────── */
contentSlide({
  chip: "05  AI 검색",
  title: "“누가 X를 해봤나”에 답합니다",
  line: "평범한 문장으로 묻습니다. 질문에 맞는 사람만 자리에 앉고, 빈 의자는 결과가 적다는 뜻입니다.",
  image: "07-search-results.png",
  notes: "AI 검색의 핵심. 비슷한 사람으로 자리를 채우지 않는 것이 의도된 설계입니다. (35초)",
});

contentSlide({
  chip: "05  AI 검색",
  title: "순위는 ‘입증된 것’으로 매깁니다",
  line: "이력서에 적힌 주장이 아니라 면접에서 확인된 역량이 위로 올라옵니다. 필수 조건과 가산 조건도 함께 보여줍니다.",
  image: "08-search-hits.png",
  notes: "주장 vs 입증 구분이 검색을 쓸모 있게 만드는 부분입니다. (30초)",
});

/* ── 8. All Candidates — the contrast ─────────────────────────────────── */
contentSlide({
  chip: "06  전체 후보",
  chipColor: "7FD6A0",
  title: "“누가 있나”에 답합니다",
  line: "검색이 질문에 답한다면, 이쪽은 전체를 훑는 곳. 직무·연차·추천 등급으로 좁힙니다. 점수가 낮다고 숨기지 않습니다.",
  image: "09-candidates.png",
  notes: "AI 검색과의 차이를 여기서 분명히. 검색=질문에 답, 목록=전체를 봄. 필터는 보는 사람의 선택이고 화면에 몇 명 중 몇 명인지 항상 표시됩니다. (35초)",
});

/* ── 9. the skill diagram ─────────────────────────────────────────────── */
contentSlide({
  chip: "07  역량 다이어그램",
  title: "확인 못 한 역량은 0점이 아닙니다",
  line: "축은 그 직무의 기준 파일에서 나옵니다. 면접이 닿지 않은 역량은 평균에서 빼고, 점수가 몇 개 위에 서 있는지 함께 적습니다.",
  image: "11-radar.png",
  notes: "면접 한 번으로 전부 판단할 수 있다는 전제를 시스템이 스스로 부정합니다. (30초)",
});

/* ── 10. evidence ─────────────────────────────────────────────────────── */
contentSlide({
  chip: "08  근거",
  title: "모든 점수에 발언이 붙습니다",
  line: "총점은 모델이 아니라 코드가 계산합니다. 가중평균 high×3 / medium×2 / low×1 — 손으로 검산할 수 있습니다.",
  image: "12-evidence.png",
  notes: "여기가 범용 LLM과 갈리는 지점. 인용 없는 점수는 만들지 않습니다. (35초)",
});

/* ── 11. integrity ────────────────────────────────────────────────────── */
contentSlide({
  chip: "09  세션 무결성",
  title: "얼굴도, 시선도, 감정도 보지 않습니다",
  line: "창 전환 · 붙여넣기 · 답변 타이밍만 봅니다. 점수에는 반영되지 않고, ‘증거가 아니라 물어볼 이유’로 따로 보고합니다.",
  image: "13-integrity.png",
  notes: "감정 추론은 EU AI Act 5조 금지 사항이라 아예 만들지 않았습니다. (30초)",
});

/* ── 12. what it will not do ──────────────────────────────────────────── */
contentSlide({
  chip: "10  경계",
  title: "하지 않는 일과, 아직 남은 일",
  line: "합격·불합격은 사람이 정합니다. SNS 조회 없음. 편향 감사와 보관·삭제 정책은 아직 미구현 — 그대로 적어 뒀습니다.",
  image: "14-governance.png",
  notes: "마무리. 못 한 것을 숨기지 않는 것도 기능입니다. (30초)",
});

pres.writeFile({ fileName: OUT }).then(() => console.log(`  wrote ${OUT}`));
