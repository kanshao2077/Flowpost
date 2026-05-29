import type { PlatformId } from "../shared/platforms";
import type { PlatformFillPayload } from "../shared/types";
import {
  clickElement,
  clickPoint,
  findVisibleElementByExactText,
  findVisibleElementByText,
  isVisible,
  queryFirstVisible,
  setEditableText,
  sleep
} from "./dom";
import { createGenericAdapter, type PlatformAdapter } from "./generic";

const xAdapter = createGenericAdapter({
  id: "x",
  label: "X",
  editorSelectors: [
    "[data-testid='tweetTextarea_0']",
    "div[role='textbox'][contenteditable='true']",
    "div[aria-label*='Post text']",
    "div[aria-label*='Tweet text']"
  ],
  imageInputSelectors: [
    "input[data-testid='fileInput']",
    "input[type='file'][accept*='image']",
    "input[type='file']"
  ],
  imageButtonSelectors: [
    "[data-testid='fileInput']",
    "[aria-label*='Media']",
    "[aria-label*='Add photos']"
  ],
  imageButtonTexts: ["Media", "Add photos", "图片", "媒体"],
  publishSelectors: ["[data-testid='tweetButton']", "[data-testid='tweetButtonInline']"],
  publishTexts: ["Post", "Tweet", "发布"],
  loginSelectors: ["[data-testid='loginButton']", "a[href='/login']", "input[name='text']"],
  loginTexts: ["Log in", "Sign in", "登录"],
  editorTimeoutMs: 20_000
});

const linkedinAdapter = createGenericAdapter({
  id: "linkedin",
  label: "LinkedIn",
  editorSelectors: [
    ".ql-editor[contenteditable='true']",
    "div[role='textbox'][contenteditable='true']",
    "div[data-placeholder*='What do you want to talk about']",
    "div[aria-label*='Text editor for creating content']"
  ],
  openComposerSelectors: [
    "button[aria-label*='Start a post']",
    "button[aria-label*='创建帖子']",
    ".share-box-feed-entry__trigger"
  ],
  openComposerTexts: ["Start a post", "创建帖子", "发帖"],
  imageInputSelectors: [
    "input[type='file'][accept*='image']",
    "input[type='file'][name*='image']",
    "input[type='file']"
  ],
  imageButtonSelectors: [
    "button[aria-label*='Add media']",
    "button[aria-label*='Add a photo']",
    "button[aria-label*='添加媒体']",
    "button[aria-label*='添加照片']"
  ],
  imageButtonTexts: ["Add media", "Add a photo", "Media", "Photo", "添加媒体", "添加照片"],
  publishSelectors: [
    "button.share-actions__primary-action",
    "button[aria-label*='Post']",
    "button[aria-label*='发布']"
  ],
  publishTexts: ["Post", "发布"],
  loginSelectors: ["a[href*='/login']", "input[name='session_key']"],
  loginTexts: ["Sign in", "Join now", "登录"],
  editorTimeoutMs: 22_000,
  afterOpenDelayMs: 1_200
});

const jikeAdapter = createGenericAdapter({
  id: "jike",
  label: "即刻",
  editorSelectors: [
    "textarea",
    "div[contenteditable='true']",
    "div[role='textbox']",
    "[placeholder*='说点什么']",
    "[aria-label*='说点什么']"
  ],
  openComposerSelectors: [
    "button[aria-label*='发布']",
    "button[aria-label*='发动态']",
    "button[aria-label*='写动态']"
  ],
  openComposerTexts: ["发布", "发动态", "写动态", "说点什么"],
  imageInputSelectors: [
    "input[type='file'][accept*='image']",
    "input[type='file'][accept*='png']",
    "input[type='file']"
  ],
  imageButtonSelectors: [
    "button[aria-label*='图片']",
    "button[aria-label*='照片']",
    "button[aria-label*='上传']"
  ],
  imageButtonTexts: ["图片", "照片", "上传"],
  publishSelectors: ["button[type='submit']", "button[aria-label*='发布']"],
  publishTexts: ["发布"],
  loginSelectors: ["input[type='tel']", "input[name='phone']", "button[aria-label*='登录']"],
  loginTexts: ["登录", "注册"],
  afterFill: selectJikeCircle,
  afterFillDelayMs: 1_600,
  editorTimeoutMs: 20_000
});

