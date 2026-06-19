import { loadRemote } from "@module-federation/enhanced/runtime";
import type {
  MicroAppContext,
  MicroAppInstance,
  RemoteMountModule,
  RemoteRouteConfig,
} from "@federlet/shared-types";

/**
 * 远程模块加载器。
 */
export type RemoteModuleLoader = (
  moduleName: string,
) => Promise<unknown> | unknown;

/**
 * 远程应用加载错误代码。
 */
export enum RemoteLoadErrorCode {
  /**
   * 远程应用加载超时。
   */
  Timeout = "remote-load-timeout",
  /**
   * 远程应用加载失败。
   */
  LoadFailed = "remote-load-failed",
  /**
   * 远程应用协议错误。
   */
  ProtocolError = "remote-protocol-error",
  /**
   * 远程应用挂载失败。
   */
  MountFailed = "remote-mount-failed",
  /**
   * 远程应用熔断打开。
   */
  CircuitOpen = "remote-circuit-open",
}

/**
 * 远程应用加载错误选项。
 */
interface RemoteLoadErrorOptions {
  /**
   * 错误代码。
   */
  code: RemoteLoadErrorCode;
  /**
   * 错误消息。
   */
  message: string;
  /**
   * 远程应用名称。
   */
  remoteName: string;
  /**
   * 错误原因。
   */
  cause?: unknown;
}

/**
 * 远程应用加载错误。
 */
export class RemoteLoadError extends Error {
  readonly code: RemoteLoadErrorCode;
  readonly remoteName: string;
  override readonly cause?: unknown;

  constructor({ cause, code, message, remoteName }: RemoteLoadErrorOptions) {
    super(message);
    this.name = "RemoteLoadError";
    this.cause = cause;
    this.code = code;
    this.remoteName = remoteName;
  }
}

/**
 * 远程应用重试选项。
 */
export interface RemoteRetryOptions {
  maxAttempts?: number;
  backoffBaseMs?: number;
  delay?: (ms: number) => Promise<void>;
}

/**
 * 远程应用加载选项。
 */
export interface RemoteLoadOptions {
  circuitBreaker?: RemoteCircuitBreakerOptions | false;
  timeoutMs?: number;
  retry?: RemoteRetryOptions | false;
}

/**
 * 远程应用熔断状态。
 */
export type RemoteCircuitStatus = "closed" | "open";

/**
 * 远程应用熔断快照。
 */
export interface RemoteCircuitSnapshot {
  failureCount: number;
  openedAt?: number;
  status: RemoteCircuitStatus;
}

/**
 * 远程应用熔断器存储。
 */
export interface RemoteCircuitBreakerStore {
  canAttempt(remoteName: string, cooldownMs: number): boolean;
  getSnapshot(remoteName: string): RemoteCircuitSnapshot;
  recordFailure(remoteName: string, failureThreshold: number): void;
  recordSuccess(remoteName: string): void;
}

/**
 * 远程应用熔断器选项。
 */
export interface RemoteCircuitBreakerOptions {
  cooldownMs?: number;
  failureThreshold?: number;
  store?: RemoteCircuitBreakerStore;
}

/**
 * 默认远程应用加载超时时间。
 */
const DEFAULT_REMOTE_LOAD_TIMEOUT_MS = 8000;
/**
 * 默认远程应用重试最大次数。
 */
const DEFAULT_REMOTE_RETRY_MAX_ATTEMPTS = 3;
/**
 * 默认远程应用重试回退基础时间。
 */
const DEFAULT_REMOTE_RETRY_BACKOFF_BASE_MS = 300;
/**
 * 默认远程应用熔断失败阈值。
 */
const DEFAULT_REMOTE_CIRCUIT_FAILURE_THRESHOLD = 3;
/**
 * 默认远程应用熔断冷却时间。
 */
const DEFAULT_REMOTE_CIRCUIT_COOLDOWN_MS = 30_000;

/**
 * 默认远程应用重试延迟。
 */
function defaultDelay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * 创建远程应用加载错误。
 */
function createRemoteLoadError(
  code: RemoteLoadErrorCode,
  message: string,
  route: RemoteRouteConfig,
  cause?: unknown,
) {
  return new RemoteLoadError({
    cause,
    code,
    message,
    remoteName: route.remoteName,
  });
}

/**
 * 是否可重试远程应用加载错误。
 */
function isRetryableRemoteLoadError(error: unknown) {
  return (
    error instanceof RemoteLoadError &&
    (error.code === RemoteLoadErrorCode.LoadFailed ||
      error.code === RemoteLoadErrorCode.Timeout)
  );
}

/**
 * 创建远程应用熔断器存储。
 */
