import type { Settings } from "@/domain/types";
import type { SetupDraft } from "@/features/setup/buildSetupProfile";

export type RegressionFixture = {
  id: string;
  label: string;
  orientation: "text-only" | "image-enabled";
  providerMode: "stub";
  settings: Pick<Settings, "imageMode">;
  setupDraft: SetupDraft;
  recommendedChoiceIds: string[];
  qaChecklist: string[];
};

export const regressionFixtures: RegressionFixture[] = [
  {
    id: "stub-text-only-noir",
    label: "Stub text-only noir",
    orientation: "text-only",
    providerMode: "stub",
    settings: {
      imageMode: "off",
    },
    setupDraft: {
      questionResponses: {
        tone: "tense",
        artDirection: "high-contrast-noir",
        romanceLevel: "low",
        mysteryLevel: "high",
        tempo: "brisk",
        surrealness: "medium",
      },
      mainCharacterTraitsInput: "",
      worldviewSpecsInput: "",
      omakaseFlags: {
        mainCharacterTraits: true,
        worldviewSpecs: true,
      },
    },
    recommendedChoiceIds: [
      "choice-0-press-forward",
      "choice-1-ask-carefully",
      "choice-2-hold-position",
    ],
    qaChecklist: [
      "Opening turn generation",
      "Three consecutive choices reach the deterministic ending",
      "Autosave after each turn",
      "Manual save dedupes the current checkpoint",
      "Load the latest checkpoint and continue from it",
    ],
  },
  {
    id: "stub-image-enabled-watercolor",
    label: "Stub image-enabled watercolor",
    orientation: "image-enabled",
    providerMode: "stub",
    settings: {
      imageMode: "important-only",
    },
    setupDraft: {
      questionResponses: {
        tone: "warm",
        artDirection: "storybook-watercolor",
        romanceLevel: "medium",
        mysteryLevel: "medium",
        tempo: "gentle",
        surrealness: "low",
      },
      mainCharacterTraitsInput: "kind archivist, avoids direct confession",
      worldviewSpecsInput: "a coastal library town, letters that arrive before they are written",
      omakaseFlags: {
        mainCharacterTraits: false,
        worldviewSpecs: false,
      },
    },
    recommendedChoiceIds: [
      "choice-0-ask-carefully",
      "choice-1-press-forward",
      "choice-2-hold-position",
    ],
    qaChecklist: [
      "Opening turn generation with an image request",
      "Generated image action remains beta-deferred without a reusable asset URL",
      "Three consecutive choices update live parameters",
      "Autosave and manual save disposition are visible",
      "Load and continue from the checkpoint bundle",
    ],
  },
];

export function getRegressionFixture(fixtureId: string) {
  return regressionFixtures.find((fixture) => fixture.id === fixtureId) ?? null;
}
