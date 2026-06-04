import type { PlatformId } from "../shared/platforms";
import type { PlatformFillPayload, PlatformResult } from "../shared/types";
import {
  clickElement,
  clickFirstAvailable,
  describeError,
  ensureEditableTextMatches,
  findVisibleElementByText,
  isDisabled,
  isVisible,
  normalizeText,
  queryFirstVisible,
  repairEditableTextIfDuplicated,
  refreshEditableTextState,
  setEditableText,
  sleep,
  uploadImagesFromDataUrls,
  waitForAnyVisible
} from "./dom";
import type { EditableTextStrategy } from "./dom";

export interface PlatformAdapter {
  id: PlatformId;
  checkLogin(): Promise<PlatformResult>;
  fill(payload: PlatformFillPayload): Promise<PlatformResult>;
}

export interface PlatformAdapterConfig {
  id: PlatformId;
  label: string;
  editorSelectors: string[];
  openComposerSelectors?: string[];
  openComposerTexts?: string[];
  imageInputSelectors: string[];
  imageButtonSelectors?: string[];
  imageButtonTexts?: string[];
  publishSelectors: string[];
  publishTexts: string[];
  loginSelectors?: string[];
  loginTexts?: string[];
  beforeFill?: (payload: PlatformFillPayload) => Promise<string | undefined>;
  afterFill?: (payload: PlatformFillPayload) => Promise<string | undefined>;
  editorTimeoutMs?: number;
  afterOpenDelayMs?: number;
  afterFillDelayMs?: number;
  preferLineByLineText?: boolean;
  disableLineByLineText?: boolean;
  directDuplicateRepair?: boolean;
  verifyTextAfterFill?: boolean;
  textStrategy?: EditableTextStrategy;
  preferPasteText?: boolean;
  preferHtmlText?: boolean;
  forceDirectText?: boolean;
  refreshBeforePublish?: boolean;
  restoreTextAfterImageUpload?: boolean;
}

const BUTTON_LIKE_SELECTORS = ["button", "[role='button']", "a", "div[role='button']"];
const PUBLISH_BUTTON_TIMEOUT_MS = 6_000;
const PUBLISH_BUTTON_POLL_MS = 300;

type PublishButtonSearchResult =
  | { status: "ready"; button: HTMLElement }
  | { status: "disabled" | "missing" };

