import type {
  EpisodeNode,
  ImageAction,
  PresentationStageCharacter,
  SceneLine,
  Settings,
  StoryRun,
} from "@/domain/types";

import {
  createBackgroundAssetKey,
  createCharacterIdentityKey,
  createCharacterVariantKey,
  type SessionVisualAssets,
} from "./sessionVisualAssets";
import {
  getCharacterVisualCanon,
  resolveCanonicalCharacterId,
} from "./characterVisualCanon";
import {
  resolveDefaultBackgroundAsset,
  type VnAssetClass,
} from "./vnAssetBank";

export type StageBackgroundVisual = {
  assetClass: "background";
  assetUrl: string;
  debugKey: string;
  label: string;
  source: "bank" | "manifest" | "none" | "session-preview";
};

export type StageCharacterSlot = "left" | "right";
export type StageCharacterEmphasis = "primary" | "secondary";

export type StageCharacterVisual = {
  assetClass: "character-sprite" | "placeholder";
  assetSource: "session-preview" | "manifest" | "placeholder";
  emphasis: StageCharacterEmphasis;
  debugKey: string;
  label: string;
  reason: string;
  slot: StageCharacterSlot;
  spriteUrl: string;
  subjectId: string;
};

export type StageEventCgVisual = {
  assetClass: Extract<VnAssetClass, "event-cg">;
  assetUrl: string | null;
  status: "not-implemented";
};

export type StageVisualPlan = {
  background: StageBackgroundVisual;
  characters: StageCharacterVisual[];
  eventCg: StageEventCgVisual | null;
  hasSessionBackgroundPreview: boolean;
  hasSessionSpritePreview: boolean;
  diagnostics: {
    backgroundKey: string;
    backgroundDecision: string;
    backgroundSource: StageBackgroundVisual["source"];
    currentNodeId: string | null;
    currentNodePreviewUsed: boolean;
    presentationSegmentId: string | null;
    sceneType: string | null;
    sessionBackgroundKeys: string[];
    sessionCharacterKeys: string[];
    sessionVariantKeys: string[];
    stageCharacters: Array<{
      displayName: string | null;
      presence: PresentationStageCharacter["presence"];
      reason: string;
      slot: PresentationStageCharacter["slot"];
      subjectId: string;
      visible: boolean;
    }>;
    spriteSources: Array<{
      source: StageCharacterVisual["assetSource"];
      subjectId: string;
      slot: StageCharacterSlot;
    }>;
  };
};

type BuildStageVisualPlanArgs = {
  activeImageMode: Settings["imageMode"];
  backgroundLabel: string;
  currentLine: SceneLine | null;
  currentLineIndex: number;
  currentNode: EpisodeNode | null;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  portraitLabel: string;
  sceneLines: SceneLine[];
  sessionPreviewUrl: string | null;
  sessionVisualAssets: SessionVisualAssets;
  storyRun: StoryRun | null;
};

function isSpriteImageAction(imageAction: ImageAction) {
  return (
    imageAction.subjectType === "important-character" ||
    imageAction.subjectType === "portrait-frame"
  );
}

function getSpeakerName(storyRun: StoryRun | null, speakerId: string | null) {
  if (!speakerId) return null;

  const canonicalSpeakerId = storyRun
    ? resolveCanonicalCharacterId(storyRun.storyBible, speakerId)
    : speakerId;
  const match = storyRun?.storyBible.mainCast.find(
    (entry) =>
      createCharacterIdentityKey(entry.characterId) ===
      createCharacterIdentityKey(canonicalSpeakerId),
  );
  const visualCanon = storyRun
    ? getCharacterVisualCanon(storyRun.storyBible, canonicalSpeakerId)
    : null;

  return match?.displayName ?? visualCanon?.displayName ?? canonicalSpeakerId;
}

function getDialogueSpeakerId(line: SceneLine | null) {
  return line?.kind === "dialogue" ? line.speakerId : null;
}