export function createCircuitBreakerStore(
  now: () => number = () => Date.now(),
): RemoteCircuitBreakerStore {
  const circuits = new Map<
    string,
    {
      failureCount: number;
      openedAt?: number;
    }
  >();

  return {
    /**
     * 是否可尝试远程应用加载。
     */
    canAttempt(remoteName, cooldownMs) {
      const circuit = circuits.get(remoteName);

      if (!circuit?.openedAt) {
        return true;
      }

      if (now() - circuit.openedAt >= cooldownMs) {
        circuits.delete(remoteName);
        return true;
      }

      return false;
    },

    /**
     * 获取远程应用熔断器快照。
     */
    getSnapshot(remoteName) {
      const circuit = circuits.get(remoteName);

      if (!circuit) {
        return {
          failureCount: 0,
          status: "closed",
        };
      }

      return {
        failureCount: circuit.failureCount,
        openedAt: circuit.openedAt,
        status: circuit.openedAt ? "open" : "closed",
      };
    },
    /**
     * 记录远程应用加载失败。
     */
    recordFailure(remoteName, failureThreshold) {
      const current = circuits.get(remoteName);
      const failureCount = (current?.failureCount ?? 0) + 1;

      circuits.set(remoteName, {
        failureCount,
        openedAt:
          failureCount >= failureThreshold ? current?.openedAt ?? now() : undefined,
      });
    },
    /**
     * 记录远程应用加载成功。
     */
    recordSuccess(remoteName) {
      circuits.delete(remoteName);
    },
  };
}

/**
 * 默认远程应用熔断器存储。
 */
const defaultCircuitBreakerStore = createCircuitBreakerStore();

/**
 * 在超时时间内执行操作。
 * @param operation - 操作。
 * @param timeoutMs - 超时时间。
 * @param route - 远程应用路由配置。
 * @returns 操作结果。
 */
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  route: RemoteRouteConfig,
): Promise<T> {
  let timeoutId: number | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(
        createRemoteLoadError(
          RemoteLoadErrorCode.Timeout,
          `Remote ${route.remoteName} loading timed out after ${timeoutMs}ms.`,
          route,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

/**
 * 使用策略加载远程模块。
 * @param moduleName - 模块名称。
 * @param route - 远程应用路由配置。
 * @param loader - 远程模块加载器。
 * @param options - 远程应用加载选项。
 * @returns 远程模块。
 */
async function loadRemoteModuleWithPolicy(
  moduleName: string,
  route: RemoteRouteConfig,
  loader: RemoteModuleLoader,
  options: RemoteLoadOptions,
) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REMOTE_LOAD_TIMEOUT_MS;
  const retryOptions = options.retry ?? {};
  const maxAttempts =
    retryOptions === false
      ? 1
      : retryOptions.maxAttempts ?? DEFAULT_REMOTE_RETRY_MAX_ATTEMPTS;
  const backoffBaseMs =
    retryOptions === false
      ? 0
      : retryOptions.backoffBaseMs ?? DEFAULT_REMOTE_RETRY_BACKOFF_BASE_MS;
  const delay =
    retryOptions === false ? defaultDelay : retryOptions.delay ?? defaultDelay;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await withTimeout(
        Promise.resolve(loader(moduleName)).catch((error: unknown) => {
          throw createRemoteLoadError(
            RemoteLoadErrorCode.LoadFailed,
            `Remote ${moduleName} failed to load.`,
            route,
            error,
          );
        }),
        timeoutMs,
        route,
      );
    } catch (error) {
      lastError = error;

      if (!isRetryableRemoteLoadError(error) || attempt >= maxAttempts) {
        throw error;
      }

      await delay(backoffBaseMs * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

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
  options: RemoteLoadOptions = {},
): Promise<MicroAppInstance> {
  const moduleName = `${route.remoteName}/${normalizeExposedModule(
    route.exposedModule,
  )}`;
  const circuitOptions = options.circuitBreaker ?? {};
  const circuitStore =
    circuitOptions === false
      ? undefined
      : circuitOptions.store ?? defaultCircuitBreakerStore;
  const circuitCooldownMs =
    circuitOptions === false
      ? DEFAULT_REMOTE_CIRCUIT_COOLDOWN_MS
      : circuitOptions.cooldownMs ?? DEFAULT_REMOTE_CIRCUIT_COOLDOWN_MS;
  const circuitFailureThreshold =
    circuitOptions === false
      ? DEFAULT_REMOTE_CIRCUIT_FAILURE_THRESHOLD
      : circuitOptions.failureThreshold ?? DEFAULT_REMOTE_CIRCUIT_FAILURE_THRESHOLD;

  if (circuitStore && !circuitStore.canAttempt(route.remoteName, circuitCooldownMs)) {
    throw createRemoteLoadError(
      RemoteLoadErrorCode.CircuitOpen,
      `Remote ${route.remoteName} is temporarily unavailable.`,
      route,
    );
  }

  try {
    const remoteModule = (await loadRemoteModuleWithPolicy(
      moduleName,
      route,
      loader,
      options,
    )) as Partial<RemoteMountModule>;

    // 在真正调用 remote 前做协议校验，避免把不完整模块挂进 Shell。
    if (typeof remoteModule.mount !== "function") {
      throw createRemoteLoadError(
        RemoteLoadErrorCode.ProtocolError,
        `Remote ${moduleName} does not expose a mount function.`,
        route,
      );
    }

    const instance = await remoteModule.mount(context);
    circuitStore?.recordSuccess(route.remoteName);
    return instance;
  } catch (error) {
    const remoteError =
      error instanceof RemoteLoadError
        ? error
        : createRemoteLoadError(
            RemoteLoadErrorCode.MountFailed,
            `Remote ${moduleName} failed during mount.`,
            route,
            error,
          );

    circuitStore?.recordFailure(route.remoteName, circuitFailureThreshold);
    throw remoteError;
  }
}
