"use client";

import { create } from "zustand";

import type {
  ChoiceOption,
  EpisodeNode,
  Settings,
  SetupProfile,
  StoryRun,
} from "@/domain/types";

import { buildSetupProfile, type SetupDraft } from "@/features/setup/buildSetupProfile";
import {
  advancePremadeRunSession,
  createPremadeRunSession,
} from "@/features/default-mode/premadeStories";
import { createLocalActiveRunSession } from "@/features/run/createLocalActiveRunSession";
import {
  StubStoryOrchestrator,
  stubStoryOrchestrator,
} from "@/features/run/orchestration/stubStoryOrchestrator";
import {
  defaultSessionVisualAssets,
  mergeSessionVisualAssets,
  type SessionVisualAssets,
} from "@/features/run/visuals/sessionVisualAssets";
import type { TurnDebugSnapshot } from "@/features/run/debug/types";
import {
  getRegressionFixture,
  type RegressionFixture,
} from "@/features/run/fixtures/regressionFixtures";
import {
  browserCheckpointRepository,
  InMemoryCheckpointRepository,
  type LocalRunPackageExportResult,
  type PersistedRunSummary,
  type SaveRunSessionResult,
} from "@/features/run/persistence/browserCheckpointRepository";
import { fakeImageGenerationProvider } from "@/features/run/providers/fakeImageGenerationProvider";
import { fakeTextGenerationProvider } from "@/features/run/providers/fakeTextGenerationProvider";
import {
  TextGenerationProviderError,
  type ProviderDebugSnapshot,
} from "@/features/run/providers/contracts";
import type { ChoiceQuestionId } from "@/features/setup/questions";

type SetupFlowState = SetupDraft & {
  currentStepIndex: number;
  lastSubmittedProfile: SetupProfile | null;
};

type ActiveRunShellMode = "setup" | "loading" | "playable" | "ended";
type ActiveRunView = {
  screen: "scene";
  focusPanel: "dialogue" | "choices";
};

// Phase 3 boundary: this slice is local session wiring only.
// It intentionally mirrors contract-backed concepts so later phases can swap in
// persistence and orchestration without preserving Phase 2 placeholder fields.
type ActiveRunState = {
  lifecycle: "idle" | "loading" | "ready";
  playbackMode: "play" | "replay";
  requestState: "idle" | "running";
  pendingSetupProfile: SetupProfile | null;
  storyRun: StoryRun | null;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  currentNodeId: string | null;
  sessionImagePreviewsByNodeId: Record<string, string>;
  sessionVisualAssets: SessionVisualAssets;
  currentView: ActiveRunView;
  lastError: string | null;
};

type PersistenceState = {
  savedRuns: PersistedRunSummary[];
  isRefreshing: boolean;
  isSaving: boolean;
  loadingCheckpointId: string | null;
  lastSavedCheckpointId: string | null;
  lastInfo: string | null;
  lastError: string | null;
};

type DeveloperDebugState = {
  activeFixtureId: string | null;
  lastProviderErrorSnapshot: ProviderDebugSnapshot | null;
  lastTurnSnapshot: TurnDebugSnapshot | null;
};

export type AppStore = {
  settings: Settings;
  setupFlow: SetupFlowState;
  activeRun: ActiveRunState;
  persistence: PersistenceState;
  developerDebug: DeveloperDebugState;
  setImageMode: (imageMode: Settings["imageMode"]) => void;
  setTextSpeed: (textSpeed: Settings["textSpeed"]) => void;
  setAutoAdvance: (autoAdvance: boolean) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
  setSetupStepIndex: (stepIndex: number) => void;
  answerChoiceQuestion: (questionId: ChoiceQuestionId, value: string) => void;
  setTextResponse: (
    field: "mainCharacterTraitsInput" | "worldviewSpecsInput",
    value: string,
  ) => void;
  setOmakaseFlag: (
    field: "mainCharacterTraits" | "worldviewSpecs",
    value: boolean,
  ) => void;
  beginNewGameSetup: () => void;
  startDefaultStory: (storyId: string) => Promise<boolean>;
  resetSetupFlow: () => void;
  submitSetup: () => SetupProfile;
  materializeLocalRunSession: () => Promise<void>;
  runInitialStoryTurn: () => Promise<void>;
  advanceStoryTurn: (choiceId: string) => Promise<void>;
  refreshSavedRuns: () => Promise<void>;
  saveActiveRunToPersistence: () => Promise<string | null>;
  loadPersistedCheckpoint: (checkpointId: string) => Promise<boolean>;
  replayPersistedCheckpoint: (checkpointId: string) => Promise<boolean>;
  forkPersistedCheckpoint: (checkpointId: string) => Promise<boolean>;
  exportActiveRunPackage: () => Promise<LocalRunPackageExportResult | null>;
  exportSavedRunPackage: (
    checkpointId: string,
  ) => Promise<LocalRunPackageExportResult | null>;
  importCustomCodePackage: (packageText: string) => Promise<boolean>;
  advanceReplayNode: (direction: 1 | -1) => void;
  startRegressionFixture: (fixtureId: RegressionFixture["id"]) => Promise<void>;
  resetActiveRun: () => void;
  setActiveRunViewFocus: (focusPanel: ActiveRunView["focusPanel"]) => void;
};

