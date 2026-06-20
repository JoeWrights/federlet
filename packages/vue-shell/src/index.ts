import {
  computed,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  mountRemoteApp,
} from "@federlet/mf-runtime";
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
import type { PropType, Ref, VNodeChild } from "vue";
import type {
  RemoteLoadOptions,
  RemoteModuleLoader,
} from "@federlet/mf-runtime";
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
  /** 状态变化处理函数。 */
  onStatusChange?: (status: RemoteAppStatus, route: RemoteRouteConfig) => void;
  /** 错误渲染函数。 */
  renderError?: (state: RemoteAppBoundaryRenderState) => VNodeChild;
  /** 加载中渲染函数。 */
  renderLoading?: (state: RemoteAppBoundaryRenderState) => VNodeChild;
  /** 路由配置。 */
  route: RemoteRouteConfig;
}

/**
 * 使用远程应用挂载选项。
 */
export interface UseRemoteAppMountOptions
  extends Omit<RemoteAppBoundaryProps, "renderError" | "renderLoading"> {}

/**
 * 使用远程应用挂载结果。
 */
export interface UseRemoteAppMountResult {
  /** 容器类名。 */
  containerClassName: string;
  /** 容器主机引用。 */
  containerHostRef: Ref<HTMLDivElement | null>;
  /** 容器引用。 */ 
  containerRef: Ref<HTMLDivElement | null>;
  /** 错误信息。 */
  error: Ref<unknown>;
  /** 错误详情。 */
  errorDetails: Ref<RemoteErrorDetails>;
  /** 错误消息。 */
  errorMessage: Ref<string>;
  /** 重试函数。 */
  retry: () => void;
  /** 应用状态。 */
  status: Ref<RemoteAppStatus>;
}

/**
 * 是否报告远程 DOM 逃逸。
 * @param enableDomEscapeDiagnostics - 是否启用 DOM 逃逸诊断。
 * @returns 是否报告远程 DOM 逃逸。
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
}: UseRemoteAppMountOptions): UseRemoteAppMountResult {
  const containerHostRef = ref<HTMLDivElement | null>(null);
  const containerRef = ref<HTMLDivElement | null>(null);
  const instanceRef = shallowRef<MicroAppInstance | null>(null);
  const domSnapshotRef = shallowRef<RemoteDomSnapshot | null>(null);
  const status = ref<RemoteAppStatus>("loading");
  const error = shallowRef<unknown>(null);
  const retryKey = ref(0);
  const resolvedLoadOptions = computed(() => mergeRemoteLoadOptions(loadOptions));
  const containerClassName = createRemoteContainerClassName(route.remoteName);

  /**
   * 确保远程容器。
   * @returns 远程容器。
   */
  function ensureRemoteContainer() {
    if (containerRef.value) {
      return containerRef.value;
    }

    const host = containerHostRef.value;

    if (!host) {
      return null;
    }

    const container = document.createElement("div");
    container.className = containerClassName;
    container.dataset.federletRemote = route.remoteName;
    host.replaceChildren(container);
    containerRef.value = container;

    return container;
  }

  /**
   * 更新应用状态。
   * @param nextStatus - 下一个状态。
   */
  function updateStatus(nextStatus: RemoteAppStatus) {
    status.value = nextStatus;
    onStatusChange?.(nextStatus, route);
  }

  /**
   * 重试。
   */
  function retry() {
    retryKey.value += 1;
  }

  /**
   * 处理远程运行时错误。
   * @param runtimeError - 运行时错误。
   */
  function handleRemoteRuntimeError(runtimeError: unknown) {
    console.error(
      `Remote ${route.remoteName} reported a runtime error`,
      runtimeError,
    );
    onError?.(runtimeError, route);

    const instance = instanceRef.value;
    instanceRef.value = null;

    error.value = runtimeError;
    updateStatus("error");
    scheduleRemoteUnmount(instance);
  }

  /**
   * 清理。
   */
  function cleanup() {
    const instance = instanceRef.value;
    const domSnapshot = domSnapshotRef.value;
    const container = containerRef.value;
    instanceRef.value = null;
    domSnapshotRef.value = null;

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
  }

  /**
   * 挂载远程应用。
   */
  async function mount() {
    const container = ensureRemoteContainer();

    if (!container) {
      return;
    }

    error.value = null;
    updateStatus("loading");

    try {
      const domSnapshot = shouldReportRemoteDomEscapes(enableDomEscapeDiagnostics)
        ? captureRemoteDomSnapshot({
            container,
          })
        : null;
      domSnapshotRef.value = domSnapshot;
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
        resolvedLoadOptions.value,
      );

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

      instanceRef.value = instance;
      updateStatus("ready");
    } catch (mountError) {
      console.error(`Failed to mount remote ${route.id}`, mountError);
      onError?.(mountError, route);
      error.value = mountError;
      updateStatus("error");
    }
  }

  onMounted(() => {
    void mount();
  });
  watch(retryKey, () => {
    cleanup();
    void mount();
  });
  onBeforeUnmount(() => {
    cleanup();
  });

  return {
    containerClassName,
    containerHostRef,
    containerRef,
    error,
    errorDetails: computed(() => createRemoteErrorDetails(error.value)),
    errorMessage: computed(() => createRemoteErrorMessage(error.value, messages)),
    retry,
    status,
  };
}

