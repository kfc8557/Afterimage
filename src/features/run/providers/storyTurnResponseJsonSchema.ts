import {
  CHOICES_MAX,
  CONCLUSION_PRESSURE_DELTA_MAX,
  STATE_DELTA_MAX,
  STATE_DELTA_MIN,
} from "@/domain/constants/contracts";

export const storyTurnResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "sceneType",
    "sceneContent",
    "sceneSummary",
    "presentationPlan",
    "choices",
    "stateDelta",
    "imageRequest",
    "endState",
  ],
  properties: {
    sceneType: {
      type: "string",
      enum: ["opening", "normal", "ending"],
    },
    sceneContent: {
      type: "object",
      additionalProperties: false,
      required: ["locationLabel", "lines"],
      properties: {
        locationLabel: {
          type: ["string", "null"],
        },
        lines: {
          type: "array",
          items: {
            type: "object",
          additionalProperties: false,
            required: [
              "id",
              "kind",
              "speakerId",
              "backgroundKey",
              "presentationSegmentId",
              "text",
            ],
            properties: {
              id: {
                type: "string",
              },
              kind: {
                type: "string",
                enum: ["narration", "dialogue", "system"],
              },
              speakerId: {
                type: ["string", "null"],
              },
              backgroundKey: {
                type: ["string", "null"],
              },
              presentationSegmentId: {
                type: ["string", "null"],
              },
              text: {
                type: "string",
              },
            },
          },
        },
      },
    },
    sceneSummary: {
      type: "string",
    },
    presentationPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "sceneType",
        "presentationSegmentId",
        "background",
        "stageCharacters",
        "focusCharacterId",
        "notes",
      ],
      properties: {
        sceneType: {
          type: "string",
          enum: ["opening", "normal", "ending"],
        },
        presentationSegmentId: {
          type: "string",
        },
        background: {
          type: "object",
          additionalProperties: false,
          required: [
            "decision",
            "locationId",
            "locationLabel",
            "promptBrief",
            "reason",
          ],
          properties: {
            decision: {
              type: "string",
              enum: ["establish", "reuse", "change"],
            },
            locationId: {
              type: "string",
            },
            locationLabel: {
              type: "string",
            },
            promptBrief: {
              type: "string",
            },
            reason: {
              type: "string",
            },
          },
        },
        stageCharacters: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: [
              "canonicalCharacterId",
              "displayName",
              "presence",
              "visible",
              "slot",
              "expression",
              "pose",
              "priority",
              "reason",
            ],
            properties: {
              canonicalCharacterId: {
                type: "string",
              },
              displayName: {
                type: ["string", "null"],
              },
              presence: {
                type: "string",
                enum: ["present", "offstage", "unknown"],
              },
              visible: {
                type: "boolean",
              },
              slot: {
                type: ["string", "null"],
                enum: ["left", "right", null],
              },
              expression: {
                type: "string",
              },
              pose: {
                type: "string",
              },
              priority: {
                type: "integer",
                minimum: 0,
                maximum: 100,
              },
              reason: {
                type: "string",
              },
            },
          },
        },
        focusCharacterId: {
          type: ["string", "null"],
        },
        notes: {
          type: "string",
        },
      },
    },
    choices: {
      type: "array",
      minItems: 0,
      maxItems: CHOICES_MAX,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "intentTag"],
        properties: {
          id: {
            type: "string",
          },
          label: {
            type: "string",
          },
          intentTag: {
            type: "string",
          },
        },
      },
    },
    stateDelta: {
      type: "object",
      additionalProperties: false,
      required: [
        "styleShifts",
        "relationshipDelta",
        "threadUpdates",
        "inventoryUpdates",
        "conclusionPressureDelta",
        "newEndingCandidate",
      ],
      properties: {
        styleShifts: {
          type: ["object", "null"],
          additionalProperties: false,
          required: [
            "warmth",
            "tension",
            "melancholy",
            "playfulness",
            "ominousness",
            "romance",
            "mystery",
            "tempo",
            "surrealness",
          ],
          properties: {
            warmth: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
            tension: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
            melancholy: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
            playfulness: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
            ominousness: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
            romance: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
            mystery: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
            tempo: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
            surrealness: {
              type: ["number", "null"],
              minimum: STATE_DELTA_MIN,
              maximum: STATE_DELTA_MAX,
            },
          },
        },
        relationshipDelta: {
          type: ["object", "null"],
          additionalProperties: {
            type: "number",
          },
        },
        threadUpdates: {
          type: ["object", "null"],
          additionalProperties: {
            type: "object",
            additionalProperties: false,
            required: ["label", "status"],
            properties: {
              label: {
                type: "string",
              },
              status: {
                type: "string",
                enum: ["open", "active", "resolved", "failed", "dormant"],
              },
            },
          },
        },
        inventoryUpdates: {
          type: ["object", "null"],
          additionalProperties: {
            type: ["boolean", "null"],
          },
        },
        conclusionPressureDelta: {
          type: "number",
          minimum: 0,
          maximum: CONCLUSION_PRESSURE_DELTA_MAX,
        },
        newEndingCandidate: {
          type: ["string", "null"],
        },
      },
    },
    imageRequest: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["subjectType", "subjectId", "promptBrief", "styleAnchor", "reason"],
      properties: {
        subjectType: {
          type: "string",
          enum: ["important-character", "portrait-frame"],
        },
        subjectId: {
          type: "string",
        },
        promptBrief: {
          type: "string",
        },
        styleAnchor: {
          type: "string",
        },
        reason: {
          type: "string",
        },
      },
    },
    endState: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["endingType", "epilogueSummary"],
      properties: {
        endingType: {
          type: "string",
          enum: ["resolved", "tragic", "bittersweet", "open"],
        },
        epilogueSummary: {
          type: "string",
        },
      },
    },
  },
} as const;
