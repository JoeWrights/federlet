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
} from "@federlet/mf-runtime";
import { createSandboxedRemoteMount } from "@federlet/sandbox";
import {
  captureRemoteDomSnapshot,
  detectRemoteDomEscapes,
} from "@federlet/style-isolation";
import {
  createRemoteContainerClassName,
  createRemoteErrorDetails,
  createRemoteErrorMessage,
  formatRemoteErrorDetails,
  mergeRemoteLoadOptions,
  reportRemoteDomEscapes,
  scheduleRemoteUnmount,
} from "@federlet/shell-core";
import type { ReactNode } from "react";
import type {
  RemoteLoadOptions,
  RemoteModuleLoader,
} from "@federlet/mf-runtime";
import type { CreateSandboxedRemoteMountOptions } from "@federlet/sandbox";
import type {
  MicroAppContext,
  MicroAppInstance,
  RemoteRouteConfig,
} from "@federlet/shared-types";
import type { RemoteDomSnapshot } from "@federlet/style-isolation";
import type {
  CreateMountContextArgs,
  RemoteAppBoundaryRenderState,
  RemoteAppStatus,
  RemoteErrorDetails,
  RemoteErrorMessageOverrides,
} from "@federlet/shell-core";

export {
  createRemoteContainerClassName,
  createRemoteErrorDetails,
  createRemoteErrorMessage,
  createRemotePreloader,
  DEFAULT_REMOTE_LOAD_OPTIONS,
  formatRemoteErrorDetails,
  mergeRemoteLoadOptions,
  reportRemoteDomEscapes,
  scheduleRemoteUnmount,
} from "@federlet/shell-core";
export type {
  CreateMountContextArgs,
  CreateRemotePreloaderOptions,
  RemoteAppBoundaryRenderState,
  RemoteAppStatus,
  RemoteErrorDetails,
  RemoteErrorMessageOverrides,
  RemotePreloader,
} from "@federlet/shell-core";

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
  /** JS 运行时沙箱选项；传入 false 可关闭沙箱。 */
  sandbox?: CreateSandboxedRemoteMountOptions["sandbox"];
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
  /** 错误详情。 */
  errorDetails: RemoteErrorDetails;
  /** 错误消息。 */
  errorMessage: string;
  /** 重试函数。 */
  retry: () => void;
  /** 应用状态。 */
  status: RemoteAppStatus;
}

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
  sandbox,
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
        const mountRemoteWithSandbox = createSandboxedRemoteMount({
          mountRemote(context) {
            return mountRemoteApp(route, context, loader, resolvedLoadOptions);
          },
          route,
          sandbox,
        });
        const instance = await mountRemoteWithSandbox({
          ...mountContext,
          onError(runtimeError: unknown) {
            try {
              mountContext.onError?.(runtimeError);
            } finally {
              handleRemoteRuntimeError(runtimeError);
            }
          },
        });

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
    sandbox,
    shouldReportDomEscapes,
    updateStatus,
  ]);

  return {
    containerClassName: createRemoteContainerClassName(route.remoteName),
    containerRef,
    error,
    errorDetails: createRemoteErrorDetails(error),
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
    errorDetails: state.errorDetails,
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
              "details",
              null,
              createElement("summary", null, "Technical details"),
              createElement(
                "pre",
                null,
                formatRemoteErrorDetails(state.errorDetails),
              ),
            ),
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
