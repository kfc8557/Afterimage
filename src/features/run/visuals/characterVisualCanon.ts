import type {
  CanonCharacter,
  CharacterVisualCanonEntry,
  RunVisualStyleBible,
  SetupProfile,
  StoryBible,
} from "@/domain/types";

import { createCharacterIdentityKey } from "./sessionVisualAssets";

const artDirectionStyleBible: Record<
  SetupProfile["artDirection"],
  Omit<RunVisualStyleBible, "artDirection" | "styleId">
> = {
  "clean-anime-cel": {
    renderingStyle: "clean anime visual novel sprite-sheet rendering",
    lineStyle: "crisp continuous outlines with consistent line weight",
    shadingLighting: "clear cel shading with controlled highlights",
    palette: "readable color blocks with one restrained accent per character",
    textureFinish: "smooth digital finish with minimal grain",
    characterDesignRules:
      "All characters use the same facial construction, eye rendering, proportions, and knee-up VN sprite camera.",
    forbiddenStyleDrift: [
      "Do not switch any character into painterly, 3D, mascot, chibi, or generic default anime styling.",
      "Do not change a character's age band, hair, eyes, outfit language, or body framing unless the story explicitly changes outfit/state.",
    ],
  },
  "high-contrast-noir": {
    renderingStyle: "high-contrast noir VN rendering",
    lineStyle: "sharp silhouettes, clean facial planes, and controlled edge weight",
    shadingLighting: "hard shadows, rim light, and strong value separation",
    palette: "near-black neutrals with one luminous accent per character",
    textureFinish: "polished film-still finish with restrained grain",
    characterDesignRules:
      "All sprites share dramatic noir value structure, face rendering, and knee-up stage framing.",
    forbiddenStyleDrift: [
      "Do not flatten later characters into clean default anime.",
      "Do not soften the noir lighting language or change locked identity traits.",
    ],
  },
  "muted-cinematic": {
    renderingStyle: "muted cinematic anime realism for VN sprites",
    lineStyle: "soft but consistent outlines with grounded facial anatomy",
    shadingLighting: "subtle environmental light, soft shadows, and restrained highlights",
    palette: "low-saturation story palette with amber, slate, or rain-muted accents",
    textureFinish: "slightly painterly digital finish with coherent film color grading",
    characterDesignRules:
      "All character sprites share the same face construction, eye detail, shading depth, palette discipline, and knee-up camera.",
    forbiddenStyleDrift: [
      "Do not let secondary characters become cleaner generic anime than the protagonist.",
      "Do not change locked identity traits, outfit language, or color accents without explicit state change.",
    ],
  },
  "soft-ink-wash": {
    renderingStyle: "soft ink-wash VN illustration",
    lineStyle: "fluid ink contours with shared brush pressure and face rendering",
    shadingLighting: "subdued wash shadows and gentle light transitions",
    palette: "muted ink-wash colors with delicate accent marks",
    textureFinish: "visible soft paper and brush texture",
    characterDesignRules:
      "All characters share the same ink texture, facial proportions, and knee-up sprite framing.",
    forbiddenStyleDrift: [
      "Do not switch to hard cel lines or glossy digital anime.",
      "Do not alter locked body framing, hairstyle, eye color, or outfit language.",
    ],
  },
  "storybook-watercolor": {
    renderingStyle: "storybook watercolor VN illustration",
    lineStyle: "gentle illustrative outlines with consistent facial construction",
    shadingLighting: "soft watercolor shadows and warm ambient light",
    palette: "harmonized watercolor washes with one storybook accent per character",
    textureFinish: "warm paper grain and hand-painted softness",
    characterDesignRules:
      "All characters share the same watercolor finish, proportions, eye rendering, and stage sprite framing.",
    forbiddenStyleDrift: [
      "Do not switch a character into flat anime cel or 3D style.",
      "Do not alter locked identity traits without explicit story cause.",
    ],
  },
};

