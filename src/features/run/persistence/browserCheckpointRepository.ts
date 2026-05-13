import { z } from "zod";

import { STORY_CHECKPOINT_SCHEMA_VERSION } from "@/domain/constants/contracts";
import {
  EpisodeNodeSchema,
  ShareCodeSchema,
  StoryCheckpointBundleSchema,
  StoryCheckpointSchema,
  StoryRunSchema,
} from "@/domain/schemas";
import type {
  EpisodeNode,
  ResolvedAssetRef,
  StoryCheckpoint,
  StoryRun,
} from "@/domain/types";
import {
  createCharacterIdentityKey,
  createCharacterVariantKey,
  defaultSessionVisualAssets,
  mergeSessionVisualAssets,
  type SessionVisualAssets,
} from "@/features/run/visuals/sessionVisualAssets";

import {
  createLocalImageAssetUrl,
  parseLocalImageAssetId,
  putLocalImageAssetRecord,
  readLocalImageAsset,
  type LocalImageAssetPackageRecord,
} from "./localImageAssetStore";
import {
  decodeLocalRunPackage,
  encodeLocalRunPackage,
  getPackageTextBytes,
  LOCAL_RUN_PACKAGE_IMAGE_BYTES_MAX,
  type LocalRunPackage,
  type LocalRunPackageOmittedAsset,
} from "./localRunPackage";

const CHECKPOINT_STORAGE_KEY = "afterimage/checkpoint-persistence/v1";

const BrowserCheckpointStorageSchema = z
  .object({
    storyRuns: z.record(StoryRunSchema),
    storyCheckpoints: z.record(StoryCheckpointSchema),
    episodeNodes: z.record(EpisodeNodeSchema),
    shareCodes: z.record(ShareCodeSchema),
  })
  .strict();

type BrowserCheckpointStorage = z.infer<typeof BrowserCheckpointStorageSchema>;

export type ActiveRunPersistenceSnapshot = {
  storyRun: StoryRun;
  episodeNodesById: Record<string, EpisodeNode>;
  nodeOrder: string[];
  currentNodeId: string | null;
};

export type PersistedRunSummary = {
  storyRunId: string;
  checkpointId: string;
  checkpointIndex: number;
  runMode: StoryRun["runMode"];
  premadeStoryId: string | null;
  status: StoryRun["status"];
  updatedAt: string;
  currentNodeId: string;
  locationLabel: string | null;
  sceneSummary: string;
};

export type RestoreCheckpointResult = ActiveRunPersistenceSnapshot & {
  checkpoint: StoryCheckpoint;
  sessionVisualAssets: SessionVisualAssets;
};

export type LocalRunPackageExportResult = {
  checkpointId: string;
  packageText: string;
  packageBytes: number;
  includedImageAssetCount: number;
  omittedImageAssets: LocalRunPackageOmittedAsset[];
  totalImageBytes: number;
};

export type LocalRunPackageImportResult = RestoreCheckpointResult & {
  importedImageAssetCount: number;
  omittedImageAssetCount: number;
};

export type SaveRunSessionMode = "autosave" | "manual";

export type SaveRunSessionResult = {
  checkpoint: StoryCheckpoint;
  storyRun: StoryRun;
  saveDisposition: "created" | "reused";
};

export interface CheckpointPersistenceRepository {
  exportCheckpointPackage?(checkpointId: string): Promise<LocalRunPackageExportResult>;
  forkCheckpoint(checkpointId: string): Promise<RestoreCheckpointResult>;
  importCheckpointPackage?(
    packageText: string,
  ): Promise<LocalRunPackageImportResult>;
  listSavedRuns(): Promise<PersistedRunSummary[]>;
  loadCheckpointForReplay(checkpointId: string): Promise<RestoreCheckpointResult>;
  readCheckpoint(checkpointId: string): Promise<StoryCheckpoint>;
  loadCheckpoint(checkpointId: string): Promise<RestoreCheckpointResult>;
  saveRunSession(
    snapshot: ActiveRunPersistenceSnapshot,
    options?: { mode?: SaveRunSessionMode },
  ): Promise<SaveRunSessionResult>;
}

function createEmptyStorage(): BrowserCheckpointStorage {
  return {
    storyRuns: {},
    storyCheckpoints: {},
    episodeNodes: {},
    shareCodes: {},
  };
}

function createLocalId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getBrowserStorage() {
  if (typeof window === "undefined") {
    throw new Error("Checkpoint persistence is only available in the browser.");
  }

  return window.localStorage;
}

function readStorageSnapshot(): BrowserCheckpointStorage {
  const storage = getBrowserStorage();
  const rawSnapshot = storage.getItem(CHECKPOINT_STORAGE_KEY);

  if (!rawSnapshot) {
    return createEmptyStorage();
  }

  let parsedSnapshot: unknown;

  try {
    parsedSnapshot = JSON.parse(rawSnapshot);
  } catch {
    throw new Error("Stored checkpoint data could not be parsed.");
  }

  const parsedResult =
    BrowserCheckpointStorageSchema.safeParse(parsedSnapshot);

  if (!parsedResult.success) {
    throw new Error("Stored checkpoint data is invalid.");
  }

  return parsedResult.data;
}

function isQuotaExceededError(error: unknown): boolean {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      error.code === 22 ||
      error.code === 1014
    );
  }

  return false;
}