export function createGenericAdapter(config: PlatformAdapterConfig): PlatformAdapter {
  return {
    id: config.id,
    async checkLogin() {
      try {
        if (looksLoggedOut(config) && !queryFirstVisible(config.editorSelectors)) {
          return result(config.id, "needs-login", makeLoginMessage(config.label));
        }

        await openComposerIfNeeded(config);

        const editor = await waitForAnyVisible(config.editorSelectors, Math.min(config.editorTimeoutMs ?? 18_000, 10_000));
        if (editor && !looksLoggedOut(config)) {
          return result(config.id, "ready", `${config.label} 已登录，可以开始分发。`);
        }

        return result(config.id, "needs-login", makeLoginMessage(config.label));
      } catch (error) {
        if (looksLoggedOut(config)) {
          return result(config.id, "needs-login", makeLoginMessage(config.label));
        }

        return result(
          config.id,
          "manual",
          `${config.label} 无法自动确认登录状态：${describeError(error)}。请在打开的标签页确认已登录。`
        );
      }
    },
    async fill(payload) {
      try {
        if (looksLoggedOut(config) && !queryFirstVisible(config.editorSelectors)) {
          return result(config.id, "needs-login", makeLoginMessage(config.label));
        }

        await openComposerIfNeeded(config);

        const warnings: string[] = [];
        const beforeFillWarning = await runOptionalStep(config.beforeFill, payload);
        if (beforeFillWarning) warnings.push(beforeFillWarning);

        let editor = await waitForAnyVisible(config.editorSelectors, config.editorTimeoutMs ?? 18_000);
        const textOptions = {
          strategy: config.textStrategy,
          preferLineByLine: config.preferLineByLineText,
          disableLineByLine: config.disableLineByLineText,
          preferPaste: config.preferPasteText,
          preferHtml: config.preferHtmlText,
          forceDirect: config.forceDirectText
        };
        setEditableText(editor, payload.text, textOptions);
        await sleep(config.afterFillDelayMs ?? 700);

        if (
          repairEditableTextIfDuplicated(editor, payload.text, {
            ...textOptions,
            preferLineByLine: config.directDuplicateRepair ? false : true,
            forceDirect: config.directDuplicateRepair
          })
        ) {
          await sleep(350);
        }

        if (config.verifyTextAfterFill !== false) {
          const fullTextFilled = await ensureEditableTextMatches(editor, payload.text, textOptions);
          if (!fullTextFilled) return result(config.id, "manual", makeTextMismatchMessage(config.label));
        }

        const afterFillWarning = await runOptionalStep(config.afterFill, payload);
        if (afterFillWarning) warnings.push(afterFillWarning);

        const images = getPayloadImages(payload);
        if (images.length) {
          try {
            await uploadImagesFromDataUrls({
              images,
              inputSelectors: config.imageInputSelectors,
              openerSelectors: config.imageButtonSelectors,
              openerTexts: config.imageButtonTexts,
              openerTextSelectors: BUTTON_LIKE_SELECTORS
            });
            if (config.restoreTextAfterImageUpload) {
              await sleep(500);
              editor = queryFirstVisible(config.editorSelectors) ?? editor;
              const textStillPresent = await ensureEditableTextMatches(editor, payload.text, textOptions);
              if (!textStillPresent) {
                return result(config.id, "manual", makeTextLostAfterImageMessage(config.label));
              }
            }
          } catch (error) {
            return result(config.id, "manual", makeImageUploadMessage(config.label, error, images.length));
          }
        }

        if (payload.mode === "auto" && warnings.length) {
          return result(config.id, "manual", `${config.label} 已填入草稿，但${warnings.join("；")}。`);
        }

        if (payload.mode === "draft") {
          const suffix = warnings.length ? `；${warnings.join("；")}` : "";
          return result(config.id, "filled", `${config.label} 已填入草稿，停在发布前${suffix}。`);
        }

        if (config.refreshBeforePublish) {
          refreshEditableTextState(editor);
          await sleep(350);
        }

        const publishButton = await waitForPublishButton(config);
        if (publishButton.status !== "ready") {
          return result(config.id, "manual", makePublishButtonMessage(config.label, publishButton.status));
        }

        clickElement(publishButton.button);
        await sleep(1_000);
        return result(config.id, "published", `${config.label} 已点击发布按钮。`);
      } catch (error) {
        if (looksLoggedOut(config)) {
          return result(config.id, "needs-login", makeLoginMessage(config.label));
        }

        return result(config.id, "failed", makeUnhandledFillMessage(config.label, error));
      }
    }
  };
}

function makeTextMismatchMessage(label: string): string {
  return `${label} 正文填充不完整：发布框里的内容和 FlowPost 输入框不一致，已停在草稿页，请手动检查正文。`;
}

function makeTextLostAfterImageMessage(label: string): string {
  return `${label} 图片上传后正文丢失或不完整：已尝试补回但没有成功，请先检查正文再发布。`;
}

function makeImageUploadMessage(label: string, error: unknown, imageCount: number): string {
  const detail = describeError(error);

  if (detail.includes("找不到图片上传入口")) {
    return `${label} 正文已填入，但没有找到图片上传入口：可能是图片按钮没加载或平台页面结构变化，请手动上传 ${imageCount} 张图片。`;
  }

  if (detail.includes("图片数据无效")) {
    return `${label} 正文已填入，但图片数据无效：请重新选择或粘贴图片后再试。`;
  }

  return `${label} 正文已填入，但图片上传失败：${detail}。请检查图片后手动处理。`;
}

function makePublishButtonMessage(label: string, status: Exclude<PublishButtonSearchResult["status"], "ready">): string {
  if (status === "disabled") {
    return `${label} 已填入草稿，但发布按钮尚未就绪：通常是图片/链接预览还在处理，或平台没有识别到正文，请手动确认后点击发布。`;
  }

  return `${label} 已填入草稿，但没有识别到发布按钮：可能是平台页面改版，请手动点击发布。`;
}

