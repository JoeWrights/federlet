import { loadRemote } from "@module-federation/enhanced/runtime";
import type { RuntimeRemoteComponent } from "@federlet/shared-types";
import {
  runtimeRemoteRegistry,
  type RuntimeRemoteRegistry,
} from "./remote-registry";

export interface RemoteComponentDiscoveryOptions {
  /** 运行时 remote 注册中心；测试或多实例 Shell 可注入自定义 registry。 */
  registry?: RuntimeRemoteRegistry;
}

export type RemoteComponentLoader = (
  moduleName: string,
) => Promise<unknown> | unknown;

function resolveRegistry(options: RemoteComponentDiscoveryOptions = {}) {
  return options.registry ?? runtimeRemoteRegistry;
}

/**
 * 使用 Module Federation runtime 加载组件模块。
 */
export async function defaultRemoteComponentLoader(
  moduleName: string,
): Promise<unknown> {
  const remoteModule = await loadRemote(moduleName);

  if (!remoteModule) {
    throw new Error(`Remote component module ${moduleName} could not be loaded.`);
  }

  return remoteModule;
}

/**
 * 列出当前 registry 中已声明的组件。
 */
export function listRemoteComponents(
  options: RemoteComponentDiscoveryOptions = {},
): RuntimeRemoteComponent[] {
  return resolveRegistry(options).listComponents();
}

/**
 * 按 remoteName + 组件名查找组件。
 */
export function getRemoteComponent(
  remoteName: string,
  componentName: string,
  options: RemoteComponentDiscoveryOptions = {},
): RuntimeRemoteComponent | undefined {
  return resolveRegistry(options).getComponent(remoteName, componentName);
}

/**
 * 按 manifest 声明的组件名加载远程组件模块。
 */
export async function loadRemoteComponent<TModule = unknown>(
  remoteName: string,
  componentName: string,
  loader: RemoteComponentLoader = defaultRemoteComponentLoader,
  options: RemoteComponentDiscoveryOptions = {},
): Promise<TModule> {
  const component = getRemoteComponent(remoteName, componentName, options);

  if (!component) {
    throw new Error(
      `Remote component ${remoteName}/${componentName} is not registered.`,
    );
  }

  const remoteModule = await loader(component.moduleName);

  if (!remoteModule) {
    throw new Error(
      `Remote component module ${component.moduleName} could not be loaded.`,
    );
  }

  return remoteModule as TModule;
}
