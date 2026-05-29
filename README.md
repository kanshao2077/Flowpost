# 来一发 / FlowPost

FlowPost 是一个本地优先的 Chrome / Edge 内容分发插件，用来把同一条文案和图片快速填入多个内容平台的发布框。

第一版支持 X / Twitter、即刻、Substack Notes 和 LinkedIn。它不做账号托管、不保存平台密码，只使用你已经在浏览器里登录好的账号状态。

![FlowPost 界面](https://pbs.twimg.com/media/HJc-AKKaEAEzUmS?format=jpg&name=4096x4096)

## Features

- Full-page extension workspace instead of a cramped popup.
- Draft-first workflow: fill each platform's composer and stop before publish by default.
- Optional experimental auto-publish mode.
- Text plus up to 9 images per draft.
- Paste images, select multiple image files, and drag thumbnails to reorder.
- Local draft, selected platforms, image queue, Jike circle, and task logs persisted with `chrome.storage.local`.
- Jike circle picker with common circles such as `一个想法不一定对`, `有谁比我惨`, `信息流的黑色幽默`, and `AI 探索站`.
- Braun-inspired visual direction: light instrument-panel UI, hard grid, restrained color, physical button feedback.

## Supported Platforms

| Platform | Status | Notes |
| --- | --- | --- |
| 即刻 | MVP | Supports text, images, circle selection, draft mode, and experimental publish. |
| X / Twitter | MVP | Supports text and images through the compose page. |
| Substack Notes | MVP | Targets Notes, not newsletter posts. |
| LinkedIn | MVP | Supports the feed post composer. |

Platform DOM selectors are best-effort. Social products change their markup frequently, so draft mode is the safer default.

## Install Locally

```bash
npm install
npm run build
```

Then load the unpacked extension from:

```text
.output/chrome-mv3
```

In Chrome or Edge:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select `.output/chrome-mv3`.

For local development:

```bash
npm run dev
```

## Usage

1. Click the extension icon to open the full-page FlowPost workspace.
2. Write or paste your text.
3. Paste images or select image files.
4. Drag image thumbnails to reorder them.
5. Choose platforms.
6. If Jike is selected, choose a circle.
7. Keep `填充草稿` for safer posting, or switch to `尝试自动发布` if you want the plugin to click publish.
8. Click `开始分发`.

## Privacy

FlowPost does not store platform passwords or access tokens. It opens the target platform pages and interacts with the logged-in browser session.

Stored locally:

- Draft text
- Image attachments as local data URLs
- Selected platforms
- Jike circle
- Recent task status and logs

Nothing is sent to a backend because there is no backend.

## Tech Stack

- WXT
- React
- TypeScript
- Chrome Extension Manifest V3
- `chrome.storage.local`

## Scripts

```bash
npm run dev        # Start WXT development mode
npm run build      # Build unpacked Chrome MV3 extension
npm run zip        # Build and zip the extension
npm run typecheck  # Generate WXT types and run TypeScript checks
```

## Project Structure

```text
entrypoints/options      Full-page extension UI
entrypoints/background   Task scheduling, tab creation, message dispatch
entrypoints/content      Content-script message bridge
src/adapters             Platform DOM adapters
src/shared               Shared types, platform metadata, storage helpers
public/icons             Extension icons
```

## MVP Boundaries

FlowPost intentionally does not include:

- Cloud sync
- Scheduled publishing
- Account management
- Password storage
- AI rewriting
- Mobile support
- Newsletter article publishing for Substack

The current goal is simple: write once, fill several platform composers, then let you decide whether to publish manually or let the experimental publish mode try.

