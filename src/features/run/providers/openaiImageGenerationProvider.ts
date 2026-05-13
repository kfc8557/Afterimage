import {
  ImageActionSchema,
  ImageGenerationResultSchema,
  ImageRequestSchema,
} from "@/domain/schemas";
import type { ImageGenerationResult, ImageRequest } from "@/domain/types";

import type {
  ImageGenerationContext,
  ImageGenerationProvider,
  ProviderDebugSnapshot,
} from "./contracts";
import type { ProviderRuntimeConfig } from "./providerRuntimeConfig";

type OpenAIImageResponsePayload = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
};

type OpenAIImageRequestBody = {
  model: string;
  prompt: string;
  size: "1024x1536" | "1536x1024";
};

function createCharacterSpritePrompt(request: ImageRequest) {
  return [
    "Create a visual novel character sprite asset.",
    "Asset class: character-sprite. This is not a background and not an event CG.",
    "Show exactly one character. Do not include any other people, reflections of people, crowds, or companion figures.",
    "Do not create a scenic story tableau or full dramatic scene illustration.",
    "Use stable knee-up framing, centered, readable silhouette, clean outline, and consistent identity.",
    "This sprite belongs to one shared VN cast. Match the exact same art style, line weight, facial rendering, shading detail, color grading, proportions, and finish used for every other character sprite in this run.",
    "Only the character identity, outfit, pose, and expression should differ. Do not switch to generic flat anime, chibi, 3D, vector, mascot, or simplified default styling.",
    "Use transparent background if supported; otherwise use a plain neutral removable background.",
    "No text, no logo, no UI, no speech bubble, no caption, no watermark.",
    `Strict shared art bible / art direction: ${request.styleAnchor}.`,
    `Character/beat brief: ${request.promptBrief}`,
    `Reason: ${request.reason}`,
  ].join("\n");
}

function createBackgroundPrompt(request: ImageRequest) {
  return [
    "Create a visual novel background asset.",
    "Asset class: background. This is an environment/location layer only.",
    "Show the place, time, atmosphere, lighting, and readable staging depth.",
    "The background must be fully opaque and fill the entire canvas. Do not use transparency or alpha. Do not leave transparent, blank, checkerboard, or cutout regions.",
    "No people, no foreground characters, no portraits, no crowds, no reflections of people.",
    "No text, no readable signage, no letters, no words, no numbers, no logo, no UI, no speech bubble, no caption, no watermark.",
    "If the location needs signs or billboards, use abstract shapes, icons, color blocks, or illegible marks only; never spell readable words.",
    "Use a wide VN stage composition that remains readable behind character sprites and a bottom dialogue plate.",
    "Output should look like a complete painted/illustrated location plate, not a transparent PNG asset.",
    "Use the same shared art bible, color grading, line/rendering language, and finish as the character sprites in this run.",
    "Do not create an event CG or dramatic story tableau.",
    `Strict shared art bible / art direction: ${request.styleAnchor}.`,
    `Location/environment brief: ${request.promptBrief}`,
    `Reason: ${request.reason}`,
  ].join("\n");
}

function createImagePrompt(request: ImageRequest) {
  return request.subjectType === "background"
    ? createBackgroundPrompt(request)
    : createCharacterSpritePrompt(request);
}

async function readOpenAIResponseBody(response: Response) {
  const responseText = await response.text().catch(() => "");

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return {
      rawText: responseText.slice(0, 2000),
    };
  }
}

function summarizeOpenAIImagePayload(payload: OpenAIImageResponsePayload | null) {
  const firstImage = payload?.data?.[0] ?? null;

  return {
    dataCount: payload?.data?.length ?? 0,
    firstImage: firstImage
      ? {
          hasB64Json: Boolean(firstImage.b64_json),
          hasUrl: Boolean(firstImage.url),
        }
      : null,
  };
}

function createOpenAIImageRequestBody(
  config: ProviderRuntimeConfig,
  request: ImageRequest,
): OpenAIImageRequestBody {
  return {
    model: config.openaiImageModel,
    prompt: createImagePrompt(request),
    size: request.subjectType === "background" ? "1536x1024" : "1024x1536",
  };
}

export class OpenAIImageGenerationProvider implements ImageGenerationProvider {
  private lastDebugSnapshot: ProviderDebugSnapshot | null = null;

  constructor(private readonly config: ProviderRuntimeConfig) {}

  async generateImageAction(
    request: ImageRequest,
    context: ImageGenerationContext,
  ): Promise<ImageGenerationResult | null> {
    const validatedRequest = ImageRequestSchema.parse(request);

    try {
      const requestBody = createOpenAIImageRequestBody(
        this.config,
        validatedRequest,
      );
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.openaiApiKey!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        cache: "no-store",
      });

      const payload = (await readOpenAIResponseBody(response)) as
        | OpenAIImageResponsePayload
        | null;

      if (!response.ok) {
        const failureDetails = {
          status: response.status,
          statusText: response.statusText,
          requestBody,
          responseBody: payload,
        };

        this.lastDebugSnapshot = {
          rawProviderResponse: failureDetails,
          retryCount: null,
          providerName: "openai",
          model: this.config.openaiImageModel,
        };

        console.error(
          "OpenAI image provider request failed.",
          JSON.stringify(failureDetails, null, 2),
        );
        return null;
      }

      const firstImage = payload?.data?.[0];

      this.lastDebugSnapshot = {
        rawProviderResponse: {
          requestBody,
          responseSummary: summarizeOpenAIImagePayload(payload),
        },
        retryCount: null,
        providerName: "openai",
        model: this.config.openaiImageModel,
      };

      if (!firstImage?.b64_json && !firstImage?.url) {
        return null;
      }

      const imageAction = ImageActionSchema.parse({
        source: "generated",
        subjectType: validatedRequest.subjectType,
        subjectId: validatedRequest.subjectId,
        promptBrief: validatedRequest.promptBrief,
        styleAnchor: validatedRequest.styleAnchor,
        reason: validatedRequest.reason,
        // OpenAI image URLs can expire, and b64_json has no durable URL. Until
        // generated bytes are copied to app-owned storage, keep this as a
        // non-durable generated action and let the stage use its honest fallback.
        resolvedAssetUrl: null,
        generatedAssetId: `openai-image:${context.storyRunId}:${context.nodeId}:${crypto.randomUUID()}`,
      });

      return ImageGenerationResultSchema.parse({
        action: imageAction,
        sessionPreviewUrl: firstImage.b64_json
          ? `data:image/png;base64,${firstImage.b64_json}`
          : null,
      });
    } catch (error) {
      console.error("OpenAI image provider request threw.", error);
      return null;
    }
  }

  getLastDebugSnapshot() {
    return this.lastDebugSnapshot;
  }
}
