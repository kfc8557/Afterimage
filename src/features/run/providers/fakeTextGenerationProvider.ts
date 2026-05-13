import { StoryTurnRequestSchema, StoryTurnResponseSchema } from "@/domain/schemas";
import type {
  ChoiceOption,
  StoryTurnRequest,
  StoryTurnResponse,
} from "@/domain/types";

import type { ProviderDebugSnapshot, TextGenerationProvider } from "./contracts";

function createChoices(stage: number): ChoiceOption[] {
  if (stage >= 3) {
    return [];
  }

  return [
    {
      id: `choice-${stage}-press-forward`,
      label: "Press forward and test the promise",
      intentTag: "press-forward",
    },
    {
      id: `choice-${stage}-ask-carefully`,
      label: "Ask carefully for the missing truth",
      intentTag: "ask-carefully",
    },
    {
      id: `choice-${stage}-hold-position`,
      label: "Hold position and read the room",
      intentTag: "hold-position",
    },
  ];
}

function describeChoice(choice: StoryTurnRequest["lastPlayerChoice"]) {
  switch (choice?.intentTag) {
    case "press-forward":
      return "You stepped into the tension before anyone else could name it.";
    case "ask-carefully":
      return "You chose a careful question instead of a dramatic move.";
    case "hold-position":
      return "You held still long enough to notice what everyone else missed.";
    default:
      return "The opening beat arrives before the room can settle.";
  }
}

function createSceneSummary(stage: number, choice: StoryTurnRequest["lastPlayerChoice"]) {
  if (stage >= 3) {
    return "The stubbed branch resolves the opening conflict and closes on a deterministic ending beat.";
  }

  return `Stub turn ${stage + 1} escalates the opening conflict after the player chose ${choice?.intentTag ?? "the opening scene"}.`;
}

function createStateDelta(
  stage: number,
  choice: StoryTurnRequest["lastPlayerChoice"],
  protagonistId: string,
) {
  const relationshipShift =
    choice?.intentTag === "ask-carefully"
      ? 0.08
      : choice?.intentTag === "hold-position"
      ? 0.04
      : 0.12;
  const pressureDelta =
    stage === 0 ? 0.08 : stage >= 3 ? 0.22 : 0.14;

  return {
    styleShifts:
      choice?.intentTag === "press-forward"
        ? {
            tension: 0.08,
            tempo: 0.05,
          }
        : choice?.intentTag === "hold-position"
        ? {
            mystery: 0.06,
            ominousness: 0.04,
          }
        : {
            warmth: 0.04,
            romance: 0.03,
    },
    relationshipDelta: {
      [protagonistId]: relationshipShift,
    },
    threadUpdates: {
      "opening-question": {
        label: "Opening question",
        status: stage >= 3 ? "resolved" : "active",
      },
    },
    conclusionPressureDelta: pressureDelta,
    newEndingCandidate: stage >= 2 ? "quiet-resolution" : undefined,
  } as const;
}

function createLocationLabel(stage: number) {
  switch (stage) {
    case 0:
      return "Threshold District";
    case 1:
      return "Lamp-Lit Walkway";
    case 2:
      return "Private Archive";
    default:
      return "Rooftop Conservatory";
  }
}

export class FakeTextGenerationProvider implements TextGenerationProvider {
  private lastDebugSnapshot: ProviderDebugSnapshot | null = null;