const fixtureCheckpointRepository = new InMemoryCheckpointRepository();

const fixtureStoryOrchestrator = new StubStoryOrchestrator(
  fixtureCheckpointRepository,
  fakeTextGenerationProvider,
  fakeImageGenerationProvider,
);

const defaultSettings: Settings = {
  imageMode: "aggressive",
  textSpeed: "normal",
  autoAdvance: false,
  reduceMotion: false,
};

const defaultSetupFlow: SetupFlowState = {
  currentStepIndex: 0,
  lastSubmittedProfile: null,
  questionResponses: {},
  mainCharacterTraitsInput: "",
  worldviewSpecsInput: "",
  omakaseFlags: {
    mainCharacterTraits: false,
    worldviewSpecs: false,
  },
};

const defaultActiveRun: ActiveRunState = {
  lifecycle: "idle",
  playbackMode: "play",
  requestState: "idle",
  pendingSetupProfile: null,
  storyRun: null,
  episodeNodesById: {},
  nodeOrder: [],
  currentNodeId: null,
  sessionImagePreviewsByNodeId: {},
  sessionVisualAssets: defaultSessionVisualAssets,
  currentView: {
    screen: "scene",
    focusPanel: "dialogue",
  },
  lastError: null,
};

const defaultPersistence: PersistenceState = {
  savedRuns: [],
  isRefreshing: false,
  isSaving: false,
  loadingCheckpointId: null,
  lastSavedCheckpointId: null,
  lastInfo: null,
  lastError: null,
};

const defaultDeveloperDebug: DeveloperDebugState = {
  activeFixtureId: null,
  lastProviderErrorSnapshot: null,
  lastTurnSnapshot: null,
};

const emptyChoices: ChoiceOption[] = [];

function getActiveCheckpointRepository(activeFixtureId: string | null) {
  return activeFixtureId
    ? fixtureCheckpointRepository
    : browserCheckpointRepository;
}

