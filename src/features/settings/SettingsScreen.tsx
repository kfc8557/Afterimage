"use client";

import Link from "next/link";

import type { Settings } from "@/domain/types";
import { useAppStore } from "@/stores/app-store";

const imageModeOptions: Array<{
  label: string;
  value: Settings["imageMode"];
}> = [
  { value: "off", label: "Text only" },
  { value: "aggressive", label: "With image" },
];

export function SettingsScreen() {
  const settings = useAppStore((state) => state.settings);
  const setImageMode = useAppStore((state) => state.setImageMode);
  const setTextSpeed = useAppStore((state) => state.setTextSpeed);
  const setAutoAdvance = useAppStore((state) => state.setAutoAdvance);
  const setReduceMotion = useAppStore((state) => state.setReduceMotion);

  return (
    <main className="vn-page">
      <div className="vn-page-inner vn-fade-in">
        <header className="vn-page-head">
          <div>
            <p className="vn-title-sub">System</p>
            <h1 className="vn-page-title mt-2">Settings</h1>
          </div>
          <Link href="/" className="vn-btn">
            Title
          </Link>
        </header>

        <div className="flex flex-col gap-3">
          <div className="vn-toggle-row">
            <div>
              <div className="vn-setup-omakase-label">Image mode</div>
              <p className="vn-setup-omakase-detail">
                Text only hides visual layers. With image shows available
                backgrounds and character sprites.
              </p>
            </div>
            <div className="vn-segment" role="group" aria-label="image mode">
              {imageModeOptions.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className="vn-segment-btn"
                  aria-pressed={settings.imageMode === mode.value}
                  onClick={() => setImageMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="vn-toggle-row">
            <div>
              <div className="vn-setup-omakase-label">Text speed</div>
              <p className="vn-setup-omakase-detail">
                Controls auto-advance timing when Auto advance is on.
              </p>
            </div>
            <div className="vn-segment" role="group" aria-label="text speed">
              {(["slow", "normal", "fast"] as const).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className="vn-segment-btn"
                  aria-pressed={settings.textSpeed === speed}
                  onClick={() => setTextSpeed(speed)}
                >
                  {speed}
                </button>
              ))}
            </div>
          </div>

          <label className="vn-toggle-row">
            <div>
              <div className="vn-setup-omakase-label">Auto advance</div>
              <p className="vn-setup-omakase-detail">
                Automatically reveals the next line using the selected text speed.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoAdvance}
              onChange={(event) => setAutoAdvance(event.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>

          <label className="vn-toggle-row">
            <div>
              <div className="vn-setup-omakase-label">Autosave</div>
              <p className="vn-setup-omakase-detail">
                Persist checkpoints after each turn. Off by default.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.reduceMotion}
              onChange={(event) => setReduceMotion(event.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>
        </div>
      </div>
    </main>
  );
}
