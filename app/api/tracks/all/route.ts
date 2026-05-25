import { scanTracks } from "@/app/lib/tracks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tracks = await scanTracks();
    return Response.json({ tracks });
  } catch (err) {
    return Response.json({ error: String(err), tracks: [] }, { status: 500 });
  }
}