function getManualSaveInfo(
  saveDisposition: SaveRunSessionResult["saveDisposition"],
  activeFixtureId: string | null,
) {
  if (activeFixtureId) {
    return saveDisposition === "reused"
      ? "The latest fixture turn already had an isolated checkpoint. Reusing the existing fixture save."
      : "Isolated fixture checkpoint saved for the current turn.";
  }

  return saveDisposition === "reused"
    ? "The latest turn already had a saved checkpoint. Reusing the existing save."
    : "Manual checkpoint saved for the current turn.";
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function getProviderErrorSnapshot(error: unknown) {
  return error instanceof TextGenerationProviderError
    ? error.debugSnapshot
    : null;
}

function applyCurrentImageModeToLoadedRun(
  storyRun: StoryRun,
  imageMode: Settings["imageMode"],
) {
  if (storyRun.runMode === "premade-default") {
    return storyRun;
  }

  return {
    ...storyRun,
    settingsSnapshot: {
      ...storyRun.settingsSnapshot,
      imageMode,
    },
  };
}

export const useAppStore = create<AppStore>((set, get) => ({
  settings: defaultSettings,
  setupFlow: defaultSetupFlow,
  activeRun: defaultActiveRun,
  persistence: defaultPersistence,
  developerDebug: defaultDeveloperDebug,
  setImageMode: (imageMode) =>
    set((state) => ({
      settings: {
        ...state.settings,
        imageMode,
      },
      activeRun: state.activeRun.storyRun
        ? {
            ...state.activeRun,
            storyRun: {
              ...state.activeRun.storyRun,
              settingsSnapshot: {
                ...state.activeRun.storyRun.settingsSnapshot,
                imageMode,
              },
            },
          }
        : state.activeRun,
    })),
  setTextSpeed: (textSpeed) =>
    set((state) => ({
      settings: {
        ...state.settings,
        textSpeed,
      },
    })),
  setAutoAdvance: (autoAdvance) =>
    set((state) => ({
      settings: {
        ...state.settings,
        autoAdvance,
      },
    })),
  setReduceMotion: (reduceMotion) =>
    set((state) => ({
      settings: {
        ...state.settings,
        reduceMotion,
      },
    })),
  setSetupStepIndex: (currentStepIndex) =>
    set((state) => ({
      setupFlow: {
        ...state.setupFlow,
        currentStepIndex,
      },
    })),
  answerChoiceQuestion: (questionId, value) =>
    set((state) => ({
      setupFlow: {
        ...state.setupFlow,
        questionResponses: {
          ...state.setupFlow.questionResponses,
          [questionId]: value,
        },
      },
    })),
  setTextResponse: (field, value) =>
    set((state) => ({
      setupFlow: {
        ...state.setupFlow,
        [field]: value,
      },
    })),
  setOmakaseFlag: (field, value) =>
    set((state) => ({
      setupFlow: {
        ...state.setupFlow,
        omakaseFlags: {
          ...state.setupFlow.omakaseFlags,
          [field]: value,
        },
      },
    })),
  beginNewGameSetup: () =>
    set({
      setupFlow: defaultSetupFlow,
      activeRun: defaultActiveRun,
      developerDebug: defaultDeveloperDebug,
    }),
  startDefaultStory: async (storyId) => {
    try {
      const settings = get().settings;
      const premadeSession = createPremadeRunSession(storyId, settings);
      let storyRun = premadeSession.storyRun;
      let savedRuns = get().persistence.savedRuns;
      let lastSavedCheckpointId: string | null = null;
      let lastInfo = settings.reduceMotion
        ? "Default Mode story loaded locally."
        : "Default Mode story loaded (autosave off).";

      if (settings.reduceMotion) {
        try {
          const persistedSession = await browserCheckpointRepository.saveRunSession(
            premadeSession,
          );

          storyRun = persistedSession.storyRun;
          savedRuns = await browserCheckpointRepository.listSavedRuns();
          lastSavedCheckpointId = persistedSession.checkpoint.id;
        } catch (persistenceError) {
          lastInfo = `Default Mode story started without autosave: ${getErrorMessage(
            persistenceError,
            "local checkpoint persistence is unavailable.",
          )}`;
        }
      }

      set((state) => ({
        activeRun: {
          lifecycle: "ready",
          playbackMode: "play",
          requestState: "idle",
          pendingSetupProfile: null,
          storyRun,
          episodeNodesById: premadeSession.episodeNodesById,
          nodeOrder: premadeSession.nodeOrder,
          currentNodeId: premadeSession.currentNodeId,
          sessionImagePreviewsByNodeId: {},
          sessionVisualAssets: defaultSessionVisualAssets,
          currentView: {
            screen: "scene",
            focusPanel: "dialogue",
          },
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          lastSavedCheckpointId,
          lastInfo,
          lastError: null,
        },
        developerDebug: defaultDeveloperDebug,
      }));

      return true;
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo: null,
          lastError: getErrorMessage(
            error,
            "Unable to start the selected Default Mode story.",
          ),
        },
      }));

      return false;
    }
  },
  resetSetupFlow: () =>
    set({
      setupFlow: defaultSetupFlow,
    }),
  submitSetup: () => {
    let profile: SetupProfile;

    try {
      profile = buildSetupProfile(get().setupFlow);
    } catch {
      throw new Error("Unable to prepare the setup profile from the current draft.");
    }

    set((state) => ({
      setupFlow: {
        ...state.setupFlow,
        lastSubmittedProfile: profile,
      },
      activeRun: {
        ...defaultActiveRun,
        lifecycle: "loading",
        requestState: "idle",
        pendingSetupProfile: profile,
      },
      persistence: {
        ...state.persistence,
        lastInfo: null,
        lastError: null,
      },
      developerDebug: defaultDeveloperDebug,
    }));

    return profile;
  },
  materializeLocalRunSession: async () => {
    const { activeRun, settings } = get();

    if (!activeRun.pendingSetupProfile) {
      return;
    }

    if (activeRun.lifecycle !== "loading") {
      return;
    }

    const localRunSession = createLocalActiveRunSession(
      activeRun.pendingSetupProfile,
      settings,
    );

    set((state) => ({
      activeRun: {
        ...state.activeRun,
        lifecycle: "loading",
        requestState: "running",
        lastError: null,
      },
      developerDebug: {
        ...state.developerDebug,
        lastProviderErrorSnapshot: null,
      },
    }));

    try {
      const orchestrator = get().developerDebug.activeFixtureId
        ? fixtureStoryOrchestrator
        : stubStoryOrchestrator;
      const progressResult = await orchestrator.runInitialTurn({
        storyRun: localRunSession.storyRun,
        episodeNodesById: localRunSession.episodeNodesById,
        nodeOrder: localRunSession.nodeOrder,
        currentNodeId: localRunSession.currentNodeId,
        sessionVisualAssets: activeRun.sessionVisualAssets,
      });
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        activeRun: {
          lifecycle: "ready",
          playbackMode: "play",
          requestState: "idle",
          pendingSetupProfile: null,
          storyRun: progressResult.storyRun,
          episodeNodesById: progressResult.episodeNodesById,
          nodeOrder: progressResult.nodeOrder,
          currentNodeId: progressResult.currentNodeId,
          sessionImagePreviewsByNodeId:
            progressResult.sessionImagePreviewsByNodeId,
          sessionVisualAssets: progressResult.sessionVisualAssets,
          currentView: {
            screen: "scene",
            focusPanel: "dialogue",
          },
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          lastSavedCheckpointId: progressResult.checkpointId,
          lastInfo: "Opening turn generated and autosaved.",
          lastError: null,
        },
        developerDebug: {
          ...state.developerDebug,
          lastProviderErrorSnapshot: null,
          lastTurnSnapshot: progressResult.debugSnapshot,
        },
      }));
    } catch (error) {
      const lastError = getErrorMessage(
        error,
        "Unable to generate the opening story turn.",
      );
      const providerErrorSnapshot = getProviderErrorSnapshot(error);

      set((state) => ({
        activeRun: {
          ...defaultActiveRun,
          pendingSetupProfile: state.activeRun.pendingSetupProfile,
          lifecycle: "idle",
          requestState: "idle",
          lastError,
        },
        developerDebug: {
          ...state.developerDebug,
          lastProviderErrorSnapshot: providerErrorSnapshot,
        },
      }));
    }
  },
  runInitialStoryTurn: async () => {
    const { activeRun } = get();

    if (
      !activeRun.storyRun ||
      activeRun.requestState === "running" ||
      activeRun.currentNodeId
    ) {
      return;
    }

    set((state) => ({
      activeRun: {
        ...state.activeRun,
        lifecycle: "loading",
        requestState: "running",
        lastError: null,
      },
    }));

    try {
      const orchestrator = get().developerDebug.activeFixtureId
        ? fixtureStoryOrchestrator
        : stubStoryOrchestrator;
      const progressResult = await orchestrator.runInitialTurn({
        storyRun: activeRun.storyRun,
        episodeNodesById: activeRun.episodeNodesById,
        nodeOrder: activeRun.nodeOrder,
        currentNodeId: activeRun.currentNodeId,
        sessionVisualAssets: activeRun.sessionVisualAssets,
      });
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        activeRun: {
          ...state.activeRun,
          lifecycle: "ready",
          playbackMode: "play",
          requestState: "idle",
          storyRun: progressResult.storyRun,
          episodeNodesById: progressResult.episodeNodesById,
          nodeOrder: progressResult.nodeOrder,
          currentNodeId: progressResult.currentNodeId,
          sessionImagePreviewsByNodeId: {
            ...state.activeRun.sessionImagePreviewsByNodeId,
            ...progressResult.sessionImagePreviewsByNodeId,
          },
          sessionVisualAssets: mergeSessionVisualAssets(
            state.activeRun.sessionVisualAssets,
            progressResult.sessionVisualAssets,
          ),
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          lastSavedCheckpointId: progressResult.checkpointId,
          lastInfo: "Opening turn generated and autosaved.",
          lastError: null,
        },
        developerDebug: {
          ...state.developerDebug,
          lastProviderErrorSnapshot: null,
          lastTurnSnapshot: progressResult.debugSnapshot,
        },
      }));
    } catch (error) {
      const lastError = getErrorMessage(
        error,
        "Unable to generate the opening story turn.",
      );
      const providerErrorSnapshot = getProviderErrorSnapshot(error);

      set((state) => ({
        activeRun: {
          ...defaultActiveRun,
          pendingSetupProfile:
            state.activeRun.pendingSetupProfile ??
            state.activeRun.storyRun?.setupProfile ??
            null,
          lifecycle: "idle",
          requestState: "idle",
          lastError,
        },
        developerDebug: {
          ...state.developerDebug,
          lastProviderErrorSnapshot: providerErrorSnapshot,
        },
      }));
    }
  },
  advanceStoryTurn: async (choiceId) => {
    const { activeRun } = get();

    if (
      !activeRun.storyRun ||
      !activeRun.currentNodeId ||
      activeRun.playbackMode === "replay" ||
      activeRun.requestState === "running"
    ) {
      return;
    }

    if (activeRun.storyRun.runMode === "premade-default") {
      const currentNode = activeRun.episodeNodesById[activeRun.currentNodeId];

      if (!currentNode) {
        set((state) => ({
          activeRun: {
            ...state.activeRun,
            lastError: "The current Default Mode scene is missing.",
          },
        }));
        return;
      }

      try {
        const nextSession = advancePremadeRunSession({
          choiceId,
          currentNode,
          episodeNodesById: activeRun.episodeNodesById,
          nodeOrder: activeRun.nodeOrder,
          storyRun: activeRun.storyRun,
        });
        let storyRun = nextSession.storyRun;
        let savedRuns = get().persistence.savedRuns;
        let lastSavedCheckpointId = get().persistence.lastSavedCheckpointId;
        const autoSaveEnabled = get().settings.reduceMotion;
        let lastInfo = autoSaveEnabled
          ? "Default Mode branch saved locally."
          : "Default Mode branch advanced (autosave off).";

        if (autoSaveEnabled) {
          try {
            const persistedSession = await browserCheckpointRepository.saveRunSession(
              nextSession,
            );

            storyRun = persistedSession.storyRun;
            savedRuns = await browserCheckpointRepository.listSavedRuns();
            lastSavedCheckpointId = persistedSession.checkpoint.id;
          } catch (persistenceError) {
            lastInfo = `Default Mode branch continued without autosave: ${getErrorMessage(
              persistenceError,
              "local checkpoint persistence is unavailable.",
            )}`;
          }
        }

        set((state) => ({
          activeRun: {
            ...state.activeRun,
            lifecycle: "ready",
            playbackMode: "play",
            requestState: "idle",
            storyRun,
            episodeNodesById: nextSession.episodeNodesById,
            nodeOrder: nextSession.nodeOrder,
            currentNodeId: nextSession.currentNodeId,
            sessionImagePreviewsByNodeId: {},
            sessionVisualAssets: defaultSessionVisualAssets,
            lastError: null,
          },
          persistence: {
            ...state.persistence,
            savedRuns,
            lastSavedCheckpointId,
            lastInfo,
            lastError: null,
          },
        }));
      } catch (error) {
        set((state) => ({
          activeRun: {
            ...state.activeRun,
            requestState: "idle",
            lastError: getErrorMessage(
              error,
              "Unable to advance the Default Mode story.",
            ),
          },
        }));
      }

      return;
    }

    set((state) => ({
      activeRun: {
        ...state.activeRun,
        requestState: "running",
        lastError: null,
      },
    }));

    try {
      const orchestrator = get().developerDebug.activeFixtureId
        ? fixtureStoryOrchestrator
        : stubStoryOrchestrator;
      const progressResult = await orchestrator.continueFromChoice(
        {
          storyRun: activeRun.storyRun,
          episodeNodesById: activeRun.episodeNodesById,
          nodeOrder: activeRun.nodeOrder,
          currentNodeId: activeRun.currentNodeId,
          sessionVisualAssets: activeRun.sessionVisualAssets,
        },
        choiceId,
      );
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        activeRun: {
          ...state.activeRun,
          lifecycle: "ready",
          playbackMode: "play",
          requestState: "idle",
          storyRun: progressResult.storyRun,
          episodeNodesById: progressResult.episodeNodesById,
          nodeOrder: progressResult.nodeOrder,
          currentNodeId: progressResult.currentNodeId,
          sessionImagePreviewsByNodeId: {
            ...state.activeRun.sessionImagePreviewsByNodeId,
            ...progressResult.sessionImagePreviewsByNodeId,
          },
          sessionVisualAssets: mergeSessionVisualAssets(
            state.activeRun.sessionVisualAssets,
            progressResult.sessionVisualAssets,
          ),
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          lastSavedCheckpointId: progressResult.checkpointId,
          lastInfo: "Latest turn autosaved.",
          lastError: null,
        },
        developerDebug: {
          ...state.developerDebug,
          lastProviderErrorSnapshot: null,
          lastTurnSnapshot: progressResult.debugSnapshot,
        },
      }));
    } catch (error) {
      const providerErrorSnapshot = getProviderErrorSnapshot(error);

      set((state) => ({
        activeRun: {
          ...state.activeRun,
          lifecycle: "ready",
          requestState: "idle",
          lastError: getErrorMessage(
            error,
            "Unable to advance the active story turn.",
          ),
        },
        developerDebug: {
          ...state.developerDebug,
          lastProviderErrorSnapshot: providerErrorSnapshot,
        },
      }));
    }
  },
  refreshSavedRuns: async () => {
    set((state) => ({
      persistence: {
        ...state.persistence,
        isRefreshing: true,
        lastError: null,
      },
    }));

    try {
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        persistence: {
          ...state.persistence,
          savedRuns,
          isRefreshing: false,
          lastError: null,
        },
      }));
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          isRefreshing: false,
          lastError: getErrorMessage(
            error,
            "Unable to refresh saved checkpoint runs.",
          ),
        },
      }));
    }
  },
  saveActiveRunToPersistence: async () => {
    const { activeRun, developerDebug } = get();

    if (!activeRun.storyRun || !activeRun.currentNodeId) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo: null,
          lastError: "Start or load a run before creating a manual checkpoint.",
        },
      }));
      return null;
    }

    if (activeRun.playbackMode === "replay") {
      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo: null,
          lastError: "Replay is read-only. Fork or load the checkpoint before saving.",
        },
      }));
      return null;
    }

    set((state) => ({
      persistence: {
        ...state.persistence,
        isSaving: true,
        lastInfo: null,
        lastError: null,
      },
    }));

    try {
      const checkpointRepository = getActiveCheckpointRepository(
        developerDebug.activeFixtureId,
      );
      const persistedSession = await checkpointRepository.saveRunSession(
        {
          storyRun: activeRun.storyRun,
          episodeNodesById: activeRun.episodeNodesById,
          nodeOrder: activeRun.nodeOrder,
          currentNodeId: activeRun.currentNodeId,
        },
        {
          mode: "manual",
        },
      );
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        activeRun: {
          ...state.activeRun,
          storyRun: persistedSession.storyRun,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          isSaving: false,
          lastSavedCheckpointId: persistedSession.checkpoint.id,
          lastInfo: getManualSaveInfo(
            persistedSession.saveDisposition,
            developerDebug.activeFixtureId,
          ),
          lastError: null,
        },
        developerDebug: {
          ...state.developerDebug,
          lastTurnSnapshot: state.developerDebug.lastTurnSnapshot
            ? {
                ...state.developerDebug.lastTurnSnapshot,
                currentCheckpointId: persistedSession.checkpoint.id,
                saveDisposition: persistedSession.saveDisposition,
              }
            : null,
        },
      }));

      return persistedSession.checkpoint.id;
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          isSaving: false,
          lastInfo: null,
          lastError: getErrorMessage(
            error,
            "Unable to save the active run checkpoint.",
          ),
        },
      }));

      return null;
    }
  },
  loadPersistedCheckpoint: async (checkpointId) => {
    set((state) => ({
      persistence: {
        ...state.persistence,
        loadingCheckpointId: checkpointId,
        lastInfo: null,
        lastError: null,
      },
    }));

    try {
      const restoredSession = await browserCheckpointRepository.loadCheckpoint(
        checkpointId,
      );
      const savedRuns = await browserCheckpointRepository.listSavedRuns();
      const storyRun = applyCurrentImageModeToLoadedRun(
        restoredSession.storyRun,
        get().settings.imageMode,
      );

      set((state) => ({
        activeRun: {
          lifecycle: "ready",
          playbackMode: "play",
          requestState: "idle",
          pendingSetupProfile: null,
          storyRun,
          episodeNodesById: restoredSession.episodeNodesById,
          nodeOrder: restoredSession.nodeOrder,
          currentNodeId: restoredSession.currentNodeId,
          sessionImagePreviewsByNodeId: {},
          sessionVisualAssets: restoredSession.sessionVisualAssets,
          currentView: {
            screen: "scene",
            focusPanel: "dialogue",
          },
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          loadingCheckpointId: null,
          lastSavedCheckpointId: restoredSession.checkpoint.id,
          lastInfo: `Loaded checkpoint ${restoredSession.checkpoint.checkpointIndex}.`,
          lastError: null,
        },
        developerDebug: defaultDeveloperDebug,
      }));

      return true;
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          loadingCheckpointId: null,
          lastInfo: null,
          lastError: getErrorMessage(
            error,
            "Unable to load the selected checkpoint.",
          ),
        },
      }));

      return false;
    }
  },
  replayPersistedCheckpoint: async (checkpointId) => {
    set((state) => ({
      persistence: {
        ...state.persistence,
        loadingCheckpointId: checkpointId,
        lastInfo: null,
        lastError: null,
      },
    }));

    try {
      const replaySession =
        await browserCheckpointRepository.loadCheckpointForReplay(checkpointId);
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        activeRun: {
          lifecycle: "ready",
          playbackMode: "replay",
          requestState: "idle",
          pendingSetupProfile: null,
          storyRun: replaySession.storyRun,
          episodeNodesById: replaySession.episodeNodesById,
          nodeOrder: replaySession.nodeOrder,
          currentNodeId:
            replaySession.nodeOrder[0] ?? replaySession.currentNodeId,
          sessionImagePreviewsByNodeId: {},
          sessionVisualAssets: replaySession.sessionVisualAssets,
          currentView: {
            screen: "scene",
            focusPanel: "dialogue",
          },
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          loadingCheckpointId: null,
          lastSavedCheckpointId: replaySession.checkpoint.id,
          lastInfo: `Replaying checkpoint ${replaySession.checkpoint.checkpointIndex}.`,
          lastError: null,
        },
        developerDebug: defaultDeveloperDebug,
      }));

      return true;
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          loadingCheckpointId: null,
          lastInfo: null,
          lastError: getErrorMessage(
            error,
            "Unable to replay the selected checkpoint.",
          ),
        },
      }));

      return false;
    }
  },
  forkPersistedCheckpoint: async (checkpointId) => {
    set((state) => ({
      persistence: {
        ...state.persistence,
        loadingCheckpointId: checkpointId,
        lastInfo: null,
        lastError: null,
      },
    }));

    try {
      const forkedSession =
        await browserCheckpointRepository.forkCheckpoint(checkpointId);
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        activeRun: {
          lifecycle: "ready",
          playbackMode: "play",
          requestState: "idle",
          pendingSetupProfile: null,
          storyRun: forkedSession.storyRun,
          episodeNodesById: forkedSession.episodeNodesById,
          nodeOrder: forkedSession.nodeOrder,
          currentNodeId: forkedSession.currentNodeId,
          sessionImagePreviewsByNodeId: {},
          sessionVisualAssets: forkedSession.sessionVisualAssets,
          currentView: {
            screen: "scene",
            focusPanel: "dialogue",
          },
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          loadingCheckpointId: null,
          lastSavedCheckpointId: forkedSession.checkpoint.id,
          lastInfo: `Duplicated checkpoint ${forkedSession.checkpoint.checkpointIndex} into a separate local run.`,
          lastError: null,
        },
        developerDebug: defaultDeveloperDebug,
      }));

      return true;
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          loadingCheckpointId: null,
          lastInfo: null,
          lastError: getErrorMessage(
            error,
            "Unable to duplicate the selected checkpoint locally.",
          ),
        },
      }));

      return false;
    }
  },
  exportActiveRunPackage: async () => {
    if (get().activeRun.storyRun?.runMode === "premade-default") {
      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo: null,
          lastError:
            "Default Mode stories are premade local runs and do not use Custom Code export.",
        },
      }));
      return null;
    }

    const checkpointId = await get().saveActiveRunToPersistence();

    if (!checkpointId) {
      return null;
    }

    return await get().exportSavedRunPackage(checkpointId);
  },
  exportSavedRunPackage: async (checkpointId) => {
    if (!browserCheckpointRepository.exportCheckpointPackage) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo: null,
          lastError: "Custom Code export is unavailable in this runtime.",
        },
      }));
      return null;
    }

    try {
      const exportResult =
        await browserCheckpointRepository.exportCheckpointPackage(checkpointId);

      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo:
            exportResult.omittedImageAssets.length > 0
              ? `Exported package with ${exportResult.omittedImageAssets.length} image asset(s) omitted by size/missing-asset limits.`
              : "Exported local Custom Code package with image assets.",
          lastError: null,
        },
      }));

      return exportResult;
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo: null,
          lastError: getErrorMessage(
            error,
            "Unable to export the selected checkpoint package.",
          ),
        },
      }));
      return null;
    }
  },
  importCustomCodePackage: async (packageText) => {
    if (!browserCheckpointRepository.importCheckpointPackage) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo: null,
          lastError: "Custom Code import is unavailable in this runtime.",
        },
      }));
      return false;
    }

    try {
      const importedSession =
        await browserCheckpointRepository.importCheckpointPackage(packageText);
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        activeRun: {
          lifecycle: "ready",
          playbackMode: "play",
          requestState: "idle",
          pendingSetupProfile: null,
          storyRun: importedSession.storyRun,
          episodeNodesById: importedSession.episodeNodesById,
          nodeOrder: importedSession.nodeOrder,
          currentNodeId: importedSession.currentNodeId,
          sessionImagePreviewsByNodeId: {},
          sessionVisualAssets: importedSession.sessionVisualAssets,
          currentView: {
            screen: "scene",
            focusPanel: "dialogue",
          },
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          loadingCheckpointId: null,
          lastSavedCheckpointId: importedSession.checkpoint.id,
          lastInfo:
            importedSession.omittedImageAssetCount > 0
              ? `Imported local run, but ${importedSession.omittedImageAssetCount} image asset(s) were missing from the package.`
              : `Imported local run with ${importedSession.importedImageAssetCount} image asset(s).`,
          lastError: null,
        },
        developerDebug: defaultDeveloperDebug,
      }));

      return true;
    } catch (error) {
      set((state) => ({
        persistence: {
          ...state.persistence,
          lastInfo: null,
          lastError: getErrorMessage(
            error,
            "Unable to import the Custom Code package.",
          ),
        },
      }));
      return false;
    }
  },
  advanceReplayNode: (direction) =>
    set((state) => {
      if (
        state.activeRun.playbackMode !== "replay" ||
        !state.activeRun.currentNodeId
      ) {
        return state;
      }

      const currentIndex = state.activeRun.nodeOrder.indexOf(
        state.activeRun.currentNodeId,
      );
      const nextNodeId = state.activeRun.nodeOrder[currentIndex + direction];

      if (!nextNodeId) {
        return state;
      }

      return {
        activeRun: {
          ...state.activeRun,
          currentNodeId: nextNodeId,
        },
      };
    }),
  startRegressionFixture: async (fixtureId) => {
    const fixture = getRegressionFixture(fixtureId);

    if (!fixture) {
      set((state) => ({
        activeRun: {
          ...state.activeRun,
          lastError: "The requested regression fixture does not exist.",
        },
      }));
      return;
    }

    let profile: SetupProfile;

    try {
      profile = buildSetupProfile(fixture.setupDraft);
    } catch {
      set((state) => ({
        activeRun: {
          ...state.activeRun,
          lastError: "Unable to prepare the selected regression fixture.",
        },
      }));
      return;
    }

    const fixtureSettings = {
      ...get().settings,
      imageMode: fixture.settings.imageMode,
    };
    const localRunSession = createLocalActiveRunSession(profile, fixtureSettings);
    fixtureCheckpointRepository.clear();

    set((state) => ({
      setupFlow: {
        ...defaultSetupFlow,
        ...fixture.setupDraft,
        currentStepIndex: 0,
        lastSubmittedProfile: profile,
      },
      activeRun: {
        lifecycle: "loading",
        playbackMode: "play",
        requestState: "running",
        pendingSetupProfile: null,
        storyRun: localRunSession.storyRun,
        episodeNodesById: localRunSession.episodeNodesById,
        nodeOrder: localRunSession.nodeOrder,
        currentNodeId: localRunSession.currentNodeId,
        sessionImagePreviewsByNodeId: {},
        sessionVisualAssets: defaultSessionVisualAssets,
        currentView: {
          screen: "scene",
          focusPanel: "dialogue",
        },
        lastError: null,
      },
      persistence: {
        ...state.persistence,
        lastInfo: `Running fixture: ${fixture.label}.`,
        lastError: null,
      },
      developerDebug: {
        activeFixtureId: fixture.id,
        lastProviderErrorSnapshot: null,
        lastTurnSnapshot: null,
      },
    }));

    try {
      const progressResult = await fixtureStoryOrchestrator.runInitialTurn({
        storyRun: localRunSession.storyRun,
        episodeNodesById: localRunSession.episodeNodesById,
        nodeOrder: localRunSession.nodeOrder,
        currentNodeId: localRunSession.currentNodeId,
        sessionVisualAssets: defaultSessionVisualAssets,
      });
      const savedRuns = await browserCheckpointRepository.listSavedRuns();

      set((state) => ({
        activeRun: {
          ...state.activeRun,
          lifecycle: "ready",
          playbackMode: "play",
          requestState: "idle",
          storyRun: progressResult.storyRun,
          episodeNodesById: progressResult.episodeNodesById,
          nodeOrder: progressResult.nodeOrder,
          currentNodeId: progressResult.currentNodeId,
          sessionImagePreviewsByNodeId:
            progressResult.sessionImagePreviewsByNodeId,
          sessionVisualAssets: progressResult.sessionVisualAssets,
          lastError: null,
        },
        persistence: {
          ...state.persistence,
          savedRuns,
          lastSavedCheckpointId: progressResult.checkpointId,
          lastInfo: `Fixture opening generated and autosaved: ${fixture.label}.`,
          lastError: null,
        },
        developerDebug: {
          activeFixtureId: fixture.id,
          lastProviderErrorSnapshot: null,
          lastTurnSnapshot: progressResult.debugSnapshot,
        },
      }));
    } catch (error) {
      const providerErrorSnapshot = getProviderErrorSnapshot(error);

      set((state) => ({
        activeRun: {
          ...state.activeRun,
          lifecycle: "ready",
          requestState: "idle",
          lastError: getErrorMessage(
            error,
            "Unable to run the selected regression fixture.",
          ),
        },
        developerDebug: {
          ...state.developerDebug,
          lastProviderErrorSnapshot: providerErrorSnapshot,
        },
      }));
    }
  },
  resetActiveRun: () =>
    set({
      activeRun: defaultActiveRun,
      developerDebug: defaultDeveloperDebug,
    }),
  setActiveRunViewFocus: (focusPanel) =>
    set((state) => ({
      activeRun: {
        ...state.activeRun,
        currentView: {
          ...state.activeRun.currentView,
          focusPanel,
        },
      },
    })),
}));