function findNearestDialogueSpeaker(args: {
  excludeSpeakerId?: string | null;
  lineIndex: number;
  lines: SceneLine[];
}) {
  const candidates: Array<{ distance: number; speakerId: string }> = [];

  args.lines.forEach((line, index) => {
    const speakerId = getDialogueSpeakerId(line);

    if (!speakerId || speakerId === args.excludeSpeakerId) {
      return;
    }

    candidates.push({
      distance: Math.abs(index - args.lineIndex),
      speakerId,
    });
  });

  candidates.sort((a, b) => a.distance - b.distance);

  return candidates[0]?.speakerId ?? null;
}

function selectStageSpeakerIds(args: {
  currentLine: SceneLine | null;
  currentLineIndex: number;
  currentNode: EpisodeNode | null;
  sceneLines: SceneLine[];
}) {
  const activeSpeakerId = getDialogueSpeakerId(args.currentLine);
  const orderedSceneSpeakers: string[] = [];

  args.sceneLines.forEach((line) => {
    const speakerId = getDialogueSpeakerId(line);

    if (speakerId && !orderedSceneSpeakers.includes(speakerId)) {
      orderedSceneSpeakers.push(speakerId);
    }
  });

  const stableSpeakers = orderedSceneSpeakers.slice(0, 2);

  if (
    activeSpeakerId &&
    stableSpeakers.length >= 2 &&
    !stableSpeakers.includes(activeSpeakerId)
  ) {
    const nearestCounterpart = findNearestDialogueSpeaker({
      excludeSpeakerId: activeSpeakerId,
      lineIndex: args.currentLineIndex,
      lines: args.sceneLines,
    });

    return [nearestCounterpart ?? stableSpeakers[0], activeSpeakerId].filter(
      (speakerId): speakerId is string => Boolean(speakerId),
    );
  }

  if (stableSpeakers.length > 0) {
    return stableSpeakers;
  }

  return args.currentNode?.imageActions.find(isSpriteImageAction)?.subjectId
    ? [args.currentNode.imageActions.find(isSpriteImageAction)!.subjectId]
    : [];
}

function selectPresentationStageCharacters(args: {
  currentLine: SceneLine | null;
  currentNode: EpisodeNode | null;
  storyRun: StoryRun | null;
}) {
  const authoredVisualState = args.currentLine?.authoredVisualState ?? null;

  if (authoredVisualState) {
    return (["left", "right"] as const).flatMap((slot) => {
      const subjectId = authoredVisualState[slot];

      if (!subjectId) {
        return [];
      }

      return {
        canonicalCharacterId: subjectId,
        displayName: subjectId.replace(".png", "").replaceAll("_", " "),
        expression: "authored fixed sprite",
        pose: "authored line-level VIS slot",
        presence: "present" as const,
        priority: slot === "left" ? 90 : 80,
        reason: "Authored line-level VIS state controls this sprite slot.",
        slot,
        visible: true,
      };
    });
  }

  return (
    args.currentNode?.presentationPlan?.stageCharacters
      .filter(
        (character) =>
          character.visible &&
          character.presence === "present" &&
          character.slot,
      )
      .slice(0, 2)
      .map((character) => ({
        ...character,
        canonicalCharacterId: args.storyRun
          ? resolveCanonicalCharacterId(
              args.storyRun.storyBible,
              character.canonicalCharacterId,
            )
          : character.canonicalCharacterId,
      })) ?? []
  );
}

function findLatestManifestSpriteAction(args: {
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  subjectId: string;
}) {
  for (let index = args.nodeOrder.length - 1; index >= 0; index -= 1) {
    const nodeId = args.nodeOrder[index];
    const node = nodeId ? args.episodeNodesById[nodeId] : null;
    const manifestSprite = node?.imageActions.find(
      (imageAction) =>
        isSpriteImageAction(imageAction) &&
        imageAction.subjectId === args.subjectId &&
        imageAction.source === "manifest" &&
        imageAction.resolvedAssetUrl,
    );

    if (manifestSprite) {
      return manifestSprite;
    }
  }

  return null;
}

function findCurrentSpriteAction(args: {
  currentNode: EpisodeNode | null;
  subjectId: string;
}) {
  return (
    args.currentNode?.imageActions.find(
      (imageAction) =>
        isSpriteImageAction(imageAction) &&
        imageAction.subjectId === args.subjectId,
    ) ?? null
  );
}

