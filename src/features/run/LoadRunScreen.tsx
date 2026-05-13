"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { LocalRunPackageExportResult } from "@/features/run/persistence/browserCheckpointRepository";
import { Modal } from "@/features/run/RunOverlays";
import { useAppStore } from "@/stores/app-store";

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function exportSummary(exportResult: LocalRunPackageExportResult | null) {
  if (!exportResult) return null;

  return [
    `${formatBytes(exportResult.packageBytes)} package`,
    `${exportResult.includedImageAssetCount} image asset(s) included`,
    exportResult.omittedImageAssets.length > 0
      ? `${exportResult.omittedImageAssets.length} image asset(s) omitted`
      : "no image omissions",
  ].join(" · ");
}

export function LoadRunScreen() {
  const router = useRouter();
  const persistence = useAppStore((state) => state.persistence);
  const refreshSavedRuns = useAppStore((state) => state.refreshSavedRuns);
  const loadPersistedCheckpoint = useAppStore(
    (state) => state.loadPersistedCheckpoint,
  );
  const replayPersistedCheckpoint = useAppStore(
    (state) => state.replayPersistedCheckpoint,
  );
  const exportSavedRunPackage = useAppStore(
    (state) => state.exportSavedRunPackage,
  );
  const [exportText, setExportText] = useState("");
  const [exportResult, setExportResult] =
    useState<LocalRunPackageExportResult | null>(null);
  const [exportingCheckpointId, setExportingCheckpointId] = useState<
    string | null
  >(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [localInfo, setLocalInfo] = useState<string | null>(null);

  useEffect(() => {
    void refreshSavedRuns();
  }, [refreshSavedRuns]);

  async function handleExportCode(checkpointId: string) {
    setExportingCheckpointId(checkpointId);
    const result = await exportSavedRunPackage(checkpointId);
    setExportingCheckpointId(null);

    if (!result) return;

    setExportResult(result);
    setExportText(result.packageText);
    setIsExportModalOpen(true);
    setLocalInfo("Custom Code package generated from this save.");
  }

  async function handleCopyCode() {
    if (!exportText) return;

    try {
      await navigator.clipboard.writeText(exportText);
      setLocalInfo("Custom Code package copied.");
    } catch {
      setLocalInfo("Custom Code package is ready; copy it from the box.");
    }
  }

  return (
    <main className="vn-page">
      <div className="vn-page-inner vn-fade-in">
        <header className="vn-page-head">
          <div>
            <p className="vn-title-sub">Checkpoint archive</p>
            <h1 className="vn-page-title mt-2">Load Game</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64">
              Replay is read-only stored playback. Experimental AI saves can be
              exported as browser-local Custom Code packages.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="vn-btn">
              Title
            </Link>
            <button
              type="button"
              onClick={() => {
                void refreshSavedRuns();
              }}
              disabled={persistence.isRefreshing}
              className="vn-btn"
            >
              {persistence.isRefreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </header>

        {persistence.savedRuns.length === 0 && !persistence.isRefreshing ? (
          <div className="vn-empty">
            <p className="vn-title-sub">The archive is empty</p>
            <p className="mt-3 text-white/64">
              Completed turns autosave once a checkpoint bundle is written.
            </p>
            <Link
              href="/new-game"
              className="vn-btn vn-btn-primary mt-5 inline-flex"
            >
              Start a new run
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {persistence.savedRuns.map((savedRun, index) => {
              const isDefaultMode = savedRun.runMode === "premade-default";

              return (
                <article key={savedRun.checkpointId} className="vn-save-row">
                  <span className="vn-save-meta">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="vn-save-meta">
                      {isDefaultMode ? "Default Mode" : "Experimental AI"} ·
                      Run {savedRun.storyRunId.slice(0, 8)} · CP{" "}
                      {savedRun.checkpointIndex} · {savedRun.status}
                    </p>
                    <p className="vn-save-title truncate">
                      {savedRun.locationLabel ?? "Untitled scene"}
                    </p>
                    <p className="vn-save-summary">{savedRun.sceneSummary}</p>
                    <p className="vn-save-meta mt-1">
                      {formatTimestamp(savedRun.updatedAt)}
                    </p>
                  </div>
                  <div className="vn-save-actions">
                      <button
                        type="button"
                        disabled={
                          persistence.loadingCheckpointId !== null ||
                          exportingCheckpointId !== null
                        }
                        onClick={async () => {
                          const replaying = await replayPersistedCheckpoint(
                            savedRun.checkpointId,
                          );
                          if (replaying) {
                            router.push("/run");
                          }
                        }}
                        className="vn-btn"
                      >
                        Replay
                      </button>
                      {!isDefaultMode ? (
                        <button
                          type="button"
                          disabled={
                            persistence.loadingCheckpointId !== null ||
                            exportingCheckpointId !== null
                          }
                          onClick={async () => {
                            await handleExportCode(savedRun.checkpointId);
                          }}
                          className="vn-btn"
                        >
                          {exportingCheckpointId === savedRun.checkpointId
                            ? "Exporting"
                            : "Export Code"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={
                          persistence.loadingCheckpointId !== null ||
                          exportingCheckpointId !== null
                        }
                        onClick={async () => {
                          const loaded = await loadPersistedCheckpoint(
                            savedRun.checkpointId,
                          );
                          if (loaded) {
                            router.push("/run");
                          }
                        }}
                        className="vn-btn vn-btn-primary"
                      >
                        {persistence.loadingCheckpointId === savedRun.checkpointId
                          ? "Loading"
                          : "Load"}
                      </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {localInfo ? (
          <p className="text-sm text-[var(--accent-soft)]">{localInfo}</p>
        ) : null}
        {persistence.lastError ? (
          <p className="text-sm text-[var(--accent)]">{persistence.lastError}</p>
        ) : null}
      </div>
      {isExportModalOpen && exportText ? (
        <Modal
          title="Custom Code package"
          onClose={() => setIsExportModalOpen(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  void handleCopyCode();
                }}
                className="vn-btn vn-btn-primary"
              >
                Copy Code
              </button>
              <Link href="/custom-code" className="vn-btn">
                Open Custom Code
              </Link>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-white/64">
              Paste this into Custom Code to create a separate playable local
              run. Image data can make the code long.
            </p>
            <textarea
              value={exportText}
              onChange={(event) => setExportText(event.target.value)}
              className="min-h-64 w-full rounded-[18px] border border-white/10 bg-black/22 px-4 py-3 font-mono text-xs leading-5 text-white outline-none focus:border-[rgba(217,181,109,0.45)]"
            />
            <p className="text-sm text-white/54">
              {exportSummary(exportResult)}
            </p>
            {exportResult?.omittedImageAssets.length ? (
              <p className="text-sm leading-6 text-[var(--accent)]">
                Some image data was omitted because it was missing locally or
                exceeded the local package image cap.
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
