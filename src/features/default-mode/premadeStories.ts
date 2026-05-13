import { RECENT_WAVES_DEFAULT_MAX } from "@/domain/constants/contracts";
import { EpisodeNodeSchema, StoryRunSchema } from "@/domain/schemas";
import type {
  ChoiceOption,
  EpisodeNode,
  ImageAction,
  PresentationPlan,
  RunState,
  SceneLine,
  SeedStyle,
  Settings,
  SetupProfile,
  StoryBible,
  StoryRun,
  StorySceneType,
  StyleState,
} from "@/domain/types";
import {
  createCharacterVisualCanonEntry,
  createRunVisualStyleBible,
} from "@/features/run/visuals/characterVisualCanon";

import astraNodesJson from "./frictionProtocolNodes.json";

export const FRICTION_PROTOCOL_STORY_ID = "the-friction-protocol";
const AUTO_CHOICE_ID = "__AUTO_PREMADE_NEXT__";

type AuthoredVisualState = {
  bg: string;
  left: string | null;
  right: string | null;
};

type AuthoredChoiceEffect = {
  routeDelta?: Record<string, number>;
  flags?: Record<string, boolean>;
};

type AuthoredNext =
  | {
      type: "auto";
      to?: string;
      target?: "visible manipulator ending check";
      setFlags?: Record<string, boolean>;
    }
  | { type: "choiceMap"; byChoice: Record<string, string> }
  | { type: "routeCheck"; routePriorityFromDoc6?: boolean }
  | { type: "choiceThenConditional"; rules: Array<{ if?: string; else?: string; to?: string }> }
  | { type: "endingCheck"; route: string; visiblePowerPath?: boolean }
  | { type: "terminal"; endingType?: string };

type AuthoredNode = {
  nodeId: string;
  sourceDoc: "DOC2" | "DOC3";
  sourceOrderIndex: number;
  blockType: "scene" | "local_variant" | "ending";
  route: string;
  storyTurnResponse: {
    sceneContent: {
      locationLabel?: string;
      lines: Array<{
        id: string;
        kind: "narration" | "dialogue" | "system";
        speakerId: string | null;
        text: string;
      }>;
    };
    sceneSummary: string;
    choices: ChoiceOption[];
    stateDelta: EpisodeNode["stateDelta"];
    endState?: EpisodeNode["endState"] | null;
  };
  lineVisualStates: Record<string, AuthoredVisualState>;
  choiceEffects: Record<string, AuthoredChoiceEffect>;
  next: AuthoredNext;
};

export type PremadeStory = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  artDirection: SetupProfile["artDirection"];
  seedStyle: SeedStyle;
  initialSceneId: string;
  protagonistId: string;
  cast: StoryBible["mainCast"];
  worldviewPremise: string;
  settingRules: string[];
  coreConflicts: string[];
};

type PremadeRunSession = {
  currentNodeId: string;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  storyRun: StoryRun;
};

const astraNodes = astraNodesJson as unknown as AuthoredNode[];
const astraNodeById = new Map(astraNodes.map((node) => [node.nodeId, node]));
const GOWN_ROUTE_FLAG = "flag_manipulator_gown_on";
const ASTRA_COMMON_SPRITE = "astra_base_common.png";
const ASTRA_MANIPULATOR_SPRITE = "astra_base_manipulator.png";

const routeVariableNames = [
  "free_will_belief",
  "control_instinct",
  "truth_commitment",
  "fatalism",
  "empathy",
  "guilt",
  "ambition",
  "isolation",
  "attachment_need",
  "institutional_loyalty",
  "technical_access",
  "evidence_exposure",
  "suspicion_on_astra",
  "board_dependency",
  "public_stability",
  "public_awareness",
  "public_dependence",
  "public_autonomy",
  "social_trust",
  "algorithmic_reach",
  "saye_trust",
  "mira_trust",
  "noah_loyalty",
  "ilya_alignment",
  "seren_bond",
  "halden_trust",
  "world_rule_progress",
  "dystopia_index",
  "subjective_happiness",
  "dissent_visibility",
] as const;