const fallbackHair = [
  "ink-black shoulder-length hair with an uneven rain-cut fringe",
  "copper-brown chin-length hair tucked behind one ear",
  "blue-black medium hair with a sharp side part and loose temple strands",
  "ash-brown tied-back hair with a few escaped curls",
  "smoke-gray cropped hair with a precise angular outline",
  "deep auburn long hair braided low with a practical tie",
];

const fallbackEyes = [
  "quiet dark eyes with guarded focus and heavy lower lashes",
  "muted amber eyes with a watchful expression",
  "deep gray eyes with restrained intensity",
  "soft hazel eyes with careful attention",
  "pale green eyes that feel analytical rather than cute",
  "warm brown eyes with a tired but alert gaze",
];

const fallbackOutfits = [
  "structured school-uniform inspired layers with a practical cropped jacket",
  "simple collared top under a muted long coat with worn cuffs",
  "neat academy jacket with a single distinctive lapel pin",
  "dark cardigan and tailored skirt or trousers suited to the setting",
  "workroom apron over a narrow-collared shirt with subtle ink marks",
  "weatherproof cloaklet or overshirt layered for the story setting",
];

const fallbackAccents = [
  "slate and charcoal with one small amber accent",
  "deep green and black with a brass accent",
  "rain-muted navy with a pale cream accent",
  "warm gray and brown with a low-saturation red accent",
  "smoky violet and graphite with a silver accent",
  "desaturated teal and black with a worn gold accent",
];

const fallbackExpressions = [
  "composed but guarded, with tension held around the eyes",
  "quietly skeptical, as if withholding one crucial fact",
  "soft-spoken and observant, with restrained emotional leakage",
  "alert and slightly wary, ready to answer but not volunteer",
  "calm surface expression with a hint of private urgency",
];

const fallbackProps = [
  "a small notebook, key tag, ribbon, pin, glove, or document case only if it suits the current story role",
  "one subtle accessory tied to role or setting, never a loud mascot prop",
  "no mandatory prop unless the scene names one; preserve a clean reusable sprite silhouette",
  "a restrained practical accessory that can repeat across scenes without implying a new outfit",
];

function pickStable<T>(items: T[], seed: string, salt: number) {
  const hash = Array.from(`${seed}:${salt}`).reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );

  return items[hash % items.length]!;
}

export function createRunVisualStyleBible(
  setupProfile: SetupProfile,
): RunVisualStyleBible {
  return {
    styleId: `style-${setupProfile.artDirection}`,
    artDirection: setupProfile.artDirection,
    ...artDirectionStyleBible[setupProfile.artDirection],
  };
}

function findProtagonist(storyBible: StoryBible) {
  return (
    storyBible.mainCast.find((entry) => entry.role === "protagonist") ??
    storyBible.mainCast[0] ??
    null
  );
}

export function resolveCanonicalCharacterId(
  storyBible: StoryBible,
  subjectId: string,
) {
  const identityKey = createCharacterIdentityKey(subjectId);
  const protagonist = findProtagonist(storyBible);

  if (
    protagonist &&
    (identityKey === "lead" ||
      identityKey === "protagonist" ||
      identityKey === "main-character")
  ) {
    return protagonist.characterId;
  }

  const castMatch = storyBible.mainCast.find(
    (entry) =>
      createCharacterIdentityKey(entry.characterId) === identityKey ||
      createCharacterIdentityKey(entry.displayName) === identityKey,
  );

  return castMatch?.characterId ?? subjectId;
}

function findCastCharacter(storyBible: StoryBible, canonicalCharacterId: string) {
  const identityKey = createCharacterIdentityKey(canonicalCharacterId);

  return storyBible.mainCast.find(
    (entry) => createCharacterIdentityKey(entry.characterId) === identityKey,
  );
}

function createIdentityLocks(entry: CharacterVisualCanonEntry) {
  return [
    `Keep canonical id ${entry.canonicalCharacterId} tied to ${entry.displayName}.`,
    `Keep hair locked: ${entry.hair}.`,
    `Keep eyes locked: ${entry.eyes}.`,
    `Keep outfit language locked: ${entry.outfit}.`,
    `Keep silhouette/body framing locked: ${entry.silhouetteBodyFraming}.`,
  ];
}

