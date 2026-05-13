"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Settings, StoryRun } from "@/domain/types";
import { DeveloperDebugger } from "@/features/run/debug/DeveloperDebugger";
import { getPremadeAutoAdvanceChoiceId } from "@/features/default-mode/premadeStories";
import type { ProviderRuntimeStatus } from "@/features/run/providers/providerRuntimeConfig";
import {
  buildHistoryGroups,
  ConfirmExitModal,
  HistoryModal,
  SettingsModal,
} from "@/features/run/RunOverlays";
import { StageCharacters } from "@/features/run/StageCharacters";
import {
  buildStageVisualPlan,
  type StageBackgroundVisual,
} from "@/features/run/visuals/stageVisualPlan";
import {
  getCharacterVisualCanon,
  resolveCanonicalCharacterId,
} from "@/features/run/visuals/characterVisualCanon";
import { createCharacterIdentityKey } from "@/features/run/visuals/sessionVisualAssets";
import {
  selectActiveRunError,
  selectAvailableChoices,
  selectCurrentBackgroundLabel,
  selectCurrentNode,
  selectCurrentPortraitLabel,
  selectIsRunRequestInFlight,
  selectRunShellMode,
  useAppStore,
} from "@/stores/app-store";

type PopupKind = "history" | "settings" | "confirmExit" | null;

function getActiveImageMode(
  settingsImageMode: Settings["imageMode"],
  storyRunImageMode: StoryRun["settingsSnapshot"]["imageMode"] | undefined,
) {
  return storyRunImageMode ?? settingsImageMode;
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(
        target.closest(
          "a,button,input,textarea,select,[role='dialog'],[data-vn-stop]",
        ),
      )
    : false;
}

function providerDot(status: ProviderRuntimeStatus["text"]["status"]) {
  switch (status) {
    case "ready":
      return "#98dce8";
    case "misconfigured":
      return "#ffd37a";
    default:
      return "rgba(255,244,231,0.42)";
  }
}

function IconBtn({
  label,
  icon,
  onClick,
  disabled,
  title,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      className="vn-icon-btn"
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
    >
      {icon}
      <span className="vn-icon-btn-label">{label}</span>
    </button>
  );
}

const IconSave = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 3h11l3 3v15H5z" />
    <path d="M8 3v6h8V3" />
    <path d="M8 21v-7h8v7" />
  </svg>
);
const IconHistory = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
    <path d="M12 7v5l3 2" />
  </svg>
);
const IconSettings = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
);
const IconExit = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 17l-5-5 5-5" />
    <path d="M5 12h12" />
    <path d="M21 4v16" />
  </svg>
);

function autoAdvanceDelay(textSpeed: Settings["textSpeed"]) {
  switch (textSpeed) {
    case "slow":
      return 2600;
    case "fast":
      return 900;
    default:
      return 1600;
  }
}

