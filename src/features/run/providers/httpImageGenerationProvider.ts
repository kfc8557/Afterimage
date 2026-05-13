import {
  ImageGenerationResultSchema,
  ImageRequestSchema,
} from "@/domain/schemas";
import type { ImageGenerationResult, ImageRequest } from "@/domain/types";

import type {
  ImageGenerationContext,
  ImageGenerationProvider,
  ProviderDebugSnapshot,
} from "./contracts";
import { ImageGenerationRequestBodySchema } from "./internalSchemas";

export class HttpImageGenerationProvider implements ImageGenerationProvider {
  private lastDebugSnapshot: ProviderDebugSnapshot | null = null;

  async generateImageAction(
    request: ImageRequest,
    context: ImageGenerationContext,
  ): Promise<ImageGenerationResult | null> {
    const requestBody = ImageGenerationRequestBodySchema.parse({
      request: ImageRequestSchema.parse(request),
      context,
    });

    try {
      const response = await fetch("/api/run/providers/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        cache: "no-store",
      });

      const payload = await response.json().catch(() => null);

      this.lastDebugSnapshot = {
        rawProviderResponse: {
          assetClass: response.headers.get("x-ai-vn-image-asset-class"),
          payload,
          sessionPreviewUrlProduced:
            response.headers.get("x-ai-vn-image-session-preview") === "true",
          subjectId: response.headers.get("x-ai-vn-image-subject-id"),
        },
        retryCount: null,
        providerName: response.headers.get("x-ai-vn-image-provider"),
        model: response.headers.get("x-ai-vn-image-model"),
      };

      if (!response.ok) {
        return null;
      }

      return ImageGenerationResultSchema.nullable().parse(payload);
    } catch {
      return null;
    }
  }

  getLastDebugSnapshot() {
    return this.lastDebugSnapshot;
  }
}

export const httpImageGenerationProvider = new HttpImageGenerationProvider();