function isPlaceholderName(displayName: string, canonicalCharacterId: string) {
  const normalized = createCharacterIdentityKey(displayName);

  return (
    normalized === "lead" ||
    normalized === "unknown" ||
    normalized === "unknown-girl" ||
    normalized === "unknown-boy" ||
    normalized === "unknown-character" ||
    normalized === createCharacterIdentityKey(canonicalCharacterId)
  );
}

function createCanonEntryFromSharedTemplate(args: {
  canonicalCharacterId: string;
  character: CanonCharacter | null;
  setupProtagonistCue?: string | null;
  storyBible: StoryBible;
}): CharacterVisualCanonEntry {
  const seed = `${args.canonicalCharacterId}:${args.storyBible.worldviewPremise}`;
  const displayName =
    args.character?.displayName ?? args.canonicalCharacterId.replace(/-/g, " ");
  const role = args.character?.role ?? "supporting scene character";
  const publicSummary =
    args.character?.publicSummary ??
    "app-inferred supporting character; details locked after first visual canon creation";
  const protagonistCue = args.setupProtagonistCue?.trim();
  const identityCue = protagonistCue || publicSummary;
  const sourcePrefix = protagonistCue
    ? "setup-derived protagonist cue"
    : "story-inferred character cue";
  const entry: CharacterVisualCanonEntry = {
    canonicalCharacterId: args.canonicalCharacterId,
    displayName,
    roleArchetype: `${role}; ${publicSummary}`,
    ageBandPresentation: protagonistCue
      ? `infer from ${sourcePrefix}: ${identityCue}; keep age/presentation consistent`
      : `young adult or context-appropriate presentation inferred from role/world: ${publicSummary}`,
    hair: protagonistCue
      ? `derive and lock from ${sourcePrefix}: ${identityCue}`
      : `${pickStable(fallbackHair, seed, 1)}; harmonized with role/world cue: ${publicSummary}`,
    eyes: protagonistCue
      ? `derive and lock from ${sourcePrefix}: ${identityCue}`
      : `${pickStable(fallbackEyes, seed, 2)}; harmonized with role/world cue: ${publicSummary}`,
    outfit: protagonistCue
      ? `derive and lock from ${sourcePrefix}: ${identityCue}`
      : `${pickStable(fallbackOutfits, seed, 3)}; adapted to the story world without copying the protagonist`,
    silhouetteBodyFraming: protagonistCue
      ? `stable knee-up VN sprite framing derived from ${sourcePrefix}: ${identityCue}`
      : "stable knee-up visual novel sprite framing with a distinct readable silhouette, shoulders, and hands when useful",
    colorPaletteAccent:
      protagonistCue
        ? `derive from ${sourcePrefix} and the run-level style bible; keep one restrained accent`
        : `${pickStable(fallbackAccents, seed, 4)}; chosen to distinguish this character within the same cast style`,
    expressionBaseline: protagonistCue
      ? `baseline expression follows ${sourcePrefix} and the current story tone`
      : pickStable(fallbackExpressions, seed, 5),
    propsAccessories: protagonistCue
      ? `only props/accessories named or clearly implied by ${sourcePrefix}: ${identityCue}`
      : pickStable(fallbackProps, seed, 6),
    forbiddenChangesIdentityLocks: [],
  };

  return {
    ...entry,
    forbiddenChangesIdentityLocks: createIdentityLocks(entry),
  };
}

export function createCharacterVisualCanonEntry(args: {
  canonicalCharacterId: string;
  character: CanonCharacter | null;
  setupProtagonistCue?: string | null;
  storyBible: StoryBible;
}) {
  return createCanonEntryFromSharedTemplate(args);
}

