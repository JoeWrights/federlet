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

export type RemoteAppStatus = "loading" | "ready" | "error";

export interface CreateMountContextArgs {
  container: HTMLElement;
  route: RemoteRouteConfig;
}

export interface RemoteErrorMessageOverrides
  extends Partial<Record<RemoteLoadErrorCode, string>> {
  default?: string;
}

export interface RemoteAppBoundaryRenderState {
  error: unknown;
  errorMessage: string;
  retry: () => void;
  route: RemoteRouteConfig;
  status: RemoteAppStatus;
}

export interface RemoteAppBoundaryProps {
  createMountContext?: (args: CreateMountContextArgs) => MicroAppContext;
  enableDomEscapeDiagnostics?: boolean;
  loadOptions?: RemoteLoadOptions;
  loader?: RemoteModuleLoader;
  messages?: RemoteErrorMessageOverrides;
  onError?: (error: unknown, route: RemoteRouteConfig) => void;
  onStatusChange?: (status: RemoteAppStatus, route: RemoteRouteConfig) => void;
  renderError?: (state: RemoteAppBoundaryRenderState) => ReactNode;
  renderLoading?: (state: RemoteAppBoundaryRenderState) => ReactNode;
  route: RemoteRouteConfig;
}

export interface UseRemoteAppMountOptions
  extends Omit<RemoteAppBoundaryProps, "renderError" | "renderLoading"> {}

export interface UseRemoteAppMountResult {
  containerClassName: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  error: unknown;
  errorMessage: string;
  retry: () => void;
  status: RemoteAppStatus;
}

export interface CreateRemotePreloaderOptions {
  loadOptions?: RemoteLoadOptions;
  loader?: RemoteModuleLoader;
}

export interface RemotePreloader {
  preload: (route: RemoteRouteConfig) => Promise<void>;
}

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

function shouldReportRemoteDomEscapes(enableDomEscapeDiagnostics?: boolean) {
  if (enableDomEscapeDiagnostics !== undefined) {
    return enableDomEscapeDiagnostics;
  }

  return process.env.NODE_ENV !== "production";
}

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

export function reportRemoteDomEscapes(issues: RemoteDomEscapeIssue[]) {
  for (const issue of issues) {
    console.error(
      `Remote ${issue.remoteName} created DOM outside its container during ${issue.phase}`,
      issue,
    );
  }
}

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

export function createRemoteContainerClassName(remoteName: string) {
  return createScopedRemoteContainerClassName(
    "remote-boundary__container",
    remoteName,
  );
}

function createRemotePreloadKey(route: RemoteRouteConfig) {
  return `${route.remoteName}/${route.exposedModule}`;
}

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
        const instance = await mountRemoteApp(
          route,
          createMountContext({
            container,
            route,
          }),
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
