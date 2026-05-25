# 歌词显示功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AuraPlayer 添加网易云音乐歌词显示功能，赛博朋克终端风格逐行滚动

**Architecture:** 后端代理网易云 API 获取 LRC 歌词，前端解析并同步显示，内存缓存减少请求

**Tech Stack:** Next.js API Routes, React Context, CSS Variables

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `app/lib/types.ts` | 修改 | 添加 LyricLine 类型 |
| `app/lib/lyrics.ts` | 新增 | LRC 解析和网易云 API 调用 |
| `app/api/lyrics/route.ts` | 新增 | 歌词 API 路由 |
| `app/context/PlayerContext.tsx` | 修改 | 添加歌词状态和同步逻辑 |
| `app/components/organisms/LyricsPanel.tsx` | 新增 | 歌词显示组件 |
| `app/components/organisms/index.ts` | 修改 | 导出 LyricsPanel |
| `app/page.tsx` | 修改 | 插入 LyricsPanel |

---

### Task 1: 添加 LyricLine 类型

**Files:**
- Modify: `app/lib/types.ts`

- [ ] **Step 1: 添加 LyricLine 接口**

```typescript
// 在 app/lib/types.ts 文件末尾添加
export interface LyricLine {
  time: number;    // 秒
  text: string;    // 歌词文本
}
```

- [ ] **Step 2: 验证类型定义**

```bash
cd D:/aiclaude/vibecoding/aura-player && npx tsc --noEmit app/lib/types.ts
```

Expected: 无错误输出

- [ ] **Step 3: 提交**

```bash
git add app/lib/types.ts
git commit -m "feat: add LyricLine type definition"
```

---

### Task 2: 创建 LRC 解析工具

**Files:**
- Create: `app/lib/lyrics.ts`

- [ ] **Step 1: 创建 LRC 解析函数**

```typescript
// app/lib/lyrics.ts
import type { LyricLine } from "@/app/lib/types";

/**
 * 解析 LRC 格式歌词
 * 支持格式: [mm:ss.xx]歌词 或 [mm:ss]歌词
 */
export function parseLRC(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(lrc)) !== null) {
    const minutes = parseInt(match[1] ?? "0", 10);
    const seconds = parseInt(match[2] ?? "0", 10);
    const ms = match[3] ? parseInt(match[3].padEnd(3, "0"), 10) : 0;
    const time = minutes * 60 + seconds + ms / 1000;
    const text = match[4]?.trim() ?? "";

    if (text) {
      lines.push({ time, text });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/**
 * 二分查找当前应高亮的歌词行
 */
export function findCurrentLyricIndex(
  lyrics: LyricLine[],
  currentTime: number
): number {
  if (!lyrics.length) return -1;

  let low = 0;
  let high = lyrics.length - 1;
  let result = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const lyric = lyrics[mid];

    if (lyric && lyric.time <= currentTime) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return result;
}
```

- [ ] **Step 2: 提交**

```bash
git add app/lib/lyrics.ts
git commit -m "feat: add LRC parser and lyric sync utilities"
```

---

### Task 3: 创建歌词 API 路由

**Files:**
- Create: `app/api/lyrics/route.ts`

- [ ] **Step 1: 创建 API 路由**

```typescript
// app/api/lyrics/route.ts
import { NextRequest } from "next/server";
import { parseLRC } from "@/app/lib/lyrics";
import type { LyricLine } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const lyricsCache = new Map<string, LyricLine[]>();

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function searchSongId(title: string, artist: string): Promise<string | null> {
  const keyword = artist ? `${title} ${artist}` : title;
  const res = await fetch(
    `https://music.163.com/api/search/get?s=${encodeURIComponent(keyword)}&type=1&limit=1`,
    {
      headers: {
        "User-Agent": UA,
        Referer: "https://music.163.com/",
      },
    }
  );

  const json = (await res.json()) as {
    result?: { songs?: Array<{ id: number }> };
  };

  return json.result?.songs?.[0]?.id?.toString() ?? null;
}