function makeUnhandledFillMessage(label: string, error: unknown): string {
  const detail = describeError(error);

  if (detail.includes("找不到页面元素")) {
    return `${label} 找不到发布框：可能是未登录、页面加载太慢，或平台页面结构变化。`;
  }

  if (detail.includes("找不到按钮")) {
    return `${label} 找不到需要点击的按钮：可能是页面语言、布局或平台结构变化。`;
  }

  return `${label} 处理失败：${detail}`;
}

async function runOptionalStep(
  step: ((payload: PlatformFillPayload) => Promise<string | undefined>) | undefined,
  payload: PlatformFillPayload
): Promise<string | undefined> {
  if (!step) return undefined;

  try {
    return await step(payload);
  } catch (error) {
    return describeError(error);
  }
}

async function openComposerIfNeeded(config: PlatformAdapterConfig): Promise<void> {
  if (queryFirstVisible(config.editorSelectors)) return;

  const clicked = await clickFirstAvailable({
    selectors: config.openComposerSelectors,
    texts: config.openComposerTexts,
    textSelectors: BUTTON_LIKE_SELECTORS,
    timeoutMs: 3_000
  });

  if (clicked) {
    await sleep(config.afterOpenDelayMs ?? 900);
  }
}

async function waitForPublishButton(config: PlatformAdapterConfig): Promise<PublishButtonSearchResult> {
  const deadline = Date.now() + PUBLISH_BUTTON_TIMEOUT_MS;
  let sawDisabledButton = false;

  while (Date.now() <= deadline) {
    const direct = findClickableElementBySelectors(config.publishSelectors);
    if (direct.button) return { status: "ready", button: direct.button };
    if (direct.sawDisabled) sawDisabledButton = true;

    const byText = findClickableElementByText(BUTTON_LIKE_SELECTORS, config.publishTexts);
    if (byText.button) return { status: "ready", button: byText.button };
    if (byText.sawDisabled) sawDisabledButton = true;

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(PUBLISH_BUTTON_POLL_MS, remainingMs));
  }

  return { status: sawDisabledButton ? "disabled" : "missing" };
}

function findClickableElementBySelectors(selectors: string[]): { button?: HTMLElement; sawDisabled: boolean } {
  let sawDisabled = false;

  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isVisible);
    const enabled = elements.find((element) => !isDisabled(element));
    if (enabled) return { button: enabled, sawDisabled };
    if (elements.length) sawDisabled = true;
  }

  return { sawDisabled };
}

function findClickableElementByText(
  selectors: string[],
  texts: string[]
): { button?: HTMLElement; sawDisabled: boolean } {
  const wanted = texts.map(normalizeText);
  let sawDisabled = false;

  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter((element) => {
      if (!isVisible(element)) return false;
      const label = normalizeText(
        [
          element.textContent ?? "",
          element.getAttribute("aria-label") ?? "",
          element.getAttribute("title") ?? "",
          element.getAttribute("data-control-name") ?? ""
        ].join(" ")
      );
      return wanted.some((text) => label.includes(text));
    });

    const enabled = elements.find((element) => !isDisabled(element));
    if (enabled) return { button: enabled, sawDisabled };
    if (elements.length) sawDisabled = true;
  }

  return { sawDisabled };
}

function looksLoggedOut(config: PlatformAdapterConfig): boolean {
  const selectorMatch = config.loginSelectors?.length ? queryFirstVisible(config.loginSelectors) : undefined;
  if (selectorMatch) return true;

  const textMatch = config.loginTexts?.length
    ? findVisibleElementByText(BUTTON_LIKE_SELECTORS, config.loginTexts)
    : undefined;

  return Boolean(textMatch);
}

function makeLoginMessage(label: string): string {
  return `${label} 需要先登录：请在刚打开的 ${label} 标签页完成登录，再回到 FlowPost 重新开始分发。FlowPost 不保存账号密码。`;
}

function result(platform: PlatformId, status: PlatformResult["status"], message: string): PlatformResult {
  return {
    platform,
    status,
    message,
    at: Date.now(),
    url: window.location.href
  };
}

function getPayloadImages(payload: PlatformFillPayload) {
  return payload.images?.length ? payload.images : payload.image ? [payload.image] : [];
}
