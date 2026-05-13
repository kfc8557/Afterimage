import { z } from "zod";

import {
  CHOICES_MAX,
  CHOICES_MIN,
  CONCLUSION_PRESSURE_DELTA_MAX,
  CONCLUSION_PRESSURE_MAX,
  CONCLUSION_PRESSURE_MIN,
  RECENT_WAVES_DEFAULT_MAX,
  QUESTIONNAIRE_ANSWER_VALUE_MAX_LENGTH,
  SETUP_SEED_TEXT_ARRAY_MAX,
  SETUP_SEED_TEXT_ENTRY_MAX_LENGTH,
  SETUP_VIBE_MAX_LENGTH,
  STATE_DELTA_MAX,
  STATE_DELTA_MIN,
  STORY_CHECKPOINT_SCHEMA_VERSION,
  STYLE_VALUE_MAX,
  STYLE_VALUE_MIN,
} from "../constants/contracts";

const idSchema = z.string().trim().min(1);
const nonEmptyStringSchema = z.string().trim().min(1);
const setupSeedTextSchema = nonEmptyStringSchema.max(
  SETUP_SEED_TEXT_ENTRY_MAX_LENGTH,
);
const setupSeedTextArraySchema = z
  .array(setupSeedTextSchema)
  .max(SETUP_SEED_TEXT_ARRAY_MAX);
const timestampSchema = z.string().datetime({ offset: true });
const boundedFloatSchema = z
  .number()
  .min(CONCLUSION_PRESSURE_MIN)
  .max(CONCLUSION_PRESSURE_MAX);
const styleValueSchema = z.number().min(STYLE_VALUE_MIN).max(STYLE_VALUE_MAX);
const styleDeltaValueSchema = z.number().min(STATE_DELTA_MIN).max(STATE_DELTA_MAX);

export const SeedStyleSchema = z
  .object({
    tone: z.enum(["warm", "tense", "melancholic", "playful", "ominous"]),
    romanceLevel: z.enum(["low", "medium", "high"]),
    mysteryLevel: z.enum(["low", "medium", "high"]),
    tempo: z.enum(["gentle", "balanced", "brisk"]),
    surrealness: z.enum(["low", "medium", "high"]),
  })
  .strict();

export const ArtDirectionSchema = z.enum([
  "soft-ink-wash",
  "clean-anime-cel",
  "muted-cinematic",
  "high-contrast-noir",
  "storybook-watercolor",
]);

export const QuestionnaireAnswerSchema = z
  .object({
    questionId: idSchema,
    answerType: z.enum(["single-choice", "text", "omakase"]),
    value: nonEmptyStringSchema.max(QUESTIONNAIRE_ANSWER_VALUE_MAX_LENGTH),
  })
  .strict();

export const OmakaseFlagsSchema = z
  .object({
    mainCharacterTraits: z.boolean(),
    worldviewSpecs: z.boolean(),
  })
  .strict();

export const SetupProfileSchema = z
  .object({
    questionnaireAnswers: z.array(QuestionnaireAnswerSchema),
    vibe: setupSeedTextSchema.max(SETUP_VIBE_MAX_LENGTH).default("legacy beta vibe"),
    artDirection: ArtDirectionSchema.default("clean-anime-cel"),
    premise: setupSeedTextArraySchema.default([]),
    protagonist: setupSeedTextArraySchema.default([]),
    relationshipSeed: setupSeedTextArraySchema.default([]),
    mainCharacterTraits: setupSeedTextArraySchema,
    worldviewSpecs: setupSeedTextArraySchema,
    omakaseFlags: OmakaseFlagsSchema,
    seedStyle: SeedStyleSchema,
  })
  .strict();

export const CanonCharacterSchema = z
  .object({
    characterId: idSchema,
    displayName: nonEmptyStringSchema,
    role: nonEmptyStringSchema,
    publicSummary: nonEmptyStringSchema,
  })
  .strict();