async function fetchLyricsFromNetease(songId: string): Promise<LyricLine[]> {
  const res = await fetch(
    `https://music.163.com/api/song/lyric?id=${songId}&lv=1`,
    {
      headers: {
        "User-Agent": UA,
        Referer: "https://music.163.com/",
      },
    }
  );

  const json = (await res.json()) as {
    lrc?: { lyric?: string };
  };

  if (!json.lrc?.lyric) {
    return [];
  }

  return parseLRC(json.lrc.lyric);
}

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title")?.trim();
  const artist = req.nextUrl.searchParams.get("artist")?.trim() ?? "";

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  const cacheKey = `${title}-${artist}`;

  // 检查缓存
  if (lyricsCache.has(cacheKey)) {
    return Response.json({ lyrics: lyricsCache.get(cacheKey) });
  }

  try {
    // 搜索歌曲 ID
    const songId = await searchSongId(title, artist);
    if (!songId) {
      return Response.json({ lyrics: [] });
    }

    // 获取歌词
    const lyrics = await fetchLyricsFromNetease(songId);

    // 缓存结果
    lyricsCache.set(cacheKey, lyrics);

    return Response.json({ lyrics });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: 测试 API**

```bash
curl -s "http://localhost:3000/api/lyrics?title=晴天&artist=周杰伦" | head -c 500
```

Expected: JSON 响应包含 lyrics 数组

- [ ] **Step 3: 提交**

```bash
git add app/api/lyrics/route.ts
git commit -m "feat: add lyrics API route with Netease Music integration"
```

---

### Task 4: 扩展 PlayerContext 歌词状态

**Files:**
- Modify: `app/context/PlayerContext.tsx`

- [ ] **Step 1: 添加歌词状态和方法**

在 PlayerContext.tsx 中：

1. 添加 import:
```typescript
import type { LyricLine } from "@/app/lib/types";
import { findCurrentLyricIndex } from "@/app/lib/lyrics";
```

2. 扩展 PlayerCtx 类型（约第 17 行）:
```typescript
type PlayerCtx = {
  // ... 现有属性
  lyrics: LyricLine[];
  currentLyricIndex: number;
  fetchLyrics: (title: string, artist: string) => Promise<void>;
};
```

3. 在 PlayerProvider 中添加状态（约第 33 行后）:
```typescript
const [lyrics, setLyrics] = useState<LyricLine[]>([]);
const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
```

4. 添加 fetchLyrics 方法:
```typescript
const fetchLyrics = useCallback(async (title: string, artist: string) => {
  try {
    const res = await fetch(
      `/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
    );
    const data = (await res.json()) as { lyrics?: LyricLine[] };
    setLyrics(data.lyrics ?? []);
    setCurrentLyricIndex(-1);
  } catch {
    setLyrics([]);
    setCurrentLyricIndex(-1);
  }
}, []);
```

5. 在 timeupdate 时同步歌词（在现有 useEffect 中添加）:
```typescript
useEffect(() => {
  const idx = findCurrentLyricIndex(lyrics, progress);
  if (idx !== currentLyricIndex) {
    setCurrentLyricIndex(idx);
  }
}, [progress, lyrics, currentLyricIndex]);
```

6. 当播放新歌曲时自动获取歌词（在 playTrackWrapped 中添加）:
```typescript
// 在 playTrackWrapped 函数中，播放新歌曲后调用
if (track.title) {
  fetchLyrics(track.title, track.author ?? "");
}
```

7. 扩展 context value:
```typescript
const ctx: PlayerCtx = useMemo(
  () => ({
    // ... 现有属性
    lyrics,
    currentLyricIndex,
    fetchLyrics,
  }),
  [/* ... 现有依赖 */ lyrics, currentLyricIndex, fetchLyrics]
);
```

- [ ] **Step 2: 验证类型正确**

```bash
cd D:/aiclaude/vibecoding/aura-player && npx tsc --noEmit
```

Expected: 无类型错误

- [ ] **Step 3: 提交**

```bash
git add app/context/PlayerContext.tsx
git commit -m "feat: add lyrics state and sync logic to PlayerContext"
```

---

### Task 5: 创建 LyricsPanel 组件

**Files:**
- Create: `app/components/organisms/LyricsPanel.tsx`
- Modify: `app/components/organisms/index.ts`

- [ ] **Step 1: 创建 LyricsPanel 组件**

```tsx
// app/components/organisms/LyricsPanel.tsx
"use client";

import { usePlayer } from "@/app/context/PlayerContext";
import { useRef, useEffect, useState } from "react";

