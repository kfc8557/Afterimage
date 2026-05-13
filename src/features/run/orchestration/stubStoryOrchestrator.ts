import { RECENT_WAVES_DEFAULT_MAX } from "@/domain/constants/contracts";
import {
  EpisodeNodeSchema,
  ImageActionSchema,
  StoryTurnRequestSchema,
  StoryTurnResponseSchema,
  validateRecentWavesBound,
} from "@/domain/schemas";
import type {
  ChoiceOption,
  CharacterVisualCanonEntry,
  EpisodeNode,
  ImageAction,
  ImageRequest,
  PresentationPlan,
  PresentationStageCharacter,
  RecentWave,
  SceneLine,
  StorySceneType,
  StoryCheckpointBundle,
  StoryRun,
  StoryTurnRequest,
  StoryTurnResponse,
  StyleState,
} from "@/domain/types";
import type {
  LiveParameterDebugEntry,
  TurnDebugSnapshot,
} from "@/features/run/debug/types";
import type {
  ActiveRunPersistenceSnapshot,
  CheckpointPersistenceRepository,
} from "@/features/run/persistence/browserCheckpointRepository";
import { browserCheckpointRepository } from "@/features/run/persistence/browserCheckpointRepository";
import {
  createLocalImageAssetUrl,
  storeGeneratedImagePreview,
} from "@/features/run/persistence/localImageAssetStore";
import {
  ensureStoryBibleVisualCanon,
  formatCharacterSpritePrompt,
  formatRunVisualStyleBible,
  getCharacterVisualCanon,
  resolveCanonicalCharacterId,
} from "@/features/run/visuals/characterVisualCanon";
import type {
  ImageGenerationProvider,
  TextGenerationProvider,
} from "@/features/run/providers/contracts";
import {
  resolveRuntimeImageGenerationProvider,
  resolveRuntimeTextGenerationProvider,
} from "@/features/run/providers/runtimeProviderResolver";
import {
  createBackgroundAssetKey,
  createCharacterIdentityKey,
  createCharacterVariantKey,
  defaultSessionVisualAssets,
  mergeSessionVisualAssets,
  type SessionVisualAssets,
} from "@/features/run/visuals/sessionVisualAssets";

import { applyStateDelta } from "./applyStateDelta";

type TurnRequestSeed = Pick<
  StoryCheckpointBundle,
  "setupProfile" | "storyBible" | "runState" | "recentWaves"
>;

export type StoryTurnProgressResult = {
  checkpointId: string;
  currentNodeId: string;
  debugSnapshot: TurnDebugSnapshot;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  sessionImagePreviewsByNodeId: Record<string, string>;
  sessionVisualAssets: SessionVisualAssets;
  storyRun: StoryRun;
};

type ActiveRunGenerationSnapshot = ActiveRunPersistenceSnapshot & {
  sessionVisualAssets?: SessionVisualAssets;
};

type ImageBuildResult = {
  imageActions: ImageAction[];
  imageJobDiagnostics: ImageJobDiagnostic[];
  sessionImagePreviewsByNodeId: Record<string, string>;
  sessionVisualAssets: SessionVisualAssets;
};

type SpriteImageRequest = ImageRequest & {
  subjectType: "important-character" | "portrait-frame";
};

type ImageJobDiagnostic = {
  assetClass: ImageRequest["subjectType"];
  finalPromptBrief?: string;
  reason: string;
  sessionPreviewUrlProduced?: boolean;
  status: "scheduled" | "skipped" | "fulfilled" | "failed";
  styleAnchor?: string;
  subjectId: string;
  visualCanon?: CharacterVisualCanonEntry | null;
};

const AGGRESSIVE_IMAGE_JOBS_PER_TURN_MAX = 5;
const AGGRESSIVE_SPRITE_JOBS_PER_TURN_MAX = 4;

const styleParameterKeys: Array<keyof StyleState> = [
  "warmth",
  "tension",
  "melancholy",
  "playfulness",
  "ominousness",
  "romance",
  "mystery",
  "tempo",
  "surrealness",
];

function createLocalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function assertCurrentNode(
  snapshot: ActiveRunPersistenceSnapshot,
): EpisodeNode {
  if (!snapshot.currentNodeId) {
    throw new Error("The active run is missing its current episode node.");
  }

  const currentNode = snapshot.episodeNodesById[snapshot.currentNodeId];

  if (!currentNode) {
    throw new Error("The active run is missing the current node payload.");
  }

  return currentNode;
}

function createContinuityHints(
  requestSeed: TurnRequestSeed,
  currentNode: EpisodeNode | null,
) {
  return [
    requestSeed.storyBible.worldviewPremise,
    currentNode?.sceneSummary,
    requestSeed.storyBible.coreConflicts[0],
  ].filter((hint): hint is string => Boolean(hint));
}

function determineNextSceneType(args: {
  currentNode: EpisodeNode | null;
  requestSeed: TurnRequestSeed;
}): StorySceneType {
  if (!args.currentNode) {
    return "opening";
  }

  if (
    args.requestSeed.runState.conclusionPressure >= 1 ||
    (args.requestSeed.runState.conclusionPressure >= 0.86 &&
      args.requestSeed.runState.endingCandidates.length >= 1)
  ) {
    return "ending";
  }

  return "normal";
}

function normalizePresentationId(value: string) {
  return createBackgroundAssetKey(value).replace(/^background:/, "");
}

