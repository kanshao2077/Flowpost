import { browser } from "wxt/browser";
import { getPlatform } from "../../src/shared/platforms";
import { MESSAGE_TYPES, isRuntimeMessage, type FillPlatformResponse, type GetJobStateResponse, type StartDistributionResponse } from "../../src/shared/messages";
import { getJobState, saveDraft, saveJobState } from "../../src/shared/storage";
import type { DistributionRequest, JobState, PlatformFillPayload, PlatformResult } from "../../src/shared/types";

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => {
    void openOptionsPage();
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isRuntimeMessage(message)) return undefined;

    if (message.type === MESSAGE_TYPES.GET_JOB_STATE) {
      void getJobState()
        .then((job): GetJobStateResponse => ({ ok: true, job }))
        .catch((error): GetJobStateResponse => ({ ok: false, error: describeError(error) }))
        .then(sendResponse);
      return true;
    }

    if (message.type === MESSAGE_TYPES.START_DISTRIBUTION) {
      void runDistribution(message.payload)
        .then((job): StartDistributionResponse => ({ ok: true, job }))
        .catch((error): StartDistributionResponse => ({ ok: false, error: describeError(error) }))
        .then(sendResponse);
      return true;
    }

    return undefined;
  });
});

async function openOptionsPage(): Promise<void> {
  const optionsUrl = browser.runtime.getURL("/options.html");
  const existingTabs = await browser.tabs.query({ url: optionsUrl });
  const existingTab = existingTabs[0];

  if (existingTab?.id) {
    await browser.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId) {
      await browser.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  await browser.tabs.create({ url: optionsUrl, active: true });
}

async function runDistribution(request: DistributionRequest): Promise<JobState> {
  const images = request.images?.length ? request.images : request.image ? [request.image] : [];
  const normalizedRequest: DistributionRequest = {
    ...request,
    image: images[0],
    images
  };

  await saveDraft({
    text: request.text,
    image: images[0],
    images,
    selectedPlatforms: request.platforms,
    mode: request.mode,
    jikeCircle: request.jikeCircle,
    updatedAt: Date.now()
  });

  let job: JobState = {
    id: request.id,
    request: normalizedRequest,
    status: "running",
    results: request.platforms.map((platform) => makeResult(platform, "queued", `${getPlatform(platform).label} 等待处理。`)),
    startedAt: Date.now()
  };

  await saveJobState(job);

  for (const platform of request.platforms) {
    const definition = getPlatform(platform);
    job = upsertResult(job, makeResult(platform, "opening", `正在打开 ${definition.label}。`, undefined, definition.composeUrl));
    await saveJobState(job);

    try {
      const tab = await browser.tabs.create({ url: definition.composeUrl, active: true });
      if (!tab.id) throw new Error("浏览器没有返回新标签页 ID");

      job = upsertResult(
        job,
        makeResult(platform, "opening", `${definition.label} 页面已打开，等待加载。`, tab.id, definition.composeUrl)
      );
      await saveJobState(job);

      await waitForTabComplete(tab.id);

      const payload: PlatformFillPayload = {
        platform,
        text: request.text,
        image: images[0],
        images,
        mode: request.mode,
        jikeCircle: request.jikeCircle
      };

      const response = await sendFillMessageWithRetry(tab.id, payload);
      const result = response.result;

      if (!response.ok || !result) {
        throw new Error(response.error ?? "页面脚本没有返回结果");
      }

      job = upsertResult(job, { ...result, tabId: tab.id });
      await saveJobState(job);
    } catch (error) {
      job = upsertResult(job, makeResult(platform, "failed", `${definition.label} 失败：${describeError(error)}`));
      await saveJobState(job);
    }
  }

  job = {
    ...job,
    status: "complete",
    finishedAt: Date.now()
  };

  await saveJobState(job);
  return job;
}

async function waitForTabComplete(tabId: number, timeoutMs = 45_000): Promise<void> {
  const current = await browser.tabs.get(tabId);
  if (current.status === "complete") return;

  await new Promise<void>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      reject(new Error("页面加载超时"));
    }, timeoutMs);

    const listener: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (updatedTabId, changeInfo): void => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      globalThis.clearTimeout(timeoutId);
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    };

    browser.tabs.onUpdated.addListener(listener);
  });
}

async function sendFillMessageWithRetry(tabId: number, payload: PlatformFillPayload): Promise<FillPlatformResponse> {
  let lastError = "页面脚本未就绪";

  for (let attempt = 0; attempt < 18; attempt += 1) {
    try {
      return await browser.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.FILL_PLATFORM,
        payload
      });
    } catch (error) {
      lastError = describeError(error);
      await sleep(500);
    }
  }

  return { ok: false, error: lastError };
}

function upsertResult(job: JobState, result: PlatformResult): JobState {
  const nextResults = job.results.map((candidate) => (candidate.platform === result.platform ? result : candidate));
  return {
    ...job,
    results: nextResults.some((candidate) => candidate.platform === result.platform) ? nextResults : [...nextResults, result]
  };
}

function makeResult(
  platform: PlatformResult["platform"],
  status: PlatformResult["status"],
  message: string,
  tabId?: number,
  url?: string
): PlatformResult {
  return {
    platform,
    status,
    message,
    tabId,
    url,
    at: Date.now()
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
