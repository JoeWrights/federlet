import { useEffect, useRef, useState } from "react";
import { mountRemoteApp, RemoteLoadErrorCode } from "@federlet/mf-runtime";
import type { RemoteLoadOptions } from "@federlet/mf-runtime";
import {
  captureRemoteDomSnapshot,
  createRemoteContainerClassName as createScopedRemoteContainerClassName,
  detectRemoteDomEscapes,
} from "@federlet/style-isolation";
import type {
  RemoteDomEscapeIssue,
  RemoteDomSnapshot,
} from "@federlet/style-isolation";
import type {
  MicroAppInstance,
  RemoteRouteConfig,
} from "@federlet/shared-types";

interface RemoteAppBoundaryProps {
  route: RemoteRouteConfig;
}

/**
 * 默认远程应用加载选项。
 */
const DEFAULT_REMOTE_LOAD_OPTIONS: RemoteLoadOptions = {
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
 * 是否报告远程应用 DOM 逃逸。
 * @returns 是否报告远程应用 DOM 逃逸。
 */
function shouldReportRemoteDomEscapes() {
  return process.env.NODE_ENV !== "production";
}

/**
 * 获取远程应用加载错误代码。
 * @param error - 错误。
 * @returns 错误代码。
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
 * 创建远程应用错误消息。
 * @param error - 错误。
 * @returns 错误消息。
 */
function createRemoteErrorMessage(error: unknown) {
  switch (getRemoteLoadErrorCode(error)) {
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
      return "Remote app is unavailable.";
  }
}

/**
 * 报告远程应用 DOM 逃逸。
 * @param issues - 逃逸问题。
 */
export function reportRemoteDomEscapes(issues: RemoteDomEscapeIssue[]) {
  if (!shouldReportRemoteDomEscapes()) {
    return;
  }

  for (const issue of issues) {
    console.error(
      `Remote ${issue.remoteName} created DOM outside its container during ${issue.phase}`,
      issue,
    );
  }
}

/**
 * 调度远程应用卸载。
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

export function createRemoteContainerClassName(remoteName: string) {
  return createScopedRemoteContainerClassName(
    "remote-boundary__container",
    remoteName,
  );
}

/**
 * Shell 中负责加载、挂载和卸载 remote 应用的边界组件。
 *
 * 它把 React Router 匹配到的 remote 配置转换为统一的挂载上下文，
 * 并在组件卸载或重试时调用 remote 返回的 `unmount()` 清理资源。
 */
export function RemoteAppBoundary({ route }: RemoteAppBoundaryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<MicroAppInstance | null>(null);
  const domSnapshotRef = useRef<RemoteDomSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState(
    "Remote app is unavailable.",
  );
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      if (!containerRef.current) {
        return;
      }

      setStatus("loading");
      setErrorMessage("Remote app is unavailable.");

      try {
        const domSnapshot = captureRemoteDomSnapshot({
          container: containerRef.current,
        });
        domSnapshotRef.current = domSnapshot;
        // Shell 只注入协议上下文，不直接依赖 remote 内部框架实现。
        const instance = await mountRemoteApp(
          route,
          {
            basename: route.basename,
            container: containerRef.current,
            props: {
              mountedAt: new Date().toISOString(),
            },
          },
          undefined,
          DEFAULT_REMOTE_LOAD_OPTIONS,
        );

        // 如果加载过程中边界已经卸载，立即释放刚创建的 remote 实例。
        if (cancelled) {
          scheduleRemoteUnmount(instance);
          return;
        }

        reportRemoteDomEscapes(
          detectRemoteDomEscapes({
            container: containerRef.current,
            phase: "mount",
            remoteName: route.remoteName,
            snapshot: domSnapshot,
          }),
        );
        instanceRef.current = instance;
        setStatus("ready");
      } catch (error) {
        console.error(`Failed to mount remote ${route.id}`, error);

        if (!cancelled) {
          setErrorMessage(createRemoteErrorMessage(error));
          setStatus("error");
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
      // 路由切换或组件卸载时，把清理动作交还给 remote 自己完成。
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
  }, [route, retryKey]);

  return (
    <section className="remote-boundary" aria-busy={status === "loading"}>
      <header className="remote-boundary__header">
        <h2>{route.title}</h2>
        <span>{status}</span>
      </header>

      {status === "loading" ? (
        <p className="remote-boundary__message">Loading remote app...</p>
      ) : null}

      {status === "error" ? (
        <div className="remote-boundary__error" role="alert">
          <p>{errorMessage}</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={createRemoteContainerClassName(route.remoteName)}
        data-federlet-remote={route.remoteName}
      />
    </section>
  );
}