export function createProtagonistVisualCanon(args: {
  character: CanonCharacter;
  setupProfile: SetupProfile;
  storyBible?: StoryBible;
}): CharacterVisualCanonEntry {
  const setupProtagonistCue =
    args.setupProfile.protagonist[0] ??
    args.setupProfile.mainCharacterTraits[0] ??
    args.character.publicSummary;

  return createCanonEntryFromSharedTemplate({
    canonicalCharacterId: args.character.characterId,
    character: args.character,
    setupProtagonistCue,
    storyBible:
      args.storyBible ??
      ({
        worldviewPremise:
          args.setupProfile.premise[0] ??
          args.setupProfile.worldviewSpecs[0] ??
          args.character.publicSummary,
      } as StoryBible),
  });
}

export function createInferredCharacterVisualCanon(args: {
  canonicalCharacterId: string;
  character: CanonCharacter | null;
  storyBible: StoryBible;
}): CharacterVisualCanonEntry {
  return createCanonEntryFromSharedTemplate(args);
}

export function ensureStoryBibleVisualCanon(args: {
  presentationCharacters?: Array<{
    canonicalCharacterId: string;
    displayName: string | null;
    publicSummary?: string | null;
    role?: string | null;
  }>;
  setupProfile: SetupProfile;
  storyBible: StoryBible;
  subjectIds: string[];
}) {
  let mainCast = [...args.storyBible.mainCast];
  let characterVisualCanon = [...args.storyBible.characterVisualCanon];
  const visualStyleBible =
    args.storyBible.visualStyleBible ?? createRunVisualStyleBible(args.setupProfile);
  const protagonist = findProtagonist(args.storyBible);
  const presentationById = new Map(
    (args.presentationCharacters ?? []).map((character) => [
      createCharacterIdentityKey(character.canonicalCharacterId),
      character,
    ]),
  );
  const allSubjectIds = Array.from(
    new Set([
      ...args.subjectIds,
      ...(args.presentationCharacters ?? []).map(
        (character) => character.canonicalCharacterId,
      ),
    ]),
  );

  allSubjectIds.forEach((subjectId) => {
    const canonicalCharacterId = resolveCanonicalCharacterId(
      args.storyBible,
      subjectId,
    );
    const existingEntry = characterVisualCanon.find(
      (entry) =>
        createCharacterIdentityKey(entry.canonicalCharacterId) ===
        createCharacterIdentityKey(canonicalCharacterId),
    );
    const presentationCharacter = presentationById.get(
      createCharacterIdentityKey(canonicalCharacterId),
    );
    const displayName = presentationCharacter?.displayName?.trim() || null;

    if (existingEntry) {
      if (
        displayName &&
        displayName !== existingEntry.displayName &&
        isPlaceholderName(existingEntry.displayName, canonicalCharacterId)
      ) {
        const updatedEntry = {
          ...existingEntry,
          displayName,
        };
        characterVisualCanon = characterVisualCanon.map((entry) =>
          createCharacterIdentityKey(entry.canonicalCharacterId) ===
          createCharacterIdentityKey(canonicalCharacterId)
            ? {
                ...updatedEntry,
                forbiddenChangesIdentityLocks: createIdentityLocks(updatedEntry),
              }
            : entry,
        );
      }
      return;
    }

    const castCharacter =
      findCastCharacter({ ...args.storyBible, mainCast }, canonicalCharacterId) ??
      (displayName
        ? {
            characterId: canonicalCharacterId,
            displayName,
            role: presentationCharacter?.role ?? "supporting scene character",
            publicSummary:
              presentationCharacter?.publicSummary ??
              "AI-introduced character; visual canon is locked at first staged appearance.",
          }
        : null);

    if (
      castCharacter &&
      !mainCast.some(
        (entry) =>
          createCharacterIdentityKey(entry.characterId) ===
          createCharacterIdentityKey(canonicalCharacterId),
      )
    ) {
      mainCast = [...mainCast, castCharacter];
    }

    const setupProtagonistCue =
      protagonist &&
      createCharacterIdentityKey(protagonist.characterId) ===
        createCharacterIdentityKey(canonicalCharacterId)
        ? args.setupProfile.protagonist[0] ??
          args.setupProfile.mainCharacterTraits[0] ??
          protagonist.publicSummary
        : null;
    const nextEntry =
      createCharacterVisualCanonEntry({
        canonicalCharacterId,
        character: castCharacter ?? null,
        setupProtagonistCue,
        storyBible: {
          ...args.storyBible,
          mainCast,
        },
      });

    characterVisualCanon = [...characterVisualCanon, nextEntry];
  });

  return {
    ...args.storyBible,
    mainCast,
    visualStyleBible,
    characterVisualCanon,
  };
}