function evictOldestCheckpoint(
  snapshot: BrowserCheckpointStorage,
): BrowserCheckpointStorage | null {
  const checkpoints = Object.values(snapshot.storyCheckpoints);

  if (checkpoints.length <= 1) {
    return null;
  }

  const oldest = checkpoints.reduce((acc, candidate) =>
    new Date(candidate.createdAt).getTime() <
    new Date(acc.createdAt).getTime()
      ? candidate
      : acc,
  );

  const remainingCheckpoints = { ...snapshot.storyCheckpoints };
  delete remainingCheckpoints[oldest.id];

  const runStillHasCheckpoints = Object.values(remainingCheckpoints).some(
    (checkpoint) => checkpoint.storyRunId === oldest.storyRunId,
  );

  const nextStoryRuns = { ...snapshot.storyRuns };
  if (!runStillHasCheckpoints) {
    delete nextStoryRuns[oldest.storyRunId];
  } else {
    const storyRun = nextStoryRuns[oldest.storyRunId];
    if (storyRun && storyRun.latestCheckpointId === oldest.id) {
      const replacement = Object.values(remainingCheckpoints)
        .filter((checkpoint) => checkpoint.storyRunId === oldest.storyRunId)
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )[0];

      if (replacement) {
        nextStoryRuns[oldest.storyRunId] = {
          ...storyRun,
          latestCheckpointId: replacement.id,
          latestEpisodeNodeId: replacement.episodeNodeId,
        };
      }
    }
  }

  return {
    ...snapshot,
    storyRuns: nextStoryRuns,
    storyCheckpoints: remainingCheckpoints,
  };
}

function writeStorageSnapshot(snapshot: BrowserCheckpointStorage) {
  const storage = getBrowserStorage();
  let attempt: BrowserCheckpointStorage | null = snapshot;

  while (attempt) {
    try {
      storage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(attempt));
      return;
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        throw error;
      }

      const pruned = evictOldestCheckpoint(attempt);
      if (!pruned) {
        throw error;
      }
      attempt = pruned;
    }
  }
}

function deriveRunStatus(
  currentNode: EpisodeNode,
  previousStatus: StoryRun["status"],
): StoryRun["status"] {
  if (previousStatus === "archived") {
    return "archived";
  }

  if (currentNode.turnType === "ending" || currentNode.endState) {
    return "ended";
  }

  return "active";
}

function buildLineageNodes(
  episodeNodesById: Record<string, EpisodeNode>,
  currentNodeId: string,
) {
  const orderedNodes: EpisodeNode[] = [];
  const visitedNodeIds = new Set<string>();
  let cursorNodeId: string | null = currentNodeId;

  while (cursorNodeId) {
    if (visitedNodeIds.has(cursorNodeId)) {
      throw new Error("Checkpoint restore detected a cycle in episode node lineage.");
    }

    const node: EpisodeNode | undefined = episodeNodesById[cursorNodeId];

    if (!node) {
      throw new Error("Checkpoint restore could not find the requested episode node.");
    }

    orderedNodes.push(node);
    visitedNodeIds.add(cursorNodeId);
    cursorNodeId = node.parentEpisodeNodeId;
  }

  orderedNodes.reverse();

  if (orderedNodes.length === 0) {
    throw new Error("Checkpoint restore could not rebuild any episode nodes.");
  }

  return orderedNodes;
}

function buildResolvedAssetRefs(lineageNodes: EpisodeNode[]) {
  const resolvedAssetRefs = new Map<string, ResolvedAssetRef>();

  lineageNodes.forEach((node) => {
    node.imageActions.forEach((imageAction, index) => {
      switch (imageAction.source) {
        case "manifest": {
          if (!imageAction.resolvedAssetUrl) {
            return;
          }

          const assetRefId = `${node.id}:${imageAction.subjectId}:${index}`;
          const dedupeKey = `${imageAction.source}:${imageAction.subjectId}:${imageAction.resolvedAssetUrl}`;

          resolvedAssetRefs.set(dedupeKey, {
            subjectId: imageAction.subjectId,
            source: imageAction.source,
            assetRefId,
            assetUrl: imageAction.resolvedAssetUrl,
          });
          return;
        }
        case "generated": {
          if (!imageAction.generatedAssetId || !imageAction.resolvedAssetUrl) {
            return;
          }

          if (!parseLocalImageAssetId(imageAction.resolvedAssetUrl)) {
            return;
          }

          const dedupeKey = `${imageAction.source}:${imageAction.subjectId}:${imageAction.generatedAssetId}`;

          resolvedAssetRefs.set(dedupeKey, {
            subjectId: imageAction.subjectId,
            source: imageAction.source,
            assetRefId: imageAction.generatedAssetId,
            assetUrl: imageAction.resolvedAssetUrl,
          });
          return;
        }
      }
    });
  });

  return Array.from(resolvedAssetRefs.values());
}

function isSpriteImageAction(imageAction: EpisodeNode["imageActions"][number]) {
  return (
    imageAction.subjectType === "important-character" ||
    imageAction.subjectType === "portrait-frame"
  );
}