const substackAdapter = createGenericAdapter({
  id: "substack",
  label: "Substack Notes",
  editorSelectors: [
    ".ProseMirror[contenteditable='true']",
    "div[contenteditable='true']",
    "textarea",
    "div[role='textbox']"
  ],
  openComposerSelectors: [
    "button[aria-label*='New note']",
    "button[aria-label*='Write a note']",
    "a[href*='/notes/new']"
  ],
  openComposerTexts: ["New note", "Write a note", "Note", "Post"],
  imageInputSelectors: [
    "input[type='file'][accept*='image']",
    "input[type='file'][accept*='png']",
    "input[type='file']"
  ],
  imageButtonSelectors: [
    "button[aria-label*='Image']",
    "button[aria-label*='Photo']",
    "button[aria-label*='Media']",
    "button[aria-label*='Attach']"
  ],
  imageButtonTexts: ["Image", "Photo", "Media", "Attach"],
  publishSelectors: ["button[type='submit']", "button[aria-label*='Post']", "button[aria-label*='Publish']"],
  publishTexts: ["Post", "Publish"],
  loginSelectors: ["a[href*='sign-in']", "button[aria-label*='Sign in']", "input[type='email']"],
  loginTexts: ["Sign in", "Log in"],
  editorTimeoutMs: 22_000,
  afterOpenDelayMs: 1_200
});

const ADAPTERS: Record<PlatformId, PlatformAdapter> = {
  x: xAdapter,
  linkedin: linkedinAdapter,
  jike: jikeAdapter,
  substack: substackAdapter
};

export function getAdapter(platform: PlatformId): PlatformAdapter {
  return ADAPTERS[platform];
}

async function selectJikeCircle(payload: PlatformFillPayload): Promise<string | undefined> {
  const circle = payload.jikeCircle?.trim();
  if (payload.platform !== "jike" || !circle) return undefined;

  fixDuplicatedJikeText(payload.text);

  const matchTerms = getJikeCircleMatchTerms(circle);
  const exactVisibleChip = findJikeCircleChipByCandidates(matchTerms) ?? (await findJikeCircleChipByScrolling(matchTerms));
  if (exactVisibleChip) {
    clickElement(exactVisibleChip);
    await sleep(600);
    return undefined;
  }

  const pickerOpened = await openJikeCirclePicker(matchTerms);
  if (!pickerOpened) {
    return `未能打开即刻圈子选择器，需要手动选择「${circle}」`;
  }

  const optionBeforeSearch = findJikeCircleOptionByCandidates(matchTerms);
  if (optionBeforeSearch) {
    clickElement(optionBeforeSearch);
    await sleep(600);
    return undefined;
  }

  const searchTerms = getJikeCircleSearchTerms(circle);

  for (const term of searchTerms) {
    const searchInput = await waitForJikeCircleSearchTarget();

    if (searchInput) {
      setEditableText(searchInput, term);
    } else {
      const activeSearchTarget = findJikeCircleActiveSearchTarget();
      if (activeSearchTarget) setEditableText(activeSearchTarget, term);
    }

    await sleep(900);

    const option = findJikeCircleOptionByCandidates(matchTerms);
    if (option) {
      clickElement(option);
      await sleep(600);
      return undefined;
    }
  }

  for (const left of [0, 180, 360, 540, 720, 960, 1280]) {
    scrollJikeCircleRows(left);
    await sleep(140);
    const match = findJikeCircleOptionByCandidates(matchTerms) ?? findJikeCircleChipByCandidates(matchTerms);
    if (match) {
      clickElement(match);
      await sleep(600);
      return undefined;
    }
  }

  return `已打开即刻圈子选择器，但未找到「${circle}」候选项`;
}

