import type { MediaAttachment } from "../shared/types";

export const DEFAULT_TIMEOUT_MS = 18_000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

export function isDisabled(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return true;
  return (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    Boolean(element.closest("[disabled], [aria-disabled='true']"))
  );
}

export function queryFirstVisible<T extends Element = HTMLElement>(selectors: string[]): T | undefined {
  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll<T>(selector));
    const match = elements.find(isVisible);
    if (match) return match;
  }

  return undefined;
}

export function queryFirst<T extends Element = HTMLElement>(selectors: string[]): T | undefined {
  for (const selector of selectors) {
    const match = document.querySelector<T>(selector);
    if (match) return match;
  }

  return undefined;
}

export async function waitForAnyVisible<T extends Element = HTMLElement>(
  selectors: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const match = queryFirstVisible<T>(selectors);
    if (match) return match;
    await sleep(250);
  }

  throw new Error(`找不到页面元素：${selectors.join(", ")}`);
}

export function findVisibleElementByText<T extends HTMLElement = HTMLElement>(
  selectors: string[],
  texts: string[]
): T | undefined {
  const wanted = texts.map(normalizeText);

  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll<T>(selector));
    const match = elements.find((element) => {
      if (!isVisible(element)) return false;
      const haystack = normalizeText(
        [
          element.textContent ?? "",
          element.getAttribute("aria-label") ?? "",
          element.getAttribute("title") ?? "",
          element.getAttribute("data-control-name") ?? ""
        ].join(" ")
      );
      return wanted.some((text) => haystack.includes(text));
    });

    if (match) return match;
  }

  return undefined;
}

export function findVisibleElementByExactText<T extends HTMLElement = HTMLElement>(
  selectors: string[],
  text: string
): T | undefined {
  const wanted = normalizeText(text);

  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll<T>(selector));
    const match = elements.find((element) => {
      if (!isVisible(element)) return false;
      const label = normalizeText(
        [
          element.textContent ?? "",
          element.getAttribute("aria-label") ?? "",
          element.getAttribute("title") ?? ""
        ].join(" ")
      );
      return label === wanted;
    });

    if (match) return match;
  }

  return undefined;
}

export async function waitForVisibleElementByText<T extends HTMLElement = HTMLElement>(
  selectors: string[],
  texts: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const match = findVisibleElementByText<T>(selectors, texts);
    if (match) return match;
    await sleep(250);
  }

  throw new Error(`找不到按钮：${texts.join(" / ")}`);
}

export function clickElement(element: Element): void {
  if (!(element instanceof HTMLElement)) {
    throw new Error("目标元素不能点击");
  }

  element.scrollIntoView({ block: "center", inline: "center" });
  const rect = element.getBoundingClientRect();
  const eventInit = {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  };
  element.focus();
  element.dispatchEvent(new PointerEvent("pointerdown", { ...eventInit, pointerType: "mouse" }));
  element.dispatchEvent(new MouseEvent("mousedown", eventInit));
  element.dispatchEvent(new PointerEvent("pointerup", { ...eventInit, pointerType: "mouse" }));
  element.dispatchEvent(new MouseEvent("mouseup", eventInit));
  element.click();
}

export function clickPoint(x: number, y: number): boolean {
  const target = document.elementFromPoint(x, y);
  if (!(target instanceof HTMLElement)) return false;

  const eventInit = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y
  };

  target.dispatchEvent(new PointerEvent("pointerdown", { ...eventInit, pointerType: "mouse" }));
  target.dispatchEvent(new MouseEvent("mousedown", eventInit));
  target.dispatchEvent(new PointerEvent("pointerup", { ...eventInit, pointerType: "mouse" }));
  target.dispatchEvent(new MouseEvent("mouseup", eventInit));
  target.click();
  return true;
}

export async function clickFirstAvailable(config: {
  selectors?: string[];
  texts?: string[];
  textSelectors?: string[];
  timeoutMs?: number;
}): Promise<HTMLElement | undefined> {
  const selectors = config.selectors ?? [];
  const textSelectors = config.textSelectors ?? ["button", "[role='button']", "a"];
  const timeoutMs = config.timeoutMs ?? 2_500;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const direct = queryFirstVisible<HTMLElement>(selectors);
    const byText = config.texts?.length ? findVisibleElementByText(textSelectors, config.texts) : undefined;
    const match = direct ?? byText;

    if (match && !isDisabled(match)) {
      clickElement(match);
      return match;
    }

    await sleep(250);
  }

  return undefined;
}

