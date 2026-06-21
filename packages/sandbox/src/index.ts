import type {
  MicroAppContext,
  MicroAppInstance,
  RemoteRouteConfig,
} from "@federlet/shared-types";

/**
 * 沙箱模式
 * - off: 关闭沙箱
 * - proxy: 代理模式
 */
export type SandboxMode = "off" | "proxy";

/**
 * 沙箱选项
 */
export interface FederletSandboxOptions {
  /**
   * 容器
   */
  container: HTMLElement;
  /**
   * 额外全局变量
   */
  extraGlobals?: Record<PropertyKey, unknown>;
  /**
   * 沙箱模式
   */
  mode?: SandboxMode;
  /**
   * 远程名称
   */
  remoteName: string;
}

/**
 * 沙箱全局变量变更
 */
export interface SandboxGlobalMutation {
  /**
   * 全局变量键
   */
  key: string;
  /**
   * 远程名称
   */
  remoteName: string;
  /**
   * 变更类型
   */
  type: "set" | "delete";
}

/**
 * 沙箱事件监听诊断
 */
export interface SandboxEventListenerDiagnostic {
  /**
   * 捕获
   */
  capture?: boolean;
  /**
   * 类型
   */
  type: string;
}

/**
 * 沙箱诊断
 */
export interface SandboxDiagnostics {
  /**
   * 是否激活
   */
  active: boolean;
  /**
   * 事件监听诊断
   */
  eventListeners: SandboxEventListenerDiagnostic[];
  /**
   * 全局处理器
   */
  globalHandlers: string[];
  /**
   * 全局变量变更
   */
  globalMutations: SandboxGlobalMutation[];
  /**
   * 间隔计数
   */
  intervalCount: number;
  /**
   * 沙箱模式
   */
  mode: SandboxMode;
  /**
   * 请求动画帧计数
   */
  rafCount: number;
  /**
   * 远程名称
   */
  remoteName: string;
  /**
   * 超时计数
   */
  timeoutCount: number;
}

/**
 * 沙箱实例
 */
export interface FederletSandbox {
  /**
   * 激活沙箱
   */
  activate(): void;
  /**
   * 销毁沙箱
   */
  deactivate(): void;
  /**
   * 获取诊断信息
   */
  getDiagnostics(): SandboxDiagnostics;
  /**
   * 全局 this
   */
  globalThis: SandboxWindow;
}

/**
 * 沙箱化远程应用实例
 */
export interface SandboxedMicroAppInstance extends MicroAppInstance {
  /**
   * 沙箱实例
   */
  sandbox: FederletSandbox;
}

/**
 * 创建沙箱化远程应用挂载选项
 */
export interface CreateSandboxedRemoteMountOptions {
  /**
   * 挂载远程应用
   */
  mountRemote: (context: MicroAppContext) => Promise<MicroAppInstance> | MicroAppInstance;
  /**
   * 路由配置
   */
  route: RemoteRouteConfig;
  /**
   * 沙箱选项
   */
  sandbox?: Omit<FederletSandboxOptions, "container" | "remoteName"> | false;
}

/**
 * 沙箱窗口
 */
type SandboxWindow = Window & Record<string, unknown>;

/**
 * 定时器 ID
 */
type TimerId = number;

/**
 * 请求动画帧 ID
 */
type RafId = number;

/**
 * 事件监听目标
 */
type EventListenerTarget = EventListenerOrEventListenerObject;

/**
 * 跟踪的事件监听
 */
interface TrackedEventListener {
  /**
   * 监听目标
   */
  listener: EventListenerTarget;
  /**
   * 选项
   */
  options?: AddEventListenerOptions | boolean;
  /**
   * 类型
   */
  type: string;
}

/**
 * 全局处理器补丁
 */
interface GlobalHandlerPatch {
  /**
   * 当前值
   */
  current: unknown;
  /**
   * 描述符
   */
  descriptor?: PropertyDescriptor;
  /**
   * 是否存在
   */
  existed: boolean;
}

/**
 * 全局处理器键
 */
const GLOBAL_HANDLER_KEYS = ["onerror", "onunhandledrejection"] as const;

