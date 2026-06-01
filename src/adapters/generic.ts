import type { PlatformId } from "../shared/platforms";
import type { PlatformFillPayload, PlatformResult } from "../shared/types";
import {
  clickElement,
  clickFirstAvailable,
  describeError,
  ensureEditableTextMatches,
  findVisibleElementByText,
  isDisabled,
  queryFirstVisible,
  repairEditableTextIfDuplicated,
  setEditableText,
  sleep,
  uploadImagesFromDataUrls,
  waitForAnyVisible,
  waitForVisibleElementByText
} from "./dom";

export interface PlatformAdapter {
  id: PlatformId;
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
}

const BUTTON_LIKE_SELECTORS = ["button", "[role='button']", "a", "div[role='button']"];

export function createGenericAdapter(config: PlatformAdapterConfig): PlatformAdapter {
  return {
    id: config.id,
    async fill(payload) {
      try {
        if (looksLoggedOut(config) && !queryFirstVisible(config.editorSelectors)) {
          return result(config.id, "needs-login", makeLoginMessage(config.label));
        }

        await openComposerIfNeeded(config);

        const warnings: string[] = [];
        const beforeFillWarning = await runOptionalStep(config.beforeFill, payload);
        if (beforeFillWarning) warnings.push(beforeFillWarning);

        const editor = await waitForAnyVisible(config.editorSelectors, config.editorTimeoutMs ?? 18_000);
        const textOptions = {
          preferLineByLine: config.preferLineByLineText,
          disableLineByLine: config.disableLineByLineText
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
          if (!fullTextFilled) {
            return result(config.id, "manual", `${config.label} 文本没有完整填入，已停在草稿页，请手动检查后再发布。`);
          }
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
          } catch (error) {
            return result(
              config.id,
              "manual",
              `${config.label} 文本已填入，但图片上传需要手动处理：${describeError(error)}`
            );
          }
        }

        if (payload.mode === "auto" && warnings.length) {
          return result(config.id, "manual", `${config.label} 已填入草稿，但${warnings.join("；")}。`);
        }

        if (payload.mode === "draft") {
          const suffix = warnings.length ? `；${warnings.join("；")}` : "";
          return result(config.id, "filled", `${config.label} 已填入草稿，停在发布前${suffix}。`);
        }

        const publishButton = await findPublishButton(config);
        if (!publishButton) {
          return result(config.id, "manual", `${config.label} 已填入草稿，但找不到可点击的发布按钮。`);
        }

        clickElement(publishButton);
        await sleep(1_000);
        return result(config.id, "published", `${config.label} 已点击发布按钮。`);
      } catch (error) {
        if (looksLoggedOut(config)) {
          return result(config.id, "needs-login", makeLoginMessage(config.label));
        }

        return result(config.id, "failed", `${config.label} 处理失败：${describeError(error)}`);
      }
    }
  };
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

async function findPublishButton(config: PlatformAdapterConfig): Promise<HTMLElement | undefined> {
  const direct = queryFirstVisible<HTMLElement>(config.publishSelectors);
  if (direct && !isDisabled(direct)) return direct;

  try {
    const byText = await waitForVisibleElementByText<HTMLElement>(
      BUTTON_LIKE_SELECTORS,
      config.publishTexts,
      4_000
    );
    if (!isDisabled(byText)) return byText;
  } catch {
    return undefined;
  }

  return undefined;
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