const defaultStyleState: StyleState = {
  warmth: 0.2,
  tension: 0.72,
  melancholy: 0.35,
  playfulness: 0.05,
  ominousness: 0.62,
  romance: 0.05,
  mystery: 0.7,
  tempo: 0.52,
  surrealness: 0.18,
};

const frictionProtocolStory: PremadeStory = {
  id: FRICTION_PROTOCOL_STORY_ID,
  title: "The Friction Protocol",
  subtitle: "Astra Vey / deterministic premade route",
  description:
    "A local-only authored VN about algorithmic control, public harm, and whether refusal can exist inside a system built to predict it.",
  artDirection: "muted-cinematic",
  seedStyle: {
    tone: "tense",
    romanceLevel: "low",
    mysteryLevel: "medium",
    tempo: "balanced",
    surrealness: "low",
  },
  initialSceneId: "C1_1",
  protagonistId: "astra",
  worldviewPremise:
    "Helix controls social attention through predictive ranking systems, crisis tools, and friction protocols that reshape public choice while preserving the language of freedom.",
  settingRules: [
    "Default Mode is deterministic and local-only.",
    "The authored VIS state is the source of truth for background and sprite staging.",
    "The story uses fixed-face sprites and static backgrounds; no runtime image generation is allowed.",
  ],
  coreConflicts: [
    "Astra Vey must decide whether to expose, reform, control, protect, or surrender to the system she helped build.",
  ],
  cast: [
    {
      characterId: "astra",
      displayName: "Astra",
      role: "protagonist",
      publicSummary:
        "Senior architect at Helix, precise, severe, brilliant, morally cornered by systems she understands too well.",
    },
    {
      characterId: "noah",
      displayName: "Noah",
      role: "junior engineer / conscience pressure",
      publicSummary:
        "Young Helix engineer, perceptive and loyal, still capable of surprise in a building that rewards obedience.",
    },
    {
      characterId: "saye",
      displayName: "Saye",
      role: "executive superior",
      publicSummary:
        "Helix authority figure, calm under crisis, fluent in institutional necessity.",
    },
    {
      characterId: "mira",
      displayName: "Mira",
      role: "journalist",
      publicSummary:
        "External investigator with enough evidence to make Helix fear the public record.",
    },
    {
      characterId: "ilya",
      displayName: "Ilya",
      role: "technical counterpart",
      publicSummary:
        "Analyst with a clinical view of systems, harm, and whether damage can be modeled before it is admitted.",
    },
    {
      characterId: "seren",
      displayName: "Seren",
      role: "human consequence",
      publicSummary:
        "A person harmed by Helix outcomes whose presence turns abstract metrics into memory.",
    },
    {
      characterId: "halden",
      displayName: "Halden",
      role: "board power broker",
      publicSummary:
        "Board-side operator who understands ambition as infrastructure.",
    },
  ],
};

export function listPremadeStories() {
  return [frictionProtocolStory];
}

export function getPremadeStory(storyId: string) {
  return storyId === frictionProtocolStory.id ? frictionProtocolStory : null;
}

function createLocalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createSetupProfile(story: PremadeStory): SetupProfile {
  return {
    questionnaireAnswers: [],
    vibe: story.title,
    artDirection: story.artDirection,
    premise: [
      "Astra Vey navigates Helix, a platform company whose ranking systems reshape public choice while claiming neutrality.",
    ],
    protagonist: [story.cast[0]?.publicSummary ?? "Astra Vey"],
    relationshipSeed: [],
    mainCharacterTraits: [story.cast[0]?.publicSummary ?? "Astra Vey"],
    worldviewSpecs: story.settingRules,
    omakaseFlags: {
      mainCharacterTraits: false,
      worldviewSpecs: false,
    },
    seedStyle: story.seedStyle,
  };
}

