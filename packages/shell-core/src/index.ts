import {
  federletLogger,
  preloadRemoteApp,
  RemoteLoadErrorCode,
  type RemoteLoadOptions,
  type RemoteModuleLoader,
} from "@federlet/mf-runtime";
import { createRemoteContainerClassName as createScopedRemoteContainerClassName } from "@federlet/style-isolation";
import type {
  MicroAppInstance,
  RemoteRouteConfig,
} from "@federlet/shared-types";
import type { RemoteDomEscapeIssue } from "@federlet/style-isolation";

/**
 * remote 应用状态。
 */
export type RemoteAppStatus = "loading" | "ready" | "error";

/**
 * 创建挂载上下文参数。
 */
export interface CreateMountContextArgs {
  /** remote 应用需要渲染到的 DOM 容器。 */
  container: HTMLElement;
  /** 路由配置。 */
  route: RemoteRouteConfig;
}

/**
 * remote 错误消息覆盖。
 */
export interface RemoteErrorMessageOverrides
  extends Partial<Record<RemoteLoadErrorCode, string>> {
  default?: string;
}

/**
 * remote 错误详情。
 */
export interface RemoteErrorDetails {
  /** 错误代码。 */
  code?: string;
  /** 原始 cause 错误详情。 */
  cause?: RemoteErrorDetails;
  /** 错误消息。 */
  message: string;
  /** 错误名称。 */
  name?: string;
  /** remote 名称。 */
  remoteName?: string;
  /** 错误堆栈。 */
  stack?: string;
}

/**
 * remote 应用边界渲染状态。
 */
export interface RemoteAppBoundaryRenderState {
  /** 错误信息。 */
  error: unknown;
  /** 错误详情。 */
  errorDetails: RemoteErrorDetails;
  /** 错误消息。 */
  errorMessage: string;
  /** 重试函数。 */
  retry: () => void;
  /** 路由配置。 */
  route: RemoteRouteConfig;
  /** 应用状态。 */
  status: RemoteAppStatus;
}

/**
 * 创建远程预加载器选项。
 */
export interface CreateRemotePreloaderOptions {
  /** 加载选项。 */
  loadOptions?: RemoteLoadOptions;
  /** 模块加载器。 */
  loader?: RemoteModuleLoader;
}

/**
 * 远程预加载器。
 */
export interface RemotePreloader {
  /** 预加载远程应用。 */
  preload: (route: RemoteRouteConfig) => Promise<void>;
}

/**
 * 默认远程加载选项。
 */
export const DEFAULT_REMOTE_LOAD_OPTIONS: RemoteLoadOptions = {
  circuitBreaker: {
    cooldownMs: 30_000,
    failureThreshold: 3,
  },
  retry: {
    backoffBaseMs: 300,
    maxAttempts: 3,
  },
  timeoutMs: 8000,
};

/**
 * 合并远程加载选项。
 * @param loadOptions - 加载选项。
 * @returns 合并后的加载选项。
 */
export function mergeRemoteLoadOptions(
  loadOptions: RemoteLoadOptions | undefined,
): RemoteLoadOptions {
  if (!loadOptions) {
    return DEFAULT_REMOTE_LOAD_OPTIONS;
  }

  return {
    ...DEFAULT_REMOTE_LOAD_OPTIONS,
    ...loadOptions,
    circuitBreaker:
      loadOptions.circuitBreaker === false
        ? false
        : {
            ...(DEFAULT_REMOTE_LOAD_OPTIONS.circuitBreaker === false
              ? {}
              : DEFAULT_REMOTE_LOAD_OPTIONS.circuitBreaker),
            ...(loadOptions.circuitBreaker ?? {}),
          },
    retry:
      loadOptions.retry === false
        ? false
        : {
            ...(DEFAULT_REMOTE_LOAD_OPTIONS.retry === false
              ? {}
              : DEFAULT_REMOTE_LOAD_OPTIONS.retry),
            ...(loadOptions.retry ?? {}),
          },
  };
}

/**
 * 获取远程加载错误代码。
 * @param error - 错误信息。
 * @returns 远程加载错误代码。
 */
function getRemoteLoadErrorCode(
  error: unknown,
): RemoteLoadErrorCode | undefined {
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    typeof error.code !== "string"
  ) {
    return undefined;
  }

  return error.code as RemoteLoadErrorCode;
}

/**
 * 获取错误字符串属性。
 * @param error - 错误信息。
 * @param property - 属性名称。
 * @returns 属性值。
 */
function getStringProperty(error: object, property: string) {
  if (!(property in error)) {
    return undefined;
  }

  const value = error[property as keyof typeof error];

  return typeof value === "string" ? value : undefined;
}

/**
 * 获取错误 cause。
 * @param error - 错误信息。
 * @returns cause。
 */
function getCause(error: object) {
  if (!("cause" in error)) {
    return undefined;
  }

  return error.cause;
}

/**
 * 创建远程错误详情。
 * @param error - 错误信息。
 * @returns 可渲染的远程错误详情。
 */
