"use client";

import Link from "next/link";

import { getAiModeProviderBlocker } from "@/features/run/providers/aiModeAccess";
import type { ProviderRuntimeStatus } from "@/features/run/providers/providerRuntimeConfig";
import { useAppStore } from "@/stores/app-store";

type NewGameModeScreenProps = {
  providerStatus: ProviderRuntimeStatus;
};

export function NewGameModeScreen({ providerStatus }: NewGameModeScreenProps) {
  const beginNewGameSetup = useAppStore((state) => state.beginNewGameSetup);
  const aiModeBlocker = getAiModeProviderBlocker(providerStatus);

  return (
    <main className="vn-page">
      <div className="vn-page-inner vn-fade-in">
        <header className="vn-page-head">
          <div>
            <p className="vn-title-sub">New Game</p>
            <h1 className="vn-page-title mt-2">Choose Mode</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64">
              Default Mode plays local premade routes without setup or API calls.
              Experimental AI Mode uses the current generated story flow.
            </p>
          </div>
          <Link href="/" className="vn-btn">
            Title
          </Link>
        </header>

        <div className="vn-mode-grid">
          <Link href="/new-game/default" className="vn-mode-card">
            <span className="vn-setup-kicker">No setup · local only</span>
            <span className="vn-mode-title">Default Mode</span>
            <span className="vn-mode-copy">
              Pick a premade route and play immediately. No text or image
              provider is called.
            </span>
          </Link>

          {aiModeBlocker.blocked ? (
            <div className="vn-mode-card vn-mode-card-disabled" aria-disabled="true">
              <span className="vn-setup-kicker">Generated story · unavailable</span>
              <span className="vn-mode-title">Experimental AI Mode</span>
              <span className="vn-mode-copy">{aiModeBlocker.message}</span>
            </div>
          ) : (
            <Link
              href="/setup"
              onClick={() => beginNewGameSetup()}
              className="vn-mode-card"
            >
              <span className="vn-setup-kicker">Generated story · API backed</span>
              <span className="vn-mode-title">Experimental AI Mode</span>
              <span className="vn-mode-copy">
                Build a custom seed, generate turns, and use Custom Code export
                for local run packages.
              </span>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