async function buildSessionVisualAssetsFromRefs(args: {
  lineageNodes: EpisodeNode[];
  resolvedAssetRefs: ResolvedAssetRef[];
}) {
  let sessionVisualAssets = defaultSessionVisualAssets;
  const refsByAssetRefId = new Map(
    args.resolvedAssetRefs.map((assetRef) => [assetRef.assetRefId, assetRef]),
  );

  for (const node of args.lineageNodes) {
    for (const imageAction of node.imageActions) {
      const resolvedAssetRef = imageAction.generatedAssetId
        ? refsByAssetRefId.get(imageAction.generatedAssetId)
        : null;
      const localAssetId = parseLocalImageAssetId(
        imageAction.resolvedAssetUrl ?? resolvedAssetRef?.assetUrl,
      );
      const localAsset = localAssetId
        ? await readLocalImageAsset(localAssetId)
        : null;
      const assetUrl =
        localAsset?.dataUrl ?? imageAction.resolvedAssetUrl ?? resolvedAssetRef?.assetUrl;

      if (!assetUrl || parseLocalImageAssetId(assetUrl)) {
        continue;
      }

      if (imageAction.subjectType === "background") {
        sessionVisualAssets = mergeSessionVisualAssets(sessionVisualAssets, {
          backgroundsByLocationKey: {
            [imageAction.subjectId]: assetUrl,
          },
        });
        continue;
      }

      if (isSpriteImageAction(imageAction)) {
        const identityKey = createCharacterIdentityKey(imageAction.subjectId);
        const variantKey = createCharacterVariantKey({
          promptBrief: imageAction.promptBrief,
          subjectId: imageAction.subjectId,
        });

        sessionVisualAssets = mergeSessionVisualAssets(sessionVisualAssets, {
          characterSpritesByIdentity: {
            [identityKey]: assetUrl,
          },
          characterSpriteVariantsByKey: {
            [variantKey]: assetUrl,
          },
        });
      }
    }
  }

  return sessionVisualAssets;
}

function buildSessionNodeMap(lineageNodes: EpisodeNode[]) {
  return Object.fromEntries(lineageNodes.map((node) => [node.id, node]));
}

function selectCurrentNode(snapshot: ActiveRunPersistenceSnapshot) {
  if (!snapshot.currentNodeId) {
    throw new Error("Cannot persist a run without a current episode node.");
  }

  const currentNode = snapshot.episodeNodesById[snapshot.currentNodeId];

  if (!currentNode) {
    throw new Error("Cannot persist a run without a current episode node.");
  }

  return currentNode;
}

function validateSnapshotNodes(snapshot: ActiveRunPersistenceSnapshot) {
  const nodes = Object.values(snapshot.episodeNodesById);

  if (nodes.length === 0) {
    throw new Error("Cannot persist a run without any episode nodes.");
  }

  nodes.forEach((node) => {
    if (node.storyRunId !== snapshot.storyRun.id) {
      throw new Error("Episode node persistence rejected a mismatched storyRunId.");
    }
  });

  return nodes;
}

function buildRunSummary(
  storyRun: StoryRun,
  checkpoint: StoryCheckpoint,
  episodeNodesById: Record<string, EpisodeNode>,
): PersistedRunSummary {
  const currentNode = episodeNodesById[checkpoint.episodeNodeId];

  if (!currentNode) {
    throw new Error("Saved checkpoint is missing its current episode node.");
  }

  return {
    storyRunId: storyRun.id,
    checkpointId: checkpoint.id,
    checkpointIndex: checkpoint.checkpointIndex,
    runMode: storyRun.runMode,
    premadeStoryId: storyRun.premadeStoryId,
    status: deriveRunStatus(currentNode, storyRun.status),
    updatedAt: checkpoint.createdAt,
    currentNodeId: currentNode.id,
    locationLabel: currentNode.scene.locationLabel ?? null,
    sceneSummary: currentNode.sceneSummary,
  };
}

function createCheckpointBundle(
  snapshot: ActiveRunPersistenceSnapshot,
  allSessionNodes: EpisodeNode[],
  lineageNodes: EpisodeNode[],
) {
  return StoryCheckpointBundleSchema.parse({
    setupProfile: snapshot.storyRun.setupProfile,
    storyBible: snapshot.storyRun.storyBible,
    runState: snapshot.storyRun.runState,
    recentWaves: snapshot.storyRun.recentWaves,
    eventCursor: allSessionNodes.length,
    resolvedAssetRefs: buildResolvedAssetRefs(lineageNodes),
  });
}

function createBundleSignature(bundle: StoryCheckpoint["bundle"]) {
  return JSON.stringify(bundle);
}

async function buildCheckpointRestoreResult(args: {
  checkpoint: StoryCheckpoint;
  episodeNodes: Record<string, EpisodeNode>;
  storyRun: StoryRun;
  writeRestoredRun?: (storyRun: StoryRun) => void;
}) {
  const runEpisodeNodes = Object.fromEntries(
    Object.values(args.episodeNodes)
      .filter((node) => node.storyRunId === args.checkpoint.storyRunId)
      .map((node) => [node.id, node]),
  );
  const lineageNodes = buildLineageNodes(
    runEpisodeNodes,
    args.checkpoint.episodeNodeId,
  );
  const currentNode = lineageNodes[lineageNodes.length - 1];

  if (!currentNode) {
    throw new Error("The checkpoint restore could not resolve a current node.");
  }

  const restoredStoryRun = StoryRunSchema.parse({
    ...args.storyRun,
    status: deriveRunStatus(currentNode, args.storyRun.status),
    updatedAt: args.writeRestoredRun
      ? new Date().toISOString()
      : args.storyRun.updatedAt,
    setupProfile: args.checkpoint.bundle.setupProfile,
    storyBible: args.checkpoint.bundle.storyBible,
    runState: args.checkpoint.bundle.runState,
    recentWaves: args.checkpoint.bundle.recentWaves,
    latestCheckpointId: args.checkpoint.id,
    latestEpisodeNodeId: currentNode.id,
  });

  args.writeRestoredRun?.(restoredStoryRun);

  const sessionVisualAssets = await buildSessionVisualAssetsFromRefs({
    lineageNodes,
    resolvedAssetRefs: args.checkpoint.bundle.resolvedAssetRefs,
  });

  return {
    checkpoint: args.checkpoint,
    storyRun: restoredStoryRun,
    episodeNodesById: buildSessionNodeMap(lineageNodes),
    nodeOrder: lineageNodes.map((node) => node.id),
    currentNodeId: currentNode.id,
    sessionVisualAssets,
  };
}

