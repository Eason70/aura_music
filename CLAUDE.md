# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指导。

## 项目概述

AuraMusic — AI Agent 驱动的 B站音频播放器。基于 Next.js 16 (App Router)、React 19、TypeScript 5、Tailwind CSS 4 构建。用户通过自然语言与 AI 对话，搜索 B站视频并转换为音频，构建个人音乐库。

## 开发命令

```bash
pnpm dev          # 启动开发服务器 http://localhost:3000
pnpm build        # 生产构建
pnpm start        # 启动生产服务器
pnpm lint         # 运行 ESLint
```

**未配置测试框架。** 目前没有单元测试或 E2E 测试。

## 环境配置

复制 `.env.example` 为 `.env.local`，关键变量：
- `ANTHROPIC_BASE_URL` — AI API 端点（默认 DeepSeek）
- `ANTHROPIC_API_KEY` — AI 服务商 API Key
- `MUSIC_DIR` — 本地音频存储目录（默认 `~/Documents/bili`）

## 架构

### 组件结构（Atomic Design）

```
app/components/
├── atoms/       # 原子组件：Label, Icon, Badge, Slider, Logo, DanmakuOverlay
├── molecules/   # 分子组件：ControlBar, SeekBar, TrackInfo, VolumeControl, ChatMessage, CommandInput
└── organisms/   # 有机体：Player, Playlist, AgentChat, LyricsPanel, ClockPanel, StatusBar, PlayerWithLyrics
```

各层通过 `index.ts` 统一导出。

### 状态管理（React Context）

全局状态由 4 个 Context 管理，在 `app/components/providers.tsx` 中嵌套组合：

| Context | 文件 | 职责 |
|---------|------|------|
| `ModeContext` | `context/ModeContext.tsx` | 本地/云端模式切换 |
| `PlayerContext` | `context/PlayerContext.tsx` | 音频播放、播放列表、歌词、进度、音量、歌词面板展开/折叠 |
| `DanmakuContext` | `context/DanmakuContext.tsx` | B站弹幕叠加状态 |
| `AgentContext` | `context/AgentContext.tsx` | AI 聊天消息、SSE 流式传输、视频转音频队列 |

**注意：** `PlayerContext` 同时管理音频状态和 UI 状态（歌词面板展开/折叠）。`lyricsExpanded` 标志控制 `PlayerWithLyrics` 的布局行为。

### 页面布局

主页 `app/page.tsx` 桌面端采用双栏网格布局：
- **左栏：** `ClockPanel` → `PlayerWithLyrics`（包裹 `Player` + `LyricsPanel`）
- **右栏：** `Playlist` → `AgentChat`

**PlayerWithLyrics**（`organisms/PlayerWithLyrics.tsx`）是客户端组件包装器，处理歌词展开逻辑。展开时使用 `absolute inset-0 z-10` 覆盖时钟面板区域；折叠时使用正常 flex 流（`flex-1`）。Player 使用 `relative z-20` 保持在最上层。

**折叠模式：** `LyricsPanel` 和 `Playlist` 采用相同的折叠行为 — 折叠时 `shrink-0`（细标题栏），展开时 `flex-1`。兄弟组件（如 `AgentChat`）可自动扩展填充释放的空间。

### API 路由

| 路由 | 用途 |
|------|------|
| `api/chat/` | AI Agent SSE 接口（Claude Agent SDK） |
| `api/bili/search/` | B站视频搜索代理 |
| `api/bili/audio/` | B站视频 → MP3 转换 |
| `api/bili/danmaku/` | B站弹幕获取代理 |
| `api/search/` | 本地曲库搜索 |
| `api/lyrics/` | 歌词获取（酷狗） |
| `api/tracks/all/` | 列出所有已下载曲目 |
| `api/tracks/scan/` | 扫描 MUSIC_DIR 音频文件 |
| `api/tracks/[...path]/` | 提供音频文件服务 |

### 共享库

- `app/lib/types.ts` — 核心类型：`Track`、`PlayerState`、`LyricLine`、`ChatMessage`、`AgentState` 等
- `app/lib/bili.ts` — B站 API 辅助函数（搜索、视频信息、音频提取）
- `app/lib/tracks.ts` — 曲目扫描、文件名解析、MUSIC_DIR 管理
- `app/lib/lyrics.ts` — 歌词获取与同步（酷狗 API）

### 自定义 Hooks

- `app/hooks/useAudioPlayer.ts` — 核心音频播放引擎（播放、暂停、跳转、音量、进度追踪）
- `app/hooks/useSSE.ts` — SSE 客户端，用于 AI Agent 流式通信
- `app/hooks/useClock.ts` — 实时时钟显示

### 样式

- Tailwind CSS 4 + CSS 自定义属性（如 `var(--color-surface)`、`var(--color-primary)`）
- 设计令牌定义在 `app/globals.css`
- 字体：Space Grotesk（标题）、Inter（正文）、Press Start 2P（等宽终端）、Caveat（手写）
- 图标使用 Google Material Symbols Outlined
- 复古终端风格：等宽标签、大写字母、字间距

### 页面结构

`app/page.tsx` 是**服务端组件**，负责组合布局。所有交互组件均为客户端组件（`"use client"`）。`Providers` 包装器（`app/components/providers.tsx`）必须包裹所有客户端状态消费者。

## 关键模式

- **不可变状态更新** — 所有 Context 状态使用展开/拷贝模式，禁止直接修改
- **Ref + State 同步** — `PlayerContext` 使用 ref（`playlistRef`、`indexRef`）确保回调中访问最新状态
- **Atomic Design** — 组件按 atoms → molecules → organisms 组织，通过 barrel 文件统一导出
- **SSE 流式传输** — AI Agent 响应通过 `useSSE` hook 以 Server-Sent Events 方式流式传输
