import React, { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Eraser,
  Maximize2,
  Play,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Square,
  SquarePen,
  Upload,
  X
} from "lucide-react";
import { browser } from "wxt/browser";
import "./style.css";
import {
  MESSAGE_TYPES,
  type CheckLoginsResponse,
  type ConfirmPlatformPublishedResponse,
  type StartDistributionResponse,
  type StopDistributionResponse
} from "../../src/shared/messages";
import {
  DEFAULT_JIKE_CIRCLE,
  DEFAULT_PLATFORMS,
  JIKE_CIRCLES,
  PLATFORM_ORDER,
  getPlatform,
  type PlatformId,
  type PublishMode
} from "../../src/shared/platforms";
import {
  getDraft,
  getHiddenPlatforms,
  getJobState,
  onJobStateChanged,
  saveDraft,
  saveHiddenPlatforms
} from "../../src/shared/storage";
import type { DistributionRequest, JobState, MediaAttachment, PlatformResult } from "../../src/shared/types";

const LARGE_IMAGE_THRESHOLD_BYTES = 4 * 1024 * 1024;
const IMAGE_COMPRESSION_TARGET_BYTES = Math.floor(3.8 * 1024 * 1024);
const IMAGE_COMPRESSION_MAX_DIMENSION = 4_096;
const MAX_IMAGES = 9;
const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const QUICK_CIRCLE_COUNT = 9;
const LEGACY_JIKE_CIRCLES: Record<string, string> = {
  "AI 探索者": "AI探索站",
  "AI 探索站": "AI探索站",
  "汪星人的日常": DEFAULT_JIKE_CIRCLE,
  "今天有什么好哭的": DEFAULT_JIKE_CIRCLE
};
const FAQ_ITEMS = [
  {
    question: "FlowPost 是什么？",
    answer: "一个本地浏览器插件，用浏览器里已经登录的平台账号，把同一段文案和图片分发到即刻、X、小红书、视频号、抖音、观猹、Substack Notes 和 LinkedIn。"
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
    answer: "填充草稿会停在发布前；尝试自动发布只代表插件点击了发布按钮。只有你在日志里确认后，FlowPost 才会记为发布成功。"
  },
  {
    question: "怎么检查文案排版？",
    answer: "先用填充草稿发一段带换行、空行、链接和 emoji 的测试文案。平台发布框里的样子和输入框一致，再手动发布。"
  },
  {
    question: "即刻圈子没选上怎么办？",
    answer: "先确认插件里选的圈子名称和即刻弹出的选项一致。若日志提示需要手动处理，通常是即刻页面结构变了或加载太慢。"
  },
  {
    question: "图片支持什么？",
    answer: "支持 PNG、JPG、WebP，最多 9 张。超过 4MB 会在本地自动优化；缩略图可以放大预览和拖动排序。"
  },
  {
    question: "如何联系作者？",
    answer: (
      <>
        可以通过 X 联系作者：
        <a href="https://x.com/KanShao2077" target="_blank" rel="noreferrer">
          @KanShao2077
        </a>
      </>
    )
  }
];

