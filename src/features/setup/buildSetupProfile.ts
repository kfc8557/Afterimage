import {
  SETUP_SEED_TEXT_ARRAY_MAX,
  SETUP_SEED_TEXT_ENTRY_MAX_LENGTH,
} from "@/domain/constants/contracts";
import { SetupProfileSchema } from "@/domain/schemas";
import type {
  ArtDirection,
  QuestionnaireAnswer,
  SeedStyle,
  SetupProfile,
} from "@/domain/types";

import type { ChoiceQuestionId } from "./questions";

export type SetupDraft = {
  questionResponses: Partial<Record<ChoiceQuestionId, string>>;
  mainCharacterTraitsInput: string;
  worldviewSpecsInput: string;
  omakaseFlags: {
    mainCharacterTraits: boolean;
    worldviewSpecs: boolean;
  };
};

function splitTextList(value: string) {
  return value
    .split(/\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.slice(0, SETUP_SEED_TEXT_ENTRY_MAX_LENGTH))
    .slice(0, SETUP_SEED_TEXT_ARRAY_MAX);
}

function buildQuestionnaireAnswers(
  questionResponses: SetupDraft["questionResponses"],
): QuestionnaireAnswer[] {
  return Object.entries(questionResponses).flatMap(([questionId, value]) => {
    if (!value) {
      return [];
    }

    return [
      {
        questionId,
        answerType: "single-choice",
        value,
      },
    ];
  });
}

function createVibeLabel(seedStyle: SeedStyle) {
  return `${seedStyle.tone} tone, ${seedStyle.mysteryLevel} mystery, ${seedStyle.surrealness} surrealness`;
}

function createOmakaseProtagonist(seedStyle: SeedStyle, artDirection: ArtDirection) {
  const toneTrait = {
    warm: "patiently observant",
    tense: "decisive under pressure",
    melancholic: "quietly haunted",
    playful: "quick-witted and disarming",
    ominous: "careful with secrets",
  } satisfies Record<SeedStyle["tone"], string>;

  return [
    `${toneTrait[seedStyle.tone]} protagonist shaped for ${artDirection}`,
    "carries one private contradiction into the opening scene",
  ];
}

function createOmakasePremise(seedStyle: SeedStyle, artDirection: ArtDirection) {
  const mysteryHook =
    seedStyle.mysteryLevel === "high"
      ? "a withheld truth everyone is paid to ignore"
      : seedStyle.mysteryLevel === "medium"
      ? "a local mystery with social consequences"
      : "a visible conflict with one hidden cost";

  return [
    `a ${seedStyle.tone} visual novel premise with ${mysteryHook}`,
    `visual canon anchored by ${artDirection}`,
  ];
}

function createRelationshipSeed(seedStyle: SeedStyle) {
  if (seedStyle.romanceLevel === "high") {
    return [
      "a charged bond begins before either person is ready to admit what it means",
    ];
  }

  if (seedStyle.romanceLevel === "medium") {
    return [
      "a meaningful alliance carries room for trust, friction, and possible romance",
    ];
  }

  return [
    "the central relationship starts as practical trust with emotional stakes held back",
  ];
}

export function buildSetupProfile(draft: SetupDraft): SetupProfile {
  const seedStyle: SeedStyle = {
    tone: draft.questionResponses.tone as SeedStyle["tone"],
    romanceLevel:
      draft.questionResponses.romanceLevel as SeedStyle["romanceLevel"],
    mysteryLevel:
      draft.questionResponses.mysteryLevel as SeedStyle["mysteryLevel"],
    tempo: draft.questionResponses.tempo as SeedStyle["tempo"],
    surrealness:
      draft.questionResponses.surrealness as SeedStyle["surrealness"],
  };
  const artDirection = draft.questionResponses.artDirection as ArtDirection;
  const protagonist = draft.omakaseFlags.mainCharacterTraits
    ? createOmakaseProtagonist(seedStyle, artDirection)
    : splitTextList(draft.mainCharacterTraitsInput);
  const premise = draft.omakaseFlags.worldviewSpecs
    ? createOmakasePremise(seedStyle, artDirection)
    : splitTextList(draft.worldviewSpecsInput);

  const profile = {
    questionnaireAnswers: buildQuestionnaireAnswers(draft.questionResponses),
    vibe: createVibeLabel(seedStyle),
    artDirection,
    premise,
    protagonist,
    relationshipSeed: createRelationshipSeed(seedStyle),
    mainCharacterTraits: protagonist,
    worldviewSpecs: premise,
    omakaseFlags: draft.omakaseFlags,
    seedStyle,
  };

  return SetupProfileSchema.parse(profile);
}