function createFallbackPresentationPlan(args: {
  currentNode: EpisodeNode | null;
  sceneType: StorySceneType;
  storyTurnResponse: StoryTurnResponse;
}): PresentationPlan {
  const locationLabel =
    args.storyTurnResponse.sceneContent.locationLabel ??
    args.currentNode?.scene.locationLabel ??
    "Opening location";
  const locationId = createBackgroundAssetKey(locationLabel);
  const speakerIds = Array.from(
    new Set(
      args.storyTurnResponse.sceneContent.lines
        .filter((line) => line.kind === "dialogue" && line.speakerId)
        .map((line) => line.speakerId as string),
    ),
  );
  const visibleSpeakers = speakerIds.slice(0, 2);
  const stageCharacters: PresentationStageCharacter[] = speakerIds.map(
    (speakerId, index) => ({
      canonicalCharacterId: speakerId,
      displayName: null,
      expression: "neutral story beat expression",
      pose: "stable VN conversation pose",
      presence: "present",
      priority: Math.max(10, 80 - index * 10),
      reason:
        index < 2
          ? "Fallback presentation selected this dialogue speaker for the stage."
          : "Fallback presentation kept this physically present speaker hidden because beta shows two sprites.",
      slot: index === 0 ? "left" : index === 1 ? "right" : null,
      visible: visibleSpeakers.includes(speakerId),
    }),
  );

  return {
    sceneType: args.sceneType,
    presentationSegmentId: `segment:${normalizePresentationId(locationId)}:${args.sceneType}`,
    background: {
      decision: args.currentNode ? "reuse" : "establish",
      locationId,
      locationLabel,
      promptBrief: `${locationLabel}; ${args.storyTurnResponse.sceneSummary}; environment-only VN background`,
      reason: args.currentNode
        ? "Fallback presentation preserves the previous background unless the provider gives explicit direction."
        : "Fallback presentation establishes the opening location background.",
    },
    focusCharacterId: visibleSpeakers[0] ?? null,
    notes:
      "Fallback presentation plan was derived by the app because provider output did not include complete stage direction.",
    stageCharacters,
  };
}

function normalizeStoryTurnPresentation(args: {
  currentNode: EpisodeNode | null;
  requestedSceneType: StorySceneType;
  storyTurnResponse: StoryTurnResponse;
}): StoryTurnResponse {
  const presentationPlan =
    args.storyTurnResponse.presentationPlan ??
    createFallbackPresentationPlan({
      currentNode: args.currentNode,
      sceneType: args.storyTurnResponse.sceneType ?? args.requestedSceneType,
      storyTurnResponse: args.storyTurnResponse,
    });
  const sceneType = presentationPlan.sceneType ?? args.requestedSceneType;
  const normalizedLines = args.storyTurnResponse.sceneContent.lines.map(
    (line): SceneLine => ({
      ...line,
      // The text provider may invent a display-ish background key per line.
      // The app-owned presentation plan is the asset key source of truth for
      // the current beta turn, so align lines to it before image scheduling and
      // stage rendering.
      backgroundKey: presentationPlan.background.locationId,
      presentationSegmentId: presentationPlan.presentationSegmentId,
    }),
  );

  return {
    ...args.storyTurnResponse,
    sceneType,
    sceneContent: {
      ...args.storyTurnResponse.sceneContent,
      locationLabel:
        args.storyTurnResponse.sceneContent.locationLabel ??
        presentationPlan.background.locationLabel,
      lines: normalizedLines,
    },
    presentationPlan,
  };
}

function compactPromptParts(parts: Array<string | null | undefined | false>) {
  return parts
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" / ");
}

function createSharedVisualStyleCanon(requestSeed: TurnRequestSeed) {
  return formatRunVisualStyleBible(requestSeed.storyBible.visualStyleBible);
}

function createAssetManifestHints(requestSeed: TurnRequestSeed) {
  return [
    createSharedVisualStyleCanon(requestSeed),
    requestSeed.storyBible.initialVisualCanon[0]?.descriptor,
    requestSeed.storyBible.settingRules[0],
  ].filter((hint): hint is string => Boolean(hint));
}

function buildInitialRequest(
  snapshot: ActiveRunPersistenceSnapshot,
): StoryTurnRequest {
  const requestSeed: TurnRequestSeed = {
    setupProfile: snapshot.storyRun.setupProfile,
    storyBible: snapshot.storyRun.storyBible,
    runState: snapshot.storyRun.runState,
    recentWaves: snapshot.storyRun.recentWaves,
  };

  return StoryTurnRequestSchema.parse({
    requestType: "initial",
    sceneType: "opening",
    setupProfile: requestSeed.setupProfile,
    storyBible: requestSeed.storyBible,
    runState: requestSeed.runState,
    recentWaves: requestSeed.recentWaves,
    continuityHints: createContinuityHints(requestSeed, null),
    imageMode: snapshot.storyRun.settingsSnapshot.imageMode,
    assetManifestHints: createAssetManifestHints(requestSeed),
  });
}

async function buildContinueRequest(
  snapshot: ActiveRunPersistenceSnapshot,
  repository: CheckpointPersistenceRepository,
  choiceId: string,
): Promise<{
  currentNode: EpisodeNode;
  lastPlayerChoice: ChoiceOption;
  request: StoryTurnRequest;
  requestSeed: TurnRequestSeed;
}> {
  const currentNode = assertCurrentNode(snapshot);
  const lastPlayerChoice = currentNode.choices.find((choice) => choice.id === choiceId);

  if (!lastPlayerChoice) {
    throw new Error("The selected choice is not available on the current node.");
  }

  if (!snapshot.storyRun.latestCheckpointId) {
    throw new Error("Continue turns require a latest checkpoint bundle.");
  }

  const checkpoint = await repository.readCheckpoint(
    snapshot.storyRun.latestCheckpointId,
  );
  const requestSeed: TurnRequestSeed = {
    setupProfile: checkpoint.bundle.setupProfile,
    storyBible: checkpoint.bundle.storyBible,
    runState: checkpoint.bundle.runState,
    recentWaves: checkpoint.bundle.recentWaves,
  };
  const sceneType = determineNextSceneType({
    currentNode,
    requestSeed,
  });

  return {
    currentNode,
    lastPlayerChoice,
    requestSeed,
    request: StoryTurnRequestSchema.parse({
      requestType: "continue",
      sceneType,
      setupProfile: requestSeed.setupProfile,
      storyBible: requestSeed.storyBible,
      runState: requestSeed.runState,
      recentWaves: requestSeed.recentWaves,
      lastPlayerChoice,
      continuityHints: createContinuityHints(requestSeed, currentNode),
      imageMode: snapshot.storyRun.settingsSnapshot.imageMode,
      assetManifestHints: createAssetManifestHints(requestSeed),
    }),
  };
}