function buildForkedSession(args: {
  checkpoint: StoryCheckpoint;
  sourceNode: EpisodeNode;
  sourceStoryRun: StoryRun;
}) {
  const now = new Date().toISOString();
  const forkStoryRunId = createLocalId("run");
  const forkNodeId = createLocalId("episode");
  const forkCheckpointId = createLocalId("checkpoint");
  const forkNode = EpisodeNodeSchema.parse({
    ...args.sourceNode,
    id: forkNodeId,
    storyRunId: forkStoryRunId,
    parentEpisodeNodeId: null,
    depth: 0,
    createdAt: now,
  });
  const forkCheckpoint = StoryCheckpointSchema.parse({
    id: forkCheckpointId,
    storyRunId: forkStoryRunId,
    episodeNodeId: forkNode.id,
    checkpointIndex: 0,
    createdAt: now,
    schemaVersion: STORY_CHECKPOINT_SCHEMA_VERSION,
    bundle: args.checkpoint.bundle,
  });
  const forkStoryRun = StoryRunSchema.parse({
    ...args.sourceStoryRun,
    id: forkStoryRunId,
    status: deriveRunStatus(forkNode, args.sourceStoryRun.status),
    createdAt: now,
    updatedAt: now,
    originCheckpointId: args.checkpoint.id,
    setupProfile: args.checkpoint.bundle.setupProfile,
    storyBible: args.checkpoint.bundle.storyBible,
    runState: args.checkpoint.bundle.runState,
    recentWaves: args.checkpoint.bundle.recentWaves,
    latestCheckpointId: forkCheckpoint.id,
    latestEpisodeNodeId: forkNode.id,
  });

  return {
    checkpoint: forkCheckpoint,
    storyRun: forkStoryRun,
    episodeNodesById: {
      [forkNode.id]: forkNode,
    },
    nodeOrder: [forkNode.id],
    currentNodeId: forkNode.id,
  };
}

function collectLocalAssetRefs(lineageNodes: EpisodeNode[]) {
  const refs = new Map<
    string,
    {
      assetId: string;
      imageAction: EpisodeNode["imageActions"][number];
      nodeId: string;
    }
  >();

  lineageNodes.forEach((node) => {
    node.imageActions.forEach((imageAction) => {
      const assetId =
        parseLocalImageAssetId(imageAction.resolvedAssetUrl) ??
        (imageAction.generatedAssetId?.startsWith("local-image-")
          ? imageAction.generatedAssetId
          : null);

      if (!assetId) {
        return;
      }

      refs.set(assetId, {
        assetId,
        imageAction,
        nodeId: node.id,
      });
    });
  });

  return Array.from(refs.values()).sort((left, right) => {
    if (left.imageAction.subjectType === right.imageAction.subjectType) {
      return 0;
    }

    return left.imageAction.subjectType === "background" ? -1 : 1;
  });
}

async function buildLocalRunPackage(args: {
  checkpoint: StoryCheckpoint;
  episodeNodes: Record<string, EpisodeNode>;
  storyRun: StoryRun;
}) {
  const runEpisodeNodes = Object.fromEntries(
    Object.values(args.episodeNodes)
      .filter((node) => node.storyRunId === args.checkpoint.storyRunId)
      .map((node) => [node.id, node]),
  );
  const lineageNodes = buildLineageNodes(
    runEpisodeNodes,
    args.checkpoint.episodeNodeId,
  );
  const imageAssets: LocalImageAssetPackageRecord[] = [];
  const omittedImageAssets: LocalRunPackageOmittedAsset[] = [];
  let totalImageBytes = 0;

  for (const localAssetRef of collectLocalAssetRefs(lineageNodes)) {
    const localAsset = await readLocalImageAsset(localAssetRef.assetId);

    if (!localAsset) {
      omittedImageAssets.push({
        assetId: localAssetRef.assetId,
        subjectId: localAssetRef.imageAction.subjectId,
        reason: "Local image asset was missing from this browser.",
      });
      continue;
    }

    if (
      totalImageBytes + localAsset.byteSize >
      LOCAL_RUN_PACKAGE_IMAGE_BYTES_MAX
    ) {
      omittedImageAssets.push({
        assetId: localAsset.id,
        subjectId: localAsset.subjectId,
        reason: "Image omitted because the local package image byte cap was reached.",
        byteSize: localAsset.byteSize,
      });
      continue;
    }

    imageAssets.push(localAsset);
    totalImageBytes += localAsset.byteSize;
  }

  const runPackage = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: {
      storyRunId: args.storyRun.id,
      checkpointId: args.checkpoint.id,
    },
    storyRun: args.storyRun,
    checkpoint: args.checkpoint,
    episodeNodes: lineageNodes,
    imageAssets,
    omittedImageAssets,
  } satisfies LocalRunPackage;
  const packageText = encodeLocalRunPackage(runPackage);

  return {
    checkpointId: args.checkpoint.id,
    packageText,
    packageBytes: getPackageTextBytes(packageText),
    includedImageAssetCount: imageAssets.length,
    omittedImageAssets,
    totalImageBytes,
  };
}

