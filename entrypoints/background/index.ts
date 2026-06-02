import { browser } from "wxt/browser";
import { getPlatform } from "../../src/shared/platforms";
import {
  MESSAGE_TYPES,
  isRuntimeMessage,
  type CheckLoginsResponse,
  type CheckPlatformLoginResponse,
  type FillPlatformResponse,
  type GetJobStateResponse,
  type StartDistributionResponse,
  type StopDistributionResponse
} from "../../src/shared/messages";
import { getJobState, saveDraft, saveJobState } from "../../src/shared/storage";
import type { DistributionRequest, JobState, PlatformFillPayload, PlatformResult } from "../../src/shared/types";

const cancelledJobIds = new Set<string>();

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

    if (message.type === MESSAGE_TYPES.STOP_DISTRIBUTION) {
      void stopCurrentDistribution()
        .then((job): StopDistributionResponse => ({ ok: true, job }))
        .catch((error): StopDistributionResponse => ({ ok: false, error: describeError(error) }))
        .then(sendResponse);
      return true;
    }

    if (message.type === MESSAGE_TYPES.CHECK_LOGINS) {
      void checkPlatformLogins(message.payload.platforms)
        .then((results): CheckLoginsResponse => ({ ok: true, results }))
        .catch((error): CheckLoginsResponse => ({ ok: false, error: describeError(error) }))
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

  let tabGroupId: number | undefined;

  for (const platform of request.platforms) {
    if (await isJobCancelled(request.id)) return (await getJobState()) ?? job;

    const definition = getPlatform(platform);
    job = upsertResult(job, makeResult(platform, "opening", `正在打开 ${definition.label}。`, undefined, definition.composeUrl));
    await saveJobState(job);

    try {
      if (await isJobCancelled(request.id)) return (await getJobState()) ?? job;

      const tab = await browser.tabs.create({ url: definition.composeUrl, active: true });
      if (!tab.id) throw new Error("浏览器没有返回新标签页 ID");

      tabGroupId = await addTabToDistributionGroup(tab.id, tabGroupId);

      job = upsertResult(
        job,
        makeResult(platform, "opening", `${definition.label} 页面已打开，等待加载。`, tab.id, definition.composeUrl)
      );
      await saveJobState(job);

      await waitForTabComplete(tab.id, request.id);
      if (await isJobCancelled(request.id)) return (await getJobState()) ?? job;

      const payload: PlatformFillPayload = {
        platform,
        text: request.text,
        image: images[0],
        images,
        mode: request.mode,
        jikeCircle: request.jikeCircle
      };

      const response = await sendFillMessageWithRetry(tab.id, payload, request.id);
      if (await isJobCancelled(request.id)) return (await getJobState()) ?? job;

      const result = response.result;

      if (!response.ok || !result) {
        throw new Error(response.error ?? "页面脚本没有返回结果");
      }

      job = upsertResult(job, { ...result, tabId: tab.id });
      await saveJobState(job);
    } catch (error) {
      if (await isJobCancelled(request.id)) return (await getJobState()) ?? job;
      job = upsertResult(job, makeResult(platform, "failed", `${definition.label} 失败：${describeError(error)}`));
      await saveJobState(job);
    }
  }

  if (await isJobCancelled(request.id)) return (await getJobState()) ?? job;

  job = {
    ...job,
    status: "complete",
    finishedAt: Date.now()
  };

  await saveJobState(job);
  return job;
}

async function stopCurrentDistribution(): Promise<JobState | undefined> {
  const job = await getJobState();
  if (!job || job.status !== "running") return job;

  cancelledJobIds.add(job.id);

  const cancelledJob: JobState = {
    ...job,
    status: "cancelled",
    results: job.results.map((result) =>
      result.status === "queued" || result.status === "opening"
        ? {
            ...result,
            status: "cancelled",
            message: `${getPlatform(result.platform).label} 已停止。`,
            at: Date.now()
          }
        : result
    ),
    finishedAt: Date.now()
  };

  await saveJobState(cancelledJob);
  return cancelledJob;
}