function createRunState(): RunState {
  return {
    chapterIndex: 0,
    sceneIndex: 0,
    styleState: defaultStyleState,
    relationshipTracks: Object.fromEntries(
      routeVariableNames.map((name) => [name, 0]),
    ),
    activeThreads: {
      "friction-protocol-route": {
        label: "The Friction Protocol route state",
        status: "active",
      },
    },
    inventoryFlags: {},
    conclusionPressure: 0,
    endingCandidates: [],
  };
}

function createStoryBible(story: PremadeStory, setupProfile: SetupProfile): StoryBible {
  const visualStyleBible = createRunVisualStyleBible(setupProfile);
  const baseStoryBible: StoryBible = {
    worldviewPremise: story.worldviewPremise,
    settingRules: story.settingRules,
    mainCast: story.cast,
    coreConflicts: story.coreConflicts,
    forbiddenContradictions: [
      "The Friction Protocol Default Mode is authored and must not call AI providers.",
      "Do not replace fixed story sprites/backgrounds with generated substitutes.",
    ],
    initialVisualCanon: story.cast.map((entry) => ({
      subjectId: entry.characterId,
      descriptor: entry.publicSummary,
    })),
    visualStyleBible,
    characterVisualCanon: [],
  };

  return {
    ...baseStoryBible,
    characterVisualCanon: story.cast.map((entry) =>
      createCharacterVisualCanonEntry({
        canonicalCharacterId: entry.characterId,
        character: entry,
        setupProtagonistCue:
          entry.characterId === story.protagonistId
            ? setupProfile.protagonist[0] ?? entry.publicSummary
            : null,
        storyBible: baseStoryBible,
      }),
    ),
  };
}

function spriteCharacterId(assetName: string) {
  return assetName.split("_base_")[0]?.replace(".png", "") ?? assetName;
}

function assetUrl(assetName: string, assetClass: "background" | "sprite") {
  const folder = assetClass === "background" ? "backgrounds" : "sprites";

  return `/vn-bank/friction-protocol/${folder}/${assetName}`;
}

function backgroundAction(background: string): ImageAction {
  return {
    source: "manifest",
    subjectType: "background",
    subjectId: background,
    promptBrief: `The Friction Protocol authored background: ${background}`,
    styleAnchor: "fixed authored Friction Protocol asset",
    reason: "Default Mode uses the authored asset manifest and makes no image API calls.",
    resolvedAssetUrl: assetUrl(background, "background"),
    generatedAssetId: null,
  };
}

function spriteAction(sprite: string): ImageAction {
  return {
    source: "manifest",
    subjectType: "important-character",
    subjectId: sprite,
    promptBrief: `The Friction Protocol authored sprite: ${sprite}`,
    styleAnchor: "fixed authored Friction Protocol asset",
    reason: "Default Mode uses fixed-face sprites from the authored VIS state.",
    resolvedAssetUrl: assetUrl(sprite, "sprite"),
    generatedAssetId: null,
  };
}

function isManipulatorGownOn(runState: RunState) {
  return Boolean(runState.inventoryFlags[GOWN_ROUTE_FLAG]);
}

function normalizeAstraSpriteForRunState(sprite: string | null, runState: RunState) {
  if (sprite === ASTRA_COMMON_SPRITE && isManipulatorGownOn(runState)) {
    return ASTRA_MANIPULATOR_SPRITE;
  }

  return sprite;
}

function normalizeVisualStateForRunState(
  visualState: AuthoredVisualState | null,
  runState: RunState,
) {
  if (!visualState) return null;

  return {
    ...visualState,
    left: normalizeAstraSpriteForRunState(visualState.left, runState),
    right: normalizeAstraSpriteForRunState(visualState.right, runState),
  } satisfies AuthoredVisualState;
}

