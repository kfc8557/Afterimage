import type {
  ImageGenerationResult,
  ImageRequest,
  StoryTurnRequest,
  StoryTurnResponse,
} from "@/domain/types";

export type ImageGenerationContext = {
  nodeId: string;
  storyRunId: string;
};

export type ProviderFormatValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ProviderFormatDiagnostics = {
  providerName: string;
  model: string;
  requestType: StoryTurnRequest["requestType"] | null;
  rawProviderOutput: unknown;
  extractedCandidateJson: unknown;
  validationIssues: ProviderFormatValidationIssue[];
  requiredFieldFailures: string[];
  providerFormatError: string;
  attemptIndex: number;
  repairAttempted: boolean;
};

export type ProviderDebugSnapshot = {
  rawProviderResponse: unknown;
  retryCount: number | null;
  providerName: string | null;
  model: string | null;
  formatDiagnostics?: ProviderFormatDiagnostics | null;
};

export class TextGenerationProviderError extends Error {
  constructor(
    message: string,
    readonly debugSnapshot: ProviderDebugSnapshot | null = null,
  ) {
    super(message);
    this.name = "TextGenerationProviderError";
  }
}

export interface TextGenerationProvider {
  generateStoryTurn(request: StoryTurnRequest): Promise<StoryTurnResponse>;
  getLastDebugSnapshot?(): ProviderDebugSnapshot | null;
}

export interface ImageGenerationProvider {
  generateImageAction(
    request: ImageRequest,
    context: ImageGenerationContext,
  ): Promise<ImageGenerationResult | null>;
  getLastDebugSnapshot?(): ProviderDebugSnapshot | null;
}