function isSpriteImageRequest(
  imageRequest: ImageRequest | null | undefined,
): imageRequest is SpriteImageRequest {
  return (
    imageRequest?.subjectType === "important-character" ||
    imageRequest?.subjectType === "portrait-frame"
  );
}

function createBackgroundImageRequest(args: {
  requestSeed: TurnRequestSeed;
  storyTurnResponse: StoryTurnResponse;
}): ImageRequest {
  const backgroundPlan = args.storyTurnResponse.presentationPlan.background;
  const locationLabel = backgroundPlan.locationLabel;

  return {
    subjectType: "background",
    subjectId: backgroundPlan.locationId,
    promptBrief: compactPromptParts([
      "VN background layer",
      locationLabel,
      backgroundPlan.promptBrief,
      args.storyTurnResponse.sceneSummary,
      args.requestSeed.storyBible.worldviewPremise,
      args.requestSeed.storyBible.settingRules[0],
      "environment only",
      "wide stage composition",
      "no people or foreground characters",
    ]),
    styleAnchor: createSharedVisualStyleCanon(args.requestSeed),
    reason: backgroundPlan.reason,
  };
}

function resolveCharacterSubjectId(args: {
  requestSeed: TurnRequestSeed;
  subjectId: string;
}) {
  return resolveCanonicalCharacterId(
    args.requestSeed.storyBible,
    args.subjectId,
  );
}

function createCharacterDesignBrief(args: {
  requestSeed: TurnRequestSeed;
  sourceBeatBrief?: string | null;
  subjectId: string;
}) {
  const subjectId = resolveCharacterSubjectId(args);
  const characterCanon = getCharacterVisualCanon(
    args.requestSeed.storyBible,
    subjectId,
  );

  if (!characterCanon) {
    throw new Error(`Missing structured visual canon for ${subjectId}.`);
  }

  return formatCharacterSpritePrompt({
    characterCanon,
    sourceBeatBrief: args.sourceBeatBrief,
    styleBible: args.requestSeed.storyBible.visualStyleBible,
  });
}

function createProtagonistImageRequest(requestSeed: TurnRequestSeed): ImageRequest {
  const protagonist =
    requestSeed.storyBible.mainCast.find(
      (entry) => entry.role === "protagonist",
    ) ?? requestSeed.storyBible.mainCast[0];

  return createCharacterSpriteImageRequest({
    reason: "Populate the opening protagonist sprite as a session-only preview.",
    requestSeed,
    sourceBeatBrief: "opening protagonist VN sprite for the first playable scene",
    subjectId: protagonist?.characterId ?? "lead",
  });
}

function createCharacterSpriteImageRequest(args: {
  reason: string;
  requestSeed: TurnRequestSeed;
  sourceBeatBrief?: string | null;
  subjectId: string;
  subjectType?: ImageRequest["subjectType"];
}): ImageRequest {
  const subjectId = resolveCharacterSubjectId({
    requestSeed: args.requestSeed,
    subjectId: args.subjectId,
  });
  const descriptor = createCharacterDesignBrief({
    requestSeed: args.requestSeed,
    sourceBeatBrief: args.sourceBeatBrief,
    subjectId,
  });

  return {
    subjectType: args.subjectType ?? "important-character",
    subjectId,
    promptBrief: descriptor,
    styleAnchor: createSharedVisualStyleCanon(args.requestSeed),
    reason: args.reason,
  };
}

function collectDialogueSpeakerBriefs(storyTurnResponse: StoryTurnResponse) {
  const speakerBriefs: Array<{ sourceBeatBrief: string; subjectId: string }> = [];
  const seenSpeakerIds = new Set<string>();

  storyTurnResponse.sceneContent.lines.forEach((line) => {
    if (line.kind !== "dialogue" || !line.speakerId) {
      return;
    }

    const identityKey = createCharacterIdentityKey(line.speakerId);

    if (seenSpeakerIds.has(identityKey)) {
      return;
    }

    seenSpeakerIds.add(identityKey);
    speakerBriefs.push({
      sourceBeatBrief: line.text.slice(0, 220),
      subjectId: line.speakerId,
    });
  });

  return speakerBriefs;
}

function collectVisualCanonSubjectIds(args: {
  requestSeed: TurnRequestSeed;
  storyTurnResponse: StoryTurnResponse;
}) {
  const subjectIds = new Set<string>();
  const protagonistId =
    args.requestSeed.storyBible.mainCast.find(
      (entry) => entry.role === "protagonist",
    )?.characterId ??
    args.requestSeed.storyBible.mainCast[0]?.characterId ??
    "lead";

  if (isSpriteImageRequest(args.storyTurnResponse.imageRequest)) {
    subjectIds.add(args.storyTurnResponse.imageRequest.subjectId);
  }

  args.storyTurnResponse.presentationPlan.stageCharacters.forEach(
    (stageCharacter) => {
      if (stageCharacter.presence === "present" || stageCharacter.visible) {
        subjectIds.add(stageCharacter.canonicalCharacterId);
      }
    },
  );

  collectDialogueSpeakerBriefs(args.storyTurnResponse).forEach((speaker) => {
    subjectIds.add(speaker.subjectId);
  });

  if (subjectIds.size === 0) {
    subjectIds.add(protagonistId);
  }

  return Array.from(subjectIds);
}

