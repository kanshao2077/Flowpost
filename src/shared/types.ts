import type { PlatformId, PlatformStatus, PublishMode } from "./platforms";

export interface MediaAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
}

export interface DraftSnapshot {
  text: string;
  image?: MediaAttachment;
  images: MediaAttachment[];
  selectedPlatforms: PlatformId[];
  mode: PublishMode;
  jikeCircle?: string;
  updatedAt: number;
}

export interface DistributionRequest {
  id: string;
  text: string;
  image?: MediaAttachment;
  images: MediaAttachment[];
  platforms: PlatformId[];
  mode: PublishMode;
  jikeCircle?: string;
  createdAt: number;
}

export interface PlatformResult {
  platform: PlatformId;
  status: PlatformStatus;
  message: string;
  tabId?: number;
  url?: string;
  at: number;
}

export interface JobState {
  id: string;
  request: DistributionRequest;
  status: "running" | "complete" | "failed";
  results: PlatformResult[];
  startedAt: number;
  finishedAt?: number;
}

export interface PlatformFillPayload {
  platform: PlatformId;
  text: string;
  image?: MediaAttachment;
  images: MediaAttachment[];
  mode: PublishMode;
  jikeCircle?: string;
}