  async generateStoryTurn(request: StoryTurnRequest): Promise<StoryTurnResponse> {
    const validatedRequest = StoryTurnRequestSchema.parse(request);
    const stage =
      validatedRequest.requestType === "initial"
        ? 0
        : validatedRequest.recentWaves.length;
    const mainTrait =
      validatedRequest.setupProfile.protagonist[0] ??
      validatedRequest.setupProfile.mainCharacterTraits[0] ??
      "watchful";
    const worldview =
      validatedRequest.setupProfile.premise[0] ??
      validatedRequest.setupProfile.worldviewSpecs[0] ??
      "a city that prices every promise";
    const artDirection = validatedRequest.setupProfile.artDirection;
    const choiceDescription = describeChoice(validatedRequest.lastPlayerChoice);
    const sceneType =
      stage >= 3 || validatedRequest.sceneType === "ending"
        ? "ending"
        : validatedRequest.sceneType;
    const isEndingTurn = sceneType === "ending";
    const protagonist =
      validatedRequest.storyBible.mainCast.find(
        (entry) => entry.role === "protagonist",
      ) ?? validatedRequest.storyBible.mainCast[0];
    const protagonistId = protagonist?.characterId ?? "protagonist";
    const protagonistName =
      protagonist?.displayName && protagonist.displayName.toLowerCase() !== "lead"
        ? protagonist.displayName
        : "the protagonist";
    const counterpartId = "stub-counterpart";
    const locationLabel = createLocationLabel(stage);
    const backgroundKey = `background:${locationLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;
    const presentationSegmentId = `segment:${stage}:${sceneType}:${backgroundKey.replace(
      "background:",
      "",
    )}`;

    const rawProviderResponse = {
      sceneType,
      sceneContent: {
        locationLabel,
        lines: [
          {
            backgroundKey,
            id: `scene-${stage}-line-1`,
            kind: "narration",
            presentationSegmentId,
            speakerId: null,
            text:
              stage === 0
                ? `In ${worldview}, ${protagonistName} arrives as ${mainTrait} under a shared ${artDirection} visual anchor and notices the first promise in the room is already under strain.`
                : choiceDescription,
          },
          {
            backgroundKey,
            id: `scene-${stage}-line-2`,
            kind: "narration",
            presentationSegmentId,
            speakerId: null,
            text: isEndingTurn
              ? "The fake provider closes the loop on the opening question, proving that the game loop can reach a deterministic ending without real model wiring."
              : `The stubbed text provider escalates the scene in a deterministic way so the checkpoint-first loop can be exercised without any external API call.`,
          },
          {
            backgroundKey,
            id: `scene-${stage}-line-3`,
            kind: "dialogue",
            presentationSegmentId,
            speakerId: protagonistId,
            text: isEndingTurn
              ? "Then this is where the promise stops moving."
              : "I need the shape of the lie before I decide what to break.",
          },
          {
            backgroundKey,
            id: `scene-${stage}-line-4`,
            kind: "narration",
            presentationSegmentId,
            speakerId: null,
            text:
              "The room answers with a small environmental detail, giving the beat enough visual space to feel like a VN scene instead of a log entry.",
          },
          {
            backgroundKey,
            id: `scene-${stage}-line-5`,
            kind: "dialogue",
            presentationSegmentId,
            speakerId: protagonistId,
            text: isEndingTurn
              ? "No more circling. Say what the archive kept."
              : "Stay with the evidence. The answer is hiding in what did not move.",
          },
          {
            backgroundKey,
            id: `scene-${stage}-line-6`,
            kind: "narration",
            presentationSegmentId,
            speakerId: null,
            text:
              "A second beat holds the stage composition steady so narration does not wipe or churn sprites between dialogue lines.",
          },
          {
            backgroundKey,
            id: `scene-${stage}-line-7`,
            kind: "dialogue",
            presentationSegmentId,
            speakerId: protagonistId,
            text: isEndingTurn
              ? "Then let the ending remember us honestly."
              : "If this is a warning, it came from someone close enough to watch.",
          },
          {
            backgroundKey,
            id: `scene-${stage}-line-8`,
            kind: "system",
            presentationSegmentId,
            speakerId: null,
            text: isEndingTurn
              ? "Stub ending reached. Replay remains read-only; local duplicate/fork behavior is checkpoint-local."
              : "Stub turn generated from validated request contracts and checkpoint-derived state.",
          },
          ...(sceneType === "opening" || sceneType === "ending"
            ? [
                {
                  backgroundKey,
                  id: `scene-${stage}-line-9`,
                  kind: "narration" as const,
                  presentationSegmentId,
                  speakerId: null,
                  text:
                    "The final setup beat leaves a clear hook while still keeping the text segmented for backlog playback.",
                },
                {
                  backgroundKey,
                  id: `scene-${stage}-line-10`,
                  kind: "dialogue" as const,
                  presentationSegmentId,
                  speakerId: protagonistId,
                  text: isEndingTurn
                    ? "This is enough. I choose the truth that survives."
                    : "One more step, then we find out who wanted me here.",
                },
              ]
            : []),
        ],
      },
      sceneSummary: createSceneSummary(stage, validatedRequest.lastPlayerChoice),
      presentationPlan: {
        sceneType,
        presentationSegmentId,
        background: {
          decision: stage === 0 ? "establish" : "reuse",
          locationId: backgroundKey,
          locationLabel,
          promptBrief: `${locationLabel}; ${worldview}; environment-only VN background`,
          reason:
            stage === 0
              ? "Stub opening establishes one readable VN stage background."
              : "Stub turn reuses the prior location unless branch data changes it.",
        },
        stageCharacters: [
          {
            canonicalCharacterId: protagonistId,
            displayName: protagonist?.displayName ?? null,
            expression: isEndingTurn ? "resolved focus" : "watchful determination",
            pose: "stable knee-up VN conversation pose",
            presence: "present",
            priority: 90,
            reason: "The protagonist is physically present and central to this beat.",
            slot: "left",
            visible: true,
          },
          {
            canonicalCharacterId: counterpartId,
            displayName: "Archivist",
            expression: "guarded attention",
            pose: "still counterpart pose",
            presence: stage === 0 ? "present" : "offstage",
            priority: stage === 0 ? 70 : 20,
            reason:
              stage === 0
                ? "A counterpart anchors the opening conversation without forcing side swaps."
                : "The counterpart is mentioned in continuity but not physically staged.",
            slot: stage === 0 ? "right" : null,
            visible: stage === 0,
          },
        ],
        focusCharacterId: protagonistId,
        notes:
          "Stub presentation plan keeps stable stage slots and separates background context from scene text.",
      },
      choices: createChoices(stage),
      stateDelta: createStateDelta(
        stage,
        validatedRequest.lastPlayerChoice,
        protagonistId,
      ),
      imageRequest:
        validatedRequest.imageMode === "aggressive"
          ? {
              subjectType: "important-character",
              subjectId: protagonistId,
              promptBrief: `Single knee-up sprite of ${protagonistName}, ${mainTrait}, plain removable background, no other characters`,
              styleAnchor: artDirection,
              reason: isEndingTurn
                ? "Refresh the final portrait beat."
                : "Keep the important-character portrait slot populated during the stubbed loop.",
            }
          : undefined,
      endState: isEndingTurn
        ? {
            endingType: "resolved",
            epilogueSummary:
              "The stubbed branch resolves the opening promise and confirms the checkpoint-backed loop can terminate cleanly.",
          }
        : undefined,
    };
    const targetLineCount = sceneType === "normal" ? 15 : 30;

    for (
      let index = rawProviderResponse.sceneContent.lines.length;
      index < targetLineCount;
      index += 1
    ) {
      const dialogueBeat = index % 3 === 1;

      rawProviderResponse.sceneContent.lines.push({
        backgroundKey,
        id: `scene-${stage}-line-${index + 1}`,
        kind: dialogueBeat ? "dialogue" : "narration",
        presentationSegmentId,
        speakerId: dialogueBeat ? protagonistId : null,
        text: dialogueBeat
          ? isEndingTurn
            ? "The ending needs one more honest beat before it closes."
            : "The scene keeps breathing long enough for the choice to matter."
          : `Stub VN pacing beat ${index + 1} preserves a longer scene without adding provider cost.`,
      });
    }

    const storyTurnResponse = StoryTurnResponseSchema.parse(rawProviderResponse);

    this.lastDebugSnapshot = {
      rawProviderResponse,
      retryCount: 0,
      providerName: "stub",
      model: null,
    };

    return storyTurnResponse;
  }

  getLastDebugSnapshot() {
    return this.lastDebugSnapshot;
  }
}

export const fakeTextGenerationProvider = new FakeTextGenerationProvider();
