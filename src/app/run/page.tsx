import {
  buildProviderRuntimeStatus,
  readProviderRuntimeConfig,
} from "@/features/run/providers/providerRuntimeConfig";
import { RunShellScreen } from "@/features/run/RunShellScreen";

export default function RunPage() {
  const debugAllowed =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_DEBUGGER === "1";

  return (
    <RunShellScreen
      debugAllowed={debugAllowed}
      providerStatus={buildProviderRuntimeStatus(readProviderRuntimeConfig())}
    />
  );
}
