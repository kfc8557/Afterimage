import { ZodError } from "zod";
import { NextResponse } from "next/server";

import { StoryTurnResponseSchema } from "@/domain/schemas";
import {
  ProviderErrorResponseSchema,
  TextGenerationRequestBodySchema,
} from "@/features/run/providers/internalSchemas";
import { TextGenerationProviderError } from "@/features/run/providers/contracts";
import { getAiModeProviderBlocker } from "@/features/run/providers/aiModeAccess";
import {
  buildProviderRuntimeStatus,
  readProviderRuntimeConfig,
} from "@/features/run/providers/providerRuntimeConfig";
import { resolveServerTextGenerationProvider } from "@/features/run/providers/serverProviderResolver";

export const runtime = "nodejs";

function createErrorResponse(
  message: string,
  status: number,
  debug?: unknown,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    ProviderErrorResponseSchema.parse({
      error: message,
      debug,
    }),
    {
      status,
      headers,
    },
  );
}

export async function POST(request: Request) {
  const providerStatus = buildProviderRuntimeStatus(readProviderRuntimeConfig());
  const aiModeBlocker = getAiModeProviderBlocker(providerStatus);

  if (aiModeBlocker.blocked) {
    return createErrorResponse(
      aiModeBlocker.message,
      503,
      aiModeBlocker.diagnostics,
    );
  }

  try {
    const rawRequestBody = await request.json();
    const requestBody = TextGenerationRequestBodySchema.parse(rawRequestBody);
    try {
      const textProvider = resolveServerTextGenerationProvider();
      const storyTurnResponse = await textProvider.generateStoryTurn(
        requestBody.request,
      );
      const providerDebug = textProvider.getLastDebugSnapshot?.() ?? null;

      return NextResponse.json(StoryTurnResponseSchema.parse(storyTurnResponse), {
        headers: {
          "x-ai-vn-text-provider":
            providerDebug?.providerName ?? providerStatus.text.resolved,
          "x-ai-vn-text-model":
            providerDebug?.model ?? providerStatus.text.model ?? "",
          "x-ai-vn-text-retry-count":
            providerDebug?.retryCount === null || providerDebug?.retryCount === undefined
              ? ""
              : String(providerDebug.retryCount),
        },
      });
    } catch (error) {
      if (error instanceof TextGenerationProviderError) {
        const providerDebug = error.debugSnapshot;

        return createErrorResponse(
          error.message,
          502,
          providerDebug,
          {
            "x-ai-vn-text-provider":
              providerDebug?.providerName ?? providerStatus.text.resolved,
            "x-ai-vn-text-model":
              providerDebug?.model ?? providerStatus.text.model ?? "",
            "x-ai-vn-text-retry-count":
              providerDebug?.retryCount === null ||
              providerDebug?.retryCount === undefined
                ? ""
                : String(providerDebug.retryCount),
          },
        );
      }

      if (error instanceof Error) {
        return createErrorResponse(error.message, 502);
      }

      return createErrorResponse(
        "Unable to generate a story turn with the configured text provider.",
        502,
      );
    }
  } catch (error) {
    if (error instanceof ZodError) {
      return createErrorResponse("Invalid text generation request payload.", 400);
    }

    return createErrorResponse(
      "Unable to generate a story turn with the configured text provider.",
      502,
    );
  }
}