export function getCharacterVisualCanon(
  storyBible: StoryBible,
  canonicalCharacterId: string,
) {
  const identityKey = createCharacterIdentityKey(canonicalCharacterId);

  return (
    storyBible.characterVisualCanon.find(
      (entry) =>
        createCharacterIdentityKey(entry.canonicalCharacterId) === identityKey,
    ) ?? null
  );
}

export function formatRunVisualStyleBible(styleBible: RunVisualStyleBible) {
  return [
    "[RUN_STYLE_BIBLE]",
    `styleId: ${styleBible.styleId}`,
    `artDirection: ${styleBible.artDirection}`,
    `renderingStyle: ${styleBible.renderingStyle}`,
    `lineStyle: ${styleBible.lineStyle}`,
    `shadingLighting: ${styleBible.shadingLighting}`,
    `palette: ${styleBible.palette}`,
    `textureFinish: ${styleBible.textureFinish}`,
    `characterDesignRules: ${styleBible.characterDesignRules}`,
    `forbiddenStyleDrift: ${styleBible.forbiddenStyleDrift.join("; ")}`,
  ].join("\n");
}

export function formatCharacterSpritePrompt(args: {
  characterCanon: CharacterVisualCanonEntry;
  sourceBeatBrief: string | null | undefined;
  styleBible: RunVisualStyleBible;
}) {
  return [
    formatRunVisualStyleBible(args.styleBible),
    "[CHARACTER_VISUAL_CANON]",
    `canonicalCharacterId: ${args.characterCanon.canonicalCharacterId}`,
    `displayName: ${args.characterCanon.displayName}`,
    `roleArchetype: ${args.characterCanon.roleArchetype}`,
    `ageBandPresentation: ${args.characterCanon.ageBandPresentation}`,
    `hair: ${args.characterCanon.hair}`,
    `eyes: ${args.characterCanon.eyes}`,
    `outfit: ${args.characterCanon.outfit}`,
    `silhouetteBodyFraming: ${args.characterCanon.silhouetteBodyFraming}`,
    `colorPaletteAccent: ${args.characterCanon.colorPaletteAccent}`,
    `expressionBaseline: ${args.characterCanon.expressionBaseline}`,
    `propsAccessories: ${args.characterCanon.propsAccessories}`,
    `forbiddenChangesIdentityLocks: ${args.characterCanon.forbiddenChangesIdentityLocks.join("; ")}`,
    "[CURRENT_SPRITE_BEAT]",
    `poseExpressionPropCue: ${args.sourceBeatBrief ?? "baseline reusable sprite"}`,
    "[SAME_CAST_SPRITE_SHEET_REQUIREMENTS]",
    "sameCastSheet: match the run style bible, line weight, face construction, eye rendering, proportions, shading depth, palette discipline, and finish used by every other generated character in this run",
    "identityContinuity: obey the forbidden identity locks exactly while changing only expression, pose, or story-state details named in the current beat",
    "[ASSET_CONSTRAINTS]",
    "assetClass: character-sprite",
    "exactlyOneCharacter: true",
    "framing: stable knee-up VN sprite",
    "background: transparent if supported, otherwise plain removable",
    "forbid: other people, scenic tableau, text, UI, logo, watermark, caption, speech bubble",
  ].join("\n");
}
