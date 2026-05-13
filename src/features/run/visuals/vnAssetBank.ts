export type VnAssetClass =
  | "background"
  | "character-sprite"
  | "event-cg"
  | "placeholder";

export type VnBankAsset = {
  id: string;
  assetClass: VnAssetClass;
  assetUrl: string;
  tags: string[];
  artDirectionTags: string[];
  characterId: string | null;
  locationId: string | null;
  priority: number;
  licenseNote: string;
};

const vnBankManifest = [
  {
    id: "css-stage-background",
    assetClass: "background",
    assetUrl: "",
    tags: ["fallback", "stage", "css-only"],
    artDirectionTags: ["neutral"],
    characterId: null,
    locationId: "css-stage-background",
    priority: 0,
    licenseNote: "CSS-only fallback; no default bitmap is used.",
  },
  {
    id: "default-silhouette-sprite",
    assetClass: "placeholder",
    assetUrl: "/vn-bank/sprites/silhouette.svg",
    tags: ["fallback", "character-sprite", "silhouette"],
    artDirectionTags: ["neutral"],
    characterId: null,
    locationId: null,
    priority: 0,
    licenseNote: "App-owned procedural SVG fallback.",
  },
] as const satisfies VnBankAsset[];

export function resolveDefaultBackgroundAsset() {
  return vnBankManifest.find((asset) => asset.assetClass === "background")!;
}

export function resolveDefaultSilhouetteSpriteAsset() {
  return vnBankManifest.find(
    (asset) =>
      asset.assetClass === "placeholder" &&
      asset.tags.includes("character-sprite"),
  )!;
}

export function listVnBankAssets(): VnBankAsset[] {
  return [...vnBankManifest];
}