function resolveSpriteVisual(args: {
  currentNode: EpisodeNode | null;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  sessionVisualAssets: SessionVisualAssets;
  sessionPreviewUrl: string | null;
  subjectId: string;
}) {
  const currentSpriteAction = findCurrentSpriteAction({
    currentNode: args.currentNode,
    subjectId: args.subjectId,
  });
  const identityKey = createCharacterIdentityKey(args.subjectId);
  const variantKey = createCharacterVariantKey({
    promptBrief: currentSpriteAction?.promptBrief ?? null,
    subjectId: args.subjectId,
  });
  const variantSpriteUrl =
    args.sessionVisualAssets.characterSpriteVariantsByKey[variantKey];
  const identitySpriteUrl =
    args.sessionVisualAssets.characterSpritesByIdentity[identityKey];
  const currentNodeHasSingleImageAction =
    args.currentNode?.imageActions.length === 1;
  const currentNodeSpritePreviewUrl =
    currentNodeHasSingleImageAction &&
    currentSpriteAction &&
    args.sessionPreviewUrl
      ? args.sessionPreviewUrl
      : null;

  if (currentNodeSpritePreviewUrl || variantSpriteUrl || identitySpriteUrl) {
    return {
      assetClass: "character-sprite" as const,
      assetSource: "session-preview" as const,
      debugKey: currentNodeSpritePreviewUrl
        ? `node:${args.currentNode?.id ?? "current"}`
        : variantSpriteUrl
        ? variantKey
        : identityKey,
      spriteUrl: currentNodeSpritePreviewUrl ?? variantSpriteUrl ?? identitySpriteUrl,
    };
  }

  const manifestSprite = findLatestManifestSpriteAction({
    episodeNodesById: args.episodeNodesById,
    nodeOrder: args.nodeOrder,
    subjectId: args.subjectId,
  });

  if (manifestSprite?.resolvedAssetUrl) {
    return {
      assetClass: "character-sprite" as const,
      assetSource: "manifest" as const,
      debugKey: `manifest:${args.subjectId}`,
      spriteUrl: manifestSprite.resolvedAssetUrl,
    };
  }

  return null;
}

function findCurrentBackgroundAction(
  currentNode: EpisodeNode | null,
  backgroundKey: string,
) {
  return (
    currentNode?.imageActions.find(
      (imageAction) =>
        imageAction.subjectType === "background" &&
        imageAction.subjectId === backgroundKey,
    ) ?? null
  );
}

function findLatestManifestBackgroundAction(args: {
  backgroundKey: string;
  currentNode: EpisodeNode | null;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
}) {
  const currentManifestBackground = args.currentNode?.imageActions.find(
    (imageAction) =>
      imageAction.subjectType === "background" &&
      imageAction.subjectId === args.backgroundKey &&
      imageAction.source === "manifest" &&
      imageAction.resolvedAssetUrl,
  );

  if (currentManifestBackground) {
    return currentManifestBackground;
  }

  for (let index = args.nodeOrder.length - 1; index >= 0; index -= 1) {
    const nodeId = args.nodeOrder[index];
    const node = nodeId ? args.episodeNodesById[nodeId] : null;
    const manifestBackground = node?.imageActions.find(
      (imageAction) =>
        imageAction.subjectType === "background" &&
        imageAction.subjectId === args.backgroundKey &&
        imageAction.source === "manifest" &&
        imageAction.resolvedAssetUrl,
    );

    if (manifestBackground) {
      return manifestBackground;
    }
  }

  return null;
}

function findReusableSessionBackground(args: {
  currentNode: EpisodeNode | null;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  sessionVisualAssets: SessionVisualAssets;
}) {
  for (let index = args.nodeOrder.length - 1; index >= 0; index -= 1) {
    const nodeId = args.nodeOrder[index];
    const node = nodeId ? args.episodeNodesById[nodeId] : null;
    const locationKey = node?.presentationPlan?.background.locationId;
    const backgroundUrl = locationKey
      ? args.sessionVisualAssets.backgroundsByLocationKey[locationKey]
      : null;

    if (
      backgroundUrl &&
      (!args.currentNode || node?.id !== args.currentNode.id)
    ) {
      return {
        debugKey: locationKey,
        url: backgroundUrl,
      };
    }
  }

  const [firstKey, firstUrl] =
    Object.entries(args.sessionVisualAssets.backgroundsByLocationKey)[0] ?? [];

  return firstKey && firstUrl
    ? {
        debugKey: firstKey,
        url: firstUrl,
      }
    : null;
}

