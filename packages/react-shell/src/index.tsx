import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  mountRemoteApp,
  preloadRemoteApp,
  RemoteLoadErrorCode,
} from "@federlet/mf-runtime";
import {
  captureRemoteDomSnapshot,
  createRemoteContainerClassName as createScopedRemoteContainerClassName,
  detectRemoteDomEscapes,
} from "@federlet/style-isolation";
import type { ReactNode } from "react";
import type {
  RemoteLoadOptions,
  RemoteModuleLoader,
} from "@federlet/mf-runtime";
import type {
  MicroAppContext,
  MicroAppInstance,
  RemoteRouteConfig,
} from "@federlet/shared-types";
import type {
  RemoteDomEscapeIssue,
  RemoteDomSnapshot,
} from "@federlet/style-isolation";

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
  /** Shell 内部使用的稳定路由 id。 */
  route: RemoteRouteConfig;
}

/**
 * 远程错误消息覆盖。
 */
export interface RemoteErrorMessageOverrides extends Partial<
  Record<RemoteLoadErrorCode, string>
> {
  default?: string;
}

/**
 * remote 应用边界渲染状态。
 */
export interface RemoteAppBoundaryRenderState {
  /** 错误信息。 */
  error: unknown;
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
 * remote 应用边界属性。
 */
export interface RemoteAppBoundaryProps {
  /** 创建挂载上下文函数。 */
  createMountContext?: (args: CreateMountContextArgs) => MicroAppContext;
  /** 是否启用 DOM 逃逸诊断。 */
  enableDomEscapeDiagnostics?: boolean;
  /** 加载选项。 */
  loadOptions?: RemoteLoadOptions;
  /** 模块加载器。 */
  loader?: RemoteModuleLoader;
  /** 错误消息覆盖。 */
  messages?: RemoteErrorMessageOverrides;
  /** 错误处理函数。 */
  onError?: (error: unknown, route: RemoteRouteConfig) => void;
  /** 状态变化处理函数。 */
  onStatusChange?: (status: RemoteAppStatus, route: RemoteRouteConfig) => void;
  /** 错误渲染函数。 */
  renderError?: (state: RemoteAppBoundaryRenderState) => ReactNode;
  /** 加载中渲染函数。 */
  renderLoading?: (state: RemoteAppBoundaryRenderState) => ReactNode;
  /** 路由配置。 */
  route: RemoteRouteConfig;
}

/**
 * 使用远程应用挂载选项。
 */
export interface UseRemoteAppMountOptions extends Omit<
  RemoteAppBoundaryProps,
  "renderError" | "renderLoading"
> {}

/**
 * 使用远程应用挂载结果。
 */
export interface UseRemoteAppMountResult {
  /** 容器类名。 */
  containerClassName: string;
  /** 容器引用。 */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 错误信息。 */
  error: unknown;
  /** 错误消息。 */
  errorMessage: string;
  /** 重试函数。 */
  retry: () => void;
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
 * 是否报告远程 DOM 逃逸。
 * @param enableDomEscapeDiagnostics - 是否启用 DOM 逃逸诊断。
 */
function shouldReportRemoteDomEscapes(enableDomEscapeDiagnostics?: boolean) {
  if (enableDomEscapeDiagnostics !== undefined) {
    return enableDomEscapeDiagnostics;
  }

  return process.env.NODE_ENV !== "production";
}

/**
 * 合并远程加载选项。
 * @param loadOptions - 加载选项。
 * @returns 合并后的加载选项。
 */
function mergeRemoteLoadOptions(
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
    console.error(
      `Remote ${issue.remoteName} created DOM outside its container during ${issue.phase}`,
      issue,
    );
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
        console.error("Failed to unmount remote app", error);
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

/**
 * 创建默认挂载上下文。
 * @param args - 创建挂载上下文参数。
 * @returns 默认挂载上下文。
 */
function createDefaultMountContext({
  container,
  route,
}: CreateMountContextArgs): MicroAppContext {
  return {
    basename: route.basename,
    container,
    props: {
      mountedAt: new Date().toISOString(),
    },
  };
}

/**
 * 使用远程应用挂载。
 * @param options - 使用远程应用挂载选项。
 * @returns 使用远程应用挂载结果。
 */
export function useRemoteAppMount({
  createMountContext = createDefaultMountContext,
  enableDomEscapeDiagnostics,
  loadOptions,
  loader,
  messages,
  onError,
  onStatusChange,
  route,
}: UseRemoteAppMountOptions): UseRemoteAppMountResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<MicroAppInstance | null>(null);
  const domSnapshotRef = useRef<RemoteDomSnapshot | null>(null);
  const [status, setStatus] = useState<RemoteAppStatus>("loading");
  const [error, setError] = useState<unknown>(null);
  const [retryKey, setRetryKey] = useState(0);
  const resolvedLoadOptions = useMemo(
    () => mergeRemoteLoadOptions(loadOptions),
    [loadOptions],
  );

  const updateStatus = useCallback(
    (nextStatus: RemoteAppStatus) => {
      setStatus(nextStatus);
      onStatusChange?.(nextStatus, route);
    },
    [onStatusChange, route],
  );
  const retry = useCallback(() => {
    setRetryKey((key) => key + 1);
  }, []);
  const shouldReportDomEscapes = shouldReportRemoteDomEscapes(
    enableDomEscapeDiagnostics,
  );
  const handleRemoteRuntimeError = useCallback(
    (runtimeError: unknown) => {
      console.error(
        `Remote ${route.remoteName} reported a runtime error`,
        runtimeError,
      );
      onError?.(runtimeError, route);

      const instance = instanceRef.current;
      instanceRef.current = null;

      setError(runtimeError);
      updateStatus("error");
      scheduleRemoteUnmount(instance);
    },
    [onError, route, updateStatus],
  );

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      setError(null);
      updateStatus("loading");

      try {
        const domSnapshot = shouldReportDomEscapes
          ? captureRemoteDomSnapshot({
              container,
            })
          : null;
        domSnapshotRef.current = domSnapshot;
        const mountContext = createMountContext({
          container,
          route,
        });
        const instance = await mountRemoteApp(
          route,
          {
            ...mountContext,
            onError(runtimeError: unknown) {
              try {
                mountContext.onError?.(runtimeError);
              } finally {
                handleRemoteRuntimeError(runtimeError);
              }
            },
          },
          loader,
          resolvedLoadOptions,
        );

        if (cancelled) {
          scheduleRemoteUnmount(instance);
          return;
        }

        if (domSnapshot) {
          reportRemoteDomEscapes(
            detectRemoteDomEscapes({
              container,
              phase: "mount",
              remoteName: route.remoteName,
              snapshot: domSnapshot,
            }),
          );
        }

        instanceRef.current = instance;
        updateStatus("ready");
      } catch (error) {
        console.error(`Failed to mount remote ${route.id}`, error);
        onError?.(error, route);

        if (!cancelled) {
          setError(error);
          updateStatus("error");
        }
      }
    }

