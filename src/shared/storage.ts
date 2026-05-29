import { browser } from "wxt/browser";
import { DEFAULT_JIKE_CIRCLE, DEFAULT_PLATFORMS } from "./platforms";
import type { DraftSnapshot, JobState } from "./types";

const STORAGE_KEYS = {
  DRAFT: "contentDistributor:draft",
  JOB: "contentDistributor:job"
} as const;

export const DEFAULT_DRAFT: DraftSnapshot = {
  text: "",
  images: [],
  selectedPlatforms: [...DEFAULT_PLATFORMS],
  mode: "draft",
  jikeCircle: DEFAULT_JIKE_CIRCLE,
  updatedAt: 0
};

export async function getDraft(): Promise<DraftSnapshot> {
  const result = await browser.storage.local.get(STORAGE_KEYS.DRAFT);
  const stored = result[STORAGE_KEYS.DRAFT] as Partial<DraftSnapshot> | undefined;
  const draft = {
    ...DEFAULT_DRAFT,
    ...stored
  };

  return {
    ...draft,
    images: draft.images?.length ? draft.images : draft.image ? [draft.image] : []
  };
}

export async function saveDraft(draft: DraftSnapshot): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.DRAFT]: {
      ...draft,
      updatedAt: Date.now()
    }
  });
}

export async function getJobState(): Promise<JobState | undefined> {
  const result = await browser.storage.local.get(STORAGE_KEYS.JOB);
  return result[STORAGE_KEYS.JOB] as JobState | undefined;
}

export async function saveJobState(job: JobState): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.JOB]: job
  });
}

export function onJobStateChanged(callback: (job: JobState) => void): () => void {
  const listener: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, areaName): void => {
    if (areaName !== "local") return;
    const change = changes[STORAGE_KEYS.JOB];
    if (!change?.newValue) return;
    callback(change.newValue as JobState);
  };

  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
