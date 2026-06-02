import type { PlatformId } from "./platforms";
import type { DistributionRequest, JobState, PlatformFillPayload, PlatformResult } from "./types";

export const MESSAGE_TYPES = {
  START_DISTRIBUTION: "START_DISTRIBUTION",
  STOP_DISTRIBUTION: "STOP_DISTRIBUTION",
  GET_JOB_STATE: "GET_JOB_STATE",
  CHECK_LOGINS: "CHECK_LOGINS",
  CHECK_PLATFORM_LOGIN: "CHECK_PLATFORM_LOGIN",
  FILL_PLATFORM: "FILL_PLATFORM"
} as const;

export type StartDistributionMessage = {
  type: typeof MESSAGE_TYPES.START_DISTRIBUTION;
  payload: DistributionRequest;
};

export type StopDistributionMessage = {
  type: typeof MESSAGE_TYPES.STOP_DISTRIBUTION;
};

export type GetJobStateMessage = {
  type: typeof MESSAGE_TYPES.GET_JOB_STATE;
};

export type CheckLoginsMessage = {
  type: typeof MESSAGE_TYPES.CHECK_LOGINS;
  payload: {
    platforms: PlatformId[];
  };
};

export type CheckPlatformLoginMessage = {
  type: typeof MESSAGE_TYPES.CHECK_PLATFORM_LOGIN;
  payload: {
    platform: PlatformId;
  };
};

export type FillPlatformMessage = {
  type: typeof MESSAGE_TYPES.FILL_PLATFORM;
  payload: PlatformFillPayload;
};

export type RuntimeMessage =
  | StartDistributionMessage
  | StopDistributionMessage
  | GetJobStateMessage
  | CheckLoginsMessage
  | CheckPlatformLoginMessage
  | FillPlatformMessage;

export type StartDistributionResponse = {
  ok: boolean;
  job?: JobState;
  error?: string;
};

export type StopDistributionResponse = {
  ok: boolean;
  job?: JobState;
  error?: string;
};

export type GetJobStateResponse = {
  ok: boolean;
  job?: JobState;
  error?: string;
};

export type CheckLoginsResponse = {
  ok: boolean;
  results?: PlatformResult[];
  error?: string;
};

export type CheckPlatformLoginResponse = {
  ok: boolean;
  result?: PlatformResult;
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

export function isCheckPlatformLoginMessage(value: unknown): value is CheckPlatformLoginMessage {
  return isRuntimeMessage(value) && value.type === MESSAGE_TYPES.CHECK_PLATFORM_LOGIN;
}
