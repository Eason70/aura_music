"use client";

import { usePlayer } from "@/app/context/PlayerContext";
import type { ReactNode } from "react";

export function PlayerWithLyrics({ children }: { children: ReactNode }) {
  const { lyricsExpanded } = usePlayer();

  return (
    <div
      className={`flex min-h-0 flex-col ${lyricsExpanded ? "absolute inset-0 z-10" : "flex-1"}`}
    >
      {children}
    </div>
  );
}
