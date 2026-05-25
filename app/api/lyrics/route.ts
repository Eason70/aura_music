import { NextRequest } from "next/server";
import { parseLRC } from "@/app/lib/lyrics";
import { getVideoInfo } from "@/app/lib/bili";
import type { LyricLine } from "@/app/lib/types";

export const dynamic = "force-dynamic";

const lyricsCache = new Map<string, LyricLine[]>();

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * 从B站获取视频真实标题
 */
async function getBiliVideoTitle(bvid: string): Promise<string> {
  try {
    const info = await getVideoInfo(bvid);
    return info.title || bvid;
  } catch {
    return bvid;
  }
}

/**
 * 清理标题用于歌词搜索（移除括号内容、BV号等）
 */
function cleanTitleForSearch(title: string): string {
  return title
    .replace(/BV[a-zA-Z0-9]+/g, "") // 移除 BV 号
    .replace(/[【\[（(].*?[】\]）)]/g, "") // 移除括号内容
    .replace(/\s+/g, " ") // 合并空格
    .trim();
}

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
  let title = req.nextUrl.searchParams.get("title")?.trim();
  let artist = req.nextUrl.searchParams.get("artist")?.trim() ?? "";

  if (!title) {
    return Response.json({ error: "title is required" }, { status: 400 });
  }

  // 如果标题是 BV 号，从B站获取真实标题
  if (title.startsWith("BV") && title.length >= 10) {
    const bvid = title;
    title = await getBiliVideoTitle(bvid);
    // 从标题中提取歌手信息（常见格式：歌手 - 歌名 或 歌名 - 歌手）
    const parts = title.split(/[-–—|｜]/);
    if (parts.length >= 2 && !artist) {
      artist = parts[0]?.trim() ?? "";
      title = parts[1]?.trim() ?? title;
    }
  }

  // 清理标题用于搜索
  const searchTitle = cleanTitleForSearch(title);

  const cacheKey = `${searchTitle}-${artist}`;

  // 检查缓存
  if (lyricsCache.has(cacheKey)) {
    return Response.json({ lyrics: lyricsCache.get(cacheKey) });
  }

  try {
    // 搜索歌曲 ID
    let songId = await searchSongId(searchTitle, artist);

    // 如果第一次搜索失败，尝试只用标题（不带歌手）
    if (!songId && artist) {
      songId = await searchSongId(searchTitle, "");
    }

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