export const CharacterVisualCanonEntrySchema = z
  .object({
    canonicalCharacterId: idSchema,
    displayName: nonEmptyStringSchema,
    roleArchetype: nonEmptyStringSchema,
    ageBandPresentation: nonEmptyStringSchema,
    hair: nonEmptyStringSchema,
    eyes: nonEmptyStringSchema,
    outfit: nonEmptyStringSchema,
    silhouetteBodyFraming: nonEmptyStringSchema,
    colorPaletteAccent: nonEmptyStringSchema,
    expressionBaseline: nonEmptyStringSchema,
    propsAccessories: nonEmptyStringSchema,
    forbiddenChangesIdentityLocks: z.array(nonEmptyStringSchema),
  })
  .strict();

export const RunVisualStyleBibleSchema = z
  .object({
    styleId: idSchema,
    artDirection: ArtDirectionSchema,
    renderingStyle: nonEmptyStringSchema,
    lineStyle: nonEmptyStringSchema,
    shadingLighting: nonEmptyStringSchema,
    palette: nonEmptyStringSchema,
    textureFinish: nonEmptyStringSchema,
    characterDesignRules: nonEmptyStringSchema,
    forbiddenStyleDrift: z.array(nonEmptyStringSchema),
  })
  .strict();

export const VisualCanonEntrySchema = z
  .object({
    subjectId: idSchema,
    descriptor: nonEmptyStringSchema,
  })
  .strict();

export const StoryBibleSchema = z
  .object({
    worldviewPremise: nonEmptyStringSchema,
    settingRules: z.array(nonEmptyStringSchema),
    mainCast: z.array(CanonCharacterSchema),
    coreConflicts: z.array(nonEmptyStringSchema),
    forbiddenContradictions: z.array(nonEmptyStringSchema),
    initialVisualCanon: z.array(VisualCanonEntrySchema),
    visualStyleBible: RunVisualStyleBibleSchema.default({
      styleId: "legacy-clean-anime-cel",
      artDirection: "clean-anime-cel",
      renderingStyle: "shared visual novel sprite-sheet rendering",
      lineStyle: "consistent clean line weight and facial construction",
      shadingLighting: "consistent cel shading and readable stage lighting",
      palette: "coherent story palette with restrained accents",
      textureFinish: "consistent finish across backgrounds and sprites",
      characterDesignRules:
        "Characters must share one run-level art treatment while preserving distinct identity details.",
      forbiddenStyleDrift: [
        "Do not switch a later character into generic default anime styling.",
        "Do not change age band, hair, eyes, outfit language, body framing, or palette without explicit story cause.",
      ],
    }),
    characterVisualCanon: z.array(CharacterVisualCanonEntrySchema).default([]),
  })
  .strict();

export const StyleStateSchema = z
  .object({
    warmth: styleValueSchema,
    tension: styleValueSchema,
    melancholy: styleValueSchema,
    playfulness: styleValueSchema,
    ominousness: styleValueSchema,
    romance: styleValueSchema,
    mystery: styleValueSchema,
    tempo: styleValueSchema,
    surrealness: styleValueSchema,
  })
  .strict();

export const ThreadStateSchema = z
  .object({
    label: nonEmptyStringSchema,
    status: z.enum(["open", "active", "resolved", "failed", "dormant"]),
  })
  .strict();

export const RunStateSchema = z
  .object({
    chapterIndex: z.number().int().min(0),
    sceneIndex: z.number().int().min(0),
    styleState: StyleStateSchema,
    relationshipTracks: z.record(z.number()),
    activeThreads: z.record(ThreadStateSchema),
    inventoryFlags: z.record(z.boolean()),
    conclusionPressure: boundedFloatSchema,
    endingCandidates: z.array(nonEmptyStringSchema),
  })
  .strict();

export const ChoiceOptionSchema = z
  .object({
    id: idSchema,
    label: nonEmptyStringSchema,
    intentTag: nonEmptyStringSchema,
  })
  .strict();

