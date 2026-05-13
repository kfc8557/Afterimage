import {
  buildProviderRuntimeStatus,
  readProviderRuntimeConfig,
} from "@/features/run/providers/providerRuntimeConfig";
import { SetupFlow } from "@/features/setup/SetupFlow";

export default function SetupPage() {
  return (
    <SetupFlow
      providerStatus={buildProviderRuntimeStatus(readProviderRuntimeConfig())}
    />
  );
}