    void mount();

    return () => {
      cancelled = true;
      const instance = instanceRef.current;
      const domSnapshot = domSnapshotRef.current;
      const container = containerRef.current;
      instanceRef.current = null;
      domSnapshotRef.current = null;

      scheduleRemoteUnmount(instance, () => {
        if (!container || !domSnapshot) {
          return;
        }

        reportRemoteDomEscapes(
          detectRemoteDomEscapes({
            container,
            phase: "unmount",
            remoteName: route.remoteName,
            snapshot: domSnapshot,
          }),
        );
      });
    };
  }, [
    createMountContext,
    handleRemoteRuntimeError,
    loader,
    onError,
    resolvedLoadOptions,
    retryKey,
    route,
    shouldReportDomEscapes,
    updateStatus,
  ]);

  return {
    containerClassName: createRemoteContainerClassName(route.remoteName),
    containerRef,
    error,
    errorMessage: createRemoteErrorMessage(error, messages),
    retry,
    status,
  };
}

/**
 * 远程应用边界。
 * @param options - 远程应用边界选项。
 * @returns 远程应用边界。
 */
export function RemoteAppBoundary({
  renderError,
  renderLoading,
  route,
  ...options
}: RemoteAppBoundaryProps) {
  const state = useRemoteAppMount({
    ...options,
    route,
  });
  const renderState: RemoteAppBoundaryRenderState = {
    error: state.error,
    errorMessage: state.errorMessage,
    retry: state.retry,
    route,
    status: state.status,
  };
  const loadingNode =
    state.status === "loading"
      ? renderLoading
        ? renderLoading(renderState)
        : createElement(
            "p",
            { className: "remote-boundary__message" },
            "Loading remote app...",
          )
      : null;
  const errorNode =
    state.status === "error"
      ? renderError
        ? renderError(renderState)
        : createElement(
            "div",
            { className: "remote-boundary__error", role: "alert" },
            createElement("p", null, state.errorMessage),
            createElement(
              "button",
              { type: "button", onClick: state.retry },
              "Retry",
            ),
          )
      : null;

  return createElement(
    "section",
    {
      "aria-busy": state.status === "loading",
      className: "remote-boundary",
    },
    createElement(
      "header",
      { className: "remote-boundary__header" },
      createElement("h2", null, route.title),
      createElement("span", null, state.status),
    ),
    loadingNode,
    errorNode,
    createElement("div", {
      className: state.containerClassName,
      "data-federlet-remote": route.remoteName,
      ref: state.containerRef,
    }),
  );
}