function nodeDisplaysManipulatorGown(node: AuthoredNode) {
  return Object.values(node.lineVisualStates).some(
    (visualState) =>
      visualState.left === ASTRA_MANIPULATOR_SPRITE ||
      visualState.right === ASTRA_MANIPULATOR_SPRITE,
  );
}

function applyAuthoredFlagUpdates(
  runState: RunState,
  flagUpdates: Record<string, boolean> | undefined,
) {
  if (!flagUpdates) return runState;

  return {
    ...runState,
    inventoryFlags: {
      ...runState.inventoryFlags,
      ...flagUpdates,
    },
  };
}

function applyNodeEntryState(runState: RunState, node: AuthoredNode) {
  if (!nodeDisplaysManipulatorGown(node)) return runState;

  return applyAuthoredFlagUpdates(runState, {
    [GOWN_ROUTE_FLAG]: true,
  });
}

function applyNextStateEffects(runState: RunState, node: AuthoredNode) {
  return applyAuthoredFlagUpdates(
    runState,
    "setFlags" in node.next ? node.next.setFlags : undefined,
  );
}

function collectImageActions(node: AuthoredNode, runState: RunState) {
  const backgrounds = new Set<string>();
  const sprites = new Set<string>();

  Object.values(node.lineVisualStates).forEach((visualState) => {
    const normalizedVisualState = normalizeVisualStateForRunState(visualState, runState);

    if (!normalizedVisualState) return;

    backgrounds.add(normalizedVisualState.bg);
    if (normalizedVisualState.left) sprites.add(normalizedVisualState.left);
    if (normalizedVisualState.right) sprites.add(normalizedVisualState.right);
  });

  return [
    ...Array.from(backgrounds).map(backgroundAction),
    ...Array.from(sprites).map(spriteAction),
  ];
}

function createStageCharacters(
  visualState: AuthoredVisualState | null,
): PresentationPlan["stageCharacters"] {
  if (!visualState) return [];

  return (["left", "right"] as const).flatMap((slot) => {
    const sprite = visualState[slot];

    if (!sprite) return [];

    return {
      canonicalCharacterId: sprite,
      displayName: spriteCharacterId(sprite),
      expression: "fixed authored base sprite",
      pose: "authored VIS slot placement",
      presence: "present" as const,
      priority: slot === "left" ? 90 : 80,
      reason: "The Friction Protocol line-level VIS state specifies this slot.",
      slot,
      visible: true,
    };
  });
}

function createPremadePresentationPlan(args: {
  node: AuthoredNode;
  sceneType: StorySceneType;
  runState: RunState;
}): PresentationPlan {
  const firstLine = args.node.storyTurnResponse.sceneContent.lines[0];
  const firstVisualState = firstLine
    ? normalizeVisualStateForRunState(
        args.node.lineVisualStates[firstLine.id] ?? null,
        args.runState,
      )
    : null;
  const background = firstVisualState?.bg ?? args.node.storyTurnResponse.sceneContent.locationLabel ?? "bg_black_screen.png";
  const presentationSegmentId = `friction:${args.node.nodeId}`;

  return {
    sceneType: args.sceneType,
    presentationSegmentId,
    background: {
      decision: args.node.sourceOrderIndex === 1 ? "establish" : "change",
      locationId: background,
      locationLabel: background,
      promptBrief: `Authored Friction Protocol background ${background}`,
      reason: "Authored Default Mode VIS metadata controls the background.",
    },
    stageCharacters: createStageCharacters(firstVisualState),
    focusCharacterId:
      firstVisualState?.left ?? firstVisualState?.right ?? frictionProtocolStory.protagonistId,
    notes:
      "Default Mode uses line-level authored VIS state; this plan seeds the first line and renderer overrides per line.",
  };
}

function getSceneType(node: AuthoredNode, isInitial: boolean): StorySceneType {
  if (isInitial) return "opening";
  if (node.blockType === "ending" || node.next.type === "terminal") return "ending";
  return "normal";
}

