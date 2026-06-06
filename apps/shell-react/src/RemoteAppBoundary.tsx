import { useEffect, useRef, useState } from "react";
import { mountRemoteApp } from "@federlet/mf-runtime";
import type {
  MicroAppInstance,
  RemoteRouteConfig,
} from "@federlet/shared-types";

interface RemoteAppBoundaryProps {
  route: RemoteRouteConfig;
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
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      if (!containerRef.current) {
        return;
      }

      setStatus("loading");

      try {
        // Shell 只注入协议上下文，不直接依赖 remote 内部框架实现。
        const instance = await mountRemoteApp(route, {
          basename: route.basename,
          container: containerRef.current,
          props: {
            mountedAt: new Date().toISOString(),
          },
        });

        // 如果加载过程中边界已经卸载，立即释放刚创建的 remote 实例。
        if (cancelled) {
          void instance.unmount();
          return;
        }

        instanceRef.current = instance;
        setStatus("ready");
      } catch (error) {
        console.error(`Failed to mount remote ${route.id}`, error);

        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    void mount();

    return () => {
      cancelled = true;
      const instance = instanceRef.current;
      instanceRef.current = null;
      // 路由切换或组件卸载时，把清理动作交还给 remote 自己完成。
      void instance?.unmount();
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
          <p>Remote app is unavailable.</p>
          <button type="button" onClick={() => setRetryKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      <div ref={containerRef} className="remote-boundary__container" />
    </section>
  );
}
