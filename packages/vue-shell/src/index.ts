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
import { mountRemoteApp, RemoteLoadErrorCode } from "@federlet/mf-runtime";
import {
  captureRemoteDomSnapshot,
  createRemoteContainerClassName as createScopedRemoteContainerClassName,
  detectRemoteDomEscapes,
} from "@federlet/style-isolation";
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
  renderError?: (state: RemoteAppBoundaryRenderState) => VNodeChild;
  renderLoading?: (state: RemoteAppBoundaryRenderState) => VNodeChild;
  route: RemoteRouteConfig;
}

export interface UseRemoteAppMountOptions
  extends Omit<RemoteAppBoundaryProps, "renderError" | "renderLoading"> {}

export interface UseRemoteAppMountResult {
  containerClassName: string;
  containerHostRef: Ref<HTMLDivElement | null>;
  containerRef: Ref<HTMLDivElement | null>;
  error: Ref<unknown>;
  errorMessage: Ref<string>;
  retry: () => void;
  status: Ref<RemoteAppStatus>;
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
  const containerHostRef = ref<HTMLDivElement | null>(null);
  const containerRef = ref<HTMLDivElement | null>(null);
  const instanceRef = shallowRef<MicroAppInstance | null>(null);
  const domSnapshotRef = shallowRef<RemoteDomSnapshot | null>(null);
  const status = ref<RemoteAppStatus>("loading");
  const error = shallowRef<unknown>(null);
  const retryKey = ref(0);
  const resolvedLoadOptions = computed(() => mergeRemoteLoadOptions(loadOptions));
  const containerClassName = createRemoteContainerClassName(route.remoteName);

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

  function updateStatus(nextStatus: RemoteAppStatus) {
    status.value = nextStatus;
    onStatusChange?.(nextStatus, route);
  }

  function retry() {
    retryKey.value += 1;
  }

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
      const instance = await mountRemoteApp(
        route,
        createMountContext({
          container,
          route,
        }),
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
    errorMessage: computed(() => createRemoteErrorMessage(error.value, messages)),
    retry,
    status,
  };
}

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
