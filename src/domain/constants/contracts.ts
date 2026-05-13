// This is the current schema-enforced beta cap. If deployment-specific overrides
// are needed later, the runtime override must stay <= this value until schemas split.
export const RECENT_WAVES_DEFAULT_MAX = 6;

export const CONCLUSION_PRESSURE_MIN = 0.0;
export const CONCLUSION_PRESSURE_MAX = 1.0;
export const CONCLUSION_PRESSURE_DELTA_MAX = 0.25;

export const CHOICES_MIN = 2;
export const CHOICES_MAX = 4;

export const STYLE_VALUE_MIN = 0.0;
export const STYLE_VALUE_MAX = 1.0;

export const STATE_DELTA_MIN = -1.0;
export const STATE_DELTA_MAX = 1.0;

export const STORY_CHECKPOINT_SCHEMA_VERSION = 1;

export const SETUP_TEXT_INPUT_MAX_LENGTH = 600;
export const SETUP_SEED_TEXT_ARRAY_MAX = 8;
export const SETUP_SEED_TEXT_ENTRY_MAX_LENGTH = 160;
export const SETUP_VIBE_MAX_LENGTH = 160;
export const QUESTIONNAIRE_ANSWER_VALUE_MAX_LENGTH = 80;