function App(): React.JSX.Element {
  const [text, setText] = useState("");
  const [images, setImages] = useState<MediaAttachment[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>(DEFAULT_PLATFORMS);
  const [hiddenPlatforms, setHiddenPlatforms] = useState<PlatformId[]>([]);
  const [platformManagerOpen, setPlatformManagerOpen] = useState(false);
  const [mode, setMode] = useState<PublishMode>("draft");
  const [jikeCircle, setJikeCircle] = useState<string>(DEFAULT_JIKE_CIRCLE);
  const [circleMenuOpen, setCircleMenuOpen] = useState(false);
  const [circleQuery, setCircleQuery] = useState("");
  const [job, setJob] = useState<JobState | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loginResults, setLoginResults] = useState<Partial<Record<PlatformId, PlatformResult>>>({});
  const [loginChecking, setLoginChecking] = useState(false);
  const [ready, setReady] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [draggedImageId, setDraggedImageId] = useState<string | undefined>();
  const [previewImage, setPreviewImage] = useState<MediaAttachment | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const circlePickerRef = useRef<HTMLDivElement>(null);
  const suppressImagePreviewRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    void Promise.all([getDraft(), getJobState(), getHiddenPlatforms()]).then(([draft, storedJob, storedHiddenPlatforms]) => {
      if (!mounted) return;
      setText(draft.text);
      setImages(draft.images.slice(0, MAX_IMAGES));
      setHiddenPlatforms(storedHiddenPlatforms);
      const visiblePlatforms = PLATFORM_ORDER.filter((platform) => !storedHiddenPlatforms.includes(platform));
      const storedPlatforms = normalizePlatformSelection(draft.selectedPlatforms).filter(
        (platform) => !storedHiddenPlatforms.includes(platform)
      );
      setSelectedPlatforms(draft.updatedAt ? storedPlatforms : visiblePlatforms);
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

  useEffect(() => {
    if (!ready) return;
    void saveHiddenPlatforms(hiddenPlatforms);
  }, [hiddenPlatforms, ready]);

  const latestResults = useMemo(() => job?.results ?? [], [job]);
  const visiblePlatforms = useMemo(
    () => PLATFORM_ORDER.filter((platform) => !hiddenPlatforms.includes(platform)),
    [hiddenPlatforms]
  );
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
  const canStart = characterCount > 0 && selectedPlatforms.length > 0 && !isRunning && !imageProcessing;
  const jikeSelected = selectedPlatforms.includes("jike");
  const modeLabel = mode === "draft" ? "草稿" : "自动";
  const canRetrySinglePlatform = characterCount > 0 && !isRunning;

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

  useEffect(() => {
    if (!previewImage) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setPreviewImage(undefined);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewImage]);

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
    event.stopPropagation();
    await addImagesFromFiles(files, "pasted-image");
  }

  async function addImagesFromFiles(files: File[], fallbackNamePrefix?: string): Promise<void> {
    if (imageProcessing) {
      setError("图片正在处理中，请稍等。");
      return;
    }

    setImageProcessing(true);
    setError(undefined);

    try {
      const slots = MAX_IMAGES - images.length;
      if (slots <= 0) {
        setError(`最多支持 ${MAX_IMAGES} 张图片。`);
        return;
      }

      const attachments: MediaAttachment[] = [];
      const warnings: string[] = [];

      for (const [index, sourceFile] of files.slice(0, slots).entries()) {
        if (!SUPPORTED_IMAGE_TYPES.includes(sourceFile.type)) {
          warnings.push(`${sourceFile.name || "图片"} 格式不支持`);
          continue;
        }

        try {
          const file = sourceFile.size > LARGE_IMAGE_THRESHOLD_BYTES ? await optimizeLargeImage(sourceFile) : sourceFile;
          const dataUrl = await readFileAsDataUrl(file);
          attachments.push({
            id: crypto.randomUUID(),
            name: file.name || `${fallbackNamePrefix ?? "image"}-${images.length + index + 1}.png`,
            type: file.type,
            size: file.size,
            dataUrl
          });
        } catch {
          try {
            const dataUrl = await readFileAsDataUrl(sourceFile);
            attachments.push({
              id: crypto.randomUUID(),
              name: sourceFile.name || `${fallbackNamePrefix ?? "image"}-${images.length + index + 1}.png`,
              type: sourceFile.type,
              size: sourceFile.size,
              dataUrl
            });
          } catch {
            warnings.push(`${sourceFile.name || "图片"} 读取失败`);
          }
        }
      }

      if (files.length > slots) warnings.push(`最多支持 ${MAX_IMAGES} 张，已忽略多余图片`);

      if (!attachments.length) {
        setError(warnings[0] ?? "没有可用图片。");
        return;
      }

      setImages((current) => {
        const seen = new Set(current.map((image) => image.dataUrl));
        const next = [...current];

        for (const attachment of attachments) {
          if (next.length >= MAX_IMAGES) break;
          if (seen.has(attachment.dataUrl)) continue;
          seen.add(attachment.dataUrl);
          next.push(attachment);
        }

        return next;
      });
      if (warnings.length) setError(warnings.join("；"));
    } finally {
      setImageProcessing(false);
    }
  }

  function togglePlatform(platform: PlatformId): void {
    setSelectedPlatforms((current) =>
      current.includes(platform)
        ? current.filter((candidate) => candidate !== platform)
        : PLATFORM_ORDER.filter((candidate) => current.includes(candidate) || candidate === platform)
    );
  }

  function togglePlatformVisibility(platform: PlatformId): void {
    const isHidden = hiddenPlatforms.includes(platform);

    setHiddenPlatforms((current) =>
      isHidden
        ? current.filter((candidate) => candidate !== platform)
        : PLATFORM_ORDER.filter((candidate) => current.includes(candidate) || candidate === platform)
    );

    if (!isHidden) {
      setSelectedPlatforms((current) => current.filter((candidate) => candidate !== platform));
      setLoginResults((current) => {
        const next = { ...current };
        delete next[platform];
        return next;
      });
    }
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

    await startDistributionForPlatforms(selectedPlatforms, "至少选择一个平台。", false);
  }

  async function retrySinglePlatform(platform: PlatformId): Promise<void> {
    setError(undefined);
    await startDistributionForPlatforms([platform], "请选择要重试的平台。", true);
  }

  async function startDistributionForPlatforms(
    platforms: PlatformId[],
    emptyPlatformMessage: string,
    reuseExistingGroup: boolean
  ): Promise<void> {
    if (!text.trim()) {
      setError("文案不能为空。");
      return;
    }

    if (!platforms.length) {
      setError(emptyPlatformMessage);
      return;
    }

    const request: DistributionRequest = {
      id: crypto.randomUUID(),
      text: text.trim(),
      image: images[0],
      images,
      platforms,
      mode,
      jikeCircle,
      reuseExistingGroup,
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

    if (response.job) {
      setJob((current) => (current?.id && current.id !== request.id ? current : response.job));
    }
  }

  async function stopDistribution(): Promise<void> {
    setError(undefined);

    const response = (await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.STOP_DISTRIBUTION
    })) as StopDistributionResponse;

    if (!response.ok) {
      setError(response.error ?? "停止分发失败。");
      return;
    }

    if (response.job) setJob(response.job);
  }

  async function confirmPlatformPublished(platform: PlatformId): Promise<void> {
    if (!job) return;
    setError(undefined);

    const response = (await browser.runtime.sendMessage({
      type: MESSAGE_TYPES.CONFIRM_PLATFORM_PUBLISHED,
      payload: { jobId: job.id, platform }
    })) as ConfirmPlatformPublishedResponse;

    if (!response.ok) {
      setError(response.error ?? "发布状态确认失败。");
      return;
    }

    if (response.job) setJob(response.job);
  }

  async function checkLogins(): Promise<void> {
    setError(undefined);

    if (!selectedPlatforms.length) {
      setError("至少选择一个平台。");
      return;
    }

    setLoginChecking(true);
    setLoginResults({});

    let response: CheckLoginsResponse;
    try {
      response = (await browser.runtime.sendMessage({
        type: MESSAGE_TYPES.CHECK_LOGINS,
        payload: { platforms: selectedPlatforms }
      })) as CheckLoginsResponse;
    } catch (error) {
      setLoginChecking(false);
      setError(error instanceof Error ? error.message : "登录检查失败。");
      return;
    }

    setLoginChecking(false);

    if (!response.ok) {
      setError(response.error ?? "登录检查失败。");
      return;
    }

    setLoginResults(
      Object.fromEntries((response.results ?? []).map((result) => [result.platform, result])) as Partial<
        Record<PlatformId, PlatformResult>
      >
    );
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
              placeholder="写好再发。"
              spellCheck={false}
            />
          </section>

          <aside className="side-stack">
            <section className="module media-panel">
              <div className="module-head">
                <span>图片</span>
                <span className="muted">
                  {imageProcessing ? "正在优化大图…" : images.length ? `${images.length}/${MAX_IMAGES} · 可排序` : "可粘贴"}
                </span>
              </div>
              <input
                ref={fileInputRef}
                className="file-input"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                disabled={imageProcessing}
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
                          suppressImagePreviewRef.current = true;
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
                        onDragEnd={() => {
                          setDraggedImageId(undefined);
                          window.setTimeout(() => {
                            suppressImagePreviewRef.current = false;
                          }, 0);
                        }}
                        title={`${image.name} · ${formatBytes(image.size)} · 点击放大`}
                      >
                        <button
                          className="image-preview-trigger"
                          type="button"
                          aria-label={`放大预览图片 ${index + 1}：${image.name}`}
                          onClick={() => {
                            if (!suppressImagePreviewRef.current) setPreviewImage(image);
                          }}
                        >
                          <img src={image.dataUrl} alt={image.name} draggable={false} />
                          <span className="image-zoom" aria-hidden="true">
                            <Maximize2 size={13} />
                          </span>
                        </button>
                        <button
                          className="image-remove"
                          aria-label={`移除图片 ${index + 1}`}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeImage(image.id);
                          }}
                        >
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
                  <p className="media-hint">点击放大，拖动排序；超过 4MB 自动优化。</p>
                </div>
              ) : (
                <button className="paste-target" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={20} />
                  <span>粘贴图片，或点这里选择文件</span>
                  <small>最多 {MAX_IMAGES} 张，超过 4MB 自动优化</small>
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

            <button
              className={`start-button ${isRunning ? "stop-button" : ""}`}
              type="button"
              disabled={!isRunning && !canStart}
              onClick={isRunning ? stopDistribution : startDistribution}
            >
              {isRunning ? <Square size={18} /> : <Play size={18} />}
              <span>{isRunning ? "停止分发" : "开始分发"}</span>
            </button>
          </aside>
        </div>

        <section className="module platform-module">
          <div className="module-head">
            <span>平台</span>
            <div className="platform-actions">
              <button className="micro-button" type="button" onClick={checkLogins} disabled={isRunning || loginChecking}>
                <Search size={13} />
                <span>{loginChecking ? "检查中" : "检查登录"}</span>
              </button>
              <button
                className={`micro-button ${platformManagerOpen ? "active" : ""}`}
                type="button"
                onClick={() => setPlatformManagerOpen((open) => !open)}
                aria-expanded={platformManagerOpen}
                aria-controls="platform-manager"
              >
                <Settings2 size={13} />
                <span>{hiddenPlatforms.length ? `管理 · 隐藏 ${hiddenPlatforms.length}` : "管理平台"}</span>
              </button>
              <button className="micro-button" type="button" onClick={() => setSelectedPlatforms(visiblePlatforms)}>
                全选
              </button>
            </div>
          </div>
          {platformManagerOpen ? (
            <div className="platform-manager" id="platform-manager" role="group" aria-label="平台显示管理">
              <div className="platform-manager-copy">
                <strong>平台显示</strong>
                <span>隐藏暂时不用的平台；再次点击即可恢复。</span>
              </div>
              <div className="platform-visibility-grid">
                {PLATFORM_ORDER.map((platform) => {
                  const definition = getPlatform(platform);
                  const hidden = hiddenPlatforms.includes(platform);
                  return (
                    <button
                      className={`platform-visibility ${hidden ? "hidden" : "visible"}`}
                      key={platform}
                      type="button"
                      aria-pressed={!hidden}
                      onClick={() => togglePlatformVisibility(platform)}
                    >
                      <PlatformLogo platform={platform} size="small" />
                      <span>{definition.label}</span>
                      <small>{hidden ? "点击显示" : "点击隐藏"}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className="platform-grid">
            {visiblePlatforms.map((platform) => {
              const definition = getPlatform(platform);
              const selected = selectedPlatforms.includes(platform);
              const loginResult = loginResults[platform];
              return (
                <button
                  key={platform}
                  className={`platform-tile ${selected ? "selected" : ""} ${loginResult ? `login-${loginResult.status}` : ""}`}
                  style={{ "--accent": definition.accent } as CSSProperties}
                  type="button"
                  onClick={() => togglePlatform(platform)}
                  aria-pressed={selected}
                >
                  <PlatformLogo platform={platform} />
                  <span className="platform-label">
                    <span>{definition.label}</span>
                    {loginResult ? <small>{formatLoginStatus(loginResult)}</small> : null}
                  </span>
                </button>
              );
            })}
          </div>
          {hiddenPlatforms.length > 0 && !platformManagerOpen ? (
            <div className="hidden-platforms" aria-label="已隐藏的平台">
              <span>已隐藏</span>
              {hiddenPlatforms.map((platform) => {
                const definition = getPlatform(platform);
                return (
                  <button key={platform} type="button" onClick={() => togglePlatformVisibility(platform)}>
                    <PlatformLogo platform={platform} size="tiny" />
                    <span>{definition.label}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {!visiblePlatforms.length ? (
            <button className="platform-empty" type="button" onClick={() => setPlatformManagerOpen(true)}>
              所有平台都已隐藏，点击恢复
            </button>
          ) : null}
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
            <div className="log-actions">
              <span className="job-state">{formatJobStatus(job)}</span>
            </div>
          </div>
          {latestResults.length ? (
            <div className="result-list">
              {latestResults.map((result) => (
                <ResultRow
                  key={result.platform}
                  result={result}
                  canRetry={canRetrySinglePlatform}
                  canConfirm={job?.status !== "running"}
                  onRetry={retrySinglePlatform}
                  onConfirm={confirmPlatformPublished}
                />
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

        {previewImage ? (
          <div
            className="image-lightbox"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setPreviewImage(undefined);
            }}
          >
            <div
              className="image-lightbox-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={`图片预览：${previewImage.name}`}
            >
              <button
                className="image-lightbox-close"
                type="button"
                autoFocus
                aria-label="关闭图片预览"
                onClick={() => setPreviewImage(undefined)}
              >
                <X size={18} />
              </button>
              <div className="image-lightbox-stage">
                <img src={previewImage.dataUrl} alt={previewImage.name} />
              </div>
              <div className="image-lightbox-meta">
                <strong>{previewImage.name}</strong>
                <span>{formatBytes(previewImage.size)} · 按 Esc 关闭</span>
              </div>
            </div>
          </div>
        ) : null}

        <footer className="maker-signature">A creation birthed by Kan Shao 2077</footer>
      </div>
    </main>
  );
}

function PlatformLogo({
  platform,
  size = "large"
}: {
  platform: PlatformId;
  size?: "large" | "small" | "tiny";
}): React.JSX.Element {
  const definition = getPlatform(platform);

  return (
    <span className={`platform-logo platform-logo-${size}`} data-platform={platform} aria-hidden="true">
      <img src={definition.logoPath} alt="" draggable={false} />
    </span>
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

function ResultRow({
  result,
  canRetry,
  canConfirm,
  onRetry,
  onConfirm
}: {
  result: PlatformResult;
  canRetry: boolean;
  canConfirm: boolean;
  onRetry: (platform: PlatformId) => void;
  onConfirm: (platform: PlatformId) => void;
}): React.JSX.Element {
  const definition = getPlatform(result.platform);
  const tone = result.status;
  const canMarkPublished = ["filled", "publish-pending", "manual"].includes(result.status);

  return (
    <div className={`result-row ${tone}`}>
      <span className="result-icon">
        {result.status === "ready" || result.status === "filled" || result.status === "published" ? (
          <CheckCircle2 size={15} />
        ) : (
          <span />
        )}
      </span>
      <div>
        <div className="result-heading">
          <strong>{definition.label}</strong>
          <span>{formatResultStatus(result.status)}</span>
        </div>
        <p>{result.message}</p>
      </div>
      <div className="result-actions">
        {canMarkPublished ? (
          <button
            className="result-confirm"
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(result.platform)}
            title={`确认 ${definition.label} 已经公开发布`}
          >
            <CheckCircle2 size={12} />
            <span>确认已发布</span>
          </button>
        ) : null}
        <button
          className="result-retry"
          type="button"
          disabled={!canRetry}
          onClick={() => onRetry(result.platform)}
          title={`重试 ${definition.label}`}
        >
          <RotateCcw size={12} />
          <span>重试</span>
        </button>
      </div>
    </div>
  );
}

function formatLoginStatus(result: PlatformResult): string {
  if (result.status === "ready") return "已登录";
  if (result.status === "needs-login") return "需要登录";
  if (result.status === "manual") return "需确认";
  if (result.status === "failed") return "检查失败";
  return result.message;
}

function formatResultStatus(status: PlatformResult["status"]): string {
  if (status === "queued") return "等待";
  if (status === "opening") return "打开中";
  if (status === "ready") return "已登录";
  if (status === "filled") return "填充成功";
  if (status === "publish-pending") return "待确认发布";
  if (status === "published") return "发布成功";
  if (status === "manual") return "需手动处理";
  if (status === "needs-login") return "需要登录";
  if (status === "cancelled") return "已停止";
  return "失败";
}

function formatJobStatus(job: JobState | undefined): string {
  if (!job) return "idle";
  if (job.status === "running") return "running";
  if (job.status === "cancelled") return "stopped";
  if (job.status === "failed") return "failed";

  const publishedCount = job.results.filter((result) => result.status === "published").length;
  const filledCount = job.results.filter((result) =>
    ["filled", "publish-pending"].includes(result.status)
  ).length;
  const actionCount = job.results.filter((result) =>
    ["manual", "needs-login", "failed"].includes(result.status)
  ).length;
  if (publishedCount === job.results.length && publishedCount > 0) return `发布成功 ${publishedCount}/${job.results.length}`;
  if (publishedCount || filledCount) return `填充 ${filledCount} · 发布 ${publishedCount}`;
  if (actionCount) return `需处理 ${actionCount}`;
  return "complete";
}

async function optimizeLargeImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

  try {
    const initialScale = Math.min(1, IMAGE_COMPRESSION_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * initialScale));
    let height = Math.max(1, Math.round(bitmap.height * initialScale));
    let smallestBlob: Blob | undefined;

    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("浏览器无法处理这张图片");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) {
        const blob = await canvasToBlob(canvas, "image/jpeg", quality);
        if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;

        if (blob.size <= IMAGE_COMPRESSION_TARGET_BYTES) {
          return new File([blob], makeOptimizedImageName(file.name), {
            type: blob.type,
            lastModified: file.lastModified
          });
        }
      }

      if (Math.max(width, height) <= 1_200) break;
      width = Math.max(1, Math.round(width * 0.8));
      height = Math.max(1, Math.round(height * 0.8));
    }

    if (!smallestBlob || smallestBlob.size >= file.size) return file;

    return new File([smallestBlob], makeOptimizedImageName(file.name), {
      type: smallestBlob.type,
      lastModified: file.lastModified
    });
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片压缩失败"));
    }, type, quality);
  });
}

function makeOptimizedImageName(name: string): string {
  const baseName = name.trim().replace(/\.[^.]+$/, "") || "image";
  return `${baseName}-optimized.jpg`;
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
