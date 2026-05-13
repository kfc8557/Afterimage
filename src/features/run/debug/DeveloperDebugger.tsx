"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import type { ProviderRuntimeStatus } from "@/features/run/providers/providerRuntimeConfig";
import { regressionFixtures } from "@/features/run/fixtures/regressionFixtures";
import { useAppStore } from "@/stores/app-store";

type DebugTab = "fixtures" | "tier1" | "tier2" | "tier3";

const debugTabs: Array<{ id: DebugTab; label: string }> = [
  { id: "fixtures", label: "Fixtures" },
  { id: "tier1", label: "Tier 1" },
  { id: "tier2", label: "Tier 2" },
  { id: "tier3", label: "Tier 3" },
];

function JsonBlock({ value }: { value: unknown }) {
  const jsonValue = JSON.stringify(value, null, 2);

  return (
    <div className="rounded-[14px] border border-white/10 bg-black/34">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/42">
          JSON
        </span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(jsonValue);
          }}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/58 hover:border-[rgba(217,181,109,0.42)] hover:text-white"
        >
          Copy
        </button>
      </div>
      <pre className="max-h-96 overflow-auto p-4 font-mono text-xs leading-5 text-white/76">
        {jsonValue}
      </pre>
    </div>
  );
}

function DebugDetails({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-[16px] border border-white/10 bg-black/22 p-4"
    >
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--accent-soft)]">
        {title}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

