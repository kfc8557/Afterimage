import {
  buildProviderRuntimeStatus,
  readProviderRuntimeConfig,
} from "@/features/run/providers/providerRuntimeConfig";
import { NewGameModeScreen } from "@/features/new-game/NewGameModeScreen";

export default function NewGamePage() {
  return (
    <NewGameModeScreen
      providerStatus={buildProviderRuntimeStatus(readProviderRuntimeConfig())}
    />
  );
}