/**
 * 远程应用边界组件。
 */
export const RemoteAppBoundary = defineComponent({
  name: "RemoteAppBoundary",
  props: {
    createMountContext: Function as PropType<
      RemoteAppBoundaryProps["createMountContext"]
    >,
    enableDomEscapeDiagnostics: Boolean,
    loadOptions: Object as PropType<RemoteLoadOptions>,
    loader: Function as PropType<RemoteModuleLoader>,
    messages: Object as PropType<RemoteErrorMessageOverrides>,
    onError: Function as PropType<RemoteAppBoundaryProps["onError"]>,
    onStatusChange: Function as PropType<
      RemoteAppBoundaryProps["onStatusChange"]
    >,
    renderError: Function as PropType<RemoteAppBoundaryProps["renderError"]>,
    renderLoading: Function as PropType<RemoteAppBoundaryProps["renderLoading"]>,
    route: {
      required: true,
      type: Object as PropType<RemoteRouteConfig>,
    },
  },
  setup(props) {
    const remote = useRemoteAppMount({
      createMountContext: props.createMountContext,
      enableDomEscapeDiagnostics: props.enableDomEscapeDiagnostics,
      loadOptions: props.loadOptions,
      loader: props.loader,
      messages: props.messages,
      onError: props.onError,
      onStatusChange: props.onStatusChange,
      route: props.route,
    });

    return () => {
      const renderState: RemoteAppBoundaryRenderState = {
        error: remote.error.value,
        errorDetails: remote.errorDetails.value,
        errorMessage: remote.errorMessage.value,
        retry: remote.retry,
        route: props.route,
        status: remote.status.value,
      };
      const loadingNode =
        remote.status.value === "loading"
          ? props.renderLoading?.(renderState) ??
            h(
              "p",
              { class: "remote-boundary__message", key: "loading" },
              "Loading remote app...",
            )
          : null;
      const errorNode =
        remote.status.value === "error"
          ? props.renderError?.(renderState) ??
            h(
              "div",
              { class: "remote-boundary__error", key: "error", role: "alert" },
              [
                h("p", remote.errorMessage.value),
                h("details", [
                  h("summary", "Technical details"),
                  h(
                    "pre",
                    formatRemoteErrorDetails(remote.errorDetails.value),
                  ),
                ]),
                h("button", { type: "button", onClick: remote.retry }, "Retry"),
              ],
            )
          : null;

      return h(
        "section",
        {
          "aria-busy": remote.status.value === "loading",
          class: "remote-boundary",
        },
        [
          h("header", { class: "remote-boundary__header", key: "header" }, [
            h("h2", props.route.title),
            h("span", remote.status.value),
          ]),
          loadingNode,
          errorNode,
          h("div", {
            class: "remote-boundary__container-host",
            key: "remote-container",
            ref: remote.containerHostRef,
          }),
        ],
      );
    };
  },
});