function remapRecentWaves<T extends { nodeId: string }>(
  recentWaves: T[],
  nodeIdMap: Map<string, string>,
) {
  return recentWaves.map((wave) => ({
    ...wave,
    nodeId: nodeIdMap.get(wave.nodeId) ?? wave.nodeId,
  }));
}

async function importLocalRunPackageToSnapshot(args: {
  packageText: string;
  storageSnapshot: BrowserCheckpointStorage;
}) {
  const runPackage = decodeLocalRunPackage(args.packageText);
  const now = new Date().toISOString();
  const newStoryRunId = createLocalId("run");
  const newCheckpointId = createLocalId("checkpoint");
  const nodeIdMap = new Map<string, string>();
  const assetIdMap = new Map<string, string>();

  runPackage.episodeNodes.forEach((node) => {
    nodeIdMap.set(node.id, createLocalId("episode"));
  });
  runPackage.imageAssets.forEach((asset) => {
    assetIdMap.set(asset.id, createLocalId("local-image"));
  });

  const importedNodes = runPackage.episodeNodes.map((node) =>
    EpisodeNodeSchema.parse({
      ...node,
      id: nodeIdMap.get(node.id),
      storyRunId: newStoryRunId,
      parentEpisodeNodeId: node.parentEpisodeNodeId
        ? nodeIdMap.get(node.parentEpisodeNodeId) ?? null
        : null,
      imageActions: node.imageActions.map((imageAction) => {
        const oldAssetId =
          parseLocalImageAssetId(imageAction.resolvedAssetUrl) ??
          imageAction.generatedAssetId;
        const newAssetId = oldAssetId ? assetIdMap.get(oldAssetId) : null;

        if (!newAssetId) {
          return imageAction.source === "generated"
            ? {
                ...imageAction,
                resolvedAssetUrl: null,
              }
            : imageAction;
        }

        return {
          ...imageAction,
          generatedAssetId: newAssetId,
          resolvedAssetUrl: createLocalImageAssetUrl(newAssetId),
        };
      }),
      createdAt: now,
    }),
  );
  const currentNode = importedNodes[importedNodes.length - 1];

  if (!currentNode) {
    throw new Error("Imported package did not contain any episode nodes.");
  }

  const includedAssetIds = new Set(assetIdMap.values());
  const resolvedAssetRefs = buildResolvedAssetRefs(importedNodes).filter(
    (assetRef) => includedAssetIds.has(assetRef.assetRefId),
  );
  const checkpointBundle = StoryCheckpointBundleSchema.parse({
    ...runPackage.checkpoint.bundle,
    recentWaves: remapRecentWaves(
      runPackage.checkpoint.bundle.recentWaves,
      nodeIdMap,
    ),
    resolvedAssetRefs,
  });
  const importedCheckpoint = StoryCheckpointSchema.parse({
    ...runPackage.checkpoint,
    id: newCheckpointId,
    storyRunId: newStoryRunId,
    episodeNodeId: currentNode.id,
    checkpointIndex: 0,
    createdAt: now,
    bundle: checkpointBundle,
  });
  const importedStoryRun = StoryRunSchema.parse({
    ...runPackage.storyRun,
    id: newStoryRunId,
    ownerUserId: "local-user",
    status: deriveRunStatus(currentNode, runPackage.storyRun.status),
    createdAt: now,
    updatedAt: now,
    originCheckpointId: runPackage.checkpoint.id,
    latestCheckpointId: importedCheckpoint.id,
    latestEpisodeNodeId: currentNode.id,
    setupProfile: checkpointBundle.setupProfile,
    storyBible: checkpointBundle.storyBible,
    runState: checkpointBundle.runState,
    recentWaves: checkpointBundle.recentWaves,
  });

  await Promise.all(
    runPackage.imageAssets.map(async (asset) => {
      const newAssetId = assetIdMap.get(asset.id);
      const sourceNodeId = nodeIdMap.get(asset.nodeId) ?? currentNode.id;

      if (!newAssetId) {
        return;
      }

      await putLocalImageAssetRecord({
        ...asset,
        id: newAssetId,
        storyRunId: newStoryRunId,
        nodeId: sourceNodeId,
        createdAt: now,
      });
    }),
  );

  const episodeNodesById = Object.fromEntries(
    importedNodes.map((node) => [node.id, node]),
  );
  const nextStorageSnapshot: BrowserCheckpointStorage = {
    ...args.storageSnapshot,
    storyRuns: {
      ...args.storageSnapshot.storyRuns,
      [importedStoryRun.id]: importedStoryRun,
    },
    storyCheckpoints: {
      ...args.storageSnapshot.storyCheckpoints,
      [importedCheckpoint.id]: importedCheckpoint,
    },
    episodeNodes: {
      ...args.storageSnapshot.episodeNodes,
      ...episodeNodesById,
    },
  };

  return {
    checkpoint: importedCheckpoint,
    episodeNodesById,
    importedImageAssetCount: runPackage.imageAssets.length,
    omittedImageAssetCount: runPackage.omittedImageAssets.length,
    nodeOrder: importedNodes.map((node) => node.id),
    sessionVisualAssets: await buildSessionVisualAssetsFromRefs({
      lineageNodes: importedNodes,
      resolvedAssetRefs: importedCheckpoint.bundle.resolvedAssetRefs,
    }),
    storyRun: importedStoryRun,
    storageSnapshot: nextStorageSnapshot,
    currentNodeId: currentNode.id,
  };
}