/**
 * 沙箱运行时
 */
interface SandboxRuntime {
  addEventListener(
    type: string,
    listener: EventListenerTarget,
    options?: AddEventListenerOptions | boolean,
  ): void;
  cancelAnimationFrame(id: RafId): void;
  clearInterval(id?: TimerId): void;
  clearTimeout(id?: TimerId): void;
  getGlobalHandler(key: (typeof GLOBAL_HANDLER_KEYS)[number]): unknown;
  removeEventListener(
    type: string,
    listener: EventListenerTarget,
    options?: EventListenerOptions | boolean,
  ): void;
  requestAnimationFrame(callback: FrameRequestCallback): RafId;
  setGlobalHandler(
    key: (typeof GLOBAL_HANDLER_KEYS)[number],
    value: unknown,
  ): boolean;
  setInterval(handler: TimerHandler, timeout?: number, ...args: unknown[]): TimerId;
  setTimeout(handler: TimerHandler, timeout?: number, ...args: unknown[]): TimerId;
}

/**
 * 原生窗口方法
 */
interface NativeWindowMethods {
  addEventListener: typeof window.addEventListener;
  cancelAnimationFrame: typeof window.cancelAnimationFrame;
  clearInterval: typeof window.clearInterval;
  clearTimeout: typeof window.clearTimeout;
  removeEventListener: typeof window.removeEventListener;
  requestAnimationFrame: typeof window.requestAnimationFrame;
  setInterval: typeof window.setInterval;
  setTimeout: typeof window.setTimeout;
}

/**
 * 窗口补丁管理器
 */
