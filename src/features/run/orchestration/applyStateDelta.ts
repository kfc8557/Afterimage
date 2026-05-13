import { CONCLUSION_PRESSURE_DELTA_MAX, STYLE_VALUE_MAX, STYLE_VALUE_MIN } from "@/domain/constants/contracts";
import type { RunState, StateDelta, StyleState } from "@/domain/types";

function clampStyleValue(value: number) {
  return Math.min(STYLE_VALUE_MAX, Math.max(STYLE_VALUE_MIN, value));
}

function applyStyleShifts(
  currentStyleState: StyleState,
  styleShifts: StateDelta["styleShifts"],
): StyleState {
  if (!styleShifts) {
    return currentStyleState;
  }

  return {
    warmth: clampStyleValue(currentStyleState.warmth + (styleShifts.warmth ?? 0)),
    tension: clampStyleValue(currentStyleState.tension + (styleShifts.tension ?? 0)),
    melancholy: clampStyleValue(
      currentStyleState.melancholy + (styleShifts.melancholy ?? 0),
    ),
    playfulness: clampStyleValue(
      currentStyleState.playfulness + (styleShifts.playfulness ?? 0),
    ),
    ominousness: clampStyleValue(
      currentStyleState.ominousness + (styleShifts.ominousness ?? 0),
    ),
    romance: clampStyleValue(currentStyleState.romance + (styleShifts.romance ?? 0)),
    mystery: clampStyleValue(currentStyleState.mystery + (styleShifts.mystery ?? 0)),
    tempo: clampStyleValue(currentStyleState.tempo + (styleShifts.tempo ?? 0)),
    surrealness: clampStyleValue(
      currentStyleState.surrealness + (styleShifts.surrealness ?? 0),
    ),
  };
}

export function applyStateDelta(currentRunState: RunState, stateDelta: StateDelta): RunState {
  const nextRelationshipTracks = { ...currentRunState.relationshipTracks };
  const nextActiveThreads = { ...currentRunState.activeThreads };
  const nextInventoryFlags = { ...currentRunState.inventoryFlags };
  const nextEndingCandidates = [...currentRunState.endingCandidates];

  Object.entries(stateDelta.relationshipDelta ?? {}).forEach(
    ([characterId, delta]) => {
      nextRelationshipTracks[characterId] =
        (nextRelationshipTracks[characterId] ?? 0) + delta;
    },
  );

  Object.entries(stateDelta.threadUpdates ?? {}).forEach(([threadId, threadState]) => {
    nextActiveThreads[threadId] = threadState;
  });

  Object.entries(stateDelta.inventoryUpdates ?? {}).forEach(([flagId, value]) => {
    if (value === null) {
      delete nextInventoryFlags[flagId];
      return;
    }

    nextInventoryFlags[flagId] = value;
  });

  if (
    stateDelta.newEndingCandidate &&
    !nextEndingCandidates.includes(stateDelta.newEndingCandidate)
  ) {
    nextEndingCandidates.push(stateDelta.newEndingCandidate);
  }

  const cappedPressureDelta = Math.min(
    CONCLUSION_PRESSURE_DELTA_MAX,
    Math.max(0, stateDelta.conclusionPressureDelta),
  );
  const nextConclusionPressure = Math.min(
    1,
    Math.max(
      currentRunState.conclusionPressure,
      currentRunState.conclusionPressure + cappedPressureDelta,
    ),
  );

  return {
    ...currentRunState,
    styleState: applyStyleShifts(currentRunState.styleState, stateDelta.styleShifts),
    relationshipTracks: nextRelationshipTracks,
    activeThreads: nextActiveThreads,
    inventoryFlags: nextInventoryFlags,
    conclusionPressure: nextConclusionPressure,
    endingCandidates: nextEndingCandidates,
  };
}
