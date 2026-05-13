"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

import type { EpisodeNode, Settings, StoryBible } from "@/domain/types";
import {
  getCharacterVisualCanon,
  resolveCanonicalCharacterId,
} from "@/features/run/visuals/characterVisualCanon";
import { createCharacterIdentityKey } from "@/features/run/visuals/sessionVisualAssets";

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="vn-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="vn-modal vn-fade-in">
        <div className="vn-modal-header">
          <span className="vn-modal-title">{title}</span>
          <button type="button" className="vn-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="vn-modal-body">{children}</div>
        {footer ? <div className="vn-modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

type HistoryEntry = {
  lineIndex: number;
  nodeId: string;
  nodeIndex: number;
  locationLabel: string | null;
  lineId: string;
  speaker: string | null;
  kind: "narration" | "dialogue" | "system";
  text: string;
};

type HistoryGroup = {
  backgroundDecision: string;
  entries: HistoryEntry[];
  groupId: string;
  locationLabel: string | null;
  nodeId: string;
  nodeIndex: number;
  presentationSegmentId: string | null;
  sceneType: string;
};

export function buildHistoryGroups(
  episodeNodesById: Record<string, EpisodeNode>,
  nodeOrder: string[],
  currentNodeId: string | null,
  visibleLineCount: number,
  storyBible: StoryBible | null,
): HistoryGroup[] {
  const cast = storyBible?.mainCast ?? [];
  const speakerName = (speakerId: string | null) => {
    if (!speakerId) return null;
    const canonicalSpeakerId = storyBible
      ? resolveCanonicalCharacterId(storyBible, speakerId)
      : speakerId;
    const match = cast.find(
      (entry) =>
        createCharacterIdentityKey(entry.characterId) ===
        createCharacterIdentityKey(canonicalSpeakerId),
    );
    const visualCanon = storyBible
      ? getCharacterVisualCanon(storyBible, canonicalSpeakerId)
      : null;

    return match?.displayName ?? visualCanon?.displayName ?? canonicalSpeakerId;
  };

  const groups: HistoryGroup[] = [];
  const groupsById = new Map<string, HistoryGroup>();

  nodeOrder.forEach((nodeId, nodeIndex) => {
    const node = episodeNodesById[nodeId];
    if (!node) return;

    const isCurrent = nodeId === currentNodeId;
    const lines = node.scene.lines;
    const upTo = isCurrent
      ? Math.min(visibleLineCount, lines.length)
      : lines.length;

    for (let i = 0; i < upTo; i += 1) {
      const line = lines[i];
      const presentationSegmentId =
        line.presentationSegmentId ??
        node.presentationPlan?.presentationSegmentId ??
        null;
      const groupId = `${nodeId}:${presentationSegmentId ?? "scene"}`;
      let group = groupsById.get(groupId);

      if (!group) {
        group = {
          backgroundDecision: node.presentationPlan?.background.decision ?? "legacy",
          entries: [],
          groupId,
          locationLabel:
            node.presentationPlan?.background.locationLabel ??
            node.scene.locationLabel ??
            null,
          nodeId,
          nodeIndex,
          presentationSegmentId,
          sceneType: node.sceneType,
        };
        groupsById.set(groupId, group);
        groups.push(group);
      }

      group.entries.push({
        lineIndex: i,
        nodeId,
        nodeIndex,
        locationLabel: node.scene.locationLabel ?? null,
        lineId: line.id,
        speaker: speakerName(line.speakerId),
        kind: line.kind,
        text: line.text,
      });
    }
  });

  return groups;
}

export function HistoryModal({
  groups,
  onClose,
}: {
  groups: HistoryGroup[];
  onClose: () => void;
}) {
  return (
    <Modal title="Dialogue Log" onClose={onClose}>
      {groups.length === 0 ? (
        <p className="vn-dialogue-text">No revealed dialogue yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group, groupIndex) => (
            <details
              key={group.groupId}
              open={groupIndex >= Math.max(0, groups.length - 2)}
              className="vn-log-group"
            >
              <summary className="vn-log-divider" style={{ cursor: "pointer" }}>
                scene {group.nodeIndex + 1} · {group.sceneType}
                {group.locationLabel ? ` · ${group.locationLabel}` : ""}
                {` · ${group.backgroundDecision}`}
              </summary>
              <div>
                {group.entries.map((entry) => (
                  <div
                    key={`${entry.nodeId}-${entry.lineId}-${entry.lineIndex}`}
                    className="vn-log-entry"
                  >
                    <div className="vn-log-speaker">
                      {entry.kind === "narration"
                        ? "narration"
                        : entry.kind === "system"
                        ? "system"
                        : entry.speaker ?? "voice"}
                    </div>
                    <div className="vn-log-text">{entry.text}</div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function buildHistoryEntries(
  episodeNodesById: Record<string, EpisodeNode>,
  nodeOrder: string[],
  currentNodeId: string | null,
  visibleLineCount: number,
  storyBible: StoryBible | null,
): HistoryEntry[] {
  return buildHistoryGroups(
    episodeNodesById,
    nodeOrder,
    currentNodeId,
    visibleLineCount,
    storyBible,
  ).flatMap((group) => group.entries);
}

export function FlatHistoryModal({
  entries,
  onClose,
}: {
  entries: HistoryEntry[];
  onClose: () => void;
}) {
  return (
    <Modal title="Dialogue Log" onClose={onClose}>
      {entries.length === 0 ? (
        <p className="vn-dialogue-text">No revealed dialogue yet.</p>
      ) : (
        <div>
          {entries.map((entry) => {
            return (
              <div key={`${entry.nodeId}-${entry.lineId}-${entry.lineIndex}`}>
                <div className="vn-log-entry">
                  <div className="vn-log-speaker">
                    {entry.kind === "narration"
                      ? "narration"
                      : entry.kind === "system"
                      ? "system"
                      : entry.speaker ?? "voice"}
                  </div>
                  <div className="vn-log-text">{entry.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

type SettingsPopupProps = {
  settings: Settings;
  onClose: () => void;
  setImageMode: (value: Settings["imageMode"]) => void;
  setTextSpeed: (value: Settings["textSpeed"]) => void;
  setAutoAdvance: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
};

const imageModeOptions: Array<{
  label: string;
  value: Settings["imageMode"];
}> = [
  { value: "off", label: "Text only" },
  { value: "aggressive", label: "With image" },
];

export function SettingsModal({
  settings,
  onClose,
  setImageMode,
  setTextSpeed,
  setAutoAdvance,
  setReduceMotion,
}: SettingsPopupProps) {
  return (
    <Modal title="Settings" onClose={onClose}>
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
    </Modal>
  );
}

export function ConfirmExitModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title="Return to title"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="vn-btn" onClick={onCancel}>
            Stay
          </button>
          <button
            type="button"
            className="vn-btn vn-btn-primary"
            onClick={onConfirm}
          >
            Return to title
          </button>
        </>
      }
    >
      <p className="vn-dialogue-text" style={{ minHeight: 0 }}>
        The run stays in memory. Autosaved checkpoints remain available from
        Load Game. Continue to the title screen?
      </p>
    </Modal>
  );
}

export type { HistoryEntry, HistoryGroup };