function collectPresentationCharacters(storyTurnResponse: StoryTurnResponse) {
  return storyTurnResponse.presentationPlan.stageCharacters.map((character) => ({
    canonicalCharacterId: character.canonicalCharacterId,
    displayName: character.displayName,
    publicSummary: `${character.expression}; ${character.pose}; ${character.reason}`,
    role: character.visible ? "visible scene character" : "scene character",
  }));
}

function collectVisibleSpriteRequests(args: {
  requestSeed: TurnRequestSeed;
  storyTurnResponse: StoryTurnResponse;
}) {
  const requests: ImageRequest[] = [];
  const seenKeys = new Set<string>();

  function pushRequest(imageRequest: ImageRequest) {
    const key = createCharacterIdentityKey(imageRequest.subjectId);

    if (seenKeys.has(key)) {
      return;
    }

    seenKeys.add(key);
    requests.push(imageRequest);
  }

  if (isSpriteImageRequest(args.storyTurnResponse.imageRequest)) {
    const requestedCharacter =
      args.storyTurnResponse.presentationPlan.stageCharacters.find(
        (character) =>
          createCharacterIdentityKey(character.canonicalCharacterId) ===
          createCharacterIdentityKey(
            args.storyTurnResponse.imageRequest?.subjectId ?? "",
          ),
      );

    if (!requestedCharacter || requestedCharacter.presence === "present") {
      pushRequest(
        createCharacterSpriteImageRequest({
          reason: args.storyTurnResponse.imageRequest.reason,
          requestSeed: args.requestSeed,
          sourceBeatBrief: args.storyTurnResponse.imageRequest.promptBrief,
          subjectId: args.storyTurnResponse.imageRequest.subjectId,
          subjectType: args.storyTurnResponse.imageRequest.subjectType,
        }),
      );
    }
  }

  args.storyTurnResponse.presentationPlan.stageCharacters
    .filter(
      (character) => character.visible && character.presence === "present",
    )
    .sort((left, right) => right.priority - left.priority)
    .forEach((character) => {
      pushRequest(
        createCharacterSpriteImageRequest({
          reason: `Generate visible sprite from presentation plan: ${character.reason}`,
          requestSeed: args.requestSeed,
          sourceBeatBrief: compactPromptParts([
            `expression: ${character.expression}`,
            `pose: ${character.pose}`,
            `stage slot: ${character.slot ?? "unassigned"}`,
            `scene plan: ${args.storyTurnResponse.presentationPlan.notes}`,
          ]),
          subjectId: character.canonicalCharacterId,
        }),
      );
    });

  if (requests.length === 0) {
    collectDialogueSpeakerBriefs(args.storyTurnResponse).forEach((speaker) => {
      pushRequest(
        createCharacterSpriteImageRequest({
          reason: "Populate a visible scene speaker sprite as a session-only preview.",
          requestSeed: args.requestSeed,
          sourceBeatBrief: speaker.sourceBeatBrief,
          subjectId: speaker.subjectId,
        }),
      );
    });
  }

  if (
    requests.length === 0 &&
    args.storyTurnResponse.presentationPlan.stageCharacters.some(
      (character) => character.presence === "present",
    )
  ) {
    pushRequest(
      createCharacterSpriteImageRequest({
        reason:
          "Populate the highest-priority physically present character from the presentation plan.",
        requestSeed: args.requestSeed,
        sourceBeatBrief: args.storyTurnResponse.presentationPlan.notes,
        subjectId:
          args.storyTurnResponse.presentationPlan.stageCharacters.find(
            (character) => character.presence === "present",
          )?.canonicalCharacterId ?? "lead",
      }),
    );
  }

  if (requests.length === 0) {
    pushRequest(createProtagonistImageRequest(args.requestSeed));
  }

  return requests.slice(0, AGGRESSIVE_SPRITE_JOBS_PER_TURN_MAX);
}

function shouldGenerateSpriteRequest(args: {
  imageRequest: ImageRequest | null | undefined;
  sessionVisualAssets: SessionVisualAssets;
}) {
  const imageRequest = args.imageRequest;

  if (!isSpriteImageRequest(imageRequest)) {
    return false;
  }

  const identityKey = createCharacterIdentityKey(imageRequest.subjectId);
  const variantKey = createCharacterVariantKey({
    promptBrief: imageRequest.promptBrief,
    subjectId: imageRequest.subjectId,
  });

  if (!args.sessionVisualAssets.characterSpritesByIdentity[identityKey]) {
    return true;
  }

  return (
    !variantKey.endsWith(":base") &&
    !args.sessionVisualAssets.characterSpriteVariantsByKey[variantKey]
  );
}

function getImageRequestQueueKey(imageRequest: ImageRequest) {
  if (imageRequest.subjectType === "background") {
    return `${imageRequest.subjectType}:${imageRequest.subjectId}`;
  }

  return `${imageRequest.subjectType}:${createCharacterVariantKey({
    promptBrief: imageRequest.promptBrief,
    subjectId: imageRequest.subjectId,
  })}`;
}

