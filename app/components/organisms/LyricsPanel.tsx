"use client";

import { usePlayer } from "@/app/context/PlayerContext";
import { useRef, useEffect } from "react";

export function LyricsPanel() {
  const { lyrics, currentLyricIndex, state, seek, lyricsExpanded, toggleLyrics } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLParagraphElement>(null);

  // Auto-scroll to current lyric line
  useEffect(() => {
    if (activeRef.current && containerRef.current && lyricsExpanded) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentLyricIndex, lyricsExpanded]);

  const handleClick = (time: number) => {
    seek(time);
  };

  return (
    <div
      className={`flex min-h-0 flex-col overflow-hidden rounded-sm border ${lyricsExpanded ? "flex-1" : "shrink-0"}`}
      style={{
        borderColor: "var(--color-outline-variant)",
        backgroundColor: "var(--color-surface-container)",
      }}
    >
      {/* Header */}
      <button
        onClick={toggleLyrics}
        className={`flex items-center justify-between px-3 transition-colors hover:bg-[color:var(--color-surface-container-high)] ${lyricsExpanded ? "py-2" : "py-1"}`}
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
          {lyricsExpanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Lyrics content */}
      {lyricsExpanded && (
        <div
          ref={containerRef}
          className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2"
        >
          {!state.current ? (
            <p
              className="py-4 text-center text-[11px] uppercase tracking-[0.12em] opacity-50"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              [ NO TRACK LOADED ]
            </p>
          ) : lyrics.length === 0 ? (
            <p
              className="py-4 text-center text-[11px] uppercase tracking-[0.12em] opacity-50"
              style={{ fontFamily: "var(--font-headline)" }}
            >
              [ LOADING LYRICS... ]
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
