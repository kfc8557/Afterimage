"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppStore } from "@/stores/app-store";

import { FRICTION_PROTOCOL_STORY_ID } from "./premadeStories";

export function DefaultStoryPickerScreen() {
  const router = useRouter();
  const startDefaultStory = useAppStore((state) => state.startDefaultStory);
  const persistence = useAppStore((state) => state.persistence);
  const [startingStoryId, setStartingStoryId] = useState<string | null>(null);
  const hasRequestedStart = useRef(false);

  const handleStartStory = useCallback(async (storyId: string) => {
    hasRequestedStart.current = true;
    setStartingStoryId(storyId);
    const started = await startDefaultStory(storyId);
    setStartingStoryId(null);

    if (started) {
      router.push("/run");
    }
  }, [router, startDefaultStory]);

  useEffect(() => {
    if (startingStoryId || hasRequestedStart.current) {
      return;
    }

    void handleStartStory(FRICTION_PROTOCOL_STORY_ID);
  }, [handleStartStory, startingStoryId]);

  return (
    <main className="vn-page">
      <div className="vn-page-inner vn-fade-in">
        <header className="vn-page-head">
          <div>
            <p className="vn-title-sub">Default Mode</p>
            <h1 className="vn-page-title mt-2">The Friction Protocol</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64">
              Starting the local authored Astra route. Default Mode does not
              call text or image providers.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/new-game" className="vn-btn">
              Modes
            </Link>
            <Link href="/" className="vn-btn">
              Title
            </Link>
          </div>
        </header>

        <div className="vn-save-row">
          <span className="vn-save-meta">Default</span>
          <div className="min-w-0">
            <p className="vn-save-meta">Local authored route</p>
            <h2 className="vn-save-title">Starting Astra’s story</h2>
            <p className="vn-save-summary">
              If navigation does not continue automatically, use the button.
            </p>
          </div>
          <div className="vn-save-actions">
            <button
              type="button"
              disabled={Boolean(startingStoryId)}
              onClick={() => {
                void handleStartStory(FRICTION_PROTOCOL_STORY_ID);
              }}
              className="vn-btn vn-btn-primary"
            >
              {startingStoryId ? "Starting" : "Start"}
            </button>
          </div>
        </div>

        {persistence.lastError ? (
          <p className="text-sm text-[var(--accent)]">{persistence.lastError}</p>
        ) : null}
      </div>
    </main>
  );
}
