import { StoryTurnRequestSchema, StoryTurnResponseSchema } from "@/domain/schemas";
import type { StoryTurnRequest, StoryTurnResponse } from "@/domain/types";

import {
  ProviderErrorResponseSchema,
  TextGenerationRequestBodySchema,
} from "./internalSchemas";
import {
  TextGenerationProviderError,
  type ProviderDebugSnapshot,
  type TextGenerationProvider,
} from "./contracts";

export class HttpTextGenerationProvider implements TextGenerationProvider {
  private lastDebugSnapshot: ProviderDebugSnapshot | null = null;

  async generateStoryTurn(request: StoryTurnRequest): Promise<StoryTurnResponse> {
    const requestBody = TextGenerationRequestBodySchema.parse({
      request: StoryTurnRequestSchema.parse(request),
    });
    const response = await fetch("/api/run/providers/text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const retryCountHeader = response.headers.get("x-ai-vn-text-retry-count");
    const parsedRetryCount = retryCountHeader ? Number(retryCountHeader) : null;

    this.lastDebugSnapshot = {
      rawProviderResponse: payload,
      retryCount:
        parsedRetryCount !== null && Number.isFinite(parsedRetryCount)
          ? parsedRetryCount
          : null,
      providerName: response.headers.get("x-ai-vn-text-provider"),
      model: response.headers.get("x-ai-vn-text-model"),
    };

    if (!response.ok) {
      const providerError = ProviderErrorResponseSchema.safeParse(payload);
      const errorMessage = providerError.success
        ? providerError.data.error
        : "Unable to generate a story turn with the configured text provider.";

      if (providerError.success && providerError.data.debug) {
        this.lastDebugSnapshot = providerDebugSnapshotFromUnknown(
          providerError.data.debug,
          this.lastDebugSnapshot,
        );
      }

      throw new TextGenerationProviderError(errorMessage, this.lastDebugSnapshot);
    }

    return StoryTurnResponseSchema.parse(payload);
  }

  getLastDebugSnapshot() {
    return this.lastDebugSnapshot;
  }
}

export const httpTextGenerationProvider = new HttpTextGenerationProvider();

function providerDebugSnapshotFromUnknown(
  value: unknown,
  fallbackSnapshot: ProviderDebugSnapshot | null,
): ProviderDebugSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallbackSnapshot ?? {
      rawProviderResponse: value,
      retryCount: null,
      providerName: null,
      model: null,
      formatDiagnostics: null,
    };
  }

  const candidate = value as Record<string, unknown>;

  return {
    rawProviderResponse:
      "rawProviderResponse" in candidate
        ? candidate.rawProviderResponse
        : fallbackSnapshot?.rawProviderResponse ?? value,
    retryCount:
      typeof candidate.retryCount === "number"
        ? candidate.retryCount
        : fallbackSnapshot?.retryCount ?? null,
    providerName:
      typeof candidate.providerName === "string"
        ? candidate.providerName
        : fallbackSnapshot?.providerName ?? null,
    model:
      typeof candidate.model === "string"
        ? candidate.model
        : fallbackSnapshot?.model ?? null,
    formatDiagnostics:
      "formatDiagnostics" in candidate
        ? candidate.formatDiagnostics && typeof candidate.formatDiagnostics === "object"
          ? candidate.formatDiagnostics as ProviderDebugSnapshot["formatDiagnostics"]
          : null
        : fallbackSnapshot?.formatDiagnostics ?? null,
  };
}
