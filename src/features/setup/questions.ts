import type { ArtDirection, SeedStyle } from "@/domain/types";

export type ChoiceQuestionId =
  | "tone"
  | "artDirection"
  | "romanceLevel"
  | "mysteryLevel"
  | "tempo"
  | "surrealness";

type SeedStyleQuestionId = Exclude<ChoiceQuestionId, "artDirection">;

type ChoiceQuestion = {
  id: ChoiceQuestionId;
  kind: "choice";
  title: string;
  prompt: string;
  options: Array<{
    value: SeedStyle[SeedStyleQuestionId] | ArtDirection;
    label: string;
    detail: string;
  }>;
};

type TextQuestion = {
  id: "mainCharacterTraits" | "worldviewSpecs";
  kind: "text";
  title: string;
  prompt: string;
  placeholder: string;
  omakaseLabel: string;
};

export type SetupQuestion = ChoiceQuestion | TextQuestion;

export const setupQuestions: SetupQuestion[] = [
  {
    id: "tone",
    kind: "choice",
    title: "Vibe",
    prompt: "When the curtain rises, what should the story feel like first?",
    options: [
      {
        value: "warm",
        label: "Warm glow",
        detail: "Tender, intimate, and quietly hopeful.",
      },
      {
        value: "tense",
        label: "Sharp nerves",
        detail: "Immediate pressure, danger, or emotional friction.",
      },
      {
        value: "melancholic",
        label: "Soft ache",
        detail: "Reflective sadness and beautiful restraint.",
      },
      {
        value: "playful",
        label: "Bright spark",
        detail: "Witty, lively, and lightly mischievous.",
      },
      {
        value: "ominous",
        label: "Dark omen",
        detail: "Strange shadows and heavy foreboding.",
      },
    ],
  },
  {
    id: "artDirection",
    kind: "choice",
    title: "Art direction",
    prompt: "Choose the mandatory visual anchor for this run.",
    options: [
      {
        value: "soft-ink-wash",
        label: "Soft ink wash",
        detail: "Fluid linework, subdued washes, and gentle texture.",
      },
      {
        value: "clean-anime-cel",
        label: "Clean anime cel",
        detail: "Crisp character silhouettes, clear color blocks, and readable expressions.",
      },
      {
        value: "muted-cinematic",
        label: "Muted cinematic",
        detail: "Film-still framing, restrained color, and soft environmental light.",
      },
      {
        value: "high-contrast-noir",
        label: "High-contrast noir",
        detail: "Hard shadows, bright edges, and dramatic negative space.",
      },
      {
        value: "storybook-watercolor",
        label: "Storybook watercolor",
        detail: "Hand-painted softness with illustrative charm and warm paper grain.",
      },
    ],
  },
  {
    id: "romanceLevel",
    kind: "choice",
    title: "Emotional heat",
    prompt: "How central should romance feel to the route?",
    options: [
      {
        value: "low",
        label: "Peripheral",
        detail: "Present only as undertone or possibility.",
      },
      {
        value: "medium",
        label: "Interwoven",
        detail: "A meaningful thread without taking over everything.",
      },
      {
        value: "high",
        label: "Heartline",
        detail: "The route should throb with romantic gravity.",
      },
    ],
  },
  {
    id: "mysteryLevel",
    kind: "choice",
    title: "Unknowns",
    prompt: "How much mystery should the player have to untangle?",
    options: [
      {
        value: "low",
        label: "Clear lines",
        detail: "Readable motives and limited hidden machinery.",
      },
      {
        value: "medium",
        label: "Layered clues",
        detail: "Reveals should come in satisfying steps.",
      },
      {
        value: "high",
        label: "Deep puzzle",
        detail: "Secrets, misdirection, and unstable truths.",
      },
    ],
  },
  {
    id: "tempo",
    kind: "choice",
    title: "Pacing",
    prompt: "How quickly should scenes move from beat to beat?",
    options: [
      {
        value: "gentle",
        label: "Gentle drift",
        detail: "Long glances, room to linger, patient scene changes.",
      },
      {
        value: "balanced",
        label: "Measured pulse",
        detail: "Steady forward motion with time to breathe.",
      },
      {
        value: "brisk",
        label: "Quick cut",
        detail: "Fast escalation and frequent turns.",
      },
    ],
  },
  {
    id: "surrealness",
    kind: "choice",
    title: "Reality edge",
    prompt: "How strange should the world feel before anything breaks?",
    options: [
      {
        value: "low",
        label: "Mostly grounded",
        detail: "Reality stays stable and understandable.",
      },
      {
        value: "medium",
        label: "Subtle unreality",
        detail: "Odd details and symbolic slips at the edges.",
      },
      {
        value: "high",
        label: "Dream logic",
        detail: "Reality should bend early and often.",
      },
    ],
  },
  {
    id: "mainCharacterTraits",
    kind: "text",
    title: "Main character traits",
    prompt: "Describe the protagonist with short traits, habits, or contradictions.",
    placeholder: "observant, avoidant, dresses too sharply for ordinary days",
    omakaseLabel: "Let the app invent the protagonist",
  },
  {
    id: "worldviewSpecs",
    kind: "text",
    title: "Worldview hooks",
    prompt: "Add setting rules, motifs, or genre hooks you want the world to honor.",
    placeholder: "a rain-soaked city archive, whispered debts, memory as legal tender",
    omakaseLabel: "Let the app invent the worldview",
  },
];