class BrowserCheckpointRepository implements CheckpointPersistenceRepository {
  async exportCheckpointPackage(checkpointId: string) {
    const snapshot = readStorageSnapshot();
    const checkpoint = await this.readCheckpoint(checkpointId);
    const storedStoryRun = snapshot.storyRuns[checkpoint.storyRunId];

    if (!storedStoryRun) {
      throw new Error("The checkpoint is missing its parent story run.");
    }

    if (storedStoryRun.runMode === "premade-default") {
      throw new Error("Default Mode saves do not support Custom Code export.");
    }

    return await buildLocalRunPackage({
      checkpoint,
      episodeNodes: snapshot.episodeNodes,
      storyRun: storedStoryRun,
    });
  }

  async importCheckpointPackage(packageText: string) {
    const storageSnapshot = readStorageSnapshot();
    const importedSession = await importLocalRunPackageToSnapshot({
      packageText,
      storageSnapshot,
    });

    writeStorageSnapshot(importedSession.storageSnapshot);

    return {
      checkpoint: importedSession.checkpoint,
      storyRun: importedSession.storyRun,
      episodeNodesById: importedSession.episodeNodesById,
      nodeOrder: importedSession.nodeOrder,
      currentNodeId: importedSession.currentNodeId,
      sessionVisualAssets: importedSession.sessionVisualAssets,
      importedImageAssetCount: importedSession.importedImageAssetCount,
      omittedImageAssetCount: importedSession.omittedImageAssetCount,
    };
  }

  async listSavedRuns() {
    const snapshot = readStorageSnapshot();

    return Object.values(snapshot.storyCheckpoints)
      .map((checkpoint) => {
        const storyRun = snapshot.storyRuns[checkpoint.storyRunId];

        if (!storyRun) {
          throw new Error("Saved checkpoint metadata points to a missing story run.");
        }

        return buildRunSummary(storyRun, checkpoint, snapshot.episodeNodes);
      })
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
  }

  async readCheckpoint(checkpointId: string) {
    const snapshot = readStorageSnapshot();
    const checkpoint = snapshot.storyCheckpoints[checkpointId];

    if (!checkpoint) {
      throw new Error("The requested checkpoint could not be found.");
    }

    return checkpoint;
  }

  async loadCheckpoint(checkpointId: string) {
    const snapshot = readStorageSnapshot();
    const checkpoint = await this.readCheckpoint(checkpointId);
    const storedStoryRun = snapshot.storyRuns[checkpoint.storyRunId];

    if (!storedStoryRun) {
      throw new Error("The checkpoint is missing its parent story run.");
    }

    return await buildCheckpointRestoreResult({
      checkpoint,
      episodeNodes: snapshot.episodeNodes,
      storyRun: storedStoryRun,
      writeRestoredRun: (restoredStoryRun) => {
        writeStorageSnapshot({
          ...snapshot,
          storyRuns: {
            ...snapshot.storyRuns,
            [restoredStoryRun.id]: restoredStoryRun,
          },
        });
      },
    });
  }

  async loadCheckpointForReplay(checkpointId: string) {
    const snapshot = readStorageSnapshot();
    const checkpoint = await this.readCheckpoint(checkpointId);
    const storedStoryRun = snapshot.storyRuns[checkpoint.storyRunId];

    if (!storedStoryRun) {
      throw new Error("The checkpoint is missing its parent story run.");
    }

    return await buildCheckpointRestoreResult({
      checkpoint,
      episodeNodes: snapshot.episodeNodes,
      storyRun: storedStoryRun,
    });
  }

  async forkCheckpoint(checkpointId: string) {
    const snapshot = readStorageSnapshot();
    const checkpoint = await this.readCheckpoint(checkpointId);
    const sourceStoryRun = snapshot.storyRuns[checkpoint.storyRunId];
    const sourceNode = snapshot.episodeNodes[checkpoint.episodeNodeId];

    if (!sourceStoryRun || !sourceNode) {
      throw new Error(
        "The checkpoint cannot be forked because source data is missing.",
      );
    }

    const forkedSession = buildForkedSession({
      checkpoint,
      sourceNode,
      sourceStoryRun,
    });

    writeStorageSnapshot({
      ...snapshot,
      storyRuns: {
        ...snapshot.storyRuns,
        [forkedSession.storyRun.id]: forkedSession.storyRun,
      },
      storyCheckpoints: {
        ...snapshot.storyCheckpoints,
        [forkedSession.checkpoint.id]: forkedSession.checkpoint,
      },
      episodeNodes: {
        ...snapshot.episodeNodes,
        ...forkedSession.episodeNodesById,
      },
    });

    return {
      ...forkedSession,
      sessionVisualAssets: await buildSessionVisualAssetsFromRefs({
        lineageNodes: [forkedSession.episodeNodesById[forkedSession.currentNodeId]!],
        resolvedAssetRefs: forkedSession.checkpoint.bundle.resolvedAssetRefs,
      }),
    };
  }

