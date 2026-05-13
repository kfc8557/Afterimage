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

function createFakePreviewDataUrl(request: ImageRequest) {
  const isBackground = request.subjectType === "background";
  const svg = isBackground
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#24304f"/><stop offset="0.55" stop-color="#51345c"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="960" height="540" fill="url(#g)"/><path d="M0 390h960v150H0z" fill="#10131e"/><path d="M90 335h780v55H90z" fill="#20263a"/><path d="M160 130h180v260H160zM390 90h210v300H390zM650 160h150v230H650z" fill="#303852"/><path d="M190 165h38v38h-38zM260 165h38v38h-38zM430 130h44v44h-44zM515 130h44v44h-44zM682 195h34v34h-34zM742 195h34v34h-34z" fill="#98dce8" opacity="0.48"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960" viewBox="0 0 640 960"><defs><linearGradient id="h" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f7dfb7"/><stop offset="1" stop-color="#d9a7bd"/></linearGradient></defs><rect width="640" height="960" fill="none"/><ellipse cx="320" cy="198" rx="118" ry="130" fill="url(#h)"/><path d="M180 410c18-112 92-168 140-168s122 56 140 168l54 350H126z" fill="#2a334c"/><path d="M214 420c48 44 164 44 212 0l36 340H178z" fill="#6d8fc9"/><circle cx="276" cy="190" r="14" fill="#10131e"/><circle cx="364" cy="190" r="14" fill="#10131e"/><path d="M274 242c30 24 64 24 92 0" fill="none" stroke="#5f3947" stroke-width="12" stroke-linecap="round"/></svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class FakeImageGenerationProvider implements ImageGenerationProvider {
  private lastDebugSnapshot: ProviderDebugSnapshot | null = null;

  async generateImageAction(
    request: ImageRequest,
    context: ImageGenerationContext,
  ): Promise<ImageGenerationResult | null> {
    const validatedRequest = ImageRequestSchema.parse(request);

    const rawProviderResponse = {
      source: "generated",
      subjectType: validatedRequest.subjectType,
      subjectId: validatedRequest.subjectId,
      promptBrief: validatedRequest.promptBrief,
      styleAnchor: validatedRequest.styleAnchor,
      reason: validatedRequest.reason,
      resolvedAssetUrl: null,
      generatedAssetId: `${context.storyRunId}:${context.nodeId}:${validatedRequest.subjectId}`,
    };
    const imageAction = ImageActionSchema.parse(rawProviderResponse);

    this.lastDebugSnapshot = {
      rawProviderResponse,
      retryCount: 0,
      providerName: "stub",
      model: null,
    };

    return ImageGenerationResultSchema.parse({
      action: imageAction,
      sessionPreviewUrl: createFakePreviewDataUrl(validatedRequest),
    });
  }

  getLastDebugSnapshot() {
    return this.lastDebugSnapshot;
  }
}

export const fakeImageGenerationProvider = new FakeImageGenerationProvider();