export function DeveloperDebugger({
  providerStatus,
}: {
  providerStatus: ProviderRuntimeStatus;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DebugTab>("tier1");
  const activeRun = useAppStore((state) => state.activeRun);
  const persistence = useAppStore((state) => state.persistence);
  const developerDebug = useAppStore((state) => state.developerDebug);
  const startRegressionFixture = useAppStore(
    (state) => state.startRegressionFixture,
  );
  const snapshot = developerDebug.lastTurnSnapshot;
  const providerErrorSnapshot = developerDebug.lastProviderErrorSnapshot;
  const currentNode = activeRun.currentNodeId
    ? activeRun.episodeNodesById[activeRun.currentNodeId] ?? null
    : null;
  const checkpointId =
    activeRun.storyRun?.latestCheckpointId ??
    persistence.lastSavedCheckpointId ??
    snapshot?.currentCheckpointId ??
    null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="rounded-full border border-[rgba(152,220,232,0.24)] bg-black/18 px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent-soft)] backdrop-blur-md hover:border-[rgba(152,220,232,0.48)] hover:text-white"
      >
        Dev
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 p-3 backdrop-blur-md sm:p-5"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <section className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[1.5rem] border border-[rgba(152,220,232,0.22)] bg-[linear-gradient(180deg,rgba(9,13,20,0.96),rgba(4,5,8,0.98))] shadow-2xl">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--accent-soft)]">
                  Dev internal
                </p>
                <h2 className="mt-1 text-xl font-semibold">Developer Debugger</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="vn-button min-h-0 px-4 py-2 text-[10px]"
              >
                Close
              </button>
            </header>

            <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3 sm:px-5">
              {debugTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${
                    activeTab === tab.id
                      ? "border-[rgba(152,220,232,0.46)] bg-[rgba(152,220,232,0.12)] text-[var(--accent-soft)]"
                      : "border-white/10 bg-white/5 text-white/58 hover:border-[rgba(137,184,189,0.38)] hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {activeTab === "fixtures" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {regressionFixtures.map((fixture) => (
                    <button
                      key={fixture.id}
                      type="button"
                      onClick={() => {
                        void startRegressionFixture(fixture.id);
                        setIsOpen(false);
                      }}
                      className="rounded-[16px] border border-white/10 bg-white/5 p-4 text-left hover:border-[rgba(137,184,189,0.42)]"
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent-soft)]">
                        {fixture.orientation}
                      </span>
                      <span className="mt-2 block text-lg font-semibold">
                        {fixture.label}
                      </span>
                      <span className="mt-2 block text-sm leading-6 text-white/60">
                        Choices: {fixture.recommendedChoiceIds.join(" -> ")}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {activeTab === "tier1" ? (
                <div className="grid gap-3">
                  <DebugDetails title="Checkpoint and node basics" defaultOpen>
                    <JsonBlock
                      value={{
                        currentCheckpointId: checkpointId,
                        currentNodeId: activeRun.currentNodeId,
                        snapshotCheckpointId: snapshot?.currentCheckpointId ?? null,
                        snapshotNodeId: snapshot?.currentNodeId ?? null,
                        sourceCheckpointId: snapshot?.sourceCheckpointId ?? null,
                        saveDisposition: snapshot?.saveDisposition ?? null,
                        activeFixtureId: developerDebug.activeFixtureId,
                        currentNodeTurnType: currentNode?.turnType ?? null,
                      }}
                    />
                  </DebugDetails>
                  <DebugDetails title="StoryTurnRequest">
                    <JsonBlock value={snapshot?.storyTurnRequest ?? null} />
                  </DebugDetails>
                  <DebugDetails title="Raw provider response">
                    <JsonBlock value={snapshot?.rawProviderResponse ?? null} />
                  </DebugDetails>
                  <DebugDetails title="Validated StoryTurnResponse">
                    <JsonBlock
                      value={snapshot?.validatedStoryTurnResponse ?? null}
                    />
                  </DebugDetails>
                  <DebugDetails title="Applied StateDelta">
                    <JsonBlock
                      value={
                        snapshot?.appliedStateDelta ??
                        currentNode?.stateDelta ??
                        null
                      }
                    />
                  </DebugDetails>
                  <DebugDetails title="Current runState">
                    <JsonBlock
                      value={activeRun.storyRun?.runState ?? snapshot?.runState ?? null}
                    />
                  </DebugDetails>
                </div>
              ) : null}

              {activeTab === "tier2" ? (
                <div className="grid gap-3">
                  <DebugDetails title="Live parameters" defaultOpen>
                    <JsonBlock value={snapshot?.liveParameters ?? null} />
                  </DebugDetails>
                  <DebugDetails title="Relationship, thread, inventory">
                    <JsonBlock
                      value={{
                        relationshipTracks:
                          activeRun.storyRun?.runState.relationshipTracks ??
                          snapshot?.relationshipTracks ??
                          null,
                        activeThreads:
                          activeRun.storyRun?.runState.activeThreads ??
                          snapshot?.activeThreads ??
                          null,
                        inventoryFlags:
                          activeRun.storyRun?.runState.inventoryFlags ??
                          snapshot?.inventoryFlags ??
                          null,
                      }}
                    />
                  </DebugDetails>
                  <DebugDetails title="recentWaves">
                    <JsonBlock
                      value={
                        activeRun.storyRun?.recentWaves ??
                        snapshot?.recentWaves ??
                        null
                      }
                    />
                  </DebugDetails>
                  <DebugDetails title="Conclusion pressure">
                    <JsonBlock
                      value={{
                        current:
                          activeRun.storyRun?.runState.conclusionPressure ??
                          snapshot?.conclusionPressure.currentValue ??
                          null,
                        lastDelta: snapshot?.conclusionPressure.lastDelta ?? null,
                        changedThisTurn:
                          snapshot?.conclusionPressure.changedThisTurn ?? null,
                      }}
                    />
                  </DebugDetails>
                  <DebugDetails title="Story and visual policy state">
                    <JsonBlock value={snapshot?.storyPolicyState ?? null} />
                  </DebugDetails>
                </div>
              ) : null}

              {activeTab === "tier3" ? (
                <div className="grid gap-3">
                  <DebugDetails title="Provider chosen" defaultOpen>
                    <JsonBlock
                      value={{
                        runtimeStatus: providerStatus,
                        turnProviderDetails: snapshot?.providerDetails ?? null,
                        latestProviderErrorDetails: providerErrorSnapshot
                          ? {
                              providerName: providerErrorSnapshot.providerName,
                              model: providerErrorSnapshot.model,
                              retryCount: providerErrorSnapshot.retryCount,
                            }
                          : null,
                      }}
                    />
                  </DebugDetails>
                  <DebugDetails title="Latest provider format diagnostics">
                    <JsonBlock
                      value={providerErrorSnapshot?.formatDiagnostics ?? null}
                    />
                  </DebugDetails>
                  <DebugDetails title="Image request and action state">
                    <JsonBlock value={snapshot?.imageState ?? null} />
                  </DebugDetails>
                  <DebugDetails title="Fixture QA checklist">
                    <JsonBlock
                      value={
                        regressionFixtures.find(
                          (fixture) =>
                            fixture.id === developerDebug.activeFixtureId,
                        )?.qaChecklist ?? []
                      }
                    />
                  </DebugDetails>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