  async saveRunSession(
    snapshot: ActiveRunPersistenceSnapshot,
    options?: { mode?: SaveRunSessionMode },
  ): Promise<SaveRunSessionResult> {
    const saveMode = options?.mode ?? "autosave";
    const currentNode = selectCurrentNode(snapshot);
    const allSessionNodes = validateSnapshotNodes(snapshot);
    const lineageNodes = buildLineageNodes(
      snapshot.episodeNodesById,
      currentNode.id,
    );
    const storageSnapshot = readStorageSnapshot();
    const checkpointBundle = createCheckpointBundle(
      snapshot,
      allSessionNodes,
      lineageNodes,
    );
    const latestCheckpoint = snapshot.storyRun.latestCheckpointId
      ? storageSnapshot.storyCheckpoints[snapshot.storyRun.latestCheckpointId]
      : null;

    if (
      saveMode === "manual" &&
      latestCheckpoint &&
      latestCheckpoint.episodeNodeId === currentNode.id &&
      createBundleSignature(latestCheckpoint.bundle) ===
        createBundleSignature(checkpointBundle)
    ) {
      const storedStoryRun = storageSnapshot.storyRuns[snapshot.storyRun.id];

      return {
        checkpoint: latestCheckpoint,
        storyRun: storedStoryRun ?? snapshot.storyRun,
        saveDisposition: "reused",
      };
    }

    const existingCheckpointIndices = Object.values(
      storageSnapshot.storyCheckpoints,
    )
      .filter((checkpoint) => checkpoint.storyRunId === snapshot.storyRun.id)
      .map((checkpoint) => checkpoint.checkpointIndex);
    const nextCheckpointIndex =
      existingCheckpointIndices.length > 0
        ? Math.max(...existingCheckpointIndices) + 1
        : 0;
    const now = new Date().toISOString();
    const checkpoint = StoryCheckpointSchema.parse({
      id: createLocalId("checkpoint"),
      storyRunId: snapshot.storyRun.id,
      episodeNodeId: currentNode.id,
      checkpointIndex: nextCheckpointIndex,
      createdAt: now,
      schemaVersion: STORY_CHECKPOINT_SCHEMA_VERSION,
      bundle: checkpointBundle,
    });
    const persistedStoryRun = StoryRunSchema.parse({
      ...snapshot.storyRun,
      status: deriveRunStatus(currentNode, snapshot.storyRun.status),
      updatedAt: now,
      setupProfile: checkpoint.bundle.setupProfile,
      storyBible: checkpoint.bundle.storyBible,
      runState: checkpoint.bundle.runState,
      recentWaves: checkpoint.bundle.recentWaves,
      latestCheckpointId: checkpoint.id,
      latestEpisodeNodeId: currentNode.id,
    });
    const nextSnapshot: BrowserCheckpointStorage = {
      ...storageSnapshot,
      storyRuns: {
        ...storageSnapshot.storyRuns,
        [persistedStoryRun.id]: persistedStoryRun,
      },
      storyCheckpoints: {
        ...storageSnapshot.storyCheckpoints,
        [checkpoint.id]: checkpoint,
      },
      episodeNodes: {
        ...storageSnapshot.episodeNodes,
        ...Object.fromEntries(allSessionNodes.map((node) => [node.id, node])),
      },
    };

    writeStorageSnapshot(nextSnapshot);

    return {
      checkpoint,
      storyRun: persistedStoryRun,
      saveDisposition: "created",
    };
  }
}

