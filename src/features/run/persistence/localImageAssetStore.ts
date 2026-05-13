import { z } from "zod";

import type { ImageAction } from "@/domain/types";

const DB_NAME = "afterimage-local-image-assets";
const DB_VERSION = 1;
const STORE_NAME = "assets";

export const LOCAL_IMAGE_ASSET_URL_PREFIX = "local-image-asset:";

const LocalImageAssetRecordSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    storyRunId: z.string().min(1),
    nodeId: z.string().min(1),
    subjectType: z.enum(["background", "important-character", "portrait-frame"]),
    subjectId: z.string().min(1),
    promptBrief: z.string().min(1),
    styleAnchor: z.string().min(1),
    reason: z.string().min(1),
    mimeType: z.string().min(1),
    dataUrl: z.string().min(1),
    byteSize: z.number().int().min(0),
  })
  .strict();

export type LocalImageAssetRecord = z.infer<
  typeof LocalImageAssetRecordSchema
>;

export const LocalImageAssetPackageRecordSchema =
  LocalImageAssetRecordSchema.pick({
    id: true,
    createdAt: true,
    storyRunId: true,
    nodeId: true,
    subjectType: true,
    subjectId: true,
    promptBrief: true,
    styleAnchor: true,
    reason: true,
    mimeType: true,
    dataUrl: true,
    byteSize: true,
  }).strict();

export type LocalImageAssetPackageRecord = z.infer<
  typeof LocalImageAssetPackageRecordSchema
>;

function assertBrowserImageStore() {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new Error("Local image asset storage requires browser IndexedDB.");
  }
}

function openDatabase() {
  assertBrowserImageStore();

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function withAssetStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);
    let requestResult: T;

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      requestResult = request.result;
    };
    transaction.oncomplete = () => {
      database.close();
      resolve(requestResult);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

function createLocalImageAssetId() {
  return `local-image-${crypto.randomUUID()}`;
}

export function createLocalImageAssetUrl(assetId: string) {
  return `${LOCAL_IMAGE_ASSET_URL_PREFIX}${assetId}`;
}

export function parseLocalImageAssetId(assetUrl: string | null | undefined) {
  return assetUrl?.startsWith(LOCAL_IMAGE_ASSET_URL_PREFIX)
    ? assetUrl.slice(LOCAL_IMAGE_ASSET_URL_PREFIX.length)
    : null;
}

function mimeTypeFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/);

  return match?.[1] ?? "application/octet-stream";
}

export function estimateDataUrlBytes(dataUrl: string) {
  const base64Marker = ";base64,";
  const base64Index = dataUrl.indexOf(base64Marker);

  if (base64Index >= 0) {
    const base64 = dataUrl.slice(base64Index + base64Marker.length);
    return Math.floor((base64.length * 3) / 4);
  }

  return new TextEncoder().encode(dataUrl).byteLength;
}

export async function storeGeneratedImagePreview(args: {
  action: ImageAction;
  dataUrl: string;
  nodeId: string;
  storyRunId: string;
}) {
  const record = LocalImageAssetRecordSchema.parse({
    id: createLocalImageAssetId(),
    createdAt: new Date().toISOString(),
    storyRunId: args.storyRunId,
    nodeId: args.nodeId,
    subjectType: args.action.subjectType,
    subjectId: args.action.subjectId,
    promptBrief: args.action.promptBrief,
    styleAnchor: args.action.styleAnchor,
    reason: args.action.reason,
    mimeType: mimeTypeFromDataUrl(args.dataUrl),
    dataUrl: args.dataUrl,
    byteSize: estimateDataUrlBytes(args.dataUrl),
  });

  await withAssetStore("readwrite", (store) => store.put(record));

  return record;
}

export async function putLocalImageAssetRecord(
  record: LocalImageAssetPackageRecord,
) {
  const parsedRecord = LocalImageAssetRecordSchema.parse(record);

  await withAssetStore("readwrite", (store) => store.put(parsedRecord));

  return parsedRecord;
}

export async function readLocalImageAsset(assetId: string) {
  const result = await withAssetStore<LocalImageAssetRecord | undefined>(
    "readonly",
    (store) => store.get(assetId),
  );

  return result ? LocalImageAssetRecordSchema.parse(result) : null;
}

export async function readLocalImageAssets(assetIds: string[]) {
  const uniqueAssetIds = Array.from(new Set(assetIds));
  const entries = await Promise.all(
    uniqueAssetIds.map(async (assetId) => [
      assetId,
      await readLocalImageAsset(assetId),
    ] as const),
  );

  return Object.fromEntries(
    entries.filter(
      (entry): entry is readonly [string, LocalImageAssetRecord] =>
        Boolean(entry[1]),
    ),
  );
}
