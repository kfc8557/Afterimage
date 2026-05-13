import type {
  EpisodeNode,
  RunState,
  SeedStyle,
  Settings,
  SetupProfile,
  StoryBible,
  StoryRun,
  StyleState,
} from "@/domain/types";
import {
  createProtagonistVisualCanon,
  createRunVisualStyleBible,
} from "@/features/run/visuals/characterVisualCanon";

type LocalActiveRunSession = {
  currentNodeId: string | null;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  storyRun: StoryRun;
};

function createLocalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createStyleState(seedStyle: SeedStyle): StyleState {
  const tonePresets: Record<
    SeedStyle["tone"],
    Pick<
      StyleState,
      "warmth" | "tension" | "melancholy" | "playfulness" | "ominousness"
    >
  > = {
    warm: {
      warmth: 0.75,
      tension: 0.2,
      melancholy: 0.25,
      playfulness: 0.45,
      ominousness: 0.1,
    },
    tense: {
      warmth: 0.2,
      tension: 0.8,
      melancholy: 0.35,
      playfulness: 0.1,
      ominousness: 0.45,
    },
    melancholic: {
      warmth: 0.2,
      tension: 0.35,
      melancholy: 0.8,
      playfulness: 0.1,
      ominousness: 0.3,
    },
    playful: {
      warmth: 0.45,
      tension: 0.15,
      melancholy: 0.15,
      playfulness: 0.8,
      ominousness: 0.1,
    },
    ominous: {
      warmth: 0.1,
      tension: 0.55,
      melancholy: 0.45,
      playfulness: 0.05,
      ominousness: 0.85,
    },
  };

  const mappedLevels = {
    low: 0.2,
    medium: 0.5,
    high: 0.8,
  } as const;

  const tempoLevels = {
    gentle: 0.25,
    balanced: 0.5,
    brisk: 0.75,
  } as const;

  return {
    ...tonePresets[seedStyle.tone],
    romance: mappedLevels[seedStyle.romanceLevel],
    mystery: mappedLevels[seedStyle.mysteryLevel],
    tempo: tempoLevels[seedStyle.tempo],
    surrealness: mappedLevels[seedStyle.surrealness],
  };
}

function createStoryBible(setupProfile: SetupProfile): StoryBible {
  const worldviewLead =
    setupProfile.premise[0] ??
    setupProfile.worldviewSpecs[0] ??
    "A hidden city of private vows and expensive memories.";
  const protagonistDescriptor =
    setupProfile.protagonist[0] ??
    setupProfile.mainCharacterTraits[0] ??
    "An unreadable lead carrying more restraint than certainty.";
  const protagonistDisplayName =
    extractProtagonistDisplayName(protagonistDescriptor) ?? "Lead";
  const protagonistCharacterId =
    protagonistDisplayName.toLowerCase() === "lead"
      ? "lead"
      : createCharacterIdFromDisplayName(protagonistDisplayName);

  const protagonistCharacter = {
    characterId: protagonistCharacterId,
    displayName: protagonistDisplayName,
    role: "protagonist",
    publicSummary: protagonistDescriptor,
  };
  const visualStyleBible = createRunVisualStyleBible(setupProfile);
  const baseStoryBible: StoryBible = {
    worldviewPremise: worldviewLead,
    settingRules:
      setupProfile.premise.length > 0
        ? [
            ...setupProfile.premise,
            ...setupProfile.relationshipSeed,
            `Art direction: ${setupProfile.artDirection}.`,
          ]
        : [
            "Every promise has a visible cost.",
            "Public calm often hides private leverage.",
          ],
    mainCast: [protagonistCharacter],
    coreConflicts: [
      "The opening shell hints at a private tension that later generation must resolve.",
    ],
    forbiddenContradictions: [
      "Do not break the initial worldview premise established by setup.",
    ],
    initialVisualCanon: [
      {
        subjectId: protagonistCharacterId,
        descriptor: `${protagonistDescriptor}; art direction ${setupProfile.artDirection}`,
      },
    ],
    visualStyleBible,
    characterVisualCanon: [],
  };

  return {
    ...baseStoryBible,
    characterVisualCanon: [
      createProtagonistVisualCanon({
        character: protagonistCharacter,
        setupProfile,
        storyBible: baseStoryBible,
      }),
    ],
  };
}

function extractProtagonistDisplayName(descriptor: string) {
  const nameMatch = descriptor.match(
    /\b(?!The\b|A\b|An\b|Art\b|Clean\b|Soft\b|Muted\b|High\b|Storybook\b)([A-Z][a-z]{1,24})\b/,
  );

  return nameMatch?.[1] ?? null;
}

function createCharacterIdFromDisplayName(displayName: string) {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return slug ? `protagonist-${slug}` : "lead";
}

function createRunState(seedStyle: SeedStyle): RunState {
  return {
    chapterIndex: 0,
    sceneIndex: 0,
    styleState: createStyleState(seedStyle),
    relationshipTracks: {},
    activeThreads: {
      "opening-question": {
        label: "Opening question",
        status: "open",
      },
    },
    inventoryFlags: {},
    conclusionPressure: 0,
    endingCandidates: [],
  };
}

export function createLocalActiveRunSession(
  setupProfile: SetupProfile,
  settings: Settings,
): LocalActiveRunSession {
  const storyRunId = createLocalId("story-run");
  const createdAt = new Date().toISOString();
  const storyBible = createStoryBible(setupProfile);
  const runState = createRunState(setupProfile.seedStyle);

  const storyRun: StoryRun = {
    id: storyRunId,
    ownerUserId: "local-user",
    runMode: "experimental-ai",
    premadeStoryId: null,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    originCheckpointId: null,
    setupProfile,
    storyBible,
    runState,
    recentWaves: [],
    latestCheckpointId: null,
    latestEpisodeNodeId: null,
    settingsSnapshot: settings,
  };

  return {
    currentNodeId: null,
    episodeNodesById: {},
    nodeOrder: [],
    storyRun,
  };
}
