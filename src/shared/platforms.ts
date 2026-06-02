export type PlatformId = "x" | "linkedin" | "jike" | "substack";

export type PublishMode = "draft" | "auto";

export type PlatformStatus =
  | "queued"
  | "opening"
  | "ready"
  | "filled"
  | "published"
  | "manual"
  | "needs-login"
  | "cancelled"
  | "failed";

export interface PlatformDefinition {
  id: PlatformId;
  label: string;
  shortLabel: string;
  composeUrl: string;
  accent: string;
}

export const PLATFORMS: Record<PlatformId, PlatformDefinition> = {
  x: {
    id: "x",
    label: "X / Twitter",
    shortLabel: "X",
    composeUrl: "https://x.com/compose/post",
    accent: "#111111"
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    shortLabel: "in",
    composeUrl: "https://www.linkedin.com/feed/?shareActive=true",
    accent: "#276fbf"
  },
  jike: {
    id: "jike",
    label: "即刻",
    shortLabel: "即",
    composeUrl: "https://web.okjike.com/",
    accent: "#f2c94c"
  },
  substack: {
    id: "substack",
    label: "Substack Notes",
    shortLabel: "S",
    composeUrl: "https://substack.com/",
    accent: "#ff6719"
  }
};

export const PLATFORM_ORDER: PlatformId[] = ["jike", "x", "substack", "linkedin"];

export const DEFAULT_PLATFORMS: PlatformId[] = [...PLATFORM_ORDER];

export const JIKE_CIRCLES = [
  "一个想法不一定对",
  "有谁比我惨",
  "这些社会新闻都是真的",
  "信息流的黑色幽默",
  "即友日记本",
  "自我管理互助会",
  "值得一看的互联网报道",
  "买买买俱乐部",
  "生活小姿势",
  "还有这种操作",
  "读书会",
  "AI 探索站",
  "一起来学习",
  "不好笑便利店",
  "今天很开心",
  "今日烂梗",
  "沙雕电视台",
  "科技圈大小事"
] as const;

export const DEFAULT_JIKE_CIRCLE = JIKE_CIRCLES[0];

export function getPlatform(id: PlatformId): PlatformDefinition {
  return PLATFORMS[id];
}