export const RecentWaveSchema = z
  .object({
    nodeId: idSchema,
    waveSummary: nonEmptyStringSchema,
    presentedChoices: z.array(ChoiceOptionSchema).max(5),
    chosenChoiceId: idSchema.nullable(),
  })
  .strict();

export const ResolvedAssetRefSchema = z
  .object({
    subjectId: idSchema,
    source: z.enum(["manifest", "generated"]),
    assetRefId: idSchema,
    assetUrl: nonEmptyStringSchema,
  })
  .strict();

export const StoryCheckpointBundleSchema = z
  .object({
    setupProfile: SetupProfileSchema,
    storyBible: StoryBibleSchema,
    runState: RunStateSchema,
    recentWaves: z.array(RecentWaveSchema).max(RECENT_WAVES_DEFAULT_MAX),
    eventCursor: z.number().int().min(0),
    resolvedAssetRefs: z.array(ResolvedAssetRefSchema),
  })
  .strict();

export const StoryCheckpointSchema = z
  .object({
    id: idSchema,
    storyRunId: idSchema,
    episodeNodeId: idSchema,
    checkpointIndex: z.number().int().min(0),
    createdAt: timestampSchema,
    schemaVersion: z.literal(STORY_CHECKPOINT_SCHEMA_VERSION),
    bundle: StoryCheckpointBundleSchema,
  })
  .strict();

export const SettingsSchema = z
  .object({
    imageMode: z.enum(["off", "important-only", "aggressive"]),
    textSpeed: z.enum(["slow", "normal", "fast"]),
    autoAdvance: z.boolean(),
    reduceMotion: z.boolean(),
  })
  .strict();

export const StoryRunModeSchema = z.enum([
  "experimental-ai",
  "premade-default",
]);

export const StorySceneTypeSchema = z.enum(["opening", "normal", "ending"]);

export const PresentationBackgroundDecisionSchema = z.enum([
  "establish",
  "reuse",
  "change",
]);

export const PresentationStageSlotSchema = z.enum(["left", "right"]);

export const PresentationStageCharacterSchema = z
  .object({
    canonicalCharacterId: idSchema,
    displayName: nonEmptyStringSchema.nullable().default(null),
    presence: z.enum(["present", "offstage", "unknown"]),
    visible: z.boolean(),
    slot: PresentationStageSlotSchema.nullable(),
    expression: nonEmptyStringSchema,
    pose: nonEmptyStringSchema,
    priority: z.number().int().min(0).max(100).default(50),
    reason: nonEmptyStringSchema,
  })
  .strict();

export const PresentationBackgroundPlanSchema = z
  .object({
    decision: PresentationBackgroundDecisionSchema,
    locationId: idSchema,
    locationLabel: nonEmptyStringSchema,
    promptBrief: nonEmptyStringSchema,
    reason: nonEmptyStringSchema,
  })
  .strict();

export const PresentationPlanSchema = z
  .object({
    sceneType: StorySceneTypeSchema,
    presentationSegmentId: idSchema,
    background: PresentationBackgroundPlanSchema,
    stageCharacters: z.array(PresentationStageCharacterSchema),
    focusCharacterId: idSchema.nullable(),
    notes: nonEmptyStringSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const visibleCharacters = value.stageCharacters.filter(
      (character) => character.visible,
    );

    if (visibleCharacters.length > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Presentation plan may show at most two visible sprites.",
        path: ["stageCharacters"],
      });
    }

    const visibleSlots = visibleCharacters
      .map((character) => character.slot)
      .filter((slot): slot is z.infer<typeof PresentationStageSlotSchema> =>
        Boolean(slot),
      );

    if (visibleSlots.length !== new Set(visibleSlots).size) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Visible stage characters must not share the same slot.",
        path: ["stageCharacters"],
      });
    }
  });

