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
