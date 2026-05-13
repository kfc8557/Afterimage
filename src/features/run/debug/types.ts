import type {
  ImageAction,
  ImageRequest,
  PresentationPlan,
  RecentWave,
  RunState,
  StateDelta,
  StorySceneType,
  StoryTurnRequest,
  StoryTurnResponse,
} from "@/domain/types";

export type LiveParameterDebugEntry = {
  key: string;
  currentValue: number;
  lastDelta: number | null;
  changedThisTurn: boolean;
  policyNote?: string;
};

export type TurnDebugProviderDetails = {
  textProvider: string | null;
  textModel: string | null;
  imageProvider: string | null;
  imageModel: string | null;
  retryCount: number | null;
};

export type TurnDebugSnapshot = {
  capturedAt: string;
  turnType: StoryTurnRequest["requestType"];
  sourceCheckpointId: string | null;
  currentCheckpointId: string | null;
  currentNodeId: string | null;
  saveDisposition: "created" | "reused" | null;
  storyTurnRequest: StoryTurnRequest;
  rawProviderResponse: unknown;
  validatedStoryTurnResponse: StoryTurnResponse;
  appliedStateDelta: StateDelta;
  recentWaves: RecentWave[];
  runState: RunState;
  liveParameters: LiveParameterDebugEntry[];
  relationshipTracks: RunState["relationshipTracks"];
  activeThreads: RunState["activeThreads"];
  inventoryFlags: RunState["inventoryFlags"];
  conclusionPressure: {
    currentValue: number;
    lastDelta: number;
    changedThisTurn: boolean;
  };
  storyPolicyState: {
    imageMode: StoryTurnRequest["imageMode"];
    sceneType: StorySceneType;
    presentationPlan: PresentationPlan | null;
    artDirection: string;
    vibe: string;
    assetManifestHints: string[];
  };
  imageState: {
    request: ImageRequest | null;
    actions: ImageAction[];
    providerDebug: unknown;
    sessionDiagnostics?: unknown;
  };
  providerDetails: TurnDebugProviderDetails;
};