function normalizeEndState(node: AuthoredNode): EpisodeNode["endState"] | undefined {
  const endState = node.storyTurnResponse.endState ?? null;

  if (endState) return endState;

  if (node.blockType === "ending" || node.next.type === "terminal") {
    return {
      endingType: "open",
      epilogueSummary: `${node.storyTurnResponse.sceneSummary} concludes this authored route branch.`,
    };
  }

  return undefined;
}

function createEpisodeNode(args: {
  choiceId: string | null;
  depth: number;
  parentEpisodeNodeId: string | null;
  node: AuthoredNode;
  runState: RunState;
  storyRunId: string;
  turnType: EpisodeNode["turnType"];
}) {
  const now = new Date().toISOString();
  const sceneType = getSceneType(args.node, args.turnType === "initial");
  const presentationPlan = createPremadePresentationPlan({
    node: args.node,
    sceneType,
    runState: args.runState,
  });
  const endState = normalizeEndState(args.node);

  return EpisodeNodeSchema.parse({
    id: args.node.nodeId,
    storyRunId: args.storyRunId,
    parentEpisodeNodeId: args.parentEpisodeNodeId,
    depth: args.depth,
    sceneType,
    turnType: endState ? "ending" : args.turnType,
    playerChoiceId: args.choiceId,
    scene: {
      locationLabel: args.node.storyTurnResponse.sceneContent.locationLabel,
      lines: args.node.storyTurnResponse.sceneContent.lines.map((line) => {
        const visualState = normalizeVisualStateForRunState(
          args.node.lineVisualStates[line.id] ?? null,
          args.runState,
        );

        return {
          ...line,
          authoredVisualState: visualState,
          backgroundKey: visualState?.bg ?? null,
          presentationSegmentId: `friction:${args.node.nodeId}:${visualState?.bg ?? "none"}`,
        } satisfies SceneLine;
      }),
    },
    sceneSummary: args.node.storyTurnResponse.sceneSummary,
    presentationPlan,
    choices: args.node.storyTurnResponse.choices,
    stateDelta: args.node.storyTurnResponse.stateDelta,
    imageActions: collectImageActions(args.node, args.runState),
    endState,
    createdAt: now,
  });
}

function routeValue(runState: RunState, key: string) {
  return runState.relationshipTracks[key] ?? 0;
}

function routeFlag(runState: RunState, key: string) {
  return Boolean(runState.inventoryFlags[key]);
}

function evaluateRouteCheck(runState: RunState) {
  if (
    routeFlag(runState, "flag_true_route_unlocked") &&
    routeValue(runState, "free_will_belief") >= 7 &&
    routeValue(runState, "truth_commitment") >= 8 &&
    routeValue(runState, "empathy") >= 7 &&
    routeValue(runState, "control_instinct") <= 6
  ) {
    return "T1_1";
  }

  if (
    (routeFlag(runState, "flag_shadow_model_created") &&
      routeValue(runState, "control_instinct") >= 4 &&
      routeValue(runState, "ambition") >= 3 &&
      routeValue(runState, "free_will_belief") <= 6) ||
    (routeValue(runState, "control_instinct") >= 6 &&
      routeValue(runState, "ambition") >= 4 &&
      routeValue(runState, "free_will_belief") <= 4 &&
      routeValue(runState, "empathy") <= 7)
  ) {
    return "M1_1";
  }

  if (
    routeValue(runState, "truth_commitment") >= 5 &&
    routeValue(runState, "empathy") >= 3 &&
    routeValue(runState, "evidence_exposure") >= 4 &&
    routeValue(runState, "fatalism") <= 7 &&
    (!routeFlag(runState, "flag_harm_report_hidden") ||
      routeValue(runState, "evidence_exposure") >= 6)
  ) {
    return "R1_1";
  }

  if (
    routeValue(runState, "institutional_loyalty") >= 4 &&
    routeValue(runState, "truth_commitment") >= 4 &&
    routeValue(runState, "control_instinct") >= 2 &&
    routeValue(runState, "control_instinct") <= 7 &&
    routeValue(runState, "suspicion_on_astra") <= 5 &&
    routeValue(runState, "public_awareness") <= 5
  ) {
    return "F1_1";
  }

  if (
    routeValue(runState, "empathy") >= 6 &&
    routeValue(runState, "control_instinct") >= 5 &&
    routeValue(runState, "truth_commitment") <= 7 &&
    routeValue(runState, "public_awareness") <= 5
  ) {
    return "G1_1";
  }

  if (
    (routeValue(runState, "fatalism") >= 4 &&
      routeValue(runState, "free_will_belief") <= 1) ||
    (routeValue(runState, "guilt") >= 5 &&
      routeValue(runState, "free_will_belief") <= 2 &&
      routeValue(runState, "truth_commitment") <= 6)
  ) {
    return "X1_1";
  }

  return "N1_1";
}