function selectImageRequestsToGenerate(args: {
  imageMode: StoryTurnRequest["imageMode"];
  requestSeed: TurnRequestSeed;
  sessionVisualAssets: SessionVisualAssets;
  storyTurnResponse: StoryTurnResponse;
}): {
  diagnostics: ImageJobDiagnostic[];
  requests: ImageRequest[];
} {
  const diagnostics: ImageJobDiagnostic[] = [];

  if (args.imageMode !== "aggressive") {
    return {
      diagnostics: [
        {
          assetClass: "background",
          reason: `imageMode=${args.imageMode}`,
          status: "skipped",
          subjectId: "all",
        },
      ],
      requests: [],
    };
  }

  const backgroundRequest = createBackgroundImageRequest({
    requestSeed: args.requestSeed,
    storyTurnResponse: args.storyTurnResponse,
  });
  const candidateSpriteRequests = collectVisibleSpriteRequests({
    requestSeed: args.requestSeed,
    storyTurnResponse: args.storyTurnResponse,
  });
  const requests: ImageRequest[] = [];
  const queuedKeys = new Set<string>();

  function createDiagnostic(
    imageRequest: ImageRequest,
    status: ImageJobDiagnostic["status"],
    reason: string,
  ): ImageJobDiagnostic {
    const canonicalSubjectId = isSpriteImageRequest(imageRequest)
      ? resolveCharacterSubjectId({
          requestSeed: args.requestSeed,
          subjectId: imageRequest.subjectId,
        })
      : imageRequest.subjectId;

    return {
      assetClass: imageRequest.subjectType,
      finalPromptBrief: imageRequest.promptBrief,
      reason,
      status,
      styleAnchor: imageRequest.styleAnchor,
      subjectId: canonicalSubjectId,
      visualCanon: isSpriteImageRequest(imageRequest)
        ? getCharacterVisualCanon(args.requestSeed.storyBible, canonicalSubjectId)
        : null,
    };
  }

  function trySchedule(imageRequest: ImageRequest, skipReason: string) {
    const queueKey = getImageRequestQueueKey(imageRequest);

    if (queuedKeys.has(queueKey)) {
      diagnostics.push(
        createDiagnostic(
          imageRequest,
          "skipped",
          "duplicate image job already queued",
        ),
      );
      return;
    }

    if (requests.length >= AGGRESSIVE_IMAGE_JOBS_PER_TURN_MAX) {
      diagnostics.push(
        createDiagnostic(
          imageRequest,
          "skipped",
          "per-turn aggressive image job cap reached",
        ),
      );
      return;
    }

    if (skipReason) {
      diagnostics.push(createDiagnostic(imageRequest, "skipped", skipReason));
      return;
    }

    queuedKeys.add(queueKey);
    requests.push(imageRequest);
    diagnostics.push(createDiagnostic(imageRequest, "scheduled", imageRequest.reason));
  }

  const backgroundSkipReason = args.sessionVisualAssets.backgroundsByLocationKey[
    backgroundRequest.subjectId
  ]
    ? "matching session background already exists"
    : args.storyTurnResponse.presentationPlan.background.decision === "reuse"
    ? "presentation plan reuses the current background"
    : "";
  const scheduleSpriteRequests = () => {
    candidateSpriteRequests.forEach((spriteRequest) => {
      const spriteSkipReason = shouldGenerateSpriteRequest({
        imageRequest: spriteRequest,
        sessionVisualAssets: args.sessionVisualAssets,
      })
        ? ""
        : "matching session sprite already exists";

      trySchedule(spriteRequest, spriteSkipReason);
    });
  };

  if (args.storyTurnResponse.sceneType === "opening") {
    trySchedule(backgroundRequest, backgroundSkipReason);
    scheduleSpriteRequests();
  } else if (isSpriteImageRequest(args.storyTurnResponse.imageRequest)) {
    scheduleSpriteRequests();
    trySchedule(backgroundRequest, backgroundSkipReason);
  } else if (
    args.storyTurnResponse.imageRequest &&
    args.storyTurnResponse.imageRequest.subjectType === "background"
  ) {
    scheduleSpriteRequests();
    trySchedule(backgroundRequest, backgroundSkipReason);
  } else {
    scheduleSpriteRequests();
    trySchedule(backgroundRequest, backgroundSkipReason);
  }

  return { diagnostics, requests };
}

function createSessionAssetPatch(args: {
  imageAction: ImageAction;
  nodeId: string;
  sessionPreviewUrl: string | null;
}): Pick<
  ImageBuildResult,
  "sessionImagePreviewsByNodeId" | "sessionVisualAssets"
> {
  if (!args.sessionPreviewUrl) {
    return {
      sessionImagePreviewsByNodeId: {},
      sessionVisualAssets: defaultSessionVisualAssets,
    };
  }

  const imageAction = args.imageAction;

  if (imageAction.subjectType === "background") {
    return {
      sessionImagePreviewsByNodeId: {
        [args.nodeId]: args.sessionPreviewUrl,
      },
      sessionVisualAssets: {
        ...defaultSessionVisualAssets,
        backgroundsByLocationKey: {
          [imageAction.subjectId]: args.sessionPreviewUrl,
        },
      },
    };
  }

  const identityKey = createCharacterIdentityKey(imageAction.subjectId);
  const variantKey = createCharacterVariantKey({
    promptBrief: imageAction.promptBrief,
    subjectId: imageAction.subjectId,
  });

  return {
    sessionImagePreviewsByNodeId: {
      [args.nodeId]: args.sessionPreviewUrl,
    },
    sessionVisualAssets: {
      ...defaultSessionVisualAssets,
      characterSpritesByIdentity: {
        [identityKey]: args.sessionPreviewUrl,
      },
      characterSpriteVariantsByKey: {
        [variantKey]: args.sessionPreviewUrl,
      },
    },
  };
}

