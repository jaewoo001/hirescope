/**
 * Captures the screenshots the presentation uses.
 *
 *   npm run demo:shots
 *
 * Every image is the running application against the seeded database, so the
 * deck shows the product rather than a mockup of it. Shots are cropped tight to
 * the thing being explained: a full 1280x800 page shrunk onto a slide is
 * unreadable from the back of a room, and a slide nobody can read is a slide
 * that costs time without buying anything.
 *
 * One live search runs, which costs a model call. Everything else reads rows.
 */

import { chromium, type Page } from "playwright";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const PASSCODE = process.env.MANAGER_PASSCODE ?? "letmein";
const OUT = path.resolve("demo/shots");

/** Hide the dev-tools bubble Next injects; it is not part of the product. */
const HIDE_DEV_OVERLAY = `
  nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }
`;

async function shot(page: Page, file: string, clip?: { x: number; y: number; width: number; height: number }) {
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, file), ...(clip ? { clip } : {}) });
  console.log(`  ${file}`);
}

/**
 * Screenshot one card by its heading.
 *
 * Two things went wrong on the first pass. `clip` is measured from the top of
 * the document rather than the viewport, so scrolling to a section and then
 * clipping still captured the top of the page. And filtering divs by their text
 * and taking the last match returns the innermost element — which for the
 * integrity panel was the heading itself, 530x21 pixels of the word.
 *
 * Every card in this app is a `.panel`, so the reliable move is to find the
 * heading and walk up to its nearest panel ancestor.
 */
async function sectionShot(page: Page, file: string, heading: string) {
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY }).catch(() => {});

  const card = page
    .getByText(heading, { exact: false })
    .first()
    .locator('xpath=ancestor-or-self::*[contains(@class,"panel")][1]');

  const target = (await card.count()) ? card : page.getByText(heading).first();
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(700);

  const box = await target.boundingBox();
  if (!box || box.width < 300 || box.height < 120) {
    // Nothing usable resolved; a whole-viewport shot beats a picture of a word.
    await page.screenshot({ path: path.join(OUT, file) });
    console.log(`  ${file}  (fell back to viewport)`);
    return;
  }

  await target.screenshot({ path: path.join(OUT, file) });
  console.log(`  ${file}  ${Math.round(box.width)}x${Math.round(box.height)}`);
}

async function ids() {
  const db = new PrismaClient();
  try {
    const candidate = await db.candidate.findFirst({
      where: { email: "jaewoo.kim@example.com" },
      select: { id: true },
    });
    const live = await db.interview.findFirst({
      where: { status: "in_progress" },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });
    return { candidateId: candidate?.id ?? "", interviewId: live?.id ?? "" };
  } finally {
    await db.$disconnect();
  }
}

/**
 * Scroll a heading into view and shoot the whole viewport.
 *
 * For cards that are narrow by design — the skill diagram sits in a grid column
 * about 420px wide — an element shot is too small to project. A viewport shot
 * respects the scroll (which `clip` does not) and keeps the card in context
 * with what sits beside it.
 */
async function viewAt(page: Page, file: string, heading: string, settleMs = 800) {
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY }).catch(() => {});
  // scrollIntoViewIfNeeded stops as soon as the element is minimally visible,
  // which usually leaves it clipped against the bottom edge. Centre it instead.
  await page
    .getByText(heading, { exact: false })
    .first()
    .evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior }))
    .catch(() => {});
  await page.waitForTimeout(settleMs);
  await page.screenshot({ path: path.join(OUT, file) });
  console.log(`  ${file}  (viewport)`);
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const { candidateId, interviewId } = await ids();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, colorScheme: "dark" });

  // 1 — the front door
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await shot(page, "01-landing.png");

  // 2 — roles come from files, not code
  await page.goto(`${BASE}/apply`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.selectOption("select >> nth=0", { label: "Registered nurse" }).catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, "02-apply-roles.png", { x: 60, y: 90, width: 1160, height: 400 });

  // 3 — consent, per purpose
  await sectionShot(page, "03-consent.png", "Your consent");

  // 4 — the interview room, mid-interview
  if (interviewId) {
    // A stale interview shows the abandonment offer instead of the room.
    const db = new PrismaClient();
    const now = new Date();
    await db.interview.update({ where: { id: interviewId }, data: { startedAt: now } });
    const turns = await db.turn.findMany({ where: { interviewId } });
    for (const t of turns) await db.turn.update({ where: { id: t.id }, data: { createdAt: now } });
    await db.$disconnect();

    await page.goto(`${BASE}/interview/${interviewId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2600);
    await shot(page, "04-interview.png", { x: 60, y: 60, width: 1160, height: 780 });
  }

  // 5 — the door to the hiring side
  await page.goto(`${BASE}/hire/search`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await shot(page, "05-gate.png", { x: 60, y: 60, width: 780, height: 460 });

  // Through the door, once.
  await page.fill("#hire-passcode", PASSCODE).catch(() => {});
  await page.locator("button", { hasText: "Enter" }).first().click().catch(() => {});
  await page.waitForTimeout(2400);

  // 6 — AI Search: the room before a query
  await shot(page, "06-search-empty.png", { x: 60, y: 60, width: 1160, height: 700 });

  // 7 — AI Search: matches seated, empty chairs left empty
  const box = page.locator('input[type="text"], input:not([type])').first();
  await box.click().catch(() => {});
  await box.fill("Backend engineer who has worked on payments").catch(() => {});
  await page.locator("button", { hasText: /^Search$/ }).first().click().catch(() => {});
  await page.waitForTimeout(14000);
  await shot(page, "07-search-results.png", { x: 60, y: 60, width: 1160, height: 780 });

  // 8 — the ranked hits under the room
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1200);
  await shot(page, "08-search-hits.png", { x: 60, y: 40, width: 1160, height: 640 });

  // 9 — All Candidates
  await page.goto(`${BASE}/hire/candidates`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2600);
  await shot(page, "09-candidates.png", { x: 60, y: 60, width: 1160, height: 780 });

  // 10-13 — the report: the score, the diagram, the evidence, the integrity panel
  if (candidateId) {
    await page.goto(`${BASE}/hire/candidate/${candidateId}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2600);
    await shot(page, "10-report-head.png", { x: 60, y: 60, width: 1160, height: 620 });

    await viewAt(page, "11-radar.png", "Skill diagram");
    await sectionShot(page, "12-evidence.png", "Competency detail");
    await sectionShot(page, "13-integrity.png", "Session integrity");
  }

  // 14 — what it will not do
  await page.goto(`${BASE}/governance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await shot(page, "14-governance.png", { x: 60, y: 60, width: 1160, height: 760 });

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
