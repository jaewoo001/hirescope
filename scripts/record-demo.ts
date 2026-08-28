/**
 * Records the demo video, with Korean subtitles.
 *
 *   npm run demo:record
 *
 * Playwright drives a real Chromium and records the session; ffmpeg cuts it.
 * Nothing is staged — every screen is the actual application. The candidate it
 * tours (JaeWoo Kim) came from `npm run demo:live`, which runs a genuine
 * interview through the HTTP API, so the scores on screen were produced by the
 * real code paths.
 *
 * The cut spends its second half on the difference between the two ways into
 * the hiring side, because that is the thing a viewer will otherwise assume is
 * one feature shown twice: AI Search answers "who has done X", All Candidates
 * answers "who is here".
 *
 * Costs two model calls for the upload and one for the search.
 */

import { chromium, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const OUT = path.resolve("demo");
const PASSCODE = process.env.MANAGER_PASSCODE ?? "letmein";
const RESUME = path.resolve("examples/demo-resume-jaewoo-kim.pdf");

const beat = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Subtitles are injected into the page rather than burned in afterwards, so
 * they stay glued to what is on screen however the timing drifts. Noto Sans KR
 * is pulled in explicitly — the default sans on a Windows Chromium renders
 * Hangul unevenly, and it shows at this size.
 */
async function caption(page: Page, text: string, holdMs = 3000) {
  await page.evaluate((t) => {
    if (!document.getElementById("__demo_font")) {
      const link = document.createElement("link");
      link.id = "__demo_font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700&display=swap";
      document.head.appendChild(link);
    }
    let el = document.getElementById("__demo_caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "__demo_caption";
      el.style.cssText = [
        "position:fixed", "left:50%", "bottom:34px", "transform:translateX(-50%)",
        "background:rgba(8,10,18,.95)", "color:#F4F7F8", "padding:13px 28px",
        'font-family:"Noto Sans KR",system-ui,sans-serif',
        "font-weight:500", "font-size:19px", "line-height:1.5",
        "max-width:min(82vw,840px)", "text-align:center", "z-index:2147483647",
        "box-shadow:0 0 0 2px #2a3454, 0 0 0 4px #080a12",
        "opacity:0", "transition:opacity .3s ease", "pointer-events:none",
        "word-break:keep-all",
      ].join(";");
      document.body.appendChild(el);
    }
    el.textContent = t;
    requestAnimationFrame(() => { el!.style.opacity = "1"; });
  }, text);
  await beat(holdMs);
}

async function clearCaption(page: Page) {
  await page.evaluate(() => {
    const el = document.getElementById("__demo_caption");
    if (el) el.style.opacity = "0";
  });
  await beat(350);
}

async function glide(page: Page, selector: string) {
  const t = page.locator(selector).first();
  if (await t.count()) { await t.scrollIntoViewIfNeeded(); await beat(600); }
}

/**
 * Watch the database rather than the address bar. In dev, a Fast Refresh
 * remount drops the in-flight upload request even though the server has already
 * written the interview, and the recording then sits on a dead form until the
 * URL wait times out. The row appearing is the real completion signal.
 */
async function waitForInterview(since: Date, timeoutMs: number): Promise<string | null> {
  const db = new PrismaClient();
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const row = await db.interview.findFirst({
        where: { candidate: { email: "jaewoo.kim@example.com" }, startedAt: { gte: since } },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });
      if (row) return row.id;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return null;
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  rmSync(path.join(OUT, "raw"), { recursive: true, force: true });
  mkdirSync(path.join(OUT, "raw"), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: path.join(OUT, "raw"), size: { width: 1280, height: 800 } },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  // ---- the front door -------------------------------------------------
  await page.goto(BASE, { waitUntil: "networkidle" });
  await beat(900);
  await caption(page, "지원자와 채용팀. 문은 두 개뿐입니다.", 3000);
  await clearCaption(page);

  // ---- applicant: the standard is a file, not code --------------------
  await page.goto(`${BASE}/apply`, { waitUntil: "networkidle" });
  await beat(600);
  await caption(page, "직무는 코드가 아니라 마크다운 파일로 정의됩니다. 현재 20개 직무.", 3200);
  await clearCaption(page);

  await caption(page, "실제 PDF 이력서를 그대로 올립니다.", 2400);
  await page.setInputFiles('input[type="file"]', RESUME).catch(() => {});
  await page.fill('input[type="email"]', "jaewoo.kim@example.com").catch(() => {});
  await page.selectOption("select >> nth=0", { label: "Software developer" }).catch(() => {});
  await beat(1000);
  await clearCaption(page);

  await glide(page, "text=Your consent");
  await caption(page, "동의는 목적별로 나뉘고, 지원자가 본 정책 버전과 함께 기록됩니다.", 3200);
  await clearCaption(page);
  for (const box of await page.locator('input[type="checkbox"]').all()) {
    await box.check({ timeout: 2000 }).catch(() => {});
    await beat(220);
  }

  await caption(page, "이력서를 읽고 면접 계획을 세웁니다. 지금 실제로 실행됩니다.", 2600);
  const submittedAt = new Date();
  await page.locator("button", { hasText: /begin|start/i }).first().click({ timeout: 5000 }).catch(() => {});
  const interviewId = await waitForInterview(submittedAt, 200_000);
  await beat(500);
  await clearCaption(page);

  // ---- the interview room ---------------------------------------------
  if (interviewId) {
    await page.goto(`${BASE}/interview/${interviewId}`, { waitUntil: "networkidle" });
    await beat(1200);
  }
  await caption(page, "이 지원자의 이력서에서 나온 첫 질문입니다.", 3000);
  await clearCaption(page);
  await caption(page, "면접관은 모델이 다음 질문을 만드는 동안 함께 움직입니다.", 3000);
  await clearCaption(page);

  // ---- the door to the hiring side -------------------------------------
  await page.goto(`${BASE}/hire/search`, { waitUntil: "networkidle" });
  await beat(900);
  await caption(page, "채용 쪽은 문 앞에서 비밀번호를 한 번만 묻습니다.", 3000);
  await page.fill("#hire-passcode", PASSCODE).catch(() => {});
  await beat(600);
  await page.locator("button", { hasText: "Enter" }).first().click().catch(() => {});
  await page.waitForTimeout(2200);
  await clearCaption(page);

  // ---- AI Search: who has done X ---------------------------------------
  await caption(page, "AI 검색 — 평범한 문장으로 묻습니다.", 2600);
  await clearCaption(page);
  const box = page.locator('input[type="text"], input:not([type])').first();
  await box.click().catch(() => {});
  await box.type("Backend engineer who has worked on payments", { delay: 45 }).catch(() => {});
  await beat(500);
  await page.locator("button", { hasText: /^Search$/ }).first().click().catch(() => {});
  await caption(page, "질문에 맞는 사람만 자리에 앉습니다.", 2800);
  await page.waitForTimeout(11000);
  await clearCaption(page);
  await caption(page, "빈 의자는 결과가 적다는 뜻입니다. 비슷한 사람으로 채우지 않습니다.", 3400);
  await clearCaption(page);
  await glide(page, "text=match");
  await caption(page, "이력서에 적힌 주장이 아니라, 면접에서 입증된 역량으로 순위가 정해집니다.", 3600);
  await clearCaption(page);
  await page.mouse.wheel(0, 420); await beat(1400);

  // ---- All Candidates: who is here --------------------------------------
  await page.goto(`${BASE}/hire/candidates`, { waitUntil: "networkidle" });
  await beat(1400);
  await caption(page, "전체 후보 — 검색이 “누가 X를 해봤나”라면, 이쪽은 “누가 있나”입니다.", 3600);
  await clearCaption(page);
  await caption(page, "직무·연차·추천 등급으로 좁혀 봅니다. 점수가 낮다고 숨기지 않습니다.", 3400);
  await clearCaption(page);
  await page.selectOption("select >> nth=0", { label: "Software developer" }).catch(() => {});
  await beat(2200);
  await caption(page, "총점 옆에는 그 점수가 몇 개 역량 위에 서 있는지 함께 적힙니다.", 3400);
  await clearCaption(page);
  await page.mouse.wheel(0, 520); await beat(1500);

  // ---- what it will not do ----------------------------------------------
  await page.goto(`${BASE}/governance`, { waitUntil: "networkidle" });
  await beat(900);
  await caption(page, "그리고 이 시스템이 하지 않는 일과, 아직 남은 과제.", 3400);
  await clearCaption(page);
  await page.mouse.wheel(0, 620); await beat(1500);

  await context.close();
  await browser.close();
  console.log(`Raw recording written to ${path.join(OUT, "raw")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
