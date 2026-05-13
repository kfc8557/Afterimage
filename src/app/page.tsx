import {
  buildProviderRuntimeStatus,
  readProviderRuntimeConfig,
} from "@/features/run/providers/providerRuntimeConfig";
import { HomeScreen } from "@/features/home/HomeScreen";

export default function HomePage() {
  return (
    <HomeScreen providerStatus={buildProviderRuntimeStatus(readProviderRuntimeConfig())} />
  );
}
