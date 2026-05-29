import type { DistributionRequest, JobState, PlatformFillPayload, PlatformResult } from "./types";

export const MESSAGE_TYPES = {
  START_DISTRIBUTION: "START_DISTRIBUTION",
  GET_JOB_STATE: "GET_JOB_STATE",
  FILL_PLATFORM: "FILL_PLATFORM"
} as const;

export type StartDistributionMessage = {
  type: typeof MESSAGE_TYPES.START_DISTRIBUTION;
  payload: DistributionRequest;
};

export type GetJobStateMessage = {
  type: typeof MESSAGE_TYPES.GET_JOB_STATE;
};

export type FillPlatformMessage = {
  type: typeof MESSAGE_TYPES.FILL_PLATFORM;
  payload: PlatformFillPayload;
};

export type RuntimeMessage = StartDistributionMessage | GetJobStateMessage | FillPlatformMessage;

export type StartDistributionResponse = {
  ok: boolean;
  job?: JobState;
  error?: string;
};

export type GetJobStateResponse = {
  ok: boolean;
  job?: JobState;
  error?: string;
};

export type FillPlatformResponse = {
  ok: boolean;
  result?: PlatformResult;
  error?: string;
};

export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      Object.values(MESSAGE_TYPES).includes((value as { type: string }).type as RuntimeMessage["type"])
  );
}

export function isFillPlatformMessage(value: unknown): value is FillPlatformMessage {
  return isRuntimeMessage(value) && value.type === MESSAGE_TYPES.FILL_PLATFORM;
}
