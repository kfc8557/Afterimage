import { z } from "zod";

const ProviderSelectionSchema = z.enum(["stub", "openai"]);

const ProviderRuntimeEnvSchema = z
  .object({
    TEXT_PROVIDER: z.string().optional(),
    IMAGE_PROVIDER: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_TEXT_MODEL: z.string().optional(),
    OPENAI_TEXT_FALLBACK_MODEL: z.string().optional(),
    OPENAI_IMAGE_MODEL: z.string().optional(),
  })
  .passthrough();

export type ProviderSelection = z.infer<typeof ProviderSelectionSchema>;

export type ProviderRuntimeConfig = {
  textProvider: ProviderSelection;
  imageProvider: ProviderSelection;
  textProviderInput: string | null;
  imageProviderInput: string | null;
  textProviderError: string | null;
  imageProviderError: string | null;
  openaiApiKey: string | null;
  openaiTextModel: string;
  openaiTextFallbackModel: string;
  openaiImageModel: string;
  openaiImageModelInput: string | null;
  openaiImageModelWarning: string | null;
};

export type ProviderRuntimeStatusEntry = {
  configured: string | null;
  resolved: ProviderSelection;
  status: "ready" | "stub" | "misconfigured";
  message: string;
  model: string | null;
};

export type ProviderRuntimeStatus = {
  text: ProviderRuntimeStatusEntry;
  image: ProviderRuntimeStatusEntry;
};

const DEFAULT_TEXT_PROVIDER: ProviderSelection = "stub";
const DEFAULT_IMAGE_PROVIDER: ProviderSelection = "stub";
const DEFAULT_OPENAI_TEXT_MODEL = "gpt-5.4";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-1-mini";
const SUPPORTED_OPENAI_IMAGE_MODELS = [
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
] as const;

function parseProviderSelection(
  value: string | undefined,
  fallback: ProviderSelection,
  envVarName: "TEXT_PROVIDER" | "IMAGE_PROVIDER",
) {
  const parsedValue = value?.trim().toLowerCase();
  const parsedSelection = ProviderSelectionSchema.safeParse(parsedValue);

  return {
    input: parsedValue ?? null,
    selection: parsedSelection.success ? parsedSelection.data : fallback,
    error:
      parsedValue && !parsedSelection.success
        ? `${envVarName}="${parsedValue}" is invalid. Use "stub" or "openai".`
        : null,
  };
}

function parseOptionalEnvValue(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

function parseOpenAIImageModel(value: string | undefined) {
  const configuredModel = parseOptionalEnvValue(value);

  if (!configuredModel) {
    return {
      model: DEFAULT_OPENAI_IMAGE_MODEL,
      input: null,
      warning: null,
    };
  }

  if (
    SUPPORTED_OPENAI_IMAGE_MODELS.includes(
      configuredModel as (typeof SUPPORTED_OPENAI_IMAGE_MODELS)[number],
    )
  ) {
    return {
      model: configuredModel,
      input: configuredModel,
      warning: null,
    };
  }

  return {
    model: DEFAULT_OPENAI_IMAGE_MODEL,
    input: configuredModel,
    warning: `OPENAI_IMAGE_MODEL="${configuredModel}" is not in the supported GPT Image allowlist for this runtime. Falling back to ${DEFAULT_OPENAI_IMAGE_MODEL}.`,
  };
}

export function readProviderRuntimeConfig(): ProviderRuntimeConfig {
  const env = ProviderRuntimeEnvSchema.parse(process.env);
  const textProviderResult = parseProviderSelection(
    env.TEXT_PROVIDER,
    DEFAULT_TEXT_PROVIDER,
    "TEXT_PROVIDER",
  );
  const imageProviderResult = parseProviderSelection(
    env.IMAGE_PROVIDER,
    DEFAULT_IMAGE_PROVIDER,
    "IMAGE_PROVIDER",
  );
  const openaiApiKey = parseOptionalEnvValue(env.OPENAI_API_KEY);
  const openaiTextModel =
    parseOptionalEnvValue(env.OPENAI_TEXT_MODEL) ?? DEFAULT_OPENAI_TEXT_MODEL;
  const openaiTextFallbackModel =
    parseOptionalEnvValue(env.OPENAI_TEXT_FALLBACK_MODEL) ?? openaiTextModel;
  const openaiImageModelResult = parseOpenAIImageModel(env.OPENAI_IMAGE_MODEL);
  const openaiImageModel = openaiImageModelResult.model;
  const textProviderError =
    textProviderResult.error ??
    (textProviderResult.selection === "openai" && !openaiApiKey
      ? "TEXT_PROVIDER=openai requires OPENAI_API_KEY. Add it or switch TEXT_PROVIDER=stub."
      : null);
  const imageProviderError =
    imageProviderResult.error ??
    (imageProviderResult.selection === "openai" && !openaiApiKey
      ? "IMAGE_PROVIDER=openai requires OPENAI_API_KEY. Add it or switch IMAGE_PROVIDER=stub."
      : null);

  return {
    textProvider: textProviderResult.selection,
    imageProvider: imageProviderResult.selection,
    textProviderInput: textProviderResult.input,
    imageProviderInput: imageProviderResult.input,
    textProviderError,
    imageProviderError,
    openaiApiKey,
    openaiTextModel,
    openaiTextFallbackModel,
    openaiImageModel,
    openaiImageModelInput: openaiImageModelResult.input,
    openaiImageModelWarning: openaiImageModelResult.warning,
  };
}

export function buildProviderRuntimeStatus(
  config: ProviderRuntimeConfig,
): ProviderRuntimeStatus {
  return {
    text: config.textProviderError
      ? {
          configured: config.textProviderInput,
          resolved: config.textProvider,
          status: "misconfigured",
          message: config.textProviderError,
          model:
            config.textProvider === "openai" ? config.openaiTextModel : null,
        }
      : config.textProvider === "openai"
        ? {
            configured: config.textProviderInput,
            resolved: config.textProvider,
            status: "ready",
            message: `Using OpenAI text generation with model ${config.openaiTextModel}.`,
            model: config.openaiTextModel,
          }
        : {
            configured: config.textProviderInput,
            resolved: config.textProvider,
            status: "stub",
            message:
              "Using the local stub text provider. Configure TEXT_PROVIDER=openai to exercise the funded provider path.",
            model: null,
          },
    image: config.imageProviderError
      ? {
          configured: config.imageProviderInput,
          resolved: config.imageProvider,
          status: "misconfigured",
          message: config.imageProviderError,
          model:
            config.imageProvider === "openai" ? config.openaiImageModel : null,
        }
      : config.imageProvider === "openai"
        ? {
            configured: config.imageProviderInput,
            resolved: config.imageProvider,
            status: "ready",
            message: `${config.openaiImageModelWarning ? `${config.openaiImageModelWarning} ` : ""}Using OpenAI image generation with model ${config.openaiImageModel}. Aggressive mode may show non-durable session previews from provider base64 output; generated assets are not durable yet.`,
            model: config.openaiImageModel,
          }
        : {
            configured: config.imageProviderInput,
            resolved: config.imageProvider,
            status: "stub",
            message:
              "Using the local stub image provider. Aggressive mode records generated actions and falls back visually without a real session preview.",
            model: null,
          },
  };
}
