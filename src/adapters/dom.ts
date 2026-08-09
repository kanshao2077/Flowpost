import type { MediaAttachment } from "../shared/types";

export const DEFAULT_TIMEOUT_MS = 18_000;

export type EditableTextStrategy = "auto" | "direct" | "line-by-line" | "paste" | "html-paragraphs";

export interface EditableTextOptions {
  strategy?: EditableTextStrategy;
  preferLineByLine?: boolean;
  disableLineByLine?: boolean;
  forceDirect?: boolean;
  preferPaste?: boolean;
  preferHtml?: boolean;
}

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

export function setEditableText(element: Element, text: string, options: EditableTextOptions = {}): void {
  const normalizedText = normalizeLineEndings(text);

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    element.scrollIntoView({ block: "center", inline: "nearest" });
    element.focus();
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value");
    descriptor?.set?.call(element, normalizedText);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: normalizedText }));
    dispatchTextCommitEvents(element);
    return;
  }

  if (!(element instanceof HTMLElement)) {
    throw new Error("编辑器不是可输入元素");
  }

  element.scrollIntoView({ block: "center", inline: "nearest" });
  element.focus();

  const strategy = options.strategy ?? "auto";

  if (strategy === "direct" || options.forceDirect) {
    setContentEditableTextDirectly(element, normalizedText);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertReplacementText", data: normalizedText }));
    dispatchTextCommitEvents(element);
    return;
  }

  if (strategy === "html-paragraphs") {
    if (setContentEditableTextWithHtmlParagraphs(element, normalizedText)) {
      dispatchInputEvent(element, "insertHTML", normalizedText);
      dispatchTextCommitEvents(element);
      return;
    }
    setContentEditableTextDirectly(element, normalizedText);
    dispatchInputEvent(element, "insertReplacementText", normalizedText);
    dispatchTextCommitEvents(element);
    return;
  }

  if (strategy === "line-by-line") {
    if (setContentEditableTextLineByLine(element, normalizedText)) {
      dispatchInputEvent(element, "insertText", normalizedText);
      dispatchTextCommitEvents(element);
      return;
    }
    setContentEditableTextDirectly(element, normalizedText);
    dispatchInputEvent(element, "insertReplacementText", normalizedText);
    dispatchTextCommitEvents(element);
    return;
  }

  if (strategy === "paste") {
    if (setContentEditableTextByPaste(element, normalizedText) && isEditableTextMatch(element, normalizedText)) {
      dispatchTextCommitEvents(element);
      return;
    }
    setContentEditableTextDirectly(element, normalizedText);
    dispatchInputEvent(element, "insertReplacementText", normalizedText);
    dispatchTextCommitEvents(element);
    return;
  }

  if (normalizedText.includes("\n")) {
    if (options.preferHtml && setContentEditableTextWithHtmlParagraphs(element, normalizedText) && isEditableTextMatch(element, normalizedText)) {
      dispatchInputEvent(element, "insertHTML", normalizedText);
      dispatchTextCommitEvents(element);
      return;
    }

    if (setContentEditableTextWithPlainInsert(element, normalizedText) && isEditableTextMatch(element, normalizedText)) {
      dispatchInputEvent(element, "insertText", normalizedText);
      dispatchTextCommitEvents(element);
      return;
    }

    if (
      !options.disableLineByLine &&
      setContentEditableTextLineByLine(element, normalizedText) &&
      isEditableTextMatch(element, normalizedText)
    ) {
      dispatchInputEvent(element, "insertText", normalizedText);
      dispatchTextCommitEvents(element);
      return;
    }

    if (options.preferPaste && setContentEditableTextByPaste(element, normalizedText) && isEditableTextMatch(element, normalizedText)) {
      dispatchTextCommitEvents(element);
      return;
    }

    setContentEditableTextDirectly(element, normalizedText);
    dispatchInputEvent(element, "insertReplacementText", normalizedText);
    dispatchTextCommitEvents(element);
    return;
  }

  selectEditableContents(element);
  const inserted = document.execCommand("insertText", false, normalizedText);
  if (!inserted) {
    if (options.disableLineByLine || !setContentEditableTextLineByLine(element, normalizedText)) {
      setContentEditableTextDirectly(element, normalizedText);
      dispatchInputEvent(element, "insertReplacementText", normalizedText);
    }
  }

  dispatchTextCommitEvents(element);
}

export async function ensureEditableTextMatches(
  element: Element,
  expectedText: string,
  options: EditableTextOptions = {}
): Promise<boolean> {
  if (isEditableTextMatch(element, expectedText)) return true;

  const retryOptions = { ...options, preferLineByLine: !options.disableLineByLine };
  setEditableText(element, expectedText, retryOptions);
  await sleep(350);

  return isEditableTextMatch(element, expectedText);
}