async function createDurableLocalImageAction(args: {
  imageAction: ImageAction;
  nodeId: string;
  sessionPreviewUrl: string | null;
  storyRunId: string;
}) {
  if (!args.sessionPreviewUrl) {
    return args.imageAction;
  }

  try {
    const localAsset = await storeGeneratedImagePreview({
      action: args.imageAction,
      dataUrl: args.sessionPreviewUrl,
      nodeId: args.nodeId,
      storyRunId: args.storyRunId,
    });

    return ImageActionSchema.parse({
      ...args.imageAction,
      generatedAssetId: localAsset.id,
      resolvedAssetUrl: createLocalImageAssetUrl(localAsset.id),
    });
  } catch (error) {
    console.warn("Unable to persist generated image preview locally.", error);
    return args.imageAction;
  }
}

function buildImageActions(
  storyTurnResponse: StoryTurnResponse,
  storyRunId: string,
  nodeId: string,
  imageMode: StoryTurnRequest["imageMode"],
  imageGenerationProvider: ImageGenerationProvider,
  requestSeed: TurnRequestSeed,
  sessionVisualAssets: SessionVisualAssets,
): Promise<ImageBuildResult> {
  const selectedImageJobs = selectImageRequestsToGenerate({
    imageMode,
    requestSeed,
    sessionVisualAssets,
    storyTurnResponse,
  });

  if (selectedImageJobs.requests.length === 0) {
    return Promise.resolve({
      imageActions: [] as ImageAction[],
      imageJobDiagnostics: selectedImageJobs.diagnostics,
      sessionImagePreviewsByNodeId: {},
      sessionVisualAssets,
    });
  }

  return Promise.allSettled(
    selectedImageJobs.requests.map((imageRequest) =>
      Promise.resolve().then(() =>
        imageGenerationProvider.generateImageAction(imageRequest, {
          storyRunId,
          nodeId,
        }),
      ),
    ),
  ).then(async (settledResults) => {
    let nextSessionVisualAssets = sessionVisualAssets;
    const imageActions: ImageAction[] = [];
    const sessionImagePreviewsByNodeId: Record<string, string> = {};
    const imageJobDiagnostics = [...selectedImageJobs.diagnostics];

    for (const [index, settledResult] of settledResults.entries()) {
      const imageRequest = selectedImageJobs.requests[index];

      if (!imageRequest) {
        continue;
      }

      if (settledResult.status === "rejected") {
        imageJobDiagnostics.push({
          assetClass: imageRequest.subjectType,
          finalPromptBrief: imageRequest.promptBrief,
          reason:
            settledResult.reason instanceof Error
              ? settledResult.reason.message
              : "image provider rejected the job",
          status: "failed",
          styleAnchor: imageRequest.styleAnchor,
          subjectId: imageRequest.subjectId,
        });
        continue;
      }

      const imageResult = settledResult.value;

      if (!imageResult) {
        imageJobDiagnostics.push({
          assetClass: imageRequest.subjectType,
          finalPromptBrief: imageRequest.promptBrief,
          reason: "image provider returned no action",
          sessionPreviewUrlProduced: false,
          status: "failed",
          styleAnchor: imageRequest.styleAnchor,
          subjectId: imageRequest.subjectId,
        });
        continue;
      }

      const imageAction = await createDurableLocalImageAction({
        imageAction: imageResult.action,
        nodeId,
        sessionPreviewUrl: imageResult.sessionPreviewUrl,
        storyRunId,
      });
      const assetPatch = createSessionAssetPatch({
        imageAction,
        nodeId,
        sessionPreviewUrl: imageResult.sessionPreviewUrl,
      });
      imageActions.push(imageAction);
      Object.assign(
        sessionImagePreviewsByNodeId,
        assetPatch.sessionImagePreviewsByNodeId,
      );
      nextSessionVisualAssets = mergeSessionVisualAssets(
        nextSessionVisualAssets,
        assetPatch.sessionVisualAssets,
      );
      imageJobDiagnostics.push({
        assetClass: imageRequest.subjectType,
        finalPromptBrief: imageRequest.promptBrief,
        reason: imageResult.sessionPreviewUrl
          ? "session preview produced"
          : "image action produced without session preview",
        sessionPreviewUrlProduced: Boolean(imageResult.sessionPreviewUrl),
        status: "fulfilled",
        styleAnchor: imageRequest.styleAnchor,
        subjectId: imageRequest.subjectId,
      });
    }

    return {
      imageActions,
      imageJobDiagnostics,
      sessionImagePreviewsByNodeId,
      sessionVisualAssets: nextSessionVisualAssets,
    };
  });
}

function createNextRecentWaves(
  recentWaves: RecentWave[],
  nextNode: EpisodeNode,
  selectedChoice: ChoiceOption | null,
) {
  const nextRecentWaves = recentWaves.map((wave, index) => {
    if (index !== recentWaves.length - 1 || !selectedChoice) {
      return wave;
    }

    return {
      ...wave,
      chosenChoiceId: selectedChoice.id,
    };
  });

  nextRecentWaves.push({
    nodeId: nextNode.id,
    waveSummary: nextNode.sceneSummary,
    presentedChoices: nextNode.choices,
    chosenChoiceId: null,
  });

  const trimmedRecentWaves =
    nextRecentWaves.length > RECENT_WAVES_DEFAULT_MAX
      ? nextRecentWaves.slice(-RECENT_WAVES_DEFAULT_MAX)
      : nextRecentWaves;
  const validationResult = validateRecentWavesBound(trimmedRecentWaves);

  if (!validationResult.success) {
    throw new Error("Updated recentWaves exceeded the configured bound.");
  }

  return validationResult.data;
}