function resolveEndingNodeId(
  route: string,
  runState: RunState,
  visiblePowerPath = false,
) {
  if (route !== "MANIPULATOR") return null;
  const isVisiblePath = visiblePowerPath || routeFlag(runState, GOWN_ROUTE_FLAG);

  if (isVisiblePath) {
    if (
      routeValue(runState, "control_instinct") >= 6 &&
      routeValue(runState, "world_rule_progress") >= 3 &&
      routeValue(runState, "dystopia_index") >= 2
    ) {
      return "M_END_DYSTOPIA_OF_CONSENT";
    }

    if (routeFlag(runState, "flag_self_model_improved")) {
      return "M_END_FALSE_GOD_VISIBLE_ASTRA";
    }

    return "M_END_INVISIBLE_THRONE";
  }

  if (routeFlag(runState, "flag_self_model_improved")) {
    return "M_END_FALSE_GOD_PRIVATE_ASTRA";
  }

  if (routeFlag(runState, "flag_m3_constrained")) {
    return "M_END_CONSTRAINED_STEWARD";
  }

  if (routeFlag(runState, "flag_m3_hidden_architect")) {
    return "M_END_HIDDEN_ARCHITECT";
  }

  return "M_END_FALSE_GOD_PRIVATE_ASTRA";
}

function resolveConditionalNext(
  nodeId: string,
  selectedChoiceId: string | null,
  runState: RunState,
) {
  if (nodeId === "R1_1") {
    return routeValue(runState, "noah_loyalty") >= 3 ? "R1_2" : "R2_1";
  }

  if (nodeId === "R2_1") {
    return routeValue(runState, "seren_bond") >= 2 ? "R2_2" : "R3_1";
  }

  if (nodeId === "M4_1B") {
    return routeFlag(runState, "flag_m3_usurper") ? "M5B_0" : "M5_1B";
  }

  if (nodeId === "M5_1B") {
    return routeFlag(runState, "flag_m3_constrained") &&
      selectedChoiceId &&
      [
        "M5_1_PARTNERSHIP_LAYER_A",
        "M5_1_PARTNERSHIP_LAYER_B",
        "M5_1_PARTNERSHIP_LAYER_C",
      ].includes(selectedChoiceId)
      ? "M5C_2"
      : "M6_1B";
  }

  return null;
}

function resolveNextNodeId(args: {
  currentNode: AuthoredNode;
  runState: RunState;
  selectedChoiceId: string | null;
}) {
  const next = args.currentNode.next;

  switch (next.type) {
    case "auto":
      if (next.to) return next.to;
      if (next.target === "visible manipulator ending check") {
        return resolveEndingNodeId("MANIPULATOR", args.runState, true);
      }
      return null;
    case "choiceMap":
      return args.selectedChoiceId ? next.byChoice[args.selectedChoiceId] ?? null : null;
    case "routeCheck":
      return evaluateRouteCheck(args.runState);
    case "choiceThenConditional":
      return resolveConditionalNext(
        args.currentNode.nodeId,
        args.selectedChoiceId,
        args.runState,
      );
    case "endingCheck":
      return resolveEndingNodeId(
        next.route,
        args.runState,
        next.visiblePowerPath ?? false,
      );
    case "terminal":
      return null;
  }
}

