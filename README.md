# 来一发 / FlowPost

FlowPost 是一个本地浏览器插件。你写一次文案，放好图片，它会帮你把内容填到多个平台的发布框里。

现在支持：

- 即刻
- X / Twitter
- Substack Notes
- LinkedIn

它不会保存你的平台账号密码，也没有后端。它只是打开网页，用你当前浏览器已经登录好的账号去填发布框。

![FlowPost 界面](https://pbs.twimg.com/media/HJc-AKKaEAEzUmS?format=jpg&name=4096x4096)

## 你需要先准备什么

先确认电脑里有这些东西：

1. Chrome 或 Edge 浏览器。
2. Node.js。建议装 LTS 版本。
3. Git。用来从 GitHub 下载代码。
4. 先在浏览器里登录好即刻、X、Substack、LinkedIn。

不会装 Node.js 的话，去这里下载 LTS：

```text
https://nodejs.org/
```

## 新电脑怎么安装

打开终端，执行：

```bash
git clone https://github.com/kanshao2077/Flowpost.git
cd Flowpost
npm install
npm run build
```

构建完成后，会出现这个文件夹：

```text
.output/chrome-mv3
```

然后打开 Chrome：

```text
chrome://extensions/
```

按这个顺序操作：

1. 打开右上角「开发者模式」。
2. 点击「加载已解压的扩展程序」。
3. 选择刚才项目里的 `.output/chrome-mv3` 文件夹。
4. 浏览器右上角会出现「来一发 FlowPost」插件。

注意：选的是 `.output/chrome-mv3` 这个文件夹，不是整个项目文件夹。

## 这台电脑已经有项目，怎么更新

进入项目目录：

```bash
cd Flowpost
git pull
npm install
npm run build
```

然后回到：

```text
chrome://extensions/
```

点击插件卡片上的「重新加载」。

## 怎么使用

1. 点击浏览器右上角的「来一发」插件图标。
2. 在文案框里输入内容。
3. 粘贴图片，或者点击图片区域选择图片。
4. 需要多图时，最多 9 张，可以拖动缩略图排序。
5. 选择要分发的平台。
6. 如果选了即刻，记得选择圈子。
7. 建议先用「填充草稿」模式。
8. 点击「开始分发」。

FlowPost 会打开各个平台的发布页，并把这些标签页放进同一个浏览器标签组里。你处理完以后，可以直接关闭整个标签组。

## 两种发布模式

### 填充草稿

默认模式。FlowPost 只负责把文字和图片填进去，不帮你点发布。

这个模式最稳，适合日常使用。

### 尝试自动发布

FlowPost 会尝试点击发布按钮。

这个功能是实验性的。平台页面经常改版，如果你怕误发、漏图、重复发，就先别开。

## 未登录怎么办

如果某个平台没有登录，日志会提示你先登录。

处理方式：

1. 在 FlowPost 打开的那个平台标签页里登录账号。
2. 登录成功后回到 FlowPost。
3. 再点一次「开始分发」。

FlowPost 不保存账号密码。登录状态是浏览器自己的。

## 常见问题

### 为什么加载插件时找不到 `.output/chrome-mv3`

你还没构建。执行：

```bash
npm run build
```

### 为什么另一台电脑下载后不能直接用

GitHub 上放的是源码，不是已经打包好的插件。新电脑需要先执行：

```bash
npm install
npm run build
```

### 为什么不把 `node_modules`、`.output` 上传到 GitHub

这些是本机生成物，不适合放进代码仓库。

正确做法是：

- GitHub 保存源码。
- 每台电脑自己 `npm install`。
- 每台电脑自己 `npm run build`。

### 为什么平台页面打开了，但是没有填进去

通常是三种情况：

1. 你还没登录该平台。
2. 平台页面加载太慢。
3. 平台改版了，原来的页面选择器失效。

先登录，再重试。如果还是不行，就需要更新适配逻辑。

### 为什么建议先用「填充草稿」

因为社交平台页面经常变。先停在发布前，你可以最后检查一遍，风险更低。

## 支持能力

- 文案输入
- 最多 9 张图片
- 图片粘贴
- 图片拖动排序
- 即刻圈子选择
- 多平台标签页自动分组
- 本地草稿保存
- 本地任务日志

## 隐私说明

FlowPost 没有后端。

本地会保存：

- 文案草稿
- 图片数据
- 平台选择
- 即刻圈子
- 最近一次任务日志

不会保存：

- 平台账号
- 平台密码
- 登录验证码
- 平台访问令牌

## 开发命令

```bash
npm run dev        # 开发模式
npm run build      # 构建插件
npm run zip        # 打包 zip
npm run typecheck  # 类型检查
```

## 项目结构

```text
entrypoints/options      插件主界面
entrypoints/background   打开标签页、任务调度、标签分组
entrypoints/content      注入到平台页面的脚本入口
src/adapters             各平台发布框适配
src/shared               共享类型、平台配置、本地存储
public/icons             插件图标
```

## 当前边界

现在不做：

- 手机端
- 云同步
- 定时发布
- 账号管理
- AI 改写
- Substack newsletter 长文章

当前目标很简单：写一次内容，把它稳定填到几个常用平台里。
