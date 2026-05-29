import React, { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Eraser,
  Play,
  Search,
  Send,
  SquarePen,
  Upload
} from "lucide-react";
import { browser } from "wxt/browser";
import "./style.css";
import { MESSAGE_TYPES, type StartDistributionResponse } from "../../src/shared/messages";
import {
  DEFAULT_JIKE_CIRCLE,
  DEFAULT_PLATFORMS,
  JIKE_CIRCLES,
  PLATFORM_ORDER,
  getPlatform,
  type PlatformId,
  type PublishMode
} from "../../src/shared/platforms";
import { getDraft, getJobState, onJobStateChanged, saveDraft } from "../../src/shared/storage";
import type { DistributionRequest, JobState, MediaAttachment, PlatformResult } from "../../src/shared/types";

const MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 9;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const QUICK_CIRCLE_COUNT = 9;
const LEGACY_JIKE_CIRCLES: Record<string, string> = {
  "AI 探索者": "AI 探索站",
  "汪星人的日常": DEFAULT_JIKE_CIRCLE,
  "我们都爱运动": DEFAULT_JIKE_CIRCLE,
  "今天有什么好哭的": DEFAULT_JIKE_CIRCLE
};
const FAQ_ITEMS = [
  {
    question: "FlowPost 是什么？",
    answer: "一个本地浏览器插件，用浏览器里已经登录的平台账号，把同一段文案和图片分发到即刻、X、Substack Notes 和 LinkedIn。"
  },
  {
    question: "怎么使用？",
    answer: "先写文案、粘贴或上传图片，再选择平台和即刻圈子，最后点击开始分发。默认只填充草稿，确认无误后你手动发布。"
  },
  {
    question: "会保存账号密码吗？",
    answer: "不会。FlowPost 不接管账号登录，只使用当前浏览器已有登录态；如果某个平台未登录，日志会提示你先登录。"
  },
  {
    question: "草稿和自动发布有什么区别？",
    answer: "填充草稿会停在发布前，更稳；尝试自动发布会点击发布按钮，但平台页面变动时可能失败，适合你确认稳定后再用。"
  },
  {
    question: "即刻圈子没选上怎么办？",
    answer: "先确认插件里选的圈子名称和即刻弹出的选项一致。若日志提示需要手动处理，通常是即刻页面结构变了或加载太慢。"
  },
  {
    question: "图片支持什么？",
    answer: "支持 PNG、JPG、WebP，最多 9 张。可以粘贴、选择文件，也可以直接拖动缩略图排序。"
  }
];