export const StoryRunSchema = z
  .object({
    id: idSchema,
    ownerUserId: idSchema,
    runMode: StoryRunModeSchema.default("experimental-ai"),
    premadeStoryId: idSchema.nullable().default(null),
    status: z.enum(["setup", "active", "ended", "archived"]),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    originCheckpointId: idSchema.nullable(),
    setupProfile: SetupProfileSchema,
    storyBible: StoryBibleSchema,
    runState: RunStateSchema,
    recentWaves: z.array(RecentWaveSchema).max(RECENT_WAVES_DEFAULT_MAX),
    latestCheckpointId: idSchema.nullable(),
    latestEpisodeNodeId: idSchema.nullable(),
    settingsSnapshot: SettingsSchema,
  })
  .strict();

export const ImageRequestSchema = z
  .object({
    subjectType: z.enum(["background", "important-character", "portrait-frame"]),
    subjectId: idSchema,
    promptBrief: nonEmptyStringSchema,
    styleAnchor: nonEmptyStringSchema,
    reason: nonEmptyStringSchema,
  })
  .strict();

export const ImageActionSchema = z
  .object({
    source: z.enum(["manifest", "generated"]),
    subjectType: z.enum(["background", "important-character", "portrait-frame"]),
    subjectId: idSchema,
    promptBrief: nonEmptyStringSchema,
    styleAnchor: nonEmptyStringSchema,
    reason: nonEmptyStringSchema,
    resolvedAssetUrl: nonEmptyStringSchema.nullable(),
    generatedAssetId: idSchema.nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.source === "manifest") {
      if (!value.resolvedAssetUrl || value.generatedAssetId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Manifest image actions require resolvedAssetUrl and forbid generatedAssetId.",
        });
      }
    }

    if (value.source === "generated") {
      if (!value.generatedAssetId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Generated image actions require generatedAssetId.",
        });
      }
    }
  });

export const ImageGenerationResultSchema = z
  .object({
    action: ImageActionSchema,
    // Transient browser-session preview only. This may contain provider base64
    // data and must never be copied into EpisodeNode/checkpoint persistence.
    sessionPreviewUrl: nonEmptyStringSchema.nullable(),
  })
  .strict();

export const EndStateSchema = z
  .object({
    endingType: z.enum(["resolved", "tragic", "bittersweet", "open"]),
    epilogueSummary: nonEmptyStringSchema,
  })
  .strict();

export const StateDeltaSchema = z
  .object({
    styleShifts: z
      .object({
        warmth: styleDeltaValueSchema.optional(),
        tension: styleDeltaValueSchema.optional(),
        melancholy: styleDeltaValueSchema.optional(),
        playfulness: styleDeltaValueSchema.optional(),
        ominousness: styleDeltaValueSchema.optional(),
        romance: styleDeltaValueSchema.optional(),
        mystery: styleDeltaValueSchema.optional(),
        tempo: styleDeltaValueSchema.optional(),
        surrealness: styleDeltaValueSchema.optional(),
      })
      .strict()
      .optional(),
    relationshipDelta: z.record(z.number()).optional(),
    threadUpdates: z.record(ThreadStateSchema).optional(),
    inventoryUpdates: z.record(z.union([z.boolean(), z.null()])).optional(),
    conclusionPressureDelta: z
      .number()
      .min(0)
      .max(CONCLUSION_PRESSURE_DELTA_MAX),
    newEndingCandidate: nonEmptyStringSchema.optional(),
  })
  .strict();

export const SceneLineSchema = z
  .object({
    id: idSchema,
    kind: z.enum(["narration", "dialogue", "system"]),
    speakerId: idSchema.nullable(),
    backgroundKey: idSchema.nullable().default(null),
    presentationSegmentId: idSchema.nullable().default(null),
    authoredVisualState: z
      .object({
        bg: idSchema,
        left: idSchema.nullable(),
        right: idSchema.nullable(),
      })
      .strict()
      .nullable()
      .default(null),
    text: nonEmptyStringSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind === "dialogue" && !value.speakerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dialogue lines require speakerId.",
      });
    }

    if (value.kind !== "dialogue" && value.speakerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only dialogue lines may specify speakerId.",
      });
    }
  });