function fixDuplicatedJikeText(expectedText: string): void {
  const editor = queryFirstVisible<HTMLElement>([
    "textarea",
    "div[contenteditable='true']",
    "div[role='textbox']",
    "[placeholder*='说点什么']",
    "[aria-label*='说点什么']"
  ]);
  if (!editor) return;

  const actual = normalizeJikePlainText(editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement ? editor.value : editor.textContent ?? "");
  const expected = normalizeJikePlainText(expectedText);
  if (expected && actual === `${expected}${expected}`) {
    setEditableText(editor, expectedText);
  }
}

async function openJikeCirclePicker(candidates: string[]): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const trigger = (await waitForJikeCircleTrigger(attempt === 0 ? 3_000 : 1_200)) ?? findJikeCircleTriggerByLayout();
    if (trigger) {
      clickElement(trigger);
      if (await waitForJikeCirclePickerOpen(candidates)) return true;
    }

    const layoutTrigger = findJikeCircleTriggerByLayout();
    if (layoutTrigger && layoutTrigger !== trigger) {
      clickElement(layoutTrigger);
      if (await waitForJikeCirclePickerOpen(candidates)) return true;
    }

    for (const [x, y] of getJikeCircleTriggerPoints()) {
      if (clickPoint(x, y) && (await waitForJikeCirclePickerOpen(candidates, 1_400))) return true;
    }

    await sleep(300);
  }

  return false;
}

async function waitForJikeCirclePickerOpen(candidates: string[], timeoutMs = 2_200): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (findJikeCircleSearchInput() || findJikeCircleOptionByCandidates(candidates)) return true;
    await sleep(180);
  }

  return false;
}

async function waitForJikeCircleTrigger(timeoutMs = 6_000): Promise<HTMLElement | undefined> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const trigger = findJikeCircleTrigger();
    if (trigger) return trigger;
    await sleep(250);
  }

  return undefined;
}

function findJikeCircleChipByCandidates(candidates: string[]): HTMLElement | undefined {
  for (const candidate of candidates) {
    const chip = findJikeCircleChip(candidate);
    if (chip) return chip;
  }

  return undefined;
}

function findJikeCircleChip(circle: string): HTMLElement | undefined {
  const exact =
    findVisibleElementByExactText<HTMLElement>(
      [
        "section div",
        "form div",
        "[class*='item']",
        "[class*='topic'] div",
        "button",
        "[role='button']",
        "span"
      ],
      circle
    ) ??
    findVisibleElementByText<HTMLElement>(
      [
        "section div",
        "form div",
        "[class*='item']",
        "[class*='topic'] div",
        "button",
        "[role='button']",
        "span"
      ],
      [circle]
    ) ??
    findElementByVisibleLabel(circle);

  if (!exact) return undefined;

  return exact.closest<HTMLElement>("[class*='item'], button, [role='button']") ?? exact;
}

async function findJikeCircleChipByScrolling(candidates: string[]): Promise<HTMLElement | undefined> {
  const containers = findJikeScrollableCircleContainers();
  const scrollPositions = [0, 160, 320, 520, 760, 1040, 1360, 1720, 2200];

  for (const container of containers) {
    for (const left of scrollPositions) {
      container.scrollLeft = left;
      container.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sleep(120);

      const match = findJikeCircleChipByCandidates(candidates);
      if (match) return match;
    }
  }

  return undefined;
}

