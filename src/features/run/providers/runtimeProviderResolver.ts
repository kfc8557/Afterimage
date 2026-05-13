import type {
  ImageGenerationProvider,
  TextGenerationProvider,
} from "./contracts";
import { httpImageGenerationProvider } from "./httpImageGenerationProvider";
import { httpTextGenerationProvider } from "./httpTextGenerationProvider";

export function resolveRuntimeTextGenerationProvider(): TextGenerationProvider {
  return httpTextGenerationProvider;
}

export function resolveRuntimeImageGenerationProvider(): ImageGenerationProvider {
  return httpImageGenerationProvider;
}
