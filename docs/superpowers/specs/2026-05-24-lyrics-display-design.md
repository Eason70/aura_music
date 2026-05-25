# 歌词显示功能设计文档

## 概述

为 AuraPlayer 添加歌词显示功能，通过网易云音乐 API 获取 LRC 歌词，在播放器界面以赛博朋克终端风格逐行滚动显示。

## 需求

- **歌词来源**：网易云音乐 API
- **显示样式**：赛博朋克终端风格，与现有 UI 搭配
- **同步方式**：逐行滚动高亮，与播放进度同步
- **缓存策略**：后端内存缓存，同一首歌只请求一次

## 架构设计

### 1. 数据层

#### 1.1 歌词 API 路由

**文件**：`app/api/lyrics/route.ts`

```typescript
// 请求参数
GET /api/lyrics?title=歌曲标题&artist=歌手

// 响应格式
{
  "lyrics": [
    { "time": 0.0, "text": "歌词文本" },
    { "time": 5.2, "text": "下一句歌词" }
  ]
}
```

#### 1.2 网易云 API 调用流程

1. 搜索歌曲：`https://music.163.com/api/search/get?s={title}+{artist}&type=1&limit=1`
2. 获取歌词：`https://music.163.com/api/song/lyric?id={songId}&lv=1`
3. 解析 LRC 格式为 `LyricLine[]`

#### 1.3 缓存策略

```typescript
const lyricsCache = new Map<string, LyricLine[]>();
// key: `${title}-${artist}`
// 过期：不过期（内存缓存，重启清空）
```

### 2. 类型定义

**扩展**：`app/lib/types.ts`

```typescript
export interface LyricLine {
  time: number;    // 秒
  text: string;    // 歌词文本
}
```

### 3. UI 组件

#### 3.1 LyricsPanel 组件

**文件**：`app/components/organisms/LyricsPanel.tsx`

**样式设计**：
- 背景：`var(--color-surface-container)`
- 边框：`var(--color-outline-variant)`
- 当前行：`var(--color-primary)` 高亮，加粗
- 其他行：`var(--color-on-surface)` 60% 透明度
- 字体：`var(--font-body)` 等宽字体
- 终端风格：左侧 `>` 指针指示当前行

**交互**：
- 自动滚动到当前行
- 点击某行跳转到对应时间
- 可折叠/展开

#### 3.2 布局调整

**文件**：`app/page.tsx`

在 Player 和 Playlist 之间插入 LyricsPanel：

```tsx
<Player />
<LyricsPanel />  // 新增
<Playlist />
```

### 4. 状态管理

#### 4.1 扩展 PlayerContext

**文件**：`app/context/PlayerContext.tsx`

新增状态：
```typescript
lyrics: LyricLine[];
currentLyricIndex: number;
```

新增方法：
```typescript
fetchLyrics: (title: string, artist: string) => Promise<void>;
```

#### 4.2 歌词同步逻辑

在 `useAudioPlayer` 的 `timeupdate` 事件中：
1. 获取当前播放时间
2. 二分查找当前应高亮的歌词行
3. 更新 `currentLyricIndex`

### 5. 错误处理

- API 请求失败：显示 `[ LYRICS UNAVAILABLE ]`
- 无歌词结果：显示 `[ NO LYRICS FOUND ]`
- 网络错误：显示 `[ NETWORK ERROR ]`

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `app/api/lyrics/route.ts` | 新增 | 歌词 API 路由 |
| `app/lib/types.ts` | 修改 | 添加 LyricLine 类型 |
| `app/context/PlayerContext.tsx` | 修改 | 添加歌词状态和同步逻辑 |
| `app/components/organisms/LyricsPanel.tsx` | 新增 | 歌词显示组件 |
| `app/components/organisms/index.ts` | 修改 | 导出 LyricsPanel |
| `app/page.tsx` | 修改 | 插入 LyricsPanel |

## 技术约束

- 网易云 API 可能有跨域限制，需要后端代理
- LRC 格式解析需要处理多种时间戳格式
- 歌词同步需要考虑音频加载延迟