function createLiveParameterDebugEntries(args: {
  currentRunState: StoryRun["runState"];
  nextRunState: StoryRun["runState"];
  stateDelta: StoryTurnResponse["stateDelta"];
}): LiveParameterDebugEntry[] {
  const styleEntries = styleParameterKeys.map((key) => {
    const lastDelta = args.stateDelta.styleShifts?.[key] ?? 0;

    return {
      key,
      currentValue: args.nextRunState.styleState[key],
      lastDelta,
      changedThisTurn:
        args.currentRunState.styleState[key] !== args.nextRunState.styleState[key],
    };
  });

  return [
    ...styleEntries,
    {
      key: "conclusionPressure",
      currentValue: args.nextRunState.conclusionPressure,
      lastDelta: args.stateDelta.conclusionPressureDelta,
      changedThisTurn:
        args.currentRunState.conclusionPressure !==
        args.nextRunState.conclusionPressure,
      policyNote:
        "Monotonic ending-pressure value used to reduce branch sprawl over time.",
    },
  ];
}

async function createNextNodeAndRunState(args: {
  currentNode: EpisodeNode | null;
  imageGenerationProvider: ImageGenerationProvider;
  lastPlayerChoice: ChoiceOption | null;
  requestSeed: TurnRequestSeed;
  sessionVisualAssets: SessionVisualAssets;
  storyRun: StoryRun;
  storyTurnResponse: StoryTurnResponse;
}) {
  const {
    currentNode,
    imageGenerationProvider,
    lastPlayerChoice,
    requestSeed,
    storyRun,
  } = args;
  const nextNodeId = createLocalId("episode");
  const nextDepth = currentNode ? currentNode.depth + 1 : 0;
  const visualRequestSeed: TurnRequestSeed = {
    ...requestSeed,
    storyBible: ensureStoryBibleVisualCanon({
      presentationCharacters: collectPresentationCharacters(
        args.storyTurnResponse,
      ),
      setupProfile: requestSeed.setupProfile,
      storyBible: requestSeed.storyBible,
      subjectIds: collectVisualCanonSubjectIds({
        requestSeed,
        storyTurnResponse: args.storyTurnResponse,
      }),
    }),
  };
  const {
    imageActions,
    imageJobDiagnostics,
    sessionImagePreviewsByNodeId,
    sessionVisualAssets,
  } = await buildImageActions(
    args.storyTurnResponse,
    storyRun.id,
    nextNodeId,
    storyRun.settingsSnapshot.imageMode,
    imageGenerationProvider,
    visualRequestSeed,
    args.sessionVisualAssets,
  );
  const nextNode = EpisodeNodeSchema.parse({
    id: nextNodeId,
    storyRunId: storyRun.id,
    parentEpisodeNodeId: currentNode?.id ?? null,
    depth: nextDepth,
    sceneType: args.storyTurnResponse.sceneType,
    turnType: args.storyTurnResponse.endState
      ? "ending"
      : currentNode
      ? "choice-result"
      : "initial",
    playerChoiceId: lastPlayerChoice?.id ?? null,
    scene: args.storyTurnResponse.sceneContent,
    sceneSummary: args.storyTurnResponse.sceneSummary,
    presentationPlan: args.storyTurnResponse.presentationPlan,
    choices: args.storyTurnResponse.choices,
    stateDelta: args.storyTurnResponse.stateDelta,
    imageActions,
    endState: args.storyTurnResponse.endState,
    createdAt: new Date().toISOString(),
  });

  return {
    nextNode,
    nextRunState: applyStateDelta(
      requestSeed.runState,
      args.storyTurnResponse.stateDelta,
    ),
    nextStoryBible: visualRequestSeed.storyBible,
    imageJobDiagnostics,
    sessionImagePreviewsByNodeId,
    sessionVisualAssets,
  };
}

export class StubStoryOrchestrator {
  constructor(
    private readonly checkpointRepository: CheckpointPersistenceRepository,
    private readonly textGenerationProvider: TextGenerationProvider,
    private readonly imageGenerationProvider: ImageGenerationProvider,
  ) {}

  async runInitialTurn(
    snapshot: ActiveRunGenerationSnapshot,
  ): Promise<StoryTurnProgressResult> {
    if (snapshot.storyRun.latestCheckpointId || snapshot.currentNodeId) {
      throw new Error("Initial story generation can only run on a fresh session.");
    }

    const request = buildInitialRequest(snapshot);

    return this.completeTurn({
      currentNode: null,
      lastPlayerChoice: null,
      request,
      requestSeed: {
        setupProfile: snapshot.storyRun.setupProfile,
        storyBible: snapshot.storyRun.storyBible,
        runState: snapshot.storyRun.runState,
        recentWaves: snapshot.storyRun.recentWaves,
      },
      snapshot,
    });
  }

  async continueFromChoice(
    snapshot: ActiveRunGenerationSnapshot,
    choiceId: string,
  ): Promise<StoryTurnProgressResult> {
    const { currentNode, lastPlayerChoice, request, requestSeed } =
      await buildContinueRequest(snapshot, this.checkpointRepository, choiceId);

    return this.completeTurn({
      currentNode,
      lastPlayerChoice,
      request,
      requestSeed,
      snapshot,
    });
  }