const windowPatchManager = (() => {
  const activeRuntimes: SandboxRuntime[] = [];
  let globalHandlerPatches: Map<
    (typeof GLOBAL_HANDLER_KEYS)[number],
    GlobalHandlerPatch
  > | undefined;
  let installed = false;
  let nativeMethods: NativeWindowMethods | undefined;

  function getNativeMethods() {
    if (!nativeMethods) {
      nativeMethods = {
        addEventListener: window.addEventListener,
        cancelAnimationFrame: window.cancelAnimationFrame,
        clearInterval: window.clearInterval,
        clearTimeout: window.clearTimeout,
        removeEventListener: window.removeEventListener,
        requestAnimationFrame: window.requestAnimationFrame,
        setInterval: window.setInterval,
        setTimeout: window.setTimeout,
      };
    }

    return nativeMethods;
  }

  function getCurrentRuntime() {
    return activeRuntimes.at(-1);
  }

  function patchWindow() {
    if (installed) {
      return;
    }

    const native = getNativeMethods();
    globalHandlerPatches = new Map();

    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const runtime = getCurrentRuntime();

      if (runtime) {
        return runtime.setTimeout(handler, timeout, ...args);
      }

      return native.setTimeout.apply(window, [
        handler,
        timeout,
        ...args,
      ] as unknown as Parameters<typeof window.setTimeout>) as unknown as TimerId;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((id?: TimerId) => {
      activeRuntimes.forEach((runtime) => runtime.clearTimeout(id));

      return native.clearTimeout.call(window, id);
    }) as typeof window.clearTimeout;
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      const runtime = getCurrentRuntime();

      if (runtime) {
        return runtime.setInterval(handler, timeout, ...args);
      }

      return native.setInterval.apply(window, [
        handler,
        timeout,
        ...args,
      ] as unknown as Parameters<typeof window.setInterval>) as unknown as TimerId;
    }) as typeof window.setInterval;
    window.clearInterval = ((id?: TimerId) => {
      activeRuntimes.forEach((runtime) => runtime.clearInterval(id));

      return native.clearInterval.call(window, id);
    }) as typeof window.clearInterval;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const runtime = getCurrentRuntime();

      if (runtime) {
        return runtime.requestAnimationFrame(callback);
      }

      return native.requestAnimationFrame
        ? native.requestAnimationFrame.call(window, callback)
        : Number(native.setTimeout.call(window, () => callback(performance.now()), 16));
    };
    window.cancelAnimationFrame = (id: RafId) => {
      activeRuntimes.forEach((runtime) => runtime.cancelAnimationFrame(id));

      if (native.cancelAnimationFrame) {
        native.cancelAnimationFrame.call(window, id);
      } else {
        native.clearTimeout.call(window, id);
      }
    };
    window.addEventListener = ((
      type: string,
      listener: EventListenerTarget,
      options?: AddEventListenerOptions | boolean,
    ) => {
      const runtime = getCurrentRuntime();

      if (runtime) {
        return runtime.addEventListener(type, listener, options);
      }

      return native.addEventListener.call(window, type, listener, options);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((
      type: string,
      listener: EventListenerTarget,
      options?: EventListenerOptions | boolean,
    ) => {
      activeRuntimes.forEach((runtime) =>
        runtime.removeEventListener(type, listener, options),
      );

      return native.removeEventListener.call(window, type, listener, options);
    }) as typeof window.removeEventListener;

    for (const key of GLOBAL_HANDLER_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(window, key);
      const patch: GlobalHandlerPatch = {
        current: window[key],
        descriptor,
        existed: Boolean(descriptor),
      };
      globalHandlerPatches.set(key, patch);

      Object.defineProperty(window, key, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get() {
          return getCurrentRuntime()?.getGlobalHandler(key) ?? patch.current;
        },
        set(value) {
          if (!getCurrentRuntime()?.setGlobalHandler(key, value)) {
            patch.current = value;
          }
        },
      });
    }

    installed = true;
  }

  function restoreWindow() {
    if (!installed || !nativeMethods) {
      return;
    }

    window.setTimeout = nativeMethods.setTimeout;
    window.clearTimeout = nativeMethods.clearTimeout;
    window.setInterval = nativeMethods.setInterval;
    window.clearInterval = nativeMethods.clearInterval;
    window.requestAnimationFrame = nativeMethods.requestAnimationFrame;
    window.cancelAnimationFrame = nativeMethods.cancelAnimationFrame;
    window.addEventListener = nativeMethods.addEventListener;
    window.removeEventListener = nativeMethods.removeEventListener;

    globalHandlerPatches?.forEach((patch, key) => {
      if (patch.existed && patch.descriptor) {
        Object.defineProperty(window, key, patch.descriptor);
      } else {
        delete (window as unknown as SandboxWindow)[key];
      }
    });
    globalHandlerPatches = undefined;
    installed = false;
    nativeMethods = undefined;
  }

  return {
    addRuntime(runtime: SandboxRuntime) {
      patchWindow();

      if (!activeRuntimes.includes(runtime)) {
        activeRuntimes.push(runtime);
      }
    },
    nativeAddEventListener(
      type: string,
      listener: EventListenerTarget,
      options?: AddEventListenerOptions | boolean,
    ) {
      return getNativeMethods().addEventListener.call(window, type, listener, options);
    },
    nativeCancelAnimationFrame(id: RafId) {
      const native = getNativeMethods();

      if (native.cancelAnimationFrame) {
        native.cancelAnimationFrame.call(window, id);
      } else {
        native.clearTimeout.call(window, id);
      }
    },
    nativeClearInterval(id?: TimerId) {
      return getNativeMethods().clearInterval.call(window, id);
    },
    nativeClearTimeout(id?: TimerId) {
      return getNativeMethods().clearTimeout.call(window, id);
    },
    nativeRemoveEventListener(
      type: string,
      listener: EventListenerTarget,
      options?: EventListenerOptions | boolean,
    ) {
      return getNativeMethods().removeEventListener.call(window, type, listener, options);
    },
    nativeRequestAnimationFrame(callback: FrameRequestCallback) {
      const native = getNativeMethods();

      return native.requestAnimationFrame
        ? native.requestAnimationFrame.call(window, callback)
        : Number(native.setTimeout.call(window, () => callback(performance.now()), 16));
    },
    nativeSetInterval(
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ): TimerId {
      return getNativeMethods().setInterval.apply(window, [
        handler,
        timeout,
        ...args,
      ] as unknown as Parameters<typeof window.setInterval>) as unknown as TimerId;
    },
    nativeSetTimeout(
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ): TimerId {
      return getNativeMethods().setTimeout.apply(window, [
        handler,
        timeout,
        ...args,
      ] as unknown as Parameters<typeof window.setTimeout>) as unknown as TimerId;
    },
    removeRuntime(runtime: SandboxRuntime) {
      const index = activeRuntimes.indexOf(runtime);

      if (index >= 0) {
        activeRuntimes.splice(index, 1);
      }

      if (activeRuntimes.length === 0) {
        restoreWindow();
      }
    },
  };
})();

