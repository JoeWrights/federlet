import {
  registerRemoteInApolloConfig,
  type RegisterRemoteOptions,
} from "../utils/manifest.js";

export async function registerRemote(options: RegisterRemoteOptions) {
  await registerRemoteInApolloConfig(options);
}