export const SceneContentSchema = z
  .object({
    locationLabel: nonEmptyStringSchema.optional(),
    lines: z.array(SceneLineSchema).min(1),
  })
  .strict();

const choicesArraySchema = z.array(ChoiceOptionSchema).max(CHOICES_MAX);
const deterministicChoicesArraySchema = z.array(ChoiceOptionSchema).max(5);

export const StoryTurnResponseSchema = z
  .object({
    sceneType: StorySceneTypeSchema.default("normal"),
    sceneContent: SceneContentSchema,
    sceneSummary: nonEmptyStringSchema,
    presentationPlan: PresentationPlanSchema,
    choices: choicesArraySchema,
    stateDelta: StateDeltaSchema,
    imageRequest: ImageRequestSchema.optional(),
    endState: EndStateSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.endState && value.choices.length < CHOICES_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `choices must contain ${CHOICES_MIN}-${CHOICES_MAX} entries unless endState is present.`,
        path: ["choices"],
      });
    }
  });

export const EpisodeNodeSchema = z
  .object({
    id: idSchema,
    storyRunId: idSchema,
    parentEpisodeNodeId: idSchema.nullable(),
    depth: z.number().int().min(0),
    sceneType: StorySceneTypeSchema.default("normal"),
    turnType: z.enum(["initial", "choice-result", "ending"]),
    playerChoiceId: idSchema.nullable(),
    scene: SceneContentSchema,
    sceneSummary: nonEmptyStringSchema,
    presentationPlan: PresentationPlanSchema.nullable().default(null),
    choices: deterministicChoicesArraySchema,
    stateDelta: StateDeltaSchema,
    imageActions: z.array(ImageActionSchema),
    endState: EndStateSchema.optional(),
    createdAt: timestampSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.turnType === "ending" && !value.endState) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ending nodes must include endState.",
        path: ["endState"],
      });
    }
  });

export const StoryTurnRequestSchema = z
  .object({
    requestType: z.enum(["initial", "continue"]),
    sceneType: StorySceneTypeSchema,
    setupProfile: SetupProfileSchema,
    storyBible: StoryBibleSchema,
    runState: RunStateSchema,
    recentWaves: z.array(RecentWaveSchema).max(RECENT_WAVES_DEFAULT_MAX),
    lastPlayerChoice: ChoiceOptionSchema.nullable().optional(),
    continuityHints: z.array(nonEmptyStringSchema),
    imageMode: SettingsSchema.shape.imageMode,
    assetManifestHints: z.array(nonEmptyStringSchema),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.requestType === "initial" && value.lastPlayerChoice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Initial turn requests cannot include lastPlayerChoice.",
        path: ["lastPlayerChoice"],
      });
    }
  });

export const ShareCodeSchema = z
  .object({
    id: idSchema,
    code: nonEmptyStringSchema,
    checkpointId: idSchema,
    createdByUserId: idSchema,
    createdAt: timestampSchema,
    expiresAt: timestampSchema.nullable(),
  })
  .strict();

export const AssetManifestEntrySchema = z
  .object({
    id: idSchema,
    kind: z.enum(["background", "sideCharacter", "portraitFrame", "ui"]),
    tags: z.array(nonEmptyStringSchema),
    variantKey: nonEmptyStringSchema,
    assetUrl: nonEmptyStringSchema,
    licenseNote: nonEmptyStringSchema.optional(),
    priority: z.number().int().min(0),
  })
  .strict();

export function validateRecentWavesBound(
  recentWaves: z.input<typeof RecentWaveSchema>[],
  maxRecentWaves = RECENT_WAVES_DEFAULT_MAX,
) {
  return z.array(RecentWaveSchema).max(maxRecentWaves).safeParse(recentWaves);
}