  private async completeTurn(args: {
    currentNode: EpisodeNode | null;
    lastPlayerChoice: ChoiceOption | null;
    request: StoryTurnRequest;
    requestSeed: TurnRequestSeed;
    snapshot: ActiveRunGenerationSnapshot;
  }): Promise<StoryTurnProgressResult> {
    const validatedRequest = StoryTurnRequestSchema.parse(args.request);
    const parsedStoryTurnResponse = StoryTurnResponseSchema.parse(
      await this.textGenerationProvider.generateStoryTurn(validatedRequest),
    );
    const storyTurnResponse = normalizeStoryTurnPresentation({
      currentNode: args.currentNode,
      requestedSceneType: validatedRequest.sceneType,
      storyTurnResponse: parsedStoryTurnResponse,
    });
    const textProviderDebug =
      this.textGenerationProvider.getLastDebugSnapshot?.() ?? null;

    // Per-turn write order:
    // 1. produce a validated StoryTurnResponse
    // 2. write an EpisodeNode
    // 3. apply StateDelta
    // 4. update recentWaves
    // 5. write a checkpoint through the persistence boundary
    const {
      nextNode,
      nextRunState,
      nextStoryBible,
      imageJobDiagnostics,
      sessionImagePreviewsByNodeId,
      sessionVisualAssets,
    } = await createNextNodeAndRunState({
        currentNode: args.currentNode,
        imageGenerationProvider: this.imageGenerationProvider,
        lastPlayerChoice: args.lastPlayerChoice,
        requestSeed: args.requestSeed,
        sessionVisualAssets:
          args.snapshot.sessionVisualAssets ?? defaultSessionVisualAssets,
        storyRun: args.snapshot.storyRun,
        storyTurnResponse,
      });
    const imageProviderDebug =
      this.imageGenerationProvider.getLastDebugSnapshot?.() ?? null;
    const nextRecentWaves = createNextRecentWaves(
      args.requestSeed.recentWaves,
      nextNode,
      args.lastPlayerChoice,
    );
    const nextStoryRun: StoryRun = {
      ...args.snapshot.storyRun,
      storyBible: nextStoryBible,
      runState: nextRunState,
      recentWaves: nextRecentWaves,
      status: nextNode.endState ? "ended" : "active",
      latestEpisodeNodeId: nextNode.id,
    };
    const nextSessionSnapshot: ActiveRunPersistenceSnapshot = {
      storyRun: nextStoryRun,
      episodeNodesById: {
        ...args.snapshot.episodeNodesById,
        [nextNode.id]: nextNode,
      },
      nodeOrder: [...args.snapshot.nodeOrder, nextNode.id],
      currentNodeId: nextNode.id,
    };
    const persistedSession = await this.checkpointRepository.saveRunSession(
      nextSessionSnapshot,
    );
    const debugSnapshot: TurnDebugSnapshot = {
      capturedAt: new Date().toISOString(),
      turnType: validatedRequest.requestType,
      sourceCheckpointId: args.snapshot.storyRun.latestCheckpointId,
      currentCheckpointId: persistedSession.checkpoint.id,
      currentNodeId: nextNode.id,
      saveDisposition: persistedSession.saveDisposition,
      storyTurnRequest: validatedRequest,
      rawProviderResponse:
        textProviderDebug?.rawProviderResponse ?? storyTurnResponse,
      validatedStoryTurnResponse: storyTurnResponse,
      appliedStateDelta: storyTurnResponse.stateDelta,
      recentWaves: nextRecentWaves,
      runState: nextRunState,
      liveParameters: createLiveParameterDebugEntries({
        currentRunState: args.requestSeed.runState,
        nextRunState,
        stateDelta: storyTurnResponse.stateDelta,
      }),
      relationshipTracks: nextRunState.relationshipTracks,
      activeThreads: nextRunState.activeThreads,
      inventoryFlags: nextRunState.inventoryFlags,
      conclusionPressure: {
        currentValue: nextRunState.conclusionPressure,
        lastDelta: storyTurnResponse.stateDelta.conclusionPressureDelta,
        changedThisTurn:
          args.requestSeed.runState.conclusionPressure !==
          nextRunState.conclusionPressure,
      },
      storyPolicyState: {
        imageMode: validatedRequest.imageMode,
        sceneType: storyTurnResponse.sceneType,
        presentationPlan: storyTurnResponse.presentationPlan,
        artDirection: validatedRequest.setupProfile.artDirection,
        vibe: validatedRequest.setupProfile.vibe,
        assetManifestHints: validatedRequest.assetManifestHints,
      },
      imageState: {
        request: storyTurnResponse.imageRequest ?? null,
        actions: nextNode.imageActions,
        providerDebug: imageProviderDebug?.rawProviderResponse ?? null,
        sessionDiagnostics: {
          backgroundKeys: Object.keys(
            sessionVisualAssets.backgroundsByLocationKey,
          ),
          characterKeys: Object.keys(
            sessionVisualAssets.characterSpritesByIdentity,
          ),
          nodePreviewStored: Boolean(
            sessionImagePreviewsByNodeId[nextNode.id],
          ),
          jobs: imageJobDiagnostics,
          variantKeys: Object.keys(
            sessionVisualAssets.characterSpriteVariantsByKey,
          ),
        },
      },
      providerDetails: {
        textProvider: textProviderDebug?.providerName ?? null,
        textModel: textProviderDebug?.model ?? null,
        imageProvider: imageProviderDebug?.providerName ?? null,
        imageModel: imageProviderDebug?.model ?? null,
        retryCount: textProviderDebug?.retryCount ?? null,
      },
    };

    return {
      checkpointId: persistedSession.checkpoint.id,
      currentNodeId: nextNode.id,
      debugSnapshot,
      episodeNodesById: nextSessionSnapshot.episodeNodesById,
      nodeOrder: nextSessionSnapshot.nodeOrder,
      sessionImagePreviewsByNodeId,
      sessionVisualAssets,
      storyRun: persistedSession.storyRun,
    };
  }
}

export const storyOrchestrator = new StubStoryOrchestrator(
  browserCheckpointRepository,
  resolveRuntimeTextGenerationProvider(),
  resolveRuntimeImageGenerationProvider(),
);

export const stubStoryOrchestrator = storyOrchestrator;
