"use client";

import type { Track, PlayerState, LyricLine } from "@/app/lib/types";
import { findCurrentLyricIndex } from "@/app/lib/lyrics";
import { useAudioPlayer } from "@/app/hooks/useAudioPlayer";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type PlayerCtx = {
  state: PlayerState;
  playTrack: (track: Track, playlist?: Track[]) => void;
  addTracks: (tracks: Track[]) => void;
  removeTrack: (trackId: string) => void;
  next: () => void;
  prev: () => void;
  togglePlay: () => void | Promise<void>;
  seek: (n: number) => void;
  setVolume: (n: number) => void;
  stop: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  lyrics: LyricLine[];
  currentLyricIndex: number;
  fetchLyrics: (title: string, artist: string) => Promise<void>;
  lyricsExpanded: boolean;
  toggleLyrics: () => void;
};

const PlayerContext = createContext<PlayerCtx | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [lyricsExpanded, setLyricsExpanded] = useState(false);

  const playlistRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);
  const playTrackWrappedRef = useRef<(track: Track, pl?: Track[]) => void>(() => {});

  // 启动时自动加载已下载的歌曲
  useEffect(() => {
    async function loadSavedTracks() {
      try {
        console.log("[loadSavedTracks] fetching...");
        const res = await fetch("/api/tracks/all");
        const data = (await res.json()) as { tracks?: Track[] };
        console.log("[loadSavedTracks] received:", data.tracks?.length, "tracks");
        if (data.tracks?.length) {
          setPlaylist(data.tracks);
          playlistRef.current = data.tracks;
        }
      } catch (err) {
        console.error("[loadSavedTracks] error:", err);
      }
    }
    loadSavedTracks();
  }, []);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const handleEnded = useCallback(() => {
    const pl = playlistRef.current;
    if (!pl.length) return;
    const ni = (indexRef.current + 1) % pl.length;
    const t = pl[ni];
    setIndex(ni);
    indexRef.current = ni;
    if (t) playTrackWrappedRef.current(t);
  }, []);

  const {
    audioRef,
    playing,
    progress,
    duration,
    volume,
    toggle,
    seek,
    setVolume,
    playTrack,
    pause,
  } = useAudioPlayer({ onEnded: handleEnded });

  const current =
    index >= 0 && index < playlist.length ? playlist[index] ?? null : null;

  const addTracks = useCallback((tracks: Track[]) => {
    setPlaylist((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      const fresh = tracks.filter((t) => !ids.has(t.id));
      if (!fresh.length) return prev;
      const next = [...prev, ...fresh];
      playlistRef.current = next;
      return next;
    });

    if (indexRef.current < 0) {
      const cur = playlistRef.current;
      const first = cur[0];
      if (first) {
        setIndex(0);
        indexRef.current = 0;
        playTrackWrappedRef.current(first);
      }
    }
  }, []);

  const removeTrack = useCallback(
    (trackId: string) => {
      setPlaylist((prev) => {
        const rmIdx = prev.findIndex((t) => t.id === trackId);
        if (rmIdx < 0) return prev;
        const next = [...prev];
        next.splice(rmIdx, 1);
        playlistRef.current = next;

        const curIdx = indexRef.current;

        if (rmIdx === curIdx) {
          // removing the currently playing track
          if (next.length === 0) {
            setIndex(-1);
            indexRef.current = -1;
            pause();
          } else {
            const newIdx = Math.min(rmIdx, next.length - 1);
            setIndex(newIdx);
            indexRef.current = newIdx;
            const t = next[newIdx];
            if (t) playTrackWrappedRef.current(t);
          }
        } else if (rmIdx < curIdx) {
          // removed a track before current — shift index back
          const newIdx = curIdx - 1;
          setIndex(newIdx);
          indexRef.current = newIdx;
        }
        // rmIdx > curIdx: index unchanged

        return next;
      });
    },
    [pause]
  );

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

  const playTrackWrapped = useCallback(
    (track: Track, pl?: Track[]) => {
      if (pl?.length) {
        const nextPl = [...pl];
        const i = Math.max(nextPl.findIndex((t) => t.id === track.id), 0);
        setPlaylist(nextPl);
        playlistRef.current = nextPl;
        setIndex(i);
        indexRef.current = i;
        playTrack(track);
      } else {
        const cur = playlistRef.current;
        const i = cur.findIndex((t) => t.id === track.id);
        if (i >= 0) {
          setIndex(i);
          indexRef.current = i;
          playTrack(track);
        } else {
          const single = [track];
          setPlaylist(single);
          playlistRef.current = single;
          setIndex(0);
          indexRef.current = 0;
          playTrack(track);
        }
      }
      if (track.title) {
        fetchLyrics(track.title, track.author ?? "");
      }
    },
    [playTrack, fetchLyrics]
  );

  useEffect(() => {
    playTrackWrappedRef.current = playTrackWrapped;
  }, [playTrackWrapped]);

  const next = useCallback(() => {
    const i = indexRef.current;
    const pl = playlistRef.current;
    if (!pl.length) return;
    const ni = Math.min(pl.length - 1, Math.max(i + 1, 0));
    if (ni === i && i >= 0) return;
    setIndex(ni);
    indexRef.current = ni;
    const t = pl[ni];
    if (t) playTrackWrappedRef.current(t);
  }, []);

  const prev = useCallback(() => {
    const i = indexRef.current;
    const pl = playlistRef.current;
    if (!pl.length || i <= 0) return;
    const ni = Math.max(0, i - 1);
    setIndex(ni);
    indexRef.current = ni;
    const t = pl[ni];
    if (t) playTrackWrappedRef.current(t);
  }, []);

  const togglePlayWrapped = useCallback(() => {
    if (indexRef.current < 0 || !playlistRef.current[indexRef.current]) {
      const first = playlistRef.current[0];
      if (first) {
        setIndex(0);
        indexRef.current = 0;
        playTrackWrappedRef.current(first);
        return;
      }
    }
    return toggle();
  }, [toggle]);

  const stop = useCallback(() => {
    pause();
    seek(0);
  }, [pause, seek]);

  const toggleLyrics = useCallback(() => {
    setLyricsExpanded((v) => !v);
  }, []);

  useEffect(() => {
    const idx = findCurrentLyricIndex(lyrics, progress);
    if (idx !== currentLyricIndex) {
      setCurrentLyricIndex(idx);
    }
  }, [progress, lyrics, currentLyricIndex]);

  const state: PlayerState = useMemo(
    () => ({
      current,
      playlist,
      index: index < 0 ? 0 : index,
      playing,
      progress,
      duration,
      volume,
    }),
    [current, playlist, index, playing, progress, duration, volume]
  );

  const ctx: PlayerCtx = useMemo(
    () => ({
      state,
      playTrack: playTrackWrapped,
      addTracks,
      removeTrack,
      next,
      prev,
      togglePlay: togglePlayWrapped,
      seek,
      setVolume,
      stop,
      audioRef,
      lyrics,
      currentLyricIndex,
      fetchLyrics,
      lyricsExpanded,
      toggleLyrics,
    }),
    [state, playTrackWrapped, addTracks, removeTrack, next, prev, togglePlayWrapped, seek, setVolume, stop, audioRef, lyrics, currentLyricIndex, fetchLyrics, lyricsExpanded, toggleLyrics]
  );

  return (
    <PlayerContext.Provider value={ctx}>
      <audio ref={audioRef} className="hidden" preload="metadata" aria-hidden />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const v = useContext(PlayerContext);
  if (!v) throw new Error("usePlayer must be used within PlayerProvider");
  return v;
}