export function setEditableText(element: Element, text: string): void {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    element.scrollIntoView({ block: "center", inline: "nearest" });
    element.focus();
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    descriptor?.set?.call(element, text);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    dispatchTextCommitEvents(element);
    return;
  }

  if (!(element instanceof HTMLElement)) {
    throw new Error("编辑器不是可输入元素");
  }

  element.scrollIntoView({ block: "center", inline: "nearest" });
  element.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);

  document.execCommand("selectAll", false);

  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    setContentEditableTextDirectly(element, text);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: text }));
  }

  dispatchTextCommitEvents(element);
}

export function repairEditableTextIfDuplicated(element: Element, expectedText: string): boolean {
  const expected = normalizeEditableSnapshot(expectedText);
  const actual = normalizeEditableSnapshot(getEditablePlainText(element));

  if (!expected || actual !== `${expected}${expected}`) return false;

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    descriptor?.set?.call(element, expectedText);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: expectedText }));
    dispatchTextCommitEvents(element);
    return true;
  }

  if (!(element instanceof HTMLElement)) return false;

  setContentEditableTextDirectly(element, expectedText);
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: expectedText }));
  dispatchTextCommitEvents(element);
  return true;
}

export function getEditablePlainText(element: Element): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value;
  return element.textContent ?? "";
}

function setContentEditableTextDirectly(element: HTMLElement, text: string): void {
  element.textContent = "";
  element.innerHTML = "";
  element.append(document.createTextNode(text));
}

function dispatchTextCommitEvents(element: Element): void {
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}

function normalizeEditableSnapshot(text: string): string {
  return text.replace(/\u200b/g, "").replace(/\s+/g, "").trim();
}

export function dataUrlToFile(image: MediaAttachment): File {
  const [meta, encoded] = image.dataUrl.split(",");
  if (!meta || !encoded) throw new Error("图片数据无效");

  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? image.type;
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], image.name, { type: mime });
}

export async function uploadImageFromDataUrl(config: {
  image: MediaAttachment;
  inputSelectors: string[];
  openerSelectors?: string[];
  openerTexts?: string[];
  openerTextSelectors?: string[];
  timeoutMs?: number;
}): Promise<void> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let input = queryFirst<HTMLInputElement>(config.inputSelectors);

  if (!input) {
    await clickFirstAvailable({
      selectors: config.openerSelectors,
      texts: config.openerTexts,
      textSelectors: config.openerTextSelectors,
      timeoutMs: 2_000
    });
    const deadline = Date.now() + timeoutMs;
    while (!input && Date.now() < deadline) {
      input = queryFirst<HTMLInputElement>(config.inputSelectors);
      if (!input) await sleep(250);
    }
  }

  if (!input) throw new Error(`找不到图片上传入口：${config.inputSelectors.join(", ")}`);

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(dataUrlToFile(config.image));
  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));

  await sleep(1_200);
}

export async function uploadImagesFromDataUrls(config: {
  images: MediaAttachment[];
  inputSelectors: string[];
  openerSelectors?: string[];
  openerTexts?: string[];
  openerTextSelectors?: string[];
  timeoutMs?: number;
}): Promise<void> {
  if (!config.images.length) return;

  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let input = queryFirst<HTMLInputElement>(config.inputSelectors);

  if (!input) {
    await clickFirstAvailable({
      selectors: config.openerSelectors,
      texts: config.openerTexts,
      textSelectors: config.openerTextSelectors,
      timeoutMs: 2_000
    });
    const deadline = Date.now() + timeoutMs;
    while (!input && Date.now() < deadline) {
      input = queryFirst<HTMLInputElement>(config.inputSelectors);
      if (!input) await sleep(250);
    }
  }

  if (!input) throw new Error(`找不到图片上传入口：${config.inputSelectors.join(", ")}`);

  if (input.multiple || config.images.length === 1) {
    try {
      assignImagesToInput(input, config.images);
      await sleep(1_000 + config.images.length * 350);
      return;
    } catch {
      // Fall through to slower per-image assignment for platforms with custom upload controls.
    }
  }

  for (const image of config.images) {
    assignImagesToInput(input, [image]);
    await sleep(800);
  }
}

function assignImagesToInput(input: HTMLInputElement, images: MediaAttachment[]): void {
  const dataTransfer = new DataTransfer();
  for (const image of images) {
    dataTransfer.items.add(dataUrlToFile(image));
  }

  input.files = dataTransfer.files;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
