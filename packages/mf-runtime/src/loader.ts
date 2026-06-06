import { loadRemote } from "@module-federation/enhanced/runtime";
import type {
  MicroAppContext,
  MicroAppInstance,
  RemoteMountModule,
  RemoteRouteConfig,
} from "@federlet/shared-types";

export type RemoteModuleLoader = (
  moduleName: string,
) => Promise<unknown> | unknown;

/**
 * 标准化 remote 暴露模块名。
 *
 * Module Federation 运行时加载模块时使用 `remote/module` 格式，
 * 因此这里会把配置中常见的 `./mount` 转成 `mount`。
 */
export function normalizeExposedModule(exposedModule: string): string {
  return exposedModule.replace(/^\.\//, "");
}

/**
 * 使用 Module Federation runtime 加载远程模块。
 *
 * @throws 当 remoteEntry 已加载但指定模块不存在或返回空值时抛出错误。
 */
export async function defaultRemoteLoader(
  moduleName: string,
): Promise<RemoteMountModule> {
  const remoteModule = await loadRemote<RemoteMountModule>(moduleName);

  if (!remoteModule) {
    throw new Error(`Remote ${moduleName} could not be loaded.`);
  }

  return remoteModule;
}

/**
 * 根据 Shell 路由配置加载并挂载一个 remote 应用。
 *
 * 这个函数只依赖统一的 `mount(context)` 协议，不关心 remote 内部使用
 * React、Vue 还是其他框架。
 *
 * @throws 当 remote 模块没有导出合法的 `mount` 函数时抛出错误。
 */
export async function mountRemoteApp(
  route: RemoteRouteConfig,
  context: MicroAppContext,
  loader: RemoteModuleLoader = defaultRemoteLoader,
): Promise<MicroAppInstance> {
  const moduleName = `${route.remoteName}/${normalizeExposedModule(
    route.exposedModule,
  )}`;
  const remoteModule = (await loader(moduleName)) as Partial<RemoteMountModule>;

  // 在真正调用 remote 前做协议校验，避免把不完整模块挂进 Shell。
  if (typeof remoteModule.mount !== "function") {
    throw new Error(`Remote ${moduleName} does not expose a mount function.`);
  }

  return remoteModule.mount(context);
}