export const selectCurrentNode = (state: AppStore) =>
  state.activeRun.currentNodeId
    ? state.activeRun.episodeNodesById[state.activeRun.currentNodeId] ?? null
    : null;

export const selectAvailableChoices = (state: AppStore): ChoiceOption[] => {
  const currentNode = selectCurrentNode(state);

  if (!currentNode || currentNode.endState) {
    return emptyChoices;
  }

  return currentNode.choices;
};

export const selectRunShellMode = (state: AppStore): ActiveRunShellMode => {
  if (
    state.activeRun.lifecycle === "loading" ||
    (!selectCurrentNode(state) && state.activeRun.requestState === "running")
  ) {
    return "loading";
  }

  const currentNode = selectCurrentNode(state);

  if (!state.activeRun.storyRun || !currentNode) {
    return "setup";
  }

  if (
    state.activeRun.storyRun.status === "ended" ||
    currentNode.turnType === "ending" ||
    currentNode.endState
  ) {
    return "ended";
  }

  return "playable";
};

export const selectShouldRenderImages = (state: AppStore) => {
  const mode = selectRunShellMode(state);
  const imageMode =
    state.activeRun.storyRun?.settingsSnapshot.imageMode ??
    state.settings.imageMode;

  return (
    imageMode !== "off" &&
    state.activeRun.currentView.screen === "scene" &&
    mode !== "setup"
  );
};

export const selectCurrentView = (state: AppStore) => state.activeRun.currentView;

export const selectCurrentBackgroundLabel = (state: AppStore) => {
  const currentNode = selectCurrentNode(state);

  return (
    currentNode?.scene.locationLabel ??
    state.activeRun.storyRun?.setupProfile.premise[0] ??
    state.activeRun.storyRun?.setupProfile.worldviewSpecs[0] ??
    state.activeRun.pendingSetupProfile?.premise[0] ??
    state.activeRun.pendingSetupProfile?.worldviewSpecs[0] ??
    "Awaiting setup"
  );
};

export const selectCurrentPortraitLabel = (state: AppStore) =>
  state.activeRun.storyRun?.setupProfile.protagonist[0] ??
  state.activeRun.storyRun?.setupProfile.mainCharacterTraits[0] ??
  state.activeRun.pendingSetupProfile?.protagonist[0] ??
  state.activeRun.pendingSetupProfile?.mainCharacterTraits[0] ??
  "Primary character portrait placeholder";

export const selectIsRunRequestInFlight = (state: AppStore) =>
  state.activeRun.requestState === "running";

export const selectActiveRunError = (state: AppStore) =>
  state.activeRun.lastError;