async function checkPlatformLogins(platforms: PlatformFillPayload["platform"][]): Promise<PlatformResult[]> {
  const results: PlatformResult[] = [];
  let tabGroupId: number | undefined;

  for (const platform of platforms) {
    const definition = getPlatform(platform);

    try {
      const tab = await browser.tabs.create({ url: definition.composeUrl, active: true });
      if (!tab.id) throw new Error("浏览器没有返回新标签页 ID");

      tabGroupId = await addTabToDistributionGroup(tab.id, tabGroupId);
      await waitForTabComplete(tab.id, `login-check-${platform}`);

      const response = await sendLoginCheckMessageWithRetry(tab.id, platform);
      if (!response.ok || !response.result) {
        throw new Error(response.error ?? "页面脚本没有返回登录检查结果");
      }

      results.push({ ...response.result, tabId: tab.id });
    } catch (error) {
      results.push(makeResult(platform, "manual", `${definition.label} 无法自动检查登录状态：${describeError(error)}。请打开平台页面确认。`));
    }
  }

  return results;
}

async function isJobCancelled(jobId: string): Promise<boolean> {
  if (cancelledJobIds.has(jobId)) return true;
  const job = await getJobState();
  return job?.id === jobId && job.status === "cancelled";
}

async function addTabToDistributionGroup(tabId: number, groupId: number | undefined): Promise<number | undefined> {
  try {
    const nextGroupId =
      groupId === undefined
        ? await browser.tabs.group({ tabIds: tabId })
        : await browser.tabs.group({ groupId, tabIds: tabId });

    if (groupId === undefined) {
      await browser.tabGroups.update(nextGroupId, {
        title: "FlowPost 分发",
        color: "yellow"
      });
    }

    return nextGroupId;
  } catch {
    return groupId;
  }
}

async function waitForTabComplete(tabId: number, jobId: string, timeoutMs = 45_000): Promise<void> {
  const current = await browser.tabs.get(tabId);
  if (current.status === "complete") return;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const softReadyId = globalThis.setTimeout(() => {
      settle(resolve);
    }, 8_000);
    const timeoutId = globalThis.setTimeout(() => {
      settle(() => reject(new Error("页面加载超时")));
    }, timeoutMs);

    const cancelCheckId = globalThis.setInterval(() => {
      void isJobCancelled(jobId).then((cancelled) => {
        if (cancelled) settle(() => resolve());
      });
    }, 500);

    const updateListener: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (updatedTabId, changeInfo): void => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      settle(resolve);
    };

    const removedListener: Parameters<typeof browser.tabs.onRemoved.addListener>[0] = (removedTabId): void => {
      if (removedTabId !== tabId) return;
      settle(() => reject(new Error("标签页已关闭")));
    };

    function settle(callback: () => void): void {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(softReadyId);
      globalThis.clearTimeout(timeoutId);
      globalThis.clearInterval(cancelCheckId);
      browser.tabs.onUpdated.removeListener(updateListener);
      browser.tabs.onRemoved.removeListener(removedListener);
      callback();
    }

    browser.tabs.onUpdated.addListener(updateListener);
    browser.tabs.onRemoved.addListener(removedListener);
  });
}

async function sendLoginCheckMessageWithRetry(
  tabId: number,
  platform: PlatformFillPayload["platform"]
): Promise<CheckPlatformLoginResponse> {
  let lastError = "页面脚本未就绪";

  for (let attempt = 0; attempt < 18; attempt += 1) {
    try {
      await browser.tabs.get(tabId);
    } catch {
      return { ok: false, error: "标签页已关闭" };
    }

    try {
      return await browser.tabs.sendMessage(tabId, {
        type: MESSAGE_TYPES.CHECK_PLATFORM_LOGIN,
        payload: { platform }
      });
    } catch (error) {
      lastError = describeError(error);
      await sleep(500);
    }
  }

  return { ok: false, error: lastError };
}

async function sendFillMessageWithRetry(
  tabId: number,
  payload: PlatformFillPayload,
  jobId: string
): Promise<FillPlatformResponse> {
  let lastError = "页面脚本未就绪";

  for (let attempt = 0; attempt < 18; attempt += 1) {
    if (await isJobCancelled(jobId)) return { ok: false, error: "分发已停止" };

    try {
      await browser.tabs.get(tabId);
    } catch {
      return { ok: false, error: "标签页已关闭" };
    }

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
