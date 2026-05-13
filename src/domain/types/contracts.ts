import type { z } from "zod";

import type {
  AssetManifestEntrySchema,
  ArtDirectionSchema,
  CharacterVisualCanonEntrySchema,
  CanonCharacterSchema,
  ChoiceOptionSchema,
  EndStateSchema,
  EpisodeNodeSchema,
  ImageActionSchema,
  ImageGenerationResultSchema,
  ImageRequestSchema,
  OmakaseFlagsSchema,
  PresentationBackgroundDecisionSchema,
  PresentationBackgroundPlanSchema,
  PresentationPlanSchema,
  PresentationStageCharacterSchema,
  PresentationStageSlotSchema,
  QuestionnaireAnswerSchema,
  RecentWaveSchema,
  ResolvedAssetRefSchema,
  RunStateSchema,
  RunVisualStyleBibleSchema,
  SceneContentSchema,
  SceneLineSchema,
  SeedStyleSchema,
  SettingsSchema,
  ShareCodeSchema,
  SetupProfileSchema,
  StateDeltaSchema,
  StoryBibleSchema,
  StoryCheckpointBundleSchema,
  StoryCheckpointSchema,
  StorySceneTypeSchema,
  StoryRunSchema,
  StoryRunModeSchema,
  StoryTurnRequestSchema,
  StoryTurnResponseSchema,
  StyleStateSchema,
  ThreadStateSchema,
  VisualCanonEntrySchema,
} from "../schemas";

export type SeedStyle = z.infer<typeof SeedStyleSchema>;
export type ArtDirection = z.infer<typeof ArtDirectionSchema>;
export type QuestionnaireAnswer = z.infer<typeof QuestionnaireAnswerSchema>;
export type OmakaseFlags = z.infer<typeof OmakaseFlagsSchema>;
export type SetupProfile = z.infer<typeof SetupProfileSchema>;

export type CanonCharacter = z.infer<typeof CanonCharacterSchema>;
export type CharacterVisualCanonEntry = z.infer<
  typeof CharacterVisualCanonEntrySchema
>;
export type RunVisualStyleBible = z.infer<typeof RunVisualStyleBibleSchema>;
export type VisualCanonEntry = z.infer<typeof VisualCanonEntrySchema>;
export type StoryBible = z.infer<typeof StoryBibleSchema>;

export type StyleState = z.infer<typeof StyleStateSchema>;
export type ThreadState = z.infer<typeof ThreadStateSchema>;
export type RunState = z.infer<typeof RunStateSchema>;

export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;
export type RecentWave = z.infer<typeof RecentWaveSchema>;
export type ResolvedAssetRef = z.infer<typeof ResolvedAssetRefSchema>;

export type StoryCheckpointBundle = z.infer<typeof StoryCheckpointBundleSchema>;
export type StoryCheckpoint = z.infer<typeof StoryCheckpointSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type StoryRun = z.infer<typeof StoryRunSchema>;
export type StoryRunMode = z.infer<typeof StoryRunModeSchema>;
export type StorySceneType = z.infer<typeof StorySceneTypeSchema>;
export type PresentationBackgroundDecision = z.infer<
  typeof PresentationBackgroundDecisionSchema
>;
export type PresentationBackgroundPlan = z.infer<
  typeof PresentationBackgroundPlanSchema
>;
export type PresentationStageSlot = z.infer<typeof PresentationStageSlotSchema>;
export type PresentationStageCharacter = z.infer<
  typeof PresentationStageCharacterSchema
>;
export type PresentationPlan = z.infer<typeof PresentationPlanSchema>;

export type ImageRequest = z.infer<typeof ImageRequestSchema>;
export type ImageAction = z.infer<typeof ImageActionSchema>;
export type ImageGenerationResult = z.infer<typeof ImageGenerationResultSchema>;
export type EndState = z.infer<typeof EndStateSchema>;
export type StateDelta = z.infer<typeof StateDeltaSchema>;

export type SceneLine = z.infer<typeof SceneLineSchema>;
export type SceneContent = z.infer<typeof SceneContentSchema>;

export type StoryTurnRequest = z.infer<typeof StoryTurnRequestSchema>;
export type StoryTurnResponse = z.infer<typeof StoryTurnResponseSchema>;

// Replay is stored-content playback; forking always starts from StoryCheckpointBundle.
export type EpisodeNode = z.infer<typeof EpisodeNodeSchema>;
export type ShareCode = z.infer<typeof ShareCodeSchema>;
export type AssetManifestEntry = z.infer<typeof AssetManifestEntrySchema>;