function findElementByVisibleLabel(text: string): HTMLElement | undefined {
  const wanted = normalizeJikeLabel(text);
  const elements = Array.from(document.querySelectorAll<HTMLElement>("button, [role='button'], div, span"));

  return elements
    .filter((element) => {
      if (!isVisible(element)) return false;
      const label = normalizeJikeLabel(getJikeElementLabel(element));
      return label === wanted || label.includes(wanted);
    })
    .sort((left, right) => {
      const leftLabel = normalizeJikeLabel(getJikeElementLabel(left));
      const rightLabel = normalizeJikeLabel(getJikeElementLabel(right));
      const leftExact = leftLabel === wanted ? 0 : 1;
      const rightExact = rightLabel === wanted ? 0 : 1;
      if (leftExact !== rightExact) return leftExact - rightExact;
      return getElementArea(left) - getElementArea(right);
    })[0];
}

function getJikeElementLabel(element: HTMLElement): string {
  return [element.textContent ?? "", element.getAttribute("aria-label") ?? "", element.getAttribute("title") ?? ""].join(" ");
}

function normalizeJikeLabel(text: string): string {
  return text.replace(/\s+/g, "").trim().toLowerCase();
}

function normalizeJikePlainText(text: string): string {
  return text.replace(/\u200b/g, "").replace(/\s+/g, "").trim();
}

function findJikeScrollableCircleContainers(): HTMLElement[] {
  const composer = findJikeComposer();
  const roots = [composer, document.body].filter(Boolean) as HTMLElement[];
  const containers = new Set<HTMLElement>();

  for (const root of roots) {
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>(
        "[class*='topicSection'], [class*='topic'], [class*='containerWithData'], [class*='container'], section div, form div"
      )
    );

    for (const element of elements) {
      if (!isVisible(element)) continue;
      const rect = element.getBoundingClientRect();
      const text = normalizeJikeLabel(element.textContent ?? "");
      const looksLikeCircleRow =
        element.scrollWidth > element.clientWidth + 8 &&
        rect.height >= 24 &&
        rect.height <= 96 &&
        (!text || /未选择圈子|选择圈子|不好笑|今天|一起|汪星|运动|有谁|惨|圈子/.test(text));

      if (looksLikeCircleRow) containers.add(element);
    }
  }

  return Array.from(containers);
}

function findJikeCircleTrigger(): HTMLElement | undefined {
  const textSelectors = [
    "button",
    "[role='button']",
    "[class*='topicSection'] *",
    "[class*='topic'] *",
    "[class*='containerWithData'] *",
    "[class*='container'] *",
    "div",
    "span"
  ];

  const trigger =
    findVisibleElementByExactText<HTMLElement>(textSelectors, "未选择圈子") ??
    findVisibleElementByText<HTMLElement>(textSelectors, ["未选择圈子", "选择圈子"]) ??
    findElementByVisibleLabel("未选择圈子") ??
    findElementByVisibleLabel("选择圈子");

  if (trigger) return toJikeClickableElement(trigger);

  const composer = findJikeComposer();
  const scopedTrigger = composer ? findJikeTriggerInside(composer) : undefined;
  if (scopedTrigger) return scopedTrigger;

  const layoutTrigger = findJikeCircleTriggerByLayout(composer ?? document.body);
  if (layoutTrigger) return layoutTrigger;

  return findJikeUnlabeledTopicTrigger(composer ?? document.body);
}

function findJikeComposer(): HTMLElement | undefined {
  const editor = queryFirstVisible<HTMLElement>([
    "textarea",
    "div[contenteditable='true']",
    "div[role='textbox']",
    "[placeholder*='说点什么']",
    "[aria-label*='说点什么']"
  ]);

  return editor?.closest<HTMLElement>("form, section, [class*='postForm'], [class*='form'], [class*='composer']") ?? undefined;
}

function findJikeTriggerInside(root: HTMLElement): HTMLElement | undefined {
  const elements = Array.from(
    root.querySelectorAll<HTMLElement>(
      "button, [role='button'], [class*='topicSection'] *, [class*='topic'] *, [class*='containerWithData'] *, [class*='item'], div, span"
    )
  );

  const match = elements.find((element) => {
    if (!isVisible(element)) return false;
    const label = getJikeElementLabel(element).replace(/\s+/g, " ").trim();
    return /未选择圈子|选择圈子/.test(label);
  });

  return match ? toJikeClickableElement(match) : undefined;
}

