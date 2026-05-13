"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { SETUP_TEXT_INPUT_MAX_LENGTH } from "@/domain/constants/contracts";
import { getAiModeProviderBlocker } from "@/features/run/providers/aiModeAccess";
import type { ProviderRuntimeStatus } from "@/features/run/providers/providerRuntimeConfig";
import { useAppStore } from "@/stores/app-store";

import { buildSetupProfile } from "./buildSetupProfile";
import { setupQuestions } from "./questions";

type SetupFlowProps = {
  providerStatus: ProviderRuntimeStatus;
};

export function SetupFlow({ providerStatus }: SetupFlowProps) {
  const router = useRouter();
  const setup = useAppStore((state) => state.setupFlow);
  const answerChoiceQuestion = useAppStore((state) => state.answerChoiceQuestion);
  const setTextResponse = useAppStore((state) => state.setTextResponse);
  const setOmakaseFlag = useAppStore((state) => state.setOmakaseFlag);
  const setSetupStepIndex = useAppStore((state) => state.setSetupStepIndex);
  const submitSetup = useAppStore((state) => state.submitSetup);
  const resetSetupFlow = useAppStore((state) => state.resetSetupFlow);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const aiModeBlocker = getAiModeProviderBlocker(providerStatus);

  const currentQuestion = setupQuestions[setup.currentStepIndex];

  if (!currentQuestion) {
    return null;
  }

  const isFirstStep = setup.currentStepIndex === 0;
  const isLastStep = setup.currentStepIndex === setupQuestions.length - 1;
  const progress = ((setup.currentStepIndex + 1) / setupQuestions.length) * 100;
  const textOmakase =
    currentQuestion.kind === "text"
      ? (currentQuestion.id === "mainCharacterTraits"
          ? setup.omakaseFlags.mainCharacterTraits
          : setup.omakaseFlags.worldviewSpecs)
      : false;
  const textValue =
    currentQuestion.kind === "text"
      ? (currentQuestion.id === "mainCharacterTraits"
          ? setup.mainCharacterTraitsInput
          : setup.worldviewSpecsInput)
      : "";
  const currentStepReady =
    currentQuestion.kind === "choice"
      ? Boolean(setup.questionResponses[currentQuestion.id])
      : textOmakase || textValue.trim().length > 0;

  let previewProfile: ReturnType<typeof buildSetupProfile> | null = null;
  try {
    previewProfile = buildSetupProfile(setup);
  } catch {
    previewProfile = null;
  }

  return (
    <main className="vn-title-screen">
      <div className="vn-setup-wrap vn-fade-in">
        <header className="vn-title-head">
          <Link href="/" className="vn-title-sub">
            ← Title
          </Link>
          <div className="flex gap-2">
            <button type="button" onClick={resetSetupFlow} className="vn-btn">
              Reset
            </button>
          </div>
        </header>

        <div className="vn-setup-card">
          <div className="vn-setup-progress">
            <span>
              Step {setup.currentStepIndex + 1} of {setupQuestions.length}
            </span>
            <div className="vn-setup-progress-bar">
              <div
                className="vn-setup-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="vn-setup-kicker">Experimental AI Mode</p>
          <h1 className="vn-setup-title">{currentQuestion.title}</h1>
          <p className="vn-setup-prompt">{currentQuestion.prompt}</p>
          {aiModeBlocker.blocked || accessError ? (
            <div className="vn-setup-error" role="alert">
              {accessError ?? aiModeBlocker.message}
            </div>
          ) : null}

          {currentQuestion.kind === "choice" ? (
            <div className="vn-setup-options">
              {currentQuestion.options.map((option) => {
                const selected =
                  setup.questionResponses[currentQuestion.id] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      answerChoiceQuestion(currentQuestion.id, option.value)
                    }
                    className={`vn-setup-option ${
                      selected ? "vn-setup-option-selected" : ""
                    }`}
                  >
                    <span className="vn-setup-option-code">{option.value}</span>{" "}
                    <span className="vn-setup-option-label">{option.label}</span>{" "}
                    <span className="vn-setup-option-detail">{option.detail}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={textValue}
                maxLength={SETUP_TEXT_INPUT_MAX_LENGTH}
                onChange={(event) =>
                  setTextResponse(
                    currentQuestion.id === "mainCharacterTraits"
                      ? "mainCharacterTraitsInput"
                      : "worldviewSpecsInput",
                    event.target.value,
                  )
                }
                placeholder={currentQuestion.placeholder}
                disabled={textOmakase}
                className="vn-setup-field"
              />
              <div className="vn-setup-char-count">
                {textValue.length}/{SETUP_TEXT_INPUT_MAX_LENGTH}
              </div>
              <label className="vn-setup-omakase">
                <div>
                  <div className="vn-setup-omakase-label">
                    {currentQuestion.omakaseLabel}
                  </div>
                  <div className="vn-setup-omakase-detail">
                    Deterministic constrained fill, bound to selected vibe and
                    art direction.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={textOmakase}
                  onChange={(event) =>
                    setOmakaseFlag(currentQuestion.id, event.target.checked)
                  }
                  className="h-5 w-5 accent-[var(--accent)]"
                />
              </label>
            </div>
          )}

          <div className="vn-setup-nav">
            <button
              type="button"
              disabled={isFirstStep}
              onClick={() => setSetupStepIndex(setup.currentStepIndex - 1)}
              className="vn-btn"
            >
              Back
            </button>
            {!isLastStep ? (
              <button
                type="button"
                disabled={!currentStepReady}
                onClick={() => setSetupStepIndex(setup.currentStepIndex + 1)}
                className="vn-btn vn-btn-primary"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={!currentStepReady || !previewProfile || aiModeBlocker.blocked}
                onClick={() => {
                  if (aiModeBlocker.blocked) {
                    setAccessError(aiModeBlocker.message);
                    return;
                  }

                  try {
                    submitSetup();
                    router.push("/run");
                  } catch {
                    return;
                  }
                }}
                className="vn-btn vn-btn-primary"
              >
                Begin
              </button>
            )}
          </div>

          <details
            className="vn-setup-hint"
            open={previewOpen}
            onToggle={(event) =>
              setPreviewOpen((event.target as HTMLDetailsElement).open)
            }
          >
            <summary>Draft seed preview</summary>
            <div className="vn-setup-hint-body">
              {previewProfile ? (
                <>
                  <p>
                    <strong>Style:</strong> {previewProfile.seedStyle.tone}, romance{" "}
                    {previewProfile.seedStyle.romanceLevel}, mystery{" "}
                    {previewProfile.seedStyle.mysteryLevel}, tempo{" "}
                    {previewProfile.seedStyle.tempo}, surrealness{" "}
                    {previewProfile.seedStyle.surrealness}.
                  </p>
                  <p>
                    <strong>Art:</strong> {previewProfile.artDirection}.
                  </p>
                  <p>
                    <strong>Hints:</strong>{" "}
                    {[
                      previewProfile.protagonist[0],
                      previewProfile.premise[0],
                      previewProfile.relationshipSeed[0],
                    ]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </p>
                </>
              ) : (
                <p>Answer the required prompts to resolve the seed preview.</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </main>
  );
}
