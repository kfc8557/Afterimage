import { z } from "zod";

import {
  ImageGenerationResultSchema,
  ImageRequestSchema,
  StoryTurnRequestSchema,
  StoryTurnResponseSchema,
} from "@/domain/schemas";

export const ImageGenerationContextSchema = z
  .object({
    nodeId: z.string().trim().min(1),
    storyRunId: z.string().trim().min(1),
  })
  .strict();

export const TextGenerationRequestBodySchema = z
  .object({
    request: StoryTurnRequestSchema,
  })
  .strict();

export const ImageGenerationRequestBodySchema = z
  .object({
    request: ImageRequestSchema,
    context: ImageGenerationContextSchema,
  })
  .strict();

export const ProviderErrorResponseSchema = z
  .object({
    error: z.string().trim().min(1),
    debug: z.unknown().optional(),
  })
  .strict();

export const TextGenerationResponseBodySchema = StoryTurnResponseSchema;
export const ImageGenerationResponseBodySchema =
  ImageGenerationResultSchema.nullable();

export type TextGenerationRequestBody = z.infer<
  typeof TextGenerationRequestBodySchema
>;
export type ImageGenerationRequestBody = z.infer<
  typeof ImageGenerationRequestBodySchema
>;