export function LyricsPanel() {
  const { lyrics, currentLyricIndex, state, seek } = usePlayer();
  const [collapsed, setCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLParagraphElement>(null);

  // 自动滚动到当前行
  useEffect(() => {
    if (activeRef.current && containerRef.current && !collapsed) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentLyricIndex, collapsed]);

  const handleClick = (time: number) => {
    seek(time);
  };

  if (!state.current) return null;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-sm border"
      style={{
        borderColor: "var(--color-outline-variant)",
        backgroundColor: "var(--color-surface-container)",
      }}
    >
      {/* 标题栏 */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center justify-between px-3 py-2 transition-colors hover:bg-[color:var(--color-surface-container-high)]"
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            fontFamily: "var(--font-headline)",
            color: "var(--color-primary)",
          }}
        >
          [ LYRICS ]
        </span>
        <span
          className="text-[10px]"
          style={{ color: "var(--color-outline)" }}
        >
          {collapsed ? "▼" : "▲"}
        </span>
      </button>

      {/* 歌词内容 */}
      {!collapsed && (
        <div
          ref={containerRef}
          className="scrollbar-thin max-h-[16rem] min-h-[6rem] overflow-y-auto px-3 py-2"
        >
          {lyrics.length === 0 ? (
            <p
              className="py-4 text-center text-[11px] uppercase tracking-[0.12em] opacity-50"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              [ NO LYRICS ]
            </p>
          ) : (
            lyrics.map((line, i) => {
              const isActive = i === currentLyricIndex;
              return (
                <p
                  key={`${line.time}-${i}`}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => handleClick(line.time)}
                  className={`cursor-pointer py-1 transition-all duration-200 ${
                    isActive ? "opacity-100" : "opacity-40 hover:opacity-70"
                  }`}
                  style={{
                    fontFamily: "var(--font-body)",
                    color: isActive
                      ? "var(--color-primary)"
                      : "var(--color-on-surface)",
                    fontWeight: isActive ? 600 : 400,
                    fontSize: isActive ? "14px" : "13px",
                  }}
                >
                  <span
                    className="mr-2 inline-block w-4 text-right text-[10px]"
                    style={{ color: "var(--color-outline)" }}
                  >
                    {isActive ? ">" : ""}
                  </span>
                  {line.text}
                </p>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 导出组件**

修改 `app/components/organisms/index.ts`:

```typescript
export { AgentChat } from "./AgentChat";
export { ClockPanel } from "./ClockPanel";
export { LyricsPanel } from "./LyricsPanel";
export { Player } from "./Player";
export { Playlist } from "./Playlist";
export { StatusBar } from "./StatusBar";
```

- [ ] **Step 3: 验证类型**

```bash
cd D:/aiclaude/vibecoding/aura-player && npx tsc --noEmit
```

Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add app/components/organisms/LyricsPanel.tsx app/components/organisms/index.ts
git commit -m "feat: add LyricsPanel component with terminal style"
```

---

### Task 6: 集成到页面布局

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: 添加 LyricsPanel 到页面**

修改 `app/page.tsx`:

```tsx
import { DanmakuOverlay, Logo, ModeSwitch } from "@/app/components/atoms";
import {
  AgentChat,
  ClockPanel,
  LyricsPanel,
  Player,
  Playlist,
  StatusBar,
} from "@/app/components/organisms";

export default function Home() {
  return (
    <div className="dot-matrix-bg flex min-h-[100dvh] items-center justify-center p-3 text-[color:var(--color-on-surface)] md:p-6 lg:p-8">
      <div
        className="flex h-[min(94dvh,56rem)] w-full max-w-7xl flex-col overflow-hidden rounded-md border shadow-lg"
        style={{
          borderColor: "var(--color-outline-variant)",
          backgroundColor: "color-mix(in srgb, var(--color-surface) 97%, transparent)",
        }}
      >
        <header
          className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b px-4 py-3 md:px-6"
          style={{
            borderColor: "var(--color-outline-variant)",
            backgroundColor: "color-mix(in srgb, var(--color-surface-container-low) 94%, transparent)",
          }}
        >
          <Logo />
          <nav aria-label="Main" className="flex flex-wrap items-center gap-4 md:gap-6">
            <ModeSwitch />
          </nav>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:grid md:grid-cols-2 md:grid-rows-[1fr] md:gap-6 md:p-6">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
            <DanmakuOverlay />
            <ClockPanel />
            <Player />
            <LyricsPanel />
            <Playlist />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1">
            <AgentChat />
          </div>
        </main>

        <StatusBar />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证构建**

```bash
cd D:/aiclaude/vibecoding/aura-player && npm run build
```

Expected: 构建成功，无错误

- [ ] **Step 3: 提交**

```bash
git add app/page.tsx
git commit -m "feat: integrate LyricsPanel into page layout"
```

---

### Task 7: 重启服务并测试

- [ ] **Step 1: 重启开发服务器**

```bash
taskkill //F //IM node.exe 2>&1; cd D:/aiclaude/vibecoding/aura-player && npm run dev
```

- [ ] **Step 2: 测试歌词功能**

1. 打开 http://localhost:3000
2. 切换到 CLOUD 模式
3. 搜索并播放一首歌曲
4. 验证歌词面板显示
5. 验证歌词与播放进度同步
6. 点击歌词行验证跳转功能

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: complete lyrics display feature with NetEase Music integration"
```

---

## 自检清单

- [x] 所有需求已覆盖
- [x] 无 TBD/TODO 占位符
- [x] 类型名称一致
- [x] 文件路径准确
- [x] 代码完整可执行
