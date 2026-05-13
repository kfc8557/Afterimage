import type {
  ImageGenerationProvider,
  TextGenerationProvider,
} from "./contracts";
import { fakeImageGenerationProvider } from "./fakeImageGenerationProvider";
import { fakeTextGenerationProvider } from "./fakeTextGenerationProvider";
import { OpenAIImageGenerationProvider } from "./openaiImageGenerationProvider";
import {
  readProviderRuntimeConfig,
  type ProviderRuntimeConfig,
} from "./providerRuntimeConfig";
import { OpenAITextGenerationProvider } from "./openaiTextGenerationProvider";

let cachedRuntimeConfig: ProviderRuntimeConfig | null = null;
let cachedTextGenerationProvider: TextGenerationProvider | null = null;
let cachedImageGenerationProvider: ImageGenerationProvider | null = null;

function getRuntimeConfig() {
  if (!cachedRuntimeConfig) {
    cachedRuntimeConfig = readProviderRuntimeConfig();
  }

  return cachedRuntimeConfig;
}

export function resolveServerTextGenerationProvider() {
  if (cachedTextGenerationProvider) {
    return cachedTextGenerationProvider;
  }

  const config = getRuntimeConfig();

  cachedTextGenerationProvider =
    config.textProvider === "openai" && config.openaiApiKey
      ? new OpenAITextGenerationProvider(config)
      : fakeTextGenerationProvider;

  return cachedTextGenerationProvider;
}

export function resolveServerImageGenerationProvider() {
  if (cachedImageGenerationProvider) {
    return cachedImageGenerationProvider;
  }

  const config = getRuntimeConfig();

  cachedImageGenerationProvider =
    config.imageProvider === "openai" && config.openaiApiKey
      ? new OpenAIImageGenerationProvider(config)
      : fakeImageGenerationProvider;

  return cachedImageGenerationProvider;
}

export function getResolvedProviderRuntimeConfig() {
  return getRuntimeConfig();
}