export function buildStageVisualPlan({
  activeImageMode,
  backgroundLabel,
  currentLine,
  currentLineIndex,
  currentNode,
  episodeNodesById,
  nodeOrder,
  portraitLabel,
  sceneLines,
  sessionPreviewUrl,
  sessionVisualAssets,
  storyRun,
}: BuildStageVisualPlanArgs): StageVisualPlan {
  const backgroundAsset = resolveDefaultBackgroundAsset();
  const presentationPlan = currentNode?.presentationPlan ?? null;
  const imagesDisabled = activeImageMode === "off";
  const backgroundKey =
    currentLine?.authoredVisualState?.bg ??
    currentLine?.backgroundKey ??
    presentationPlan?.background.locationId ??
    createBackgroundAssetKey(currentNode?.scene.locationLabel ?? backgroundLabel);
  const currentBackgroundAction = findCurrentBackgroundAction(
    currentNode,
    backgroundKey,
  );
  const currentNodeHasSingleImageAction = currentNode?.imageActions.length === 1;
  const currentNodeBackgroundPreviewUrl =
    currentNodeHasSingleImageAction &&
    currentBackgroundAction &&
    sessionPreviewUrl
      ? sessionPreviewUrl
      : null;
  const sessionBackgroundUrl = imagesDisabled
    ? null
    : currentNodeBackgroundPreviewUrl ??
      sessionVisualAssets.backgroundsByLocationKey[backgroundKey] ??
      (presentationPlan?.background.decision === "reuse"
      ? findReusableSessionBackground({
          currentNode,
          episodeNodesById,
          nodeOrder,
          sessionVisualAssets,
        })?.url
      : null) ??
      null;
  const manifestBackgroundAction = findLatestManifestBackgroundAction({
    backgroundKey,
    currentNode,
    episodeNodesById,
    nodeOrder,
  });
  const hasResolvedBackground = Boolean(
    sessionBackgroundUrl ?? manifestBackgroundAction?.resolvedAssetUrl,
  );
  const backgroundUrl = imagesDisabled
    ? ""
    : sessionBackgroundUrl ?? manifestBackgroundAction?.resolvedAssetUrl ?? "";
  const backgroundSource: StageBackgroundVisual["source"] = imagesDisabled
    ? "none"
    : sessionBackgroundUrl
    ? "session-preview"
    : manifestBackgroundAction?.resolvedAssetUrl
    ? "manifest"
    : backgroundAsset.assetUrl
    ? "bank"
    : "none";
  const backgroundDebugKey = currentNodeBackgroundPreviewUrl
    ? `node:${currentNode?.id ?? "current"}`
    : sessionBackgroundUrl
    ? sessionVisualAssets.backgroundsByLocationKey[backgroundKey]
      ? backgroundKey
      : findReusableSessionBackground({
          currentNode,
          episodeNodesById,
          nodeOrder,
          sessionVisualAssets,
        })?.debugKey ?? backgroundKey
    : hasResolvedBackground
    ? manifestBackgroundAction?.subjectId ?? backgroundKey
    : backgroundAsset.id;
  const activeSpeakerId = getDialogueSpeakerId(currentLine);
  const primarySpeakerId = activeSpeakerId
    ? storyRun
      ? resolveCanonicalCharacterId(storyRun.storyBible, activeSpeakerId)
      : activeSpeakerId
    : presentationPlan?.focusCharacterId
    ? storyRun
      ? resolveCanonicalCharacterId(storyRun.storyBible, presentationPlan.focusCharacterId)
      : presentationPlan.focusCharacterId
    : findNearestDialogueSpeaker({
        lineIndex: currentLineIndex,
        lines: sceneLines,
      }) ??
      currentNode?.imageActions.find(isSpriteImageAction)?.subjectId ??
      null;
  const plannedStageCharacters =
    activeImageMode === "off"
      ? []
      : selectPresentationStageCharacters({ currentLine, currentNode, storyRun });
  const fallbackStageSpeakerIds =
    activeImageMode === "off" || plannedStageCharacters.length > 0
      ? []
      : selectStageSpeakerIds({
          currentLine,
          currentLineIndex,
          currentNode,
          sceneLines,
        }).slice(0, 2);
  const fallbackSlots: StageCharacterSlot[] = ["left", "right"];
  const stageAssignments =
    plannedStageCharacters.length > 0
      ? plannedStageCharacters.map((character) => ({
          reason: character.reason,
          slot: character.slot as StageCharacterSlot,
          subjectId: character.canonicalCharacterId,
        }))
      : fallbackStageSpeakerIds.map((subjectId, index) => ({
          reason:
            "Fallback stage assignment derived from nearby dialogue because this node has no presentation plan.",
          slot: fallbackSlots[index] ?? "left",
          subjectId,
        }));

  const characters = stageAssignments.flatMap((assignment) => {
    const subjectId = storyRun
      ? resolveCanonicalCharacterId(storyRun.storyBible, assignment.subjectId)
      : assignment.subjectId;
    const sprite = resolveSpriteVisual({
      currentNode,
      episodeNodesById,
      nodeOrder,
      sessionPreviewUrl,
      sessionVisualAssets,
      subjectId,
    });

    if (!sprite) {
      return [];
    }

    const subjectIdentityKey = createCharacterIdentityKey(subjectId);
    const primaryIdentityKey = primarySpeakerId
      ? createCharacterIdentityKey(primarySpeakerId)
      : null;
    const isPrimary =
      primaryIdentityKey &&
      (subjectIdentityKey === primaryIdentityKey ||
        subjectIdentityKey.startsWith(`${primaryIdentityKey}-base`) ||
        subjectIdentityKey.startsWith(`${primaryIdentityKey}_base`));

    return {
      ...sprite,
      debugKey: sprite.debugKey,
      emphasis: isPrimary ? "primary" : "secondary",
      label:
        getSpeakerName(storyRun, subjectId) ??
        (subjectId === "lead" ? portraitLabel : subjectId),
      reason: assignment.reason,
      slot: assignment.slot,
      subjectId,
    } satisfies StageCharacterVisual;
  });

  return {
    background: {
      assetClass: "background",
      assetUrl: backgroundUrl,
      debugKey: backgroundDebugKey,
      label: backgroundLabel,
      source: backgroundSource,
    },
    characters,
    eventCg: null,
    hasSessionBackgroundPreview: Boolean(sessionBackgroundUrl),
    hasSessionSpritePreview: characters.some(
      (character) => character.assetSource === "session-preview",
    ),
    diagnostics: {
      backgroundKey,
      backgroundDecision: presentationPlan?.background.decision ?? "fallback",
      backgroundSource,
      currentNodeId: currentNode?.id ?? null,
      currentNodePreviewUsed: Boolean(
        currentNodeBackgroundPreviewUrl ||
          characters.some((character) => character.debugKey.startsWith("node:")),
      ),
      presentationSegmentId:
        currentLine?.presentationSegmentId ??
        presentationPlan?.presentationSegmentId ??
        null,
      sceneType: currentNode?.sceneType ?? presentationPlan?.sceneType ?? null,
      sessionBackgroundKeys: Object.keys(
        sessionVisualAssets.backgroundsByLocationKey,
      ),
      sessionCharacterKeys: Object.keys(
        sessionVisualAssets.characterSpritesByIdentity,
      ),
      sessionVariantKeys: Object.keys(
        sessionVisualAssets.characterSpriteVariantsByKey,
      ),
      stageCharacters:
        currentNode?.presentationPlan?.stageCharacters.map((character) => ({
          displayName: character.displayName,
          presence: character.presence,
          reason: character.reason,
          slot: character.slot,
          subjectId: storyRun
            ? resolveCanonicalCharacterId(
                storyRun.storyBible,
                character.canonicalCharacterId,
              )
            : character.canonicalCharacterId,
          visible: character.visible,
        })) ?? [],
      spriteSources: characters.map((character) => ({
        source: character.assetSource,
        subjectId: character.subjectId,
        slot: character.slot,
      })),
    },
  };
}