export function repairEditableTextIfDuplicated(
  element: Element,
  expectedText: string,
  options: EditableTextOptions = {}
): boolean {
  const expected = normalizeEditableSnapshot(expectedText);
  const actual = normalizeEditableSnapshot(getEditablePlainText(element));

  if (!expected || actual !== `${expected}${expected}`) return false;

  setEditableText(element, expectedText, { ...options, preferLineByLine: true });
  return true;
}

export function getEditablePlainText(element: Element): string {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value;
  if (element instanceof HTMLElement) return element.innerText || element.textContent || "";
  return element.textContent ?? "";
}

export function refreshEditableTextState(element: Element): void {
  if (!(element instanceof HTMLElement)) return;

  element.scrollIntoView({ block: "center", inline: "nearest" });
  element.focus();
  element.dispatchEvent(new FocusEvent("focus", { bubbles: true }));
  element.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText", data: "" }));
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "" }));
  document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  dispatchTextCommitEvents(element);
}

function setContentEditableTextDirectly(element: HTMLElement, text: string): void {
  element.textContent = "";
  element.innerHTML = "";
  const lines = normalizeLineEndings(text).split("\n");

  lines.forEach((line, index) => {
    if (index > 0) element.append(document.createElement("br"));
    if (line) element.append(document.createTextNode(line));
  });
}

function setContentEditableTextWithPlainInsert(element: HTMLElement, text: string): boolean {
  selectEditableContents(element);
  const deleted = document.execCommand("delete", false);
  if (!deleted) {
    setContentEditableTextDirectly(element, "");
    selectEditableContents(element);
  }

  return document.execCommand("insertText", false, normalizeLineEndings(text));
}

function setContentEditableTextWithHtmlParagraphs(element: HTMLElement, text: string): boolean {
  const html = normalizeLineEndings(text)
    .split("\n")
    .map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
    .join("");

  selectEditableContents(element);
  const deleted = document.execCommand("delete", false);
  if (!deleted) {
    setContentEditableTextDirectly(element, "");
    selectEditableContents(element);
  }

  return document.execCommand("insertHTML", false, html);
}

function setContentEditableTextByPaste(element: HTMLElement, text: string): boolean {
  const normalizedText = normalizeLineEndings(text);

  selectEditableContents(element);
  const deleted = document.execCommand("delete", false);
  if (!deleted) {
    setContentEditableTextDirectly(element, "");
    selectEditableContents(element);
  }

  const beforeInput = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertFromPaste",
    data: normalizedText
  });

  if (!element.dispatchEvent(beforeInput)) return false;

  const inserted = document.execCommand("insertText", false, normalizedText);
  if (!inserted) return false;

  element.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertFromPaste",
      data: normalizedText
    })
  );
  document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
  return true;
}

function setContentEditableTextLineByLine(element: HTMLElement, text: string): boolean {
  const normalizedText = normalizeLineEndings(text);
  const lines = normalizedText.split("\n");
  let commandFailed = false;

  selectEditableContents(element);
  const deleted = document.execCommand("delete", false);
  if (!deleted) {
    setContentEditableTextDirectly(element, "");
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (index > 0) {
      const lineBreakInserted =
        document.execCommand("insertText", false, "\n") ||
        document.execCommand("insertLineBreak", false) ||
        document.execCommand("insertParagraph", false);
      if (!lineBreakInserted) commandFailed = true;
    }

    const line = lines[index];
    if (line) {
      const lineInserted = document.execCommand("insertText", false, line);
      if (!lineInserted) commandFailed = true;
    }
  }

  return !commandFailed;
}

function selectEditableContents(element: HTMLElement): void {
  element.focus();
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function dispatchTextCommitEvents(element: Element): void {
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
}

function dispatchInputEvent(element: Element, inputType: string, data: string): void {
  element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType, data }));
}

export function isEditableTextMatch(element: Element, expectedText: string): boolean {
  return normalizeEditableSnapshot(getEditablePlainText(element)) === normalizeEditableSnapshot(expectedText);
}

function normalizeEditableSnapshot(text: string): string {
  return normalizeLineEndings(text)
    .replace(/\u200b/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/g, " ").trim())
    .join("\n")
    .trim();
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
  if (descriptor?.set) {
    descriptor.set.call(input, dataTransfer.files);
  } else {
    input.files = dataTransfer.files;
  }

  input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
}