function App(): React.JSX.Element {
  const [text, setText] = useState("");
  const [images, setImages] = useState<MediaAttachment[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(DEFAULT_PLATFORMS);
  const [mode, setMode] = useState<PublishMode>("draft");
  const [jikeCircle, setJikeCircle] = useState<string>(DEFAULT_JIKE_CIRCLE);
  const [circleMenuOpen, setCircleMenuOpen] = useState(false);
  const [circleQuery, setCircleQuery] = useState("");
  const [job, setJob] = useState<JobState | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const [draggedImageId, setDraggedImageId] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const circlePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    void Promise.all([getDraft(), getJobState()]).then(([draft, storedJob]) => {
      if (!mounted) return;
      setText(draft.text);
      setImages(draft.images.slice(0, MAX_IMAGES));
      const storedPlatforms = normalizePlatformSelection(draft.selectedPlatforms);
      setSelectedPlatforms(storedPlatforms.length ? storedPlatforms : DEFAULT_PLATFORMS);
      setMode(draft.mode);
      setJikeCircle(normalizeJikeCircleSelection(draft.jikeCircle));
      setJob(storedJob);
      setReady(true);
    });

    const unsubscribe = onJobStateChanged((nextJob) => {
      if (mounted) setJob(nextJob);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const timeoutId = window.setTimeout(() => {
      void saveDraft({
        text,
        image: images[0],
        images,
        selectedPlatforms,
        mode,
        jikeCircle,
        updatedAt: Date.now()
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [images, jikeCircle, mode, ready, selectedPlatforms, text]);

  const latestResults = useMemo(() => job?.results ?? [], [job]);
  const quickCircleOptions = useMemo(() => JIKE_CIRCLES.slice(0, QUICK_CIRCLE_COUNT), []);
  const selectedPlatformLabels = useMemo(
    () => selectedPlatforms.map((platform) => getPlatform(platform).label).join(" / "),
    [selectedPlatforms]
  );
  const circleOptions = useMemo(() => {
    const query = normalizeCircleText(circleQuery);
    const options = JIKE_CIRCLES.filter((circle) => !query || normalizeCircleText(circle).includes(query));
    const currentIsPreset = JIKE_CIRCLES.some((circle) => circle === jikeCircle);
    return currentIsPreset || !jikeCircle.trim() ? options : [jikeCircle, ...options];
  }, [circleQuery, jikeCircle]);
  const isRunning = job?.status === "running";
  const characterCount = text.trim().length;
  const canStart = characterCount > 0 && selectedPlatforms.length > 0 && !isRunning;
  const jikeSelected = selectedPlatforms.includes("jike");
  const modeLabel = mode === "draft" ? "草稿" : "自动";

  useEffect(() => {
    if (!circleMenuOpen) return;

    function handlePointerDown(event: PointerEvent): void {
      if (!circlePickerRef.current?.contains(event.target as Node)) {
        setCircleMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setCircleMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [circleMenuOpen]);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) await addImagesFromFiles(files);
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLElement>): Promise<void> {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (!files.length) return;

    event.preventDefault();
    await addImagesFromFiles(files, "pasted-image");
  }

  async function addImagesFromFiles(files: File[], fallbackNamePrefix?: string): Promise<void> {
    setError(undefined);

    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) {
      setError(`最多支持 ${MAX_IMAGES} 张图片。`);
      return;
    }

    const attachments: MediaAttachment[] = [];
    const warnings: string[] = [];

    for (const [index, file] of files.slice(0, slots).entries()) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        warnings.push(`${file.name || "图片"} 格式不支持`);
        continue;
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        warnings.push(`${file.name || "图片"} 超过 4MB`);
        continue;
      }

      const dataUrl = await readFileAsDataUrl(file);
      attachments.push({
        id: crypto.randomUUID(),
        name: file.name || `${fallbackNamePrefix ?? "image"}-${images.length + index + 1}.png`,
        type: file.type,
        size: file.size,
        dataUrl
      });
    }

    if (files.length > slots) warnings.push(`最多支持 ${MAX_IMAGES} 张，已忽略多余图片`);

    if (!attachments.length) {
      setError(warnings[0] ?? "没有可用图片。");
      return;
    }

    setImages((current) => [...current, ...attachments].slice(0, MAX_IMAGES));
    if (warnings.length) setError(warnings.join("；"));
  }

  function togglePlatform(platform: PlatformId): void {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((candidate) => candidate !== platform)
        : PLATFORM_ORDER.filter((candidate) => current.includes(candidate) || candidate === platform)
    );
  }

  function clearContent(): void {
    setText("");
    setImages([]);
    setError(undefined);
  }

  function removeImage(id: string): void {
    setImages((current) => current.filter((image) => image.id !== id));
  }

  function moveImage(draggedId: string | undefined, targetId: string): void {
    if (!draggedId || draggedId === targetId) return;

    setImages((current) => {
      const from = current.findIndex((image) => image.id === draggedId);
      const to = current.findIndex((image) => image.id === targetId);
      if (from < 0 || to < 0) return current;

      const next = [...current];
      const [item] = next.splice(from, 1);
      if (!item) return current;
      next.splice(to, 0, item);
      return next;
    });
  }

  function chooseJikeCircle(circle: string): void {
    setJikeCircle(circle);
    setCircleQuery("");
    setCircleMenuOpen(false);
  }

  async function startDistribution(): Promise<void> {
    setError(undefined);

    if (!text.trim()) {
      setError("文案不能为空。");
      return;
    }

    if (!selectedPlatforms.length) {
      setError("至少选择一个平台。");
      return;
    }

    const request: DistributionRequest = {
      id: crypto.randomUUID(),
      text: text.trim(),
      image: images[0],
      images,
      platforms: selectedPlatforms,
      mode,
      jikeCircle,
      createdAt: Date.now()
    };

    const response = (await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.START_DISTRIBUTION,
      payload: request
    })) as StartDistributionResponse;

    if (!response.ok) {
      setError(response.error ?? "分发任务启动失败。");
      return;
    }

    if (response.job) setJob(response.job);
  }

  return (
    <main className="shell" onPaste={handlePaste}>
      <div className="content-scale">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <svg className="brand-glyph" viewBox="0 0 96 58" focusable="false">
                <path className="brand-glyph-main" d="M7 19h17v-6h9v6h38v-6h10v6h6.5c3.3 0 5.5 2.2 5.5 5.5V32H78v7H54.5l-7.2 6.6H33.8L30 39H14v-7H3v-8h4z" />
                <path className="brand-glyph-grip" d="M18.5 38.4h21.6L34.8 56H20.4l-7.2-17.6z" />
                <path className="brand-glyph-trigger-guard" d="M38.5 39h23.6v7.2H48.4c-4.6 0-7.3 2.8-7.3 7.8h-8.2c0-6.4 1.9-11.4 5.6-15z" />
                <rect className="brand-glyph-window" x="42" y="22.4" width="20" height="6.8" rx="1.1" />
                <rect className="brand-glyph-notch" x="18" y="22.4" width="6" height="9.5" />
                <rect className="brand-glyph-notch" x="30" y="22.4" width="5.5" height="9.5" />
                <rect className="brand-glyph-notch" x="43" y="33.8" width="5.4" height="5.4" />
                <circle className="brand-glyph-dot" cx="26.8" cy="47.7" r="1.9" />
              </svg>
            </div>
            <div>
              <p className="eyebrow">FLOWPOST / 来一发</p>
              <h1>来一发</h1>
            </div>
          </div>
          <div className="status-bank" aria-label="system status">
            <span className="lamp lamp-red" />
            <span className="lamp lamp-yellow" />
            <span className="lamp lamp-green" />
          </div>
        </header>

        <div className="workbench">
          <section className="module composer">
            <div className="module-head">
              <span>文案</span>
              <div className="composer-actions">
                <button className="micro-button" type="button" onClick={clearContent} disabled={!text && !images.length}>
                  <Eraser size={13} />
                  <span>清空图文</span>
                </button>
                <span className="counter">{characterCount}</span>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onPaste={handlePaste}
              placeholder="写好再发。"
              spellCheck={false}
            />
          </section>

          <aside className="side-stack">
            <section className="module media-panel">
              <div className="module-head">
                <span>图片</span>
                <span className="muted">{images.length ? `${images.length}/${MAX_IMAGES} · 可排序` : "可粘贴"}</span>
              </div>
              <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
              />
              {images.length ? (
                <div className="image-board">
                  <div className="image-grid" aria-label="已选择图片，可拖动排序">
                    {images.map((image, index) => (
                      <div
                        key={image.id}
                        className={`image-card ${draggedImageId === image.id ? "dragging" : ""}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          setDraggedImageId(image.id);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          moveImage(draggedImageId, image.id);
                          setDraggedImageId(undefined);
                        }}
                        onDragEnd={() => setDraggedImageId(undefined)}
                        title={`${image.name} · ${formatBytes(image.size)}`}
                      >
                        <img src={image.dataUrl} alt="" draggable={false} />
                        <button className="image-remove" aria-label={`移除图片 ${index + 1}`} type="button" onClick={() => removeImage(image.id)}>
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    ))}
                    {images.length < MAX_IMAGES ? (
                      <button className="image-add-card" type="button" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={16} />
                      </button>
                    ) : null}
                  </div>
                  <p className="media-hint">最多 {MAX_IMAGES} 张，拖动缩略图排序。</p>
                </div>
              ) : (
                <button className="paste-target" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={20} />
                  <span>粘贴图片，或点这里选择文件</span>
                  <small>最多 {MAX_IMAGES} 张，支持拖动排序</small>
                </button>
              )}
            </section>

            <section className="module">
              <div className="module-head">
                <span>发布模式</span>
              </div>
              <div className="mode-switch" role="group" aria-label="发布模式">
                <ModeButton active={mode === "draft"} icon={<SquarePen size={16} />} label="填充草稿" onClick={() => setMode("draft")} />
                <ModeButton active={mode === "auto"} icon={<Send size={16} />} label="尝试自动发布" onClick={() => setMode("auto")} />
              </div>
            </section>

            {error ? (
              <div className="notice error" role="alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="run-strip" aria-label="当前任务设置">
              <div>
                <span>平台</span>
                <strong>{selectedPlatforms.length} 个</strong>
                <small title={selectedPlatformLabels || "未选"}>{selectedPlatformLabels || "未选"}</small>
              </div>
              <div>
                <span>模式</span>
                <strong>{modeLabel}</strong>
                <small title={jikeSelected ? jikeCircle : "即刻未选"}>{jikeSelected ? jikeCircle : "即刻未选"}</small>
              </div>
            </div>

            <button className="start-button" type="button" disabled={!canStart} onClick={startDistribution}>
              <Play size={18} />
              <span>{isRunning ? "分发中" : "开始分发"}</span>
            </button>
          </aside>
        </div>

        <section className="module platform-module">
          <div className="module-head">
            <span>平台</span>
            <button className="micro-button" type="button" onClick={() => setSelectedPlatforms(DEFAULT_PLATFORMS)}>
              全选
            </button>
          </div>
          <div className="platform-grid">
            {PLATFORM_ORDER.map((platform) => {
              const definition = getPlatform(platform);
              const selected = selectedPlatforms.includes(platform);
              return (
                <button
                  key={platform}
                  className={`platform-tile ${selected ? "selected" : ""}`}
                  style={{ "--accent": definition.accent } as CSSProperties}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  aria-pressed={selected}
                >
                  <span className="platform-mark">{definition.shortLabel}</span>
                  <span>{definition.label}</span>
                </button>
              );
            })}
          </div>
          {jikeSelected ? (
            <div className="circle-row">
              <label id="jike-circle-label">
                <CircleDot size={16} />
                <span>即刻圈子</span>
              </label>
              <div className="circle-picker" ref={circlePickerRef}>
                <button
                  className="circle-trigger"
                  type="button"
                  aria-labelledby="jike-circle-label"
                  aria-expanded={circleMenuOpen}
                  onClick={() => {
                    setCircleQuery("");
                    setCircleMenuOpen((open) => !open);
                  }}
                >
                  <span>{jikeCircle || "选择圈子"}</span>
                  <ChevronDown size={16} />
                </button>
                {circleMenuOpen ? (
                  <div className="circle-menu" role="listbox" aria-label="即刻圈子">
                    <label className="circle-search">
                      <Search size={14} />
                      <input
                        autoFocus
                        value={circleQuery}
                        onChange={(event) => setCircleQuery(event.target.value)}
                        placeholder="搜索或输入圈子"
                      />
                    </label>
                    {!circleQuery.trim() ? (
                      <div className="circle-quick">
                        <span className="circle-menu-label">常用</span>
                        <div className="circle-chip-row">
                          {quickCircleOptions.map((circle) => (
                            <button
                              key={circle}
                              className={`circle-chip ${circle === jikeCircle ? "selected" : ""}`}
                              type="button"
                              onClick={() => chooseJikeCircle(circle)}
                            >
                              {circle}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <span className="circle-menu-label">{circleQuery.trim() ? "搜索结果" : "全部"}</span>
                    <div className="circle-options">
                      {circleOptions.map((circle) => (
                        <button
                          key={circle}
                          className={`circle-option ${circle === jikeCircle ? "selected" : ""}`}
                          type="button"
                          role="option"
                          aria-selected={circle === jikeCircle}
                          onClick={() => chooseJikeCircle(circle)}
                        >
                          {circle}
                        </button>
                      ))}
                      {circleQuery.trim() && !circleOptions.some((circle) => circle === circleQuery.trim()) ? (
                        <button
                          className="circle-option custom"
                          type="button"
                          role="option"
                          onClick={() => chooseJikeCircle(circleQuery.trim())}
                        >
                          使用「{circleQuery.trim()}」
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section className="module log">
          <div className="module-head">
            <span>日志</span>
            <span className="job-state">{job?.status ?? "idle"}</span>
          </div>
          {latestResults.length ? (
            <div className="result-list">
              {latestResults.map((result) => (
                <ResultRow key={result.platform} result={result} />
              ))}
            </div>
          ) : (
            <p className="empty-log">等待任务。</p>
          )}
        </section>

        <section className="module faq" aria-labelledby="faq-title">
          <div className="module-head">
            <span id="faq-title">常见问题</span>
          </div>
          <div className="faq-grid">
            {FAQ_ITEMS.map((item) => (
              <details className="faq-item" key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <footer className="maker-signature">A creation birthed by Kan Shao 2077</footer>
      </div>
    </main>
  );
}

function ModeButton(props: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button className={`mode-button ${props.active ? "active" : ""}`} type="button" onClick={props.onClick}>
      {props.icon}
      <span>{props.label}</span>
    </button>
  );
}

function ResultRow({ result }: { result: PlatformResult }): React.JSX.Element {
  const definition = getPlatform(result.platform);
  const tone = result.status;

  return (
    <div className={`result-row ${tone}`}>
      <span className="result-icon">
        {result.status === "filled" || result.status === "published" ? <CheckCircle2 size={15} /> : <span />}
      </span>
      <div>
        <strong>{definition.label}</strong>
        <p>{result.message}</p>
      </div>
    </div>
  );
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeCircleText(value: string): string {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function normalizePlatformSelection(platforms: PlatformId[]): PlatformId[] {
  return PLATFORM_ORDER.filter((platform) => platforms.includes(platform));
}

function normalizeJikeCircleSelection(circle: string | undefined): string {
  const value = circle?.trim();
  if (!value) return DEFAULT_JIKE_CIRCLE;
  return LEGACY_JIKE_CIRCLES[value] ?? value;
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
