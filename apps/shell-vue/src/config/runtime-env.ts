import type { FederletRuntimeEnvironment } from "@federlet/shared-types";
import { DEFAULT_APOLLO_RUNTIME_CONFIG } from "./apollo";
import { FEDERLET_GLOBAL_ENV_KEY } from "./constants";

type RuntimeEnvironmentTarget = {
  __FEDERLET_ENV__?: FederletRuntimeEnvironment;
};

export function createLocalRuntimeEnvironment(
  _runtimeEnv?: string,
): FederletRuntimeEnvironment {
  return DEFAULT_APOLLO_RUNTIME_CONFIG;
}

export function injectRuntimeEnvironment(
  target: RuntimeEnvironmentTarget,
  localRuntimeEnv: FederletRuntimeEnvironment = createLocalRuntimeEnvironment(),
) {
  target[FEDERLET_GLOBAL_ENV_KEY] = {
    ...localRuntimeEnv,
    ...target[FEDERLET_GLOBAL_ENV_KEY],
  };

  return target[FEDERLET_GLOBAL_ENV_KEY];
}

export function setupShellRuntimeEnvironment() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return injectRuntimeEnvironment(window);
}
