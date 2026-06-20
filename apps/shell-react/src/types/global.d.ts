import type { FederletRuntimeEnvironment } from "@federlet/shared-types";

declare global {
  interface Window {
    __FEDERLET_ENV__?: FederletRuntimeEnvironment;
  }
}

export {};