function findJikeUnlabeledTopicTrigger(root: HTMLElement): HTMLElement | undefined {
  const rows = findJikeScrollableCircleContainers();
  const rowWithFirstItem = rows
    .flatMap((row) => Array.from(row.querySelectorAll<HTMLElement>("[class*='item'], button, [role='button'], div, span")))
    .filter(isVisible)
    .sort((left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left)
    .find((element) => {
      const rect = element.getBoundingClientRect();
      const label = normalizeJikeLabel(element.textContent ?? "");
      return rect.width >= 48 && rect.width <= 180 && rect.height >= 24 && rect.height <= 64 && (!label || /未选择圈子|选择圈子/.test(label));
    });

  if (rowWithFirstItem) return toJikeClickableElement(rowWithFirstItem);

  const sections = Array.from(
    root.querySelectorAll<HTMLElement>("[class*='topicSection'], [class*='topic'], [class*='containerWithData']")
  ).filter(isVisible);

  for (const section of sections) {
    const firstItem = Array.from(section.querySelectorAll<HTMLElement>("[class*='item'], button, [role='button']"))
      .filter(isVisible)
      .find((element) => {
        const label = normalizeJikeLabel(element.textContent ?? "");
        return !label || /未选择圈子|选择圈子/.test(label);
      });

    if (firstItem) return toJikeClickableElement(firstItem);
  }

  return undefined;
}

function toJikeClickableElement(element: HTMLElement): HTMLElement {
  return (
    element.closest<HTMLElement>("button, [role='button'], [class*='item'], [class*='chip'], [class*='tag'], [class*='select']") ??
    element
  );
}

function findJikeCircleTriggerByLayout(root = findJikeComposer() ?? document.body): HTMLElement | undefined {
  const sendButton =
    findVisibleElementByExactText<HTMLElement>(["button", "[role='button']"], "发送") ??
    findVisibleElementByText<HTMLElement>(["button", "[role='button']"], ["发送"]);
  const sendRect = sendButton?.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const elements = Array.from(root.querySelectorAll<HTMLElement>("button, [role='button'], div, span"));

  const candidates = elements
    .filter((element) => {
      if (!isVisible(element)) return false;
      const rect = element.getBoundingClientRect();
      const label = normalizeJikeLabel(getJikeElementLabel(element));
      const pillSized = rect.width >= 54 && rect.width <= 230 && rect.height >= 24 && rect.height <= 62;
      const leftOfSend = sendRect ? rect.right < sendRect.left - 16 && rect.top < sendRect.top + 10 : true;
      const insideRoot = rect.left >= rootRect.left - 4 && rect.right <= rootRect.right + 4;
      return pillSized && leftOfSend && insideRoot && /未选择圈子|选择圈子/.test(label);
    })
    .sort((left, right) => {
      const leftLabel = normalizeJikeLabel(getJikeElementLabel(left));
      const rightLabel = normalizeJikeLabel(getJikeElementLabel(right));
      const leftScore = leftLabel.includes("未选择圈子") ? 0 : 1;
      const rightScore = rightLabel.includes("未选择圈子") ? 0 : 1;
      if (leftScore !== rightScore) return leftScore - rightScore;
      return getElementArea(left) - getElementArea(right);
    });

  return candidates[0] ? toJikeClickableElement(candidates[0]) : undefined;
}

function getJikeCircleTriggerPoints(): Array<[number, number]> {
  const editor = queryFirstVisible<HTMLElement>([
    "textarea",
    "div[contenteditable='true']",
    "div[role='textbox']",
    "[placeholder*='说点什么']",
    "[aria-label*='说点什么']"
  ]);
  const sendButton =
    findVisibleElementByExactText<HTMLElement>(["button", "[role='button']"], "发送") ??
    findVisibleElementByText<HTMLElement>(["button", "[role='button']"], ["发送"]);
  const editorRect = editor?.getBoundingClientRect();
  const sendRect = sendButton?.getBoundingClientRect();
  const points: Array<[number, number]> = [];

  if (editorRect) {
    points.push([editorRect.left + 92, editorRect.bottom + 62]);
    points.push([editorRect.left + 118, editorRect.bottom + 48]);
  }

  if (sendRect) {
    const x = editorRect ? editorRect.left + 96 : Math.max(160, sendRect.left - 1_040);
    points.push([x, sendRect.top - 58]);
    points.push([x + 32, sendRect.top - 70]);
  }

  return points.map(
    ([x, y]): [number, number] => [clamp(x, 4, window.innerWidth - 4), clamp(y, 4, window.innerHeight - 4)]
  );
}

function findJikeCircleSearchInput(): HTMLInputElement | undefined {
  return queryFirstVisible<HTMLInputElement>([
    "input[placeholder*='搜索']",
    "input[placeholder*='圈子']",
    "input[placeholder*='想法']",
    "[role='dialog'] input",
    "[class*='modal'] input",
    "[class*='popover'] input",
    "input[type='search']",
    "input[type='text']"
  ]);
}

async function waitForJikeCircleSearchTarget(timeoutMs = 2_500): Promise<HTMLElement | undefined> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const searchInput = findJikeCircleSearchInput();
    if (searchInput) return searchInput;

    const activeSearchTarget = findJikeCircleActiveSearchTarget();
    if (activeSearchTarget) return activeSearchTarget;

    await sleep(180);
  }

  return undefined;
}

