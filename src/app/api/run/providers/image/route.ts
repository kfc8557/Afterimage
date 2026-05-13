import { NextResponse } from "next/server";

import { ImageGenerationResultSchema } from "@/domain/schemas";
import { getAiModeProviderBlocker } from "@/features/run/providers/aiModeAccess";
import { ImageGenerationRequestBodySchema } from "@/features/run/providers/internalSchemas";
import {
  buildProviderRuntimeStatus,
  readProviderRuntimeConfig,
} from "@/features/run/providers/providerRuntimeConfig";
import { resolveServerImageGenerationProvider } from "@/features/run/providers/serverProviderResolver";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const providerStatus = buildProviderRuntimeStatus(readProviderRuntimeConfig());
  const aiModeBlocker = getAiModeProviderBlocker(providerStatus);

  if (aiModeBlocker.blocked) {
    console.warn(
      "Image provider route blocked.",
      JSON.stringify(aiModeBlocker.diagnostics),
    );

    return NextResponse.json(
      {
        error: aiModeBlocker.message,
        debug: aiModeBlocker.diagnostics,
      },
      { status: 503 },
    );
  }

  try {
    const requestBody = ImageGenerationRequestBodySchema.parse(await request.json());
    const imageProvider = resolveServerImageGenerationProvider();
    const imageResult = await imageProvider.generateImageAction(
      requestBody.request,
      requestBody.context,
    );
    const providerDebug = imageProvider.getLastDebugSnapshot?.() ?? null;
    const routeDiagnostics = {
      assetClass: requestBody.request.subjectType,
      model: providerDebug?.model ?? providerStatus.image.model ?? "",
      nodeId: requestBody.context.nodeId,
      sessionPreviewUrlProduced: Boolean(imageResult?.sessionPreviewUrl),
      subjectId: requestBody.request.subjectId,
    };

    console.info(
      "Image provider route result.",
      JSON.stringify(routeDiagnostics),
    );

    return NextResponse.json(
      ImageGenerationResultSchema.nullable().parse(imageResult),
      {
        headers: {
          "x-ai-vn-image-asset-class": requestBody.request.subjectType,
          "x-ai-vn-image-provider":
            providerDebug?.providerName ?? providerStatus.image.resolved,
          "x-ai-vn-image-session-preview": imageResult?.sessionPreviewUrl
            ? "true"
            : "false",
          "x-ai-vn-image-model":
            providerDebug?.model ?? providerStatus.image.model ?? "",
          "x-ai-vn-image-subject-id": requestBody.request.subjectId,
        },
      },
    );
  } catch (error) {
    console.error("Image provider route failed.", error);
    return NextResponse.json(null);
  }
}
