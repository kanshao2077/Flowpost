export type PlatformId =
  | "x"
  | "linkedin"
  | "jike"
  | "substack"
  | "xiaohongshu"
  | "douyin"
  | "wechatChannels"
  | "watcha";

export type PublishMode = "draft" | "auto";

export type PlatformStatus =
  | "queued"
  | "opening"
  | "ready"
  | "filled"
  | "publish-pending"
  | "published"
  | "manual"
  | "needs-login"
  | "cancelled"
  | "failed";

export interface PlatformDefinition {
  id: PlatformId;
  label: string;
  logoPath: string;
  composeUrl: string;
  accent: string;
}

export const PLATFORMS: Record<PlatformId, PlatformDefinition> = {
  x: {
    id: "x",
    label: "X / Twitter",
    logoPath: "/platforms/x.svg",
    composeUrl: "https://x.com/compose/post",
    accent: "#111111"
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    logoPath: "/platforms/linkedin.png",
    composeUrl: "https://www.linkedin.com/feed/?shareActive=true",
    accent: "#276fbf"
  },
  jike: {
    id: "jike",
    label: "即刻",
    logoPath: "/platforms/jike.png",
    composeUrl: "https://web.okjike.com/",
    accent: "#f2c94c"
  },
  substack: {
    id: "substack",
    label: "Substack Notes",
    logoPath: "/platforms/substack.svg",
    composeUrl: "https://substack.com/",
    accent: "#ff6719"
  },
  xiaohongshu: {
    id: "xiaohongshu",
    label: "小红书",
    logoPath: "/platforms/xiaohongshu.png",
    composeUrl: "https://creator.xiaohongshu.com/publish/publish?from=flowpost&target=image",
    accent: "#ff2442"
  },
  douyin: {
    id: "douyin",
    label: "抖音",
    logoPath: "/platforms/douyin.png",
    composeUrl: "https://creator.douyin.com/creator-micro/content/publish-media/image-text",
    accent: "#fe2c55"
  },
  wechatChannels: {
    id: "wechatChannels",
    label: "视频号",
    logoPath: "/platforms/wechat-channels.png",
    composeUrl: "https://channels.weixin.qq.com/platform/post/finderNewLifeCreate",
    accent: "#fa9d3b"
  },
  watcha: {
    id: "watcha",
    label: "观猹",
    logoPath: "/platforms/watcha.png",
    composeUrl: "https://watcha.cn/square/discuss",
    accent: "#33a66d"
  }
};

export const PLATFORM_ORDER: PlatformId[] = [
  "jike",
  "x",
  "xiaohongshu",
  "douyin",
  "wechatChannels",
  "watcha",
  "substack",
  "linkedin"
];

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
  "AI探索站",
  "一起来学习",
  "不好笑便利店",
  "今天很开心",
  "今日烂梗",
  "沙雕电视台",
  "科技圈大小事",
  "机器人讨论组",
  "无用但有趣的冷知识",
  "优质长文分享会",
  "手帐爱好者俱乐部",
  "喜欢逛书店",
  "刘慈欣书友会",
  "家居生活指南",
  "即友的周末生活",
  "植物爱好者俱乐部",
  "极简生活",
  "职场那些事儿",
  "实习那些事",
  "老师的日常",
  "副业探索小分队",
  "一起看电影",
  "我在音乐演出现场",
  "音乐人的日常",
  "今日份的摄影",
  "摄影入门学习小组",
  "街头摄影扫街组",
  "手机摄影交流站",
  "失败摄影大赏",
  "旅行攻略分享组",
  "去过的好玩的地方",
  "这个城市绝了",
  "国内美食探店团",
  "深夜放毒报社",
  "今天吃什么",
  "我们都爱运动",
  "游戏玩家的日常",
  "独立游戏爱好者",
  "即刻数码站",
  "SONY机友俱乐部",
  "萌宠动物星球",
  "养猫经验分享组",
  "有什么好东西值得买",
  "好贵但想买",
  "今天不开心",
  "今日小确幸",
  "浴室沉思",
  "今日金句",
  "设计师的日常",
  "产品安利社",
  "产品经理的日常",
  "大产品小细节",
  "创业者的日常",
  "NASA爱好者",
  "我来做即刻产品经理",
  "又有即友在互联网火了"
] as const;

export const DEFAULT_JIKE_CIRCLE = JIKE_CIRCLES[0];

export function getPlatform(id: PlatformId): PlatformDefinition {
  return PLATFORMS[id];
}