function createSyntheticEndingNode(args: {
  choiceId: string | null;
  currentNode: EpisodeNode;
  storyRunId: string;
}) {
  const now = new Date().toISOString();
  const id = `${args.currentNode.id}_terminal`;

  return EpisodeNodeSchema.parse({
    id,
    storyRunId: args.storyRunId,
    parentEpisodeNodeId: args.currentNode.id,
    depth: args.currentNode.depth + 1,
    sceneType: "ending",
    turnType: "ending",
    playerChoiceId: args.choiceId,
    scene: {
      locationLabel: args.currentNode.scene.locationLabel,
      lines: [
        {
          id: `${id}_L001`,
          kind: "narration",
          speakerId: null,
          text: "This authored route branch has reached its current local ending.",
          backgroundKey: args.currentNode.scene.lines.at(-1)?.backgroundKey ?? null,
          presentationSegmentId: `friction:${id}`,
          authoredVisualState:
            args.currentNode.scene.lines.at(-1)?.authoredVisualState ?? null,
        },
      ],
    },
    sceneSummary: "Local authored ending placeholder",
    presentationPlan: args.currentNode.presentationPlan,
    choices: [],
    stateDelta: { conclusionPressureDelta: 0 },
    imageActions: args.currentNode.imageActions,
    endState: {
      endingType: "open",
      epilogueSummary:
        "The imported route reached an ending check that has no fuller authored local ending node in the current package.",
    },
    createdAt: now,
  });
}

function applyChoiceEffects(args: {
  choiceId: string | null;
  node: AuthoredNode;
  runState: RunState;
}) {
  const effect = args.choiceId ? args.node.choiceEffects[args.choiceId] : null;
  const nextRelationshipTracks = { ...args.runState.relationshipTracks };
  const nextInventoryFlags = { ...args.runState.inventoryFlags };

  Object.entries(effect?.routeDelta ?? {}).forEach(([key, delta]) => {
    nextRelationshipTracks[key] = (nextRelationshipTracks[key] ?? 0) + delta;
  });

  Object.entries(effect?.flags ?? {}).forEach(([key, value]) => {
    nextInventoryFlags[key] = value;
  });

  if (args.choiceId && args.choiceId !== AUTO_CHOICE_ID) {
    nextInventoryFlags[args.choiceId] = true;
  }

  return {
    ...args.runState,
    relationshipTracks: nextRelationshipTracks,
    inventoryFlags: nextInventoryFlags,
  };
}

export function createPremadeRunSession(
  storyId: string,
  settings: Settings,
): PremadeRunSession {
  const story = getPremadeStory(storyId);
  const initialAuthoredNode = astraNodeById.get(frictionProtocolStory.initialSceneId);

  if (!story || !initialAuthoredNode) {
    throw new Error("The Friction Protocol story package is not available.");
  }

  const storyRunId = createLocalId("story-run");
  const createdAt = new Date().toISOString();
  const setupProfile = createSetupProfile(story);
  const storyBible = createStoryBible(story, setupProfile);
  const initialRunState = createRunState();
  const initialNode = createEpisodeNode({
    choiceId: null,
    depth: 0,
    parentEpisodeNodeId: null,
    node: initialAuthoredNode,
    runState: initialRunState,
    storyRunId,
    turnType: "initial",
  });
  const storyRun = StoryRunSchema.parse({
    id: storyRunId,
    ownerUserId: "local-user",
    runMode: "premade-default",
    premadeStoryId: story.id,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    originCheckpointId: null,
    setupProfile,
    storyBible,
    runState: initialRunState,
    recentWaves: [
      {
        nodeId: initialNode.id,
        waveSummary: initialNode.sceneSummary,
        presentedChoices: initialNode.choices,
        chosenChoiceId: null,
      },
    ],
    latestCheckpointId: null,
    latestEpisodeNodeId: initialNode.id,
    settingsSnapshot: {
      ...settings,
      imageMode: "important-only",
    },
  });

  return {
    currentNodeId: initialNode.id,
    episodeNodesById: {
      [initialNode.id]: initialNode,
    },
    nodeOrder: [initialNode.id],
    storyRun,
  };
}

