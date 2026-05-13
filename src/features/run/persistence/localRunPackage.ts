import { z } from "zod";

import {
  EpisodeNodeSchema,
  StoryCheckpointSchema,
  StoryRunSchema,
} from "@/domain/schemas";

import { LocalImageAssetPackageRecordSchema } from "./localImageAssetStore";

export const LOCAL_RUN_PACKAGE_PREFIX = "AIVN-PKG-v1.";
export const LOCAL_RUN_PACKAGE_VERSION = 1;
export const LOCAL_RUN_PACKAGE_IMAGE_BYTES_MAX = 16 * 1024 * 1024;

export const LocalRunPackageOmittedAssetSchema = z
  .object({
    assetId: z.string().min(1),
    subjectId: z.string().min(1),
    reason: z.string().min(1),
    byteSize: z.number().int().min(0).optional(),
  })
  .strict();

export const LocalRunPackageSchema = z
  .object({
    version: z.literal(LOCAL_RUN_PACKAGE_VERSION),
    exportedAt: z.string().datetime({ offset: true }),
    source: z
      .object({
        storyRunId: z.string().min(1),
        checkpointId: z.string().min(1),
      })
      .strict(),
    storyRun: StoryRunSchema,
    checkpoint: StoryCheckpointSchema,
    episodeNodes: z.array(EpisodeNodeSchema).min(1),
    imageAssets: z.array(LocalImageAssetPackageRecordSchema),
    omittedImageAssets: z.array(LocalRunPackageOmittedAssetSchema),
  })
  .strict();

export type LocalRunPackage = z.infer<typeof LocalRunPackageSchema>;
export type LocalRunPackageOmittedAsset = z.infer<
  typeof LocalRunPackageOmittedAssetSchema
>;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const binary = window.atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function encodeLocalRunPackage(runPackage: LocalRunPackage) {
  const json = JSON.stringify(LocalRunPackageSchema.parse(runPackage));
  const encoded = bytesToBase64Url(new TextEncoder().encode(json));

  return `${LOCAL_RUN_PACKAGE_PREFIX}${encoded}`;
}

export function decodeLocalRunPackage(packageText: string) {
  const trimmedPackageText = packageText.trim();

  if (!trimmedPackageText.startsWith(LOCAL_RUN_PACKAGE_PREFIX)) {
    throw new Error("Custom Code package must start with AIVN-PKG-v1.");
  }

  const payload = trimmedPackageText.slice(LOCAL_RUN_PACKAGE_PREFIX.length);
  const json = new TextDecoder().decode(base64UrlToBytes(payload));
  const parsedPayload = JSON.parse(json) as unknown;

  return LocalRunPackageSchema.parse(parsedPayload);
}

export function getPackageTextBytes(packageText: string) {
  return new TextEncoder().encode(packageText).byteLength;
}