export class InMemoryCheckpointRepository
  implements CheckpointPersistenceRepository
{
  private storageSnapshot: BrowserCheckpointStorage = createEmptyStorage();

  clear() {
    this.storageSnapshot = createEmptyStorage();
  }

  async listSavedRuns() {
    return Object.values(this.storageSnapshot.storyCheckpoints)
      .map((checkpoint) => {
        const storyRun = this.storageSnapshot.storyRuns[checkpoint.storyRunId];

        if (!storyRun) {
          throw new Error("Saved checkpoint metadata points to a missing story run.");
        }

        return buildRunSummary(storyRun, checkpoint, this.storageSnapshot.episodeNodes);
      })
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      );
  }

  async readCheckpoint(checkpointId: string) {
    const checkpoint = this.storageSnapshot.storyCheckpoints[checkpointId];

    if (!checkpoint) {
      throw new Error("The requested checkpoint could not be found.");
    }

    return checkpoint;
  }

  async loadCheckpoint(checkpointId: string) {
    const checkpoint = await this.readCheckpoint(checkpointId);
    const storedStoryRun = this.storageSnapshot.storyRuns[checkpoint.storyRunId];

    if (!storedStoryRun) {
      throw new Error("The checkpoint is missing its parent story run.");
    }

    return await buildCheckpointRestoreResult({
      checkpoint,
      episodeNodes: this.storageSnapshot.episodeNodes,
      storyRun: storedStoryRun,
      writeRestoredRun: (restoredStoryRun) => {
        this.storageSnapshot = {
          ...this.storageSnapshot,
          storyRuns: {
            ...this.storageSnapshot.storyRuns,
            [restoredStoryRun.id]: restoredStoryRun,
          },
        };
      },
    });
  }

  async loadCheckpointForReplay(checkpointId: string) {
    const checkpoint = await this.readCheckpoint(checkpointId);
    const storedStoryRun = this.storageSnapshot.storyRuns[checkpoint.storyRunId];

    if (!storedStoryRun) {
      throw new Error("The checkpoint is missing its parent story run.");
    }

    return await buildCheckpointRestoreResult({
      checkpoint,
      episodeNodes: this.storageSnapshot.episodeNodes,
      storyRun: storedStoryRun,
    });
  }

  async forkCheckpoint(checkpointId: string) {
    const checkpoint = await this.readCheckpoint(checkpointId);
    const sourceStoryRun = this.storageSnapshot.storyRuns[checkpoint.storyRunId];
    const sourceNode = this.storageSnapshot.episodeNodes[checkpoint.episodeNodeId];

    if (!sourceStoryRun || !sourceNode) {
      throw new Error(
        "The checkpoint cannot be forked because source data is missing.",
      );
    }

    const forkedSession = buildForkedSession({
      checkpoint,
      sourceNode,
      sourceStoryRun,
    });

    this.storageSnapshot = {
      ...this.storageSnapshot,
      storyRuns: {
        ...this.storageSnapshot.storyRuns,
        [forkedSession.storyRun.id]: forkedSession.storyRun,
      },
      storyCheckpoints: {
        ...this.storageSnapshot.storyCheckpoints,
        [forkedSession.checkpoint.id]: forkedSession.checkpoint,
      },
      episodeNodes: {
        ...this.storageSnapshot.episodeNodes,
        ...forkedSession.episodeNodesById,
      },
    };

    return {
      ...forkedSession,
      sessionVisualAssets: await buildSessionVisualAssetsFromRefs({
        lineageNodes: [forkedSession.episodeNodesById[forkedSession.currentNodeId]!],
        resolvedAssetRefs: forkedSession.checkpoint.bundle.resolvedAssetRefs,
      }),
    };
  }

  async saveRunSession(
    snapshot: ActiveRunPersistenceSnapshot,
    options?: { mode?: SaveRunSessionMode },
  ): Promise<SaveRunSessionResult> {
    const saveMode = options?.mode ?? "autosave";
    const currentNode = selectCurrentNode(snapshot);
    const allSessionNodes = validateSnapshotNodes(snapshot);
    const lineageNodes = buildLineageNodes(
      snapshot.episodeNodesById,
      currentNode.id,
    );
    const checkpointBundle = createCheckpointBundle(
      snapshot,
      allSessionNodes,
      lineageNodes,
    );
    const latestCheckpoint = snapshot.storyRun.latestCheckpointId
      ? this.storageSnapshot.storyCheckpoints[snapshot.storyRun.latestCheckpointId]
      : null;

    if (
      saveMode === "manual" &&
      latestCheckpoint &&
      latestCheckpoint.episodeNodeId === currentNode.id &&
      createBundleSignature(latestCheckpoint.bundle) ===
        createBundleSignature(checkpointBundle)
    ) {
      const storedStoryRun = this.storageSnapshot.storyRuns[snapshot.storyRun.id];

      return {
        checkpoint: latestCheckpoint,
        storyRun: storedStoryRun ?? snapshot.storyRun,
        saveDisposition: "reused",
      };
    }

    const existingCheckpointIndices = Object.values(
      this.storageSnapshot.storyCheckpoints,
    )
      .filter((checkpoint) => checkpoint.storyRunId === snapshot.storyRun.id)
      .map((checkpoint) => checkpoint.checkpointIndex);
    const nextCheckpointIndex =
      existingCheckpointIndices.length > 0
        ? Math.max(...existingCheckpointIndices) + 1
        : 0;
    const now = new Date().toISOString();
    const checkpoint = StoryCheckpointSchema.parse({
      id: createLocalId("checkpoint"),
      storyRunId: snapshot.storyRun.id,
      episodeNodeId: currentNode.id,
      checkpointIndex: nextCheckpointIndex,
      createdAt: now,
      schemaVersion: STORY_CHECKPOINT_SCHEMA_VERSION,
      bundle: checkpointBundle,
    });
    const persistedStoryRun = StoryRunSchema.parse({
      ...snapshot.storyRun,
      status: deriveRunStatus(currentNode, snapshot.storyRun.status),
      updatedAt: now,
      setupProfile: checkpoint.bundle.setupProfile,
      storyBible: checkpoint.bundle.storyBible,
      runState: checkpoint.bundle.runState,
      recentWaves: checkpoint.bundle.recentWaves,
      latestCheckpointId: checkpoint.id,
      latestEpisodeNodeId: currentNode.id,
    });

    this.storageSnapshot = {
      ...this.storageSnapshot,
      storyRuns: {
        ...this.storageSnapshot.storyRuns,
        [persistedStoryRun.id]: persistedStoryRun,
      },
      storyCheckpoints: {
        ...this.storageSnapshot.storyCheckpoints,
        [checkpoint.id]: checkpoint,
      },
      episodeNodes: {
        ...this.storageSnapshot.episodeNodes,
        ...Object.fromEntries(allSessionNodes.map((node) => [node.id, node])),
      },
    };

    return {
      checkpoint,
      storyRun: persistedStoryRun,
      saveDisposition: "created",
    };
  }
}

export const browserCheckpointRepository: CheckpointPersistenceRepository =
  new BrowserCheckpointRepository();
