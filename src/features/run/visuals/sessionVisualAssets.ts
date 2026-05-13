export type SessionVisualAssets = {
  backgroundsByLocationKey: Record<string, string>;
  characterSpritesByIdentity: Record<string, string>;
  characterSpriteVariantsByKey: Record<string, string>;
};

export const defaultSessionVisualAssets: SessionVisualAssets = {
  backgroundsByLocationKey: {},
  characterSpritesByIdentity: {},
  characterSpriteVariantsByKey: {},
};

function normalizeVisualKey(value: string | null | undefined, fallback: string) {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return normalized || fallback;
}

export function createBackgroundAssetKey(locationLabel: string | null | undefined) {
  return `background:${normalizeVisualKey(locationLabel, "current-location")}`;
}

export function createCharacterIdentityKey(subjectId: string | null | undefined) {
  return normalizeVisualKey(subjectId, "lead");
}

export function createCharacterVariantKey(args: {
  promptBrief: string | null | undefined;
  subjectId: string | null | undefined;
}) {
  const identityKey = createCharacterIdentityKey(args.subjectId);
  const prompt = args.promptBrief?.toLowerCase() ?? "";
  const materialStateTerms = [
    "angry",
    "blood",
    "crying",
    "different outfit",
    "disguise",
    "dress",
    "final",
    "gold eyed",
    "gold-eyed",
    "injured",
    "revealing",
    "school uniform",
    "sexy",
    "smiling",
    "soaked",
    "uniform",
    "wristband",
    "wounded",
  ];
  const materialState = materialStateTerms.find((term) =>
    prompt.includes(term),
  );

  return materialState
    ? `${identityKey}:${normalizeVisualKey(materialState, "state")}`
    : `${identityKey}:base`;
}

export function mergeSessionVisualAssets(
  currentAssets: SessionVisualAssets,
  nextAssets: Partial<SessionVisualAssets>,
): SessionVisualAssets {
  return {
    backgroundsByLocationKey: {
      ...currentAssets.backgroundsByLocationKey,
      ...nextAssets.backgroundsByLocationKey,
    },
    characterSpritesByIdentity: {
      ...currentAssets.characterSpritesByIdentity,
      ...nextAssets.characterSpritesByIdentity,
    },
    characterSpriteVariantsByKey: {
      ...currentAssets.characterSpriteVariantsByKey,
      ...nextAssets.characterSpriteVariantsByKey,
    },
  };
}