/**
 * 获取事件捕获
 * @param options - 选项
 */
function getEventCapture(options?: AddEventListenerOptions | boolean) {
  return typeof options === "boolean" ? options : options?.capture;
}

/**
 * 事件监听匹配
 * @param tracked - 跟踪的事件监听
 * @param type - 类型
 * @param listener - 监听目标
 * @param options - 选项
 */
function eventListenerMatches(
  tracked: TrackedEventListener,
  type: string,
  listener: EventListenerTarget,
  options?: AddEventListenerOptions | boolean,
) {
  return (
    tracked.type === type &&
    tracked.listener === listener &&
    getEventCapture(tracked.options) === getEventCapture(options)
  );
}

/**
 * 创建沙箱实例
 * @param options - 选项
 * @returns 沙箱实例
 */
export function createFederletSandbox({
  extraGlobals = {},
  mode = "proxy",
  remoteName,
}: FederletSandboxOptions): FederletSandbox {
  if (mode === "off") {
    return {
      activate() {
        return undefined;
      },
      deactivate() {
        return undefined;
      },
      getDiagnostics() {
        return {
          active: false,
          eventListeners: [],
          globalHandlers: [],
          globalMutations: [],
          intervalCount: 0,
          mode,
          rafCount: 0,
          remoteName,
          timeoutCount: 0,
        };
      },
      globalThis: window as unknown as SandboxWindow,
    };
  }

  let active = false;
  const sandboxTarget: Record<PropertyKey, unknown> = {
    ...extraGlobals,
  };
  const globalMutations = new Map<PropertyKey, SandboxGlobalMutation>();
  const eventListeners: TrackedEventListener[] = [];
  const timeoutIds = new Set<TimerId>();
  const intervalIds = new Set<TimerId>();
  const rafIds = new Set<RafId>();
  const globalHandlers = new Map<
    (typeof GLOBAL_HANDLER_KEYS)[number],
    GlobalHandlerPatch
  >();
  GLOBAL_HANDLER_KEYS.forEach((key) => {
    globalHandlers.set(key, {
      current: null,
      existed: false,
    });
  });

  let proxyGlobal: SandboxWindow;

  /**
   * 跟踪 setTimeout
   * @param handler - 处理函数
   * @param timeout - 超时时间
   * @param args - 参数
   * @returns 定时器 ID
   */
  function setTimeoutWithTracking(
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) {
    const id = windowPatchManager.nativeSetTimeout(handler, timeout, ...args);
    timeoutIds.add(id);
    return id;
  }

  /**
   * 清除跟踪的 setTimeout
   * @param id - 定时器 ID
   * @returns 定时器 ID
   */
  function clearTimeoutWithTracking(id?: TimerId) {
    if (id !== undefined) {
      timeoutIds.delete(id);
    }
    return windowPatchManager.nativeClearTimeout(id);
  }

  /**
   * 跟踪 setInterval
   * @param handler - 处理函数
   * @param timeout - 超时时间
   * @param args - 参数
   * @returns 定时器 ID
   */
  function setIntervalWithTracking(
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ) {
    const id = windowPatchManager.nativeSetInterval(handler, timeout, ...args);
    intervalIds.add(id);
    return id;
  }

  /**
   * 清除跟踪的 setInterval
   * @param id - 定时器 ID
   * @returns 定时器 ID
   */
  function clearIntervalWithTracking(id?: TimerId) {
    if (id !== undefined) {
      intervalIds.delete(id);
    }
    return windowPatchManager.nativeClearInterval(id);
  }

  /**
   * 跟踪 requestAnimationFrame
   * @param callback - 回调函数
   * @returns 请求动画帧 ID
   */
  function requestAnimationFrameWithTracking(callback: FrameRequestCallback) {
    const id = Number(
      windowPatchManager.nativeSetTimeout(() => callback(performance.now()), 16),
    );
    rafIds.add(id);
    return id;
  }

  /**
   * 清除跟踪的 requestAnimationFrame
   * @param id - 请求动画帧 ID
   * @returns 请求动画帧 ID
   */
  function cancelAnimationFrameWithTracking(id: RafId) {
    rafIds.delete(id);
    windowPatchManager.nativeClearTimeout(id);
  }

  /**
   * 跟踪 addEventListener
   * @param type - 类型
   * @param listener - 监听目标
   * @param options - 选项
   * @returns 事件监听目标
   */
  function addEventListenerWithTracking(
    type: string,
    listener: EventListenerTarget,
    options?: AddEventListenerOptions | boolean,
  ) {
    eventListeners.push({
      listener,
      options,
      type,
    });
    return windowPatchManager.nativeAddEventListener(type, listener, options);
  }

  /**
   * 清除跟踪的 addEventListener
   * @param type - 类型
   * @param listener - 监听目标
   * @param options - 选项
   * @returns 事件监听目标
   */
  function removeEventListenerWithTracking(
    type: string,
    listener: EventListenerTarget,
    options?: EventListenerOptions | boolean,
  ) {
    const index = eventListeners.findIndex((tracked) =>
      eventListenerMatches(tracked, type, listener, options),
    );

    if (index >= 0) {
      eventListeners.splice(index, 1);
    }

    return windowPatchManager.nativeRemoveEventListener(type, listener, options);
  }

  /**
   * 跟踪的全局变量
   */
  const trackedGlobals: Record<PropertyKey, unknown> = {
    addEventListener: addEventListenerWithTracking,
    cancelAnimationFrame: cancelAnimationFrameWithTracking,
    clearInterval: clearIntervalWithTracking,
    clearTimeout: clearTimeoutWithTracking,
    removeEventListener: removeEventListenerWithTracking,
    requestAnimationFrame: requestAnimationFrameWithTracking,
    setInterval: setIntervalWithTracking,
    setTimeout: setTimeoutWithTracking,
  };

  /**
   * 记录全局变量变更
   * @param key - 键
   * @param type - 变更类型
   */
  function recordGlobalMutation(key: PropertyKey, type: "set" | "delete") {
    globalMutations.set(key, {
      key: String(key),
      remoteName,
      type,
    });
  }

  /**
   * 设置全局处理器
   * @param key - 键
   * @param value - 值
   * @returns 是否设置成功
   */
  function setGlobalHandler(
    key: (typeof GLOBAL_HANDLER_KEYS)[number],
    value: unknown,
  ) {
    const patch = globalHandlers.get(key);

    if (!patch) {
      return false;
    }

    patch.current = value;

    return true;
  }

  proxyGlobal = new Proxy(sandboxTarget, {
    /**
     * 删除属性
     * @param target - 目标
     * @param key - 键
     * @returns 是否删除成功
     */
    deleteProperty(target, key) {
      recordGlobalMutation(key, "delete");
      return Reflect.deleteProperty(target, key);
    },
    /**
     * 获取属性
     * @param target - 目标
     * @param key - 键
     * @returns 属性值
     */
    get(target, key) {
      if (key === "window" || key === "self" || key === "globalThis") {
        return proxyGlobal;
      }

      if (key in trackedGlobals) {
        return trackedGlobals[key];
      }

      if (Reflect.has(target, key)) {
        return Reflect.get(target, key);
      }

      const value = Reflect.get(window, key);

      return typeof value === "function" ? value.bind(window) : value;
    },
    /**
     * 检查属性是否存在
     * @param target - 目标
     * @param key - 键
     * @returns 是否存在
     */
    has(target, key) {
      return Reflect.has(target, key) || key in trackedGlobals || key in window;
    },
    /**
     * 设置属性
     * @param target - 目标
     * @param key - 键
     * @param value - 值
     * @returns 是否设置成功
     */
    set(target, key, value) {
      if (
        (key === "onerror" || key === "onunhandledrejection") &&
        setGlobalHandler(key, value)
      ) {
        return true;
      }

      recordGlobalMutation(key, "set");
      return Reflect.set(target, key, value);
    },
  }) as SandboxWindow;

  const runtime: SandboxRuntime = {
    addEventListener: addEventListenerWithTracking,
    cancelAnimationFrame: cancelAnimationFrameWithTracking,
    clearInterval: clearIntervalWithTracking,
    clearTimeout: clearTimeoutWithTracking,
    getGlobalHandler(key) {
      return globalHandlers.get(key)?.current;
    },
    removeEventListener: removeEventListenerWithTracking,
    requestAnimationFrame: requestAnimationFrameWithTracking,
    setGlobalHandler,
    setInterval: setIntervalWithTracking,
    setTimeout: setTimeoutWithTracking,
  };

  return {
    activate() {
      if (active) {
        return;
      }

      active = true;
      windowPatchManager.addRuntime(runtime);
    },
    deactivate() {
      if (!active) {
        return;
      }

      timeoutIds.forEach((id) => {
        windowPatchManager.nativeClearTimeout(id);
      });
      timeoutIds.clear();

      intervalIds.forEach((id) => {
        windowPatchManager.nativeClearInterval(id);
      });
      intervalIds.clear();

      rafIds.forEach((id) => {
        windowPatchManager.nativeClearTimeout(id);
      });
      rafIds.clear();

      eventListeners.splice(0).forEach((tracked) => {
        windowPatchManager.nativeRemoveEventListener(
          tracked.type,
          tracked.listener,
          tracked.options,
        );
      });

      Array.from(globalMutations.keys()).forEach((key) => {
        delete sandboxTarget[key];
      });

      globalHandlers.forEach((patch) => {
        patch.current = null;
      });
      windowPatchManager.removeRuntime(runtime);
      active = false;
    },
    getDiagnostics() {
      return {
        active,
        eventListeners: eventListeners.map((listener) => ({
          capture: getEventCapture(listener.options),
          type: listener.type,
        })),
        globalHandlers: Array.from(globalHandlers)
          .filter(([, patch]) => patch.current != null)
          .map(([key]) => key),
        globalMutations: Array.from(globalMutations.values()),
        intervalCount: intervalIds.size,
        mode,
        rafCount: rafIds.size,
        remoteName,
        timeoutCount: timeoutIds.size,
      };
    },
    globalThis: proxyGlobal,
  };
}