export function RunShellScreen({
  debugAllowed,
  providerStatus,
}: {
  debugAllowed: boolean;
  providerStatus: ProviderRuntimeStatus;
}) {
  const router = useRouter();
  const settings = useAppStore((state) => state.settings);
  const activeRun = useAppStore((state) => state.activeRun);
  const persistence = useAppStore((state) => state.persistence);
  const runShellMode = useAppStore(selectRunShellMode);
  const currentNode = useAppStore(selectCurrentNode);
  const availableChoices = useAppStore(selectAvailableChoices);
  const isRunRequestInFlight = useAppStore(selectIsRunRequestInFlight);
  const activeRunError = useAppStore(selectActiveRunError);
  const backgroundLabel = useAppStore(selectCurrentBackgroundLabel);
  const portraitLabel = useAppStore(selectCurrentPortraitLabel);
  const materializeLocalRunSession = useAppStore(
    (state) => state.materializeLocalRunSession,
  );
  const advanceStoryTurn = useAppStore((state) => state.advanceStoryTurn);
  const saveActiveRunToPersistence = useAppStore(
    (state) => state.saveActiveRunToPersistence,
  );
  const resetActiveRun = useAppStore((state) => state.resetActiveRun);
  const setImageMode = useAppStore((state) => state.setImageMode);
  const setTextSpeed = useAppStore((state) => state.setTextSpeed);
  const setAutoAdvance = useAppStore((state) => state.setAutoAdvance);
  const setReduceMotion = useAppStore((state) => state.setReduceMotion);
  const advanceReplayNode = useAppStore((state) => state.advanceReplayNode);

  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [popup, setPopup] = useState<PopupKind>(null);

  const activeImageMode = getActiveImageMode(
    settings.imageMode,
    activeRun.storyRun?.settingsSnapshot.imageMode,
  );
  const isReplayMode = activeRun.playbackMode === "replay";
  const sceneLines = useMemo(
    () => currentNode?.scene.lines ?? [],
    [currentNode?.scene.lines],
  );
  const lineCount = sceneLines.length;
  const currentLineIndex = lineCount === 0 ? 0 : Math.min(visibleLineCount, lineCount) - 1;
  const currentLine = currentLineIndex >= 0 ? sceneLines[currentLineIndex] : null;
  const allLinesRevealed =
    runShellMode === "loading" || lineCount === 0 || visibleLineCount >= lineCount;
  const sessionPreviewUrl = currentNode
    ? activeRun.sessionImagePreviewsByNodeId[currentNode.id] ?? null
    : null;
  const stageVisualPlan = useMemo(
    () =>
      buildStageVisualPlan({
        activeImageMode,
        backgroundLabel,
        currentLine,
        currentLineIndex,
        currentNode,
        episodeNodesById: activeRun.episodeNodesById,
        nodeOrder: activeRun.nodeOrder,
        portraitLabel,
        sceneLines,
        sessionPreviewUrl,
        sessionVisualAssets: activeRun.sessionVisualAssets,
        storyRun: activeRun.storyRun,
      }),
    [
      activeImageMode,
      activeRun.episodeNodesById,
      activeRun.nodeOrder,
      activeRun.sessionVisualAssets,
      activeRun.storyRun,
      backgroundLabel,
      currentLine,
      currentLineIndex,
      currentNode,
      portraitLabel,
      sceneLines,
      sessionPreviewUrl,
    ],
  );
  const replayNodeIndex = activeRun.currentNodeId
    ? activeRun.nodeOrder.indexOf(activeRun.currentNodeId)
    : -1;
  const shouldShowChoices =
    !isReplayMode &&
    allLinesRevealed &&
    availableChoices.length > 0 &&
    !isRunRequestInFlight &&
    runShellMode !== "loading";

  useEffect(() => {
    if (activeRun.lifecycle !== "loading" || !activeRun.pendingSetupProfile) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void materializeLocalRunSession();
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    activeRun.lifecycle,
    activeRun.pendingSetupProfile,
    materializeLocalRunSession,
  ]);

  useEffect(() => {
    setVisibleLineCount(sceneLines.length > 0 ? 1 : 0);
  }, [currentNode?.id, sceneLines.length]);

  useEffect(() => {
    if (
      !settings.autoAdvance ||
      popup ||
      isRunRequestInFlight ||
      runShellMode === "loading" ||
      visibleLineCount >= sceneLines.length ||
      sceneLines.length <= 1
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setVisibleLineCount((value) => Math.min(value + 1, sceneLines.length));
    }, autoAdvanceDelay(settings.textSpeed));

    return () => window.clearTimeout(timeout);
  }, [
    isRunRequestInFlight,
    popup,
    runShellMode,
    sceneLines.length,
    settings.autoAdvance,
    settings.textSpeed,
    visibleLineCount,
  ]);

  function advanceReveal() {
    if (isRunRequestInFlight || runShellMode === "loading" || popup) {
      return;
    }

    if (
      isDefaultMode &&
      allLinesRevealed &&
      availableChoices.length === 0 &&
      runShellMode !== "ended" &&
      activeRun.playbackMode === "play"
    ) {
      void advanceStoryTurn(getPremadeAutoAdvanceChoiceId());
      return;
    }

    setVisibleLineCount((value) => Math.min(value + 1, sceneLines.length));
  }

  function revealAllLines() {
    setVisibleLineCount(sceneLines.length);
  }

  const speakerName = (speakerId: string | null) => {
    if (!speakerId) return null;
    const storyBible = activeRun.storyRun?.storyBible ?? null;
    const cast = storyBible?.mainCast ?? [];
    const canonicalSpeakerId = storyBible
      ? resolveCanonicalCharacterId(storyBible, speakerId)
      : speakerId;
    const match = cast.find(
      (entry) =>
        createCharacterIdentityKey(entry.characterId) ===
        createCharacterIdentityKey(canonicalSpeakerId),
    );
    const protagonist = cast.find((entry) => entry.role === "protagonist");
    const protagonistName =
      protagonist?.displayName && protagonist.displayName.toLowerCase() !== "lead"
        ? protagonist.displayName
        : null;
    const visualCanon = storyBible
      ? getCharacterVisualCanon(storyBible, canonicalSpeakerId)
      : null;

    if (
      (createCharacterIdentityKey(speakerId) === "lead" ||
        createCharacterIdentityKey(canonicalSpeakerId) ===
          createCharacterIdentityKey(protagonist?.characterId ?? "")) &&
      protagonistName
    ) {
      return protagonistName;
    }

    return match?.displayName ?? visualCanon?.displayName ?? canonicalSpeakerId;
  };

  const historyGroups = useMemo(() => {
    if (popup !== "history") return [];
    return buildHistoryGroups(
      activeRun.episodeNodesById,
      activeRun.nodeOrder,
      activeRun.currentNodeId,
      visibleLineCount,
      activeRun.storyRun?.storyBible ?? null,
    );
  }, [
    popup,
    activeRun.episodeNodesById,
    activeRun.nodeOrder,
    activeRun.currentNodeId,
    visibleLineCount,
    activeRun.storyRun?.storyBible,
  ]);

  const isDefaultMode = activeRun.storyRun?.runMode === "premade-default";
  const providerLabel = isDefaultMode
    ? "local default"
    : providerStatus.text.resolved === "openai"
    ? "OpenAI"
    : "stub";
  const imageModeLabel =
    activeImageMode === "off" ? "OFF" : "ON";
  const generationLabel =
    runShellMode === "loading"
      ? `Generating opening via ${providerLabel}`
      : `Generating next turn via ${providerLabel}`;

  function handleExitConfirm() {
    resetActiveRun();
    setPopup(null);
    router.push("/");
  }

  // --- Setup gating: no active run ---
  if (runShellMode === "setup" && !isRunRequestInFlight && !activeRun.pendingSetupProfile) {
    return <RunEmptyStage activeRunError={activeRunError} />;
  }

  const topTitle = activeRun.storyRun?.setupProfile.vibe ?? "Afterimage";
  const topSub = currentNode?.scene.locationLabel ?? backgroundLabel;
  const continueHint = !allLinesRevealed
    ? "click · enter · space"
    : isReplayMode
    ? "replay"
    : shouldShowChoices
    ? "choose"
    : runShellMode === "ended"
    ? "ending"
    : "revealed";
  const isCgBackground = stageVisualPlan.diagnostics.backgroundKey
    .toLowerCase()
    .startsWith("cg_");

  const isAdvanceSuppressed = Boolean(popup);

  return (
    <div
      className="vn-stage"
      data-current-node-id={activeRun.currentNodeId ?? "none"}
      data-run-mode={activeRun.storyRun?.runMode ?? "none"}
      data-session-background-keys={stageVisualPlan.diagnostics.sessionBackgroundKeys.join("|")}
      data-session-character-keys={stageVisualPlan.diagnostics.sessionCharacterKeys.join("|")}
      data-session-preview-node={sessionPreviewUrl ? "present" : "none"}
      data-visual-background-key={stageVisualPlan.diagnostics.backgroundKey}
      data-visual-background-decision={
        stageVisualPlan.diagnostics.backgroundDecision
      }
      data-visual-background-source={stageVisualPlan.diagnostics.backgroundSource}
      data-visual-presentation-segment={
        stageVisualPlan.diagnostics.presentationSegmentId ?? "none"
      }
      data-visual-scene-type={stageVisualPlan.diagnostics.sceneType ?? "none"}
      data-visual-current-node-preview-used={
        stageVisualPlan.diagnostics.currentNodePreviewUsed ? "true" : "false"
      }
      data-visual-sprite-sources={stageVisualPlan.diagnostics.spriteSources
        .map((sprite) => `${sprite.slot}:${sprite.subjectId}:${sprite.source}`)
        .join("|")}
      data-visual-stage-plan={stageVisualPlan.diagnostics.stageCharacters
        .map(
          (character) =>
            `${character.slot ?? "hidden"}:${character.subjectId}:${
              character.visible ? "visible" : "hidden"
            }:${character.presence}`,
        )
        .join("|")}
      tabIndex={0}
      onKeyDown={(event) => {
        if (isInteractiveTarget(event.target) || isAdvanceSuppressed) {
          return;
        }
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          advanceReveal();
        }
      }}
      onClick={(event) => {
        if (isInteractiveTarget(event.target) || isAdvanceSuppressed) {
          return;
        }
        advanceReveal();
      }}
    >
      <StageBackground background={stageVisualPlan.background} />
      {!isCgBackground ? <div className="vn-stage-vignette" /> : null}

      {stageVisualPlan.characters.length > 0 ? (
        <StageCharacters
          characters={stageVisualPlan.characters}
          isDefaultMode={isDefaultMode}
        />
      ) : null}

      <header className="vn-top-bar" data-vn-stop>
        <div className="vn-top-title">
          <Link href="/" className="vn-top-title-brand" aria-label="Home">
            Afterimage
          </Link>
          <span aria-hidden="true" className="vn-top-title-brand" style={{ opacity: 0.3 }}>
            ·
          </span>
          <span className="vn-top-title-sub" title={topSub}>
            {topTitle}
          </span>
        </div>
        <div className="vn-top-controls">
          <IconBtn
            label="Save"
            title={persistence.isSaving ? "Saving…" : "Save"}
            icon={IconSave}
            disabled={
              !activeRun.storyRun ||
              !activeRun.currentNodeId ||
              isReplayMode ||
              persistence.isSaving ||
              isRunRequestInFlight
            }
            onClick={() => {
              void saveActiveRunToPersistence();
            }}
          />
          <IconBtn
            label="History"
            icon={IconHistory}
            onClick={() => setPopup("history")}
          />
          <IconBtn
            label="Settings"
            icon={IconSettings}
            onClick={() => setPopup("settings")}
          />
          <IconBtn
            label="Exit"
            icon={IconExit}
            onClick={() => setPopup("confirmExit")}
          />
        </div>
      </header>

      {runShellMode === "loading" ? (
        <div className="vn-loading-shell">
          <div className="vn-loading-card">{generationLabel}</div>
        </div>
      ) : null}

      {shouldShowChoices ? (
        <div className="vn-choice-layer" data-vn-stop>
          <div className="vn-choice-stack vn-fade-up">
            {availableChoices.map((choice, index) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => {
                  void advanceStoryTurn(choice.id);
                }}
                className="vn-choice-card"
              >
                <span className="vn-choice-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="vn-dialogue">
        <article className="vn-dialogue-plate vn-fade-in">
          {currentLine?.kind === "dialogue" && currentLine.speakerId ? (
            <span className="vn-dialogue-speaker">
              {speakerName(currentLine.speakerId) ?? "voice"}
            </span>
          ) : null}

          {runShellMode === "loading" ? (
            <div className="vn-dialogue-text">{generationLabel}…</div>
          ) : currentLine ? (
            <div
              key={currentLine.id}
              className={`vn-dialogue-text ${
                currentLine.kind === "narration"
                  ? "vn-dialogue-text--narration"
                  : ""
              } vn-fade-in`}
            >
              {currentLine.text}
            </div>
          ) : (
            <div className="vn-dialogue-text">
              The scene has no dialogue lines for this node.
            </div>
          )}

          <div className="vn-dialogue-footer">
            <span>
              {lineCount > 0 ? `${Math.min(visibleLineCount, lineCount)}/${lineCount}` : "—"}
            </span>
            <span style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {!allLinesRevealed && lineCount > 1 ? (
                <button
                  type="button"
                  className="vn-btn"
                  style={{ minHeight: "1.9rem", padding: "0.25rem 0.75rem" }}
                  onClick={(event) => {
                    event.stopPropagation();
                    revealAllLines();
                  }}
                >
                  Skip
                </button>
              ) : null}
              {isReplayMode && allLinesRevealed ? (
                <>
                  <button
                    type="button"
                    className="vn-btn"
                    style={{ minHeight: "1.9rem", padding: "0.25rem 0.75rem" }}
                    disabled={replayNodeIndex <= 0}
                    onClick={(event) => {
                      event.stopPropagation();
                      advanceReplayNode(-1);
                    }}
                  >
                    Previous
                  </button>
                  <span className="vn-save-meta">
                    Replay {replayNodeIndex + 1}/{activeRun.nodeOrder.length}
                  </span>
                  <button
                    type="button"
                    className="vn-btn vn-btn-primary"
                    style={{ minHeight: "1.9rem", padding: "0.25rem 0.75rem" }}
                    disabled={replayNodeIndex >= activeRun.nodeOrder.length - 1}
                    onClick={(event) => {
                      event.stopPropagation();
                      advanceReplayNode(1);
                    }}
                  >
                    Next
                  </button>
                </>
              ) : null}
              <span className={!allLinesRevealed ? "vn-dialogue-continue" : ""}>
                {continueHint}
              </span>
            </span>
            {isRunRequestInFlight ? (
              <span style={{ color: "var(--accent-soft)" }}>{generationLabel}</span>
            ) : null}
          </div>
        </article>
      </div>

      {persistence.lastInfo && !popup ? (
        <div className="vn-info-flash">{persistence.lastInfo}</div>
      ) : null}
      {(activeRunError || persistence.lastError) && !popup ? (
        <div className="vn-error-flash">
          {activeRunError ?? persistence.lastError}
        </div>
      ) : null}

      <footer
        style={{
          position: "absolute",
          left: "1rem",
          bottom: "0.5rem",
          zIndex: 6,
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "0.58rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "rgba(255,244,231,0.3)",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <span
          className="vn-title-dot"
          style={{ background: providerDot(providerStatus.text.status) }}
        />
        <span>{providerLabel}</span>
        <span>·</span>
        <span>{stageVisualPlan.diagnostics.sceneType ?? "scene"}</span>
        <span>·</span>
        <span>{imageModeLabel}</span>
        {isReplayMode ? (
          <>
            <span>·</span>
            <span>read-only replay</span>
          </>
        ) : null}
      </footer>

      {false && debugAllowed ? (
        <div
          style={{ position: "fixed", right: "0.85rem", bottom: "0.85rem", zIndex: 60 }}
          data-vn-stop
        >
          <DeveloperDebugger providerStatus={providerStatus} />
        </div>
      ) : null}

      {popup === "history" ? (
        <HistoryModal
          groups={historyGroups}
          onClose={() => setPopup(null)}
        />
      ) : null}
      {popup === "settings" ? (
        <SettingsModal
          settings={settings}
          onClose={() => setPopup(null)}
          setImageMode={setImageMode}
          setTextSpeed={setTextSpeed}
          setAutoAdvance={setAutoAdvance}
          setReduceMotion={setReduceMotion}
        />
      ) : null}
      {popup === "confirmExit" ? (
        <ConfirmExitModal
          onCancel={() => setPopup(null)}
          onConfirm={handleExitConfirm}
        />
      ) : null}
    </div>
  );
}

function StageBackground({
  background,
}: {
  background: StageBackgroundVisual;
}) {
  return (
    <div
      className="vn-stage-bg"
      aria-hidden="true"
      data-asset-class={background.assetClass}
      data-asset-key={background.debugKey}
      data-asset-source={background.source}
      data-background-label={background.label}
    >
      <div
        className="vn-stage-bg-image"
        style={{
          backgroundColor: "#05070d",
          backgroundImage:
            background.source === "none"
              ? "none"
              : background.source === "session-preview"
              ? `url(${background.assetUrl})`
              : `url(${background.assetUrl})`,
        }}
      />
    </div>
  );
}

function RunEmptyStage({ activeRunError }: { activeRunError: string | null }) {
  const background: StageBackgroundVisual = {
    assetClass: "background",
    assetUrl: "",
    debugKey: "css-stage-background",
    label: "No active scene",
    source: "none",
  };

  return (
    <div className="vn-stage">
      <StageBackground background={background} />
      <div className="vn-stage-vignette" />
      <div
        style={{
          position: "relative",
          zIndex: 4,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            textAlign: "center",
            padding: "2rem",
            borderRadius: "1.2rem",
            border: "1px solid rgba(255,244,231,0.12)",
            background: "rgba(8,6,14,0.72)",
          }}
        >
          <p className="vn-setup-kicker">No active scene</p>
          <h1
            style={{
              marginTop: "0.85rem",
              fontSize: "clamp(2rem, 5vw, 3rem)",
              lineHeight: 1.05,
              fontWeight: 600,
            }}
          >
            Enter through setup.
          </h1>
          <p
            style={{
              marginTop: "0.85rem",
              color: "rgba(255,244,231,0.7)",
              lineHeight: 1.55,
            }}
          >
            The stage renders active runs and restored checkpoints.
          </p>
          {activeRunError ? (
            <p style={{ marginTop: "0.85rem", color: "var(--accent)" }}>
              {activeRunError}
            </p>
          ) : null}
          <div
            style={{
              marginTop: "1.2rem",
              display: "flex",
              gap: "0.5rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link href="/new-game" className="vn-btn vn-btn-primary">
              New Game
            </Link>
            <Link href="/load" className="vn-btn">
              Load Game
            </Link>
            <Link href="/" className="vn-btn">
              Title
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
