"use client";

/* eslint-disable @next/next/no-img-element */

type StageCharacter = {
  assetClass: "character-sprite" | "placeholder";
  assetSource: "session-preview" | "manifest" | "placeholder";
  debugKey: string;
  emphasis: "primary" | "secondary";
  label: string;
  slot: "left" | "right";
  spriteUrl: string;
  subjectId: string;
};

type StageCharactersProps = {
  characters: StageCharacter[];
  isDefaultMode?: boolean;
};

function CharacterSlot({
  character,
  side,
}: {
  character: StageCharacter;
  side: "left" | "right";
}) {
  return (
    <div
      className={`vn-character-slot vn-character-slot--${character.emphasis} ${
        side === "left" ? "vn-character-slot--left" : "vn-character-slot--right"
      }`}
    >
      <img
        src={character.spriteUrl}
        alt={character.label}
        className="vn-character-portrait"
        data-asset-class={character.assetClass}
        data-asset-key={character.debugKey}
        data-asset-source={character.assetSource}
        data-slot={character.slot}
        data-subject-id={character.subjectId}
      />
      <span className="vn-character-label">{character.label}</span>
    </div>
  );
}

export function StageCharacters({ characters, isDefaultMode }: StageCharactersProps) {
  if (characters.length === 0) {
    return null;
  }

  const leftCharacter =
    characters.find((character) => character.slot === "left") ?? null;
  const rightCharacter =
    characters.find((character) => character.slot === "right") ?? null;

  return (
    <div
      className={`vn-character-stage${isDefaultMode ? " vn-character-stage--default" : ""}`}
      aria-hidden={characters.length === 0}
    >
      <div className="vn-character-slot-wrap">
        {leftCharacter ? (
          <CharacterSlot character={leftCharacter} side="left" />
        ) : (
          <span />
        )}
      </div>
      <div className="vn-character-slot-wrap">
        {rightCharacter ? (
          <CharacterSlot character={rightCharacter} side="right" />
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

export type { StageCharacter };
