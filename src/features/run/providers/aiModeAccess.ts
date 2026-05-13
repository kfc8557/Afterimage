import type {
  ProviderRuntimeStatus,
  ProviderRuntimeStatusEntry,
} from "./providerRuntimeConfig";

export type AiModeProviderBlocker = {
  blocked: boolean;
  message: string;
  diagnostics: {
    text: ProviderRuntimeStatusEntry;
    image: ProviderRuntimeStatusEntry;
  };
};

function providerProblem(
  label: "Text" | "Image",
  envName: "TEXT_PROVIDER" | "IMAGE_PROVIDER",
  entry: ProviderRuntimeStatusEntry,
) {
  if (entry.status === "ready") {
    return null;
  }

  if (entry.status === "stub") {
    return `${label} provider is stub. Set ${envName}=openai.`;
  }

  return entry.message;
}

export function getAiModeProviderBlocker(
  providerStatus: ProviderRuntimeStatus,
): AiModeProviderBlocker {
  const problems = [
    providerProblem("Text", "TEXT_PROVIDER", providerStatus.text),
    providerProblem("Image", "IMAGE_PROVIDER", providerStatus.image),
  ].filter(Boolean);

  return {
    blocked: problems.length > 0,
    message:
      problems.length > 0
        ? `Experimental AI Mode requires configured OpenAI text and image providers. ${problems.join(" ")} Add OPENAI_API_KEY if needed, then restart the app.`
        : "Experimental AI Mode providers are ready.",
    diagnostics: {
      text: providerStatus.text,
      image: providerStatus.image,
    },
  };
}
