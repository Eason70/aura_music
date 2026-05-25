import { NextRequest } from "next/server";
import { getVideoInfo, getDashAudioUrl } from "@/app/lib/bili";

export const dynamic = "force-dynamic";

const AUDIO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Referer: "https://www.bilibili.com/",
  Origin: "https://www.bilibili.com",
};

export async function GET(req: NextRequest) {
  const bvid = req.nextUrl.searchParams.get("bvid")?.trim();

  if (!bvid) {
    return Response.json({ error: "bvid is required" }, { status: 400 });
  }

  try {
    const { cid } = await getVideoInfo(bvid);
    const audios = await getDashAudioUrl(bvid, cid);

    if (!audios.length) {
      return Response.json({ error: "No audio stream found" }, { status: 404 });
    }

    // Pick highest quality audio
    const best = audios.sort((a, b) => b.bandwidth - a.bandwidth)[0]!;

    const audioRes = await fetch(best.baseUrl, {
      headers: AUDIO_HEADERS,
    });

    if (!audioRes.ok) {
      return Response.json(
        { error: "Failed to fetch audio stream" },
        { status: 502 }
      );
    }

    return new Response(audioRes.body, {
      headers: {
        "Content-Type": best.mimeType || "audio/mp4",
        "Content-Disposition": `attachment; filename="${bvid}.m4a"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