export function advancePremadeRunSession(args: {
  choiceId: string;
  currentNode: EpisodeNode;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  storyRun: StoryRun;
}) {
  const authoredNode = astraNodeById.get(args.currentNode.id);
  const selectedChoice =
    args.choiceId === AUTO_CHOICE_ID
      ? null
      : args.currentNode.choices.find((choice) => choice.id === args.choiceId) ?? null;

  if (!authoredNode) {
    throw new Error("The active Default Mode node is not in the Astra package.");
  }

  if (args.currentNode.choices.length > 0 && !selectedChoice) {
    throw new Error("Select an authored choice before advancing this scene.");
  }

  const runStateAfterChoice = applyChoiceEffects({
    choiceId: selectedChoice?.id ?? null,
    node: authoredNode,
    runState: args.storyRun.runState,
  });
  const nextNodeId = resolveNextNodeId({
    currentNode: authoredNode,
    runState: runStateAfterChoice,
    selectedChoiceId: selectedChoice?.id ?? null,
  });
  const nextAuthoredNode = nextNodeId ? astraNodeById.get(nextNodeId) ?? null : null;
  const runStateAfterCurrentNode = applyNextStateEffects(runStateAfterChoice, authoredNode);
  const nextRunState = nextAuthoredNode
    ? applyNodeEntryState(runStateAfterCurrentNode, nextAuthoredNode)
    : runStateAfterCurrentNode;
  const nextNode = nextAuthoredNode
    ? createEpisodeNode({
        choiceId: selectedChoice?.id ?? null,
        depth: args.currentNode.depth + 1,
        parentEpisodeNodeId: args.currentNode.id,
        node: nextAuthoredNode,
        runState: nextRunState,
        storyRunId: args.storyRun.id,
        turnType: "choice-result",
      })
    : createSyntheticEndingNode({
        choiceId: selectedChoice?.id ?? null,
        currentNode: args.currentNode,
        storyRunId: args.storyRun.id,
      });
  const nextRecentWaves = args.storyRun.recentWaves.map((wave, index) =>
    index === args.storyRun.recentWaves.length - 1
      ? {
          ...wave,
          chosenChoiceId: selectedChoice?.id ?? null,
        }
      : wave,
  );

  nextRecentWaves.push({
    nodeId: nextNode.id,
    waveSummary: nextNode.sceneSummary,
    presentedChoices: nextNode.choices,
    chosenChoiceId: null,
  });

  return {
    currentNodeId: nextNode.id,
    episodeNodesById: {
      ...args.episodeNodesById,
      [nextNode.id]: nextNode,
    },
    nodeOrder: [...args.nodeOrder, nextNode.id],
    storyRun: StoryRunSchema.parse({
      ...args.storyRun,
      status: nextNode.endState ? "ended" : "active",
      updatedAt: new Date().toISOString(),
      latestEpisodeNodeId: nextNode.id,
      recentWaves: nextRecentWaves.slice(-RECENT_WAVES_DEFAULT_MAX),
      runState: nextRunState,
    }),
  };
}

export function isPremadeAutoAdvanceChoice(choiceId: string) {
  return choiceId === AUTO_CHOICE_ID;
}

export function getPremadeAutoAdvanceChoiceId() {
  return AUTO_CHOICE_ID;
}