function findJikeCircleActiveSearchTarget(): HTMLElement | undefined {
  const active = document.activeElement;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  ) {
    const label = [
      active.getAttribute("placeholder") ?? "",
      active.getAttribute("aria-label") ?? "",
      active.getAttribute("title") ?? ""
    ].join(" ");
    const insidePicker = Boolean(active.closest("[role='dialog'], [class*='modal'], [class*='popover'], [class*='dropdown']"));
    if (!insidePicker && !/搜索|圈子|topic/i.test(label)) return undefined;
    return active;
  }

  return queryFirstVisible<HTMLElement>([
    "[role='dialog'] [contenteditable='true']",
    "[class*='modal'] [contenteditable='true']",
    "[class*='popover'] [contenteditable='true']",
    "[contenteditable='true']"
  ]);
}

function findJikeCircleOptionByCandidates(candidates: string[]): HTMLElement | undefined {
  for (const candidate of candidates) {
    const option = findJikeCircleOption(candidate);
    if (option) return option;
  }

  return undefined;
}

function findJikeCircleOption(circle: string): HTMLElement | undefined {
  const option =
    findVisibleElementByExactText<HTMLElement>(
      ["[role='option']", "[role='menuitem']", "button", "[role='button']", "li", "div", "span"],
      circle
    ) ??
    findVisibleElementByText<HTMLElement>(
      ["[role='option']", "[role='menuitem']", "button", "[role='button']", "li", "div", "span"],
      [circle]
    ) ??
    findElementByVisibleLabel(circle);

  return option?.closest<HTMLElement>("[role='option'], [role='menuitem'], button, [role='button'], li, [class*='item']") ?? option;
}

function getJikeCircleSearchTerms(circle: string): string[] {
  const terms = [
    circle.replace(/不一定对$/, ""),
    circle.replace(/^一个/, ""),
    circle
  ];

  return uniqueNonEmpty(terms);
}

function getJikeCircleMatchTerms(circle: string): string[] {
  const terms = [
    circle,
    circle.replace(/^一个/, ""),
    circle.replace(/不一定对$/, "")
  ];

  return uniqueNonEmpty(terms);
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getElementArea(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return rect.width * rect.height;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function scrollJikeCircleRows(left: number): void {
  const containers = findJikeScrollableCircleContainers();

  for (const element of containers) {
    element.scrollLeft = left;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  }
}