/**
 * 创建沙箱化远程应用挂载
 * @param options - 选项
 * @param options.mountRemote - 挂载远程应用
 * @param options.route - 路由配置
 * @param options.sandbox - 沙箱选项
 * @returns 创建沙箱化远程应用挂载
 */
export function createSandboxedRemoteMount({
  mountRemote,
  route,
  sandbox: sandboxOptions,
}: CreateSandboxedRemoteMountOptions) {
  let lastSandbox: FederletSandbox | undefined;

  /**
   * 挂载远程应用
   * @param context - 上下文
   * @returns 沙箱化远程应用实例
   */
  async function mount(context: MicroAppContext): Promise<SandboxedMicroAppInstance> {
    const sandbox = createFederletSandbox({
      container: context.container,
      mode: "proxy",
      remoteName: route.remoteName,
      ...(sandboxOptions === false ? { mode: "off" as const } : sandboxOptions),
    });
    lastSandbox = sandbox;
    sandbox.activate();

    try {
      const instance = await mountRemote(context);

      return {
        sandbox,
        /**
         * 卸载远程应用
         * @returns 是否卸载成功
         */
        async unmount() {
          try {
            await instance.unmount();
          } finally {
            sandbox.deactivate();
          }
        },
      };
    } catch (error) {
      sandbox.deactivate();
      throw error;
    }
  }

  mount.getLastSandbox = () => lastSandbox;

  return mount;
}
