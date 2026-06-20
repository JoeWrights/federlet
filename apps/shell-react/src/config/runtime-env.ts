import type { FederletRuntimeEnvironment } from "@federlet/shared-types";
import { DEFAULT_APOLLO_RUNTIME_CONFIG } from "./apollo";
import { FEDERLET_GLOBAL_ENV_KEY } from "./constants";

/**
 * 运行时环境目标。
 */
type RuntimeEnvironmentTarget = {
  __FEDERLET_ENV__?: FederletRuntimeEnvironment;
};

/**
 * 创建本地运行时环境。
 * @param _runtimeEnv - 运行时环境。
 * @returns 运行时环境。
 */
export function createLocalRuntimeEnvironment(
  _runtimeEnv?: string,
): FederletRuntimeEnvironment {
  return DEFAULT_APOLLO_RUNTIME_CONFIG;
}

/**
 * 注入运行时环境。
 * @param target - 目标。
 * @param localRuntimeEnv - 本地运行时环境。
 * @returns 运行时环境。
 */
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

/**
 * 设置 Shell 运行时环境。
 * @returns 运行时环境。
 */
export function setupShellRuntimeEnvironment() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return injectRuntimeEnvironment(window);
}