export function createRemoteErrorDetails(error: unknown): RemoteErrorDetails {
  if (error instanceof Error) {
    const cause = getCause(error);

    return {
      cause: cause === undefined ? undefined : createRemoteErrorDetails(cause),
      code: getStringProperty(error, "code"),
      message: error.message,
      name: error.name,
      remoteName: getStringProperty(error, "remoteName"),
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    const cause = getCause(error);

    return {
      cause: cause === undefined ? undefined : createRemoteErrorDetails(cause),
      code: getStringProperty(error, "code"),
      message: getStringProperty(error, "message") ?? String(error),
      name: getStringProperty(error, "name"),
      remoteName: getStringProperty(error, "remoteName"),
      stack: getStringProperty(error, "stack"),
    };
  }

  return {
    message: String(error),
  };
}

/**
 * 格式化远程错误详情。
 * @param details - 远程错误详情。
 * @returns 可直接渲染到 pre 的错误详情文本。
 */
export function formatRemoteErrorDetails(details: RemoteErrorDetails): string {
  const lines: string[] = [];
  const title = details.name
    ? `${details.name}: ${details.message}`
    : details.message;

  lines.push(title);

  if (details.code) {
    lines.push(`Code: ${details.code}`);
  }

  if (details.remoteName) {
    lines.push(`Remote: ${details.remoteName}`);
  }

  if (details.stack) {
    lines.push("", "Stack:", details.stack);
  }

  if (details.cause) {
    lines.push("", "Caused by:", formatRemoteErrorDetails(details.cause));
  }

  return lines.join("\n");
}

/**
 * 创建远程错误消息。
 * @param error - 错误信息。
 * @param messages - 错误消息覆盖。
 * @returns 远程错误消息。
 */
export function createRemoteErrorMessage(
  error: unknown,
  messages: RemoteErrorMessageOverrides = {},
) {
  const code = getRemoteLoadErrorCode(error);

  if (code && messages[code]) {
    return messages[code];
  }

  switch (code) {
    case RemoteLoadErrorCode.Timeout:
      return "Remote app loading timed out.";
    case RemoteLoadErrorCode.LoadFailed:
      return "Remote app failed to load after retries.";
    case RemoteLoadErrorCode.CircuitOpen:
      return "Remote app is temporarily degraded.";
    case RemoteLoadErrorCode.ProtocolError:
      return "Remote app contract is incompatible.";
    case RemoteLoadErrorCode.MountFailed:
      return "Remote app failed during mount.";
    default:
      return messages.default ?? "Remote app is unavailable.";
  }
}

/**
 * 报告远程 DOM 逃逸。
 * @param issues - 逃逸问题。
 */
export function reportRemoteDomEscapes(issues: RemoteDomEscapeIssue[]) {
  for (const issue of issues) {
    federletLogger.error({
      context: {
        issue,
      },
      event: "remote.dom.escape",
      message: "Remote created DOM outside its container",
      remoteName: issue.remoteName,
      scope: "shell-core",
    });
  }
}

/**
 * 计划远程卸载。
 * @param instance - 远程应用实例。
 * @param afterUnmount - 卸载后回调。
 */
export function scheduleRemoteUnmount(
  instance: MicroAppInstance | null,
  afterUnmount?: () => void,
) {
  if (!instance) {
    afterUnmount?.();
    return;
  }

  window.setTimeout(() => {
    void Promise.resolve(instance.unmount())
      .catch((error: unknown) => {
        federletLogger.error({
          error,
          event: "remote.unmount.failed",
          message: "Failed to unmount remote app",
          scope: "shell-core",
        });
      })
      .finally(() => {
        afterUnmount?.();
      });
  }, 0);
}

/**
 * 创建远程容器类名。
 * @param remoteName - 远程应用名称。
 * @returns 远程容器类名。
 */
export function createRemoteContainerClassName(remoteName: string) {
  return createScopedRemoteContainerClassName(
    "remote-boundary__container",
    remoteName,
  );
}

/**
 * 创建远程预加载键。
 * @param route - 路由配置。
 * @returns 远程预加载键。
 */
function createRemotePreloadKey(route: RemoteRouteConfig) {
  return `${route.remoteName}/${route.exposedModule}`;
}

/**
 * 创建远程预加载器。
 * @param loader - 模块加载器。
 * @param loadOptions - 加载选项。
 * @returns 远程预加载器。
 */
export function createRemotePreloader({
  loader,
  loadOptions,
}: CreateRemotePreloaderOptions = {}): RemotePreloader {
  const preloads = new Map<string, Promise<void>>();

  return {
    preload(route) {
      const key = createRemotePreloadKey(route);
      const existingPreload = preloads.get(key);

      if (existingPreload) {
        return existingPreload;
      }

      const preload = preloadRemoteApp(route, loader, loadOptions).catch(
        (error: unknown) => {
          preloads.delete(key);
          throw error;
        },
      );
      preloads.set(key, preload);

      return preload;
    },
  };
}
