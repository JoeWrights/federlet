/**
 * 全局处理器键
 */
export const GLOBAL_HANDLER_KEYS = ["onerror", "onunhandledrejection"] as const;

/**
 * 定时器 ID
 */
export type TimerId = number;

/**
 * 请求动画帧 ID
 */
export type RafId = number;

/**
 * 事件监听目标
 */
export type EventListenerTarget = EventListenerOrEventListenerObject;

/**
 * 全局处理器补丁
 */
export interface GlobalHandlerPatch {
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
 * 沙箱运行时
 */
export interface SandboxRuntime {
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
 * 管理 window 全局方法 patch。
 *
 * 多个 sandbox 并发激活时只安装一份全局 patch，并在最后一个 sandbox
 * 移除后恢复原生 window 方法。
 */
export class WindowPatchManager {
  private activeRuntimes: SandboxRuntime[] = [];

  private globalHandlerPatches:
    | Map<(typeof GLOBAL_HANDLER_KEYS)[number], GlobalHandlerPatch>
    | undefined;

  private installed = false;

  private nativeMethods: NativeWindowMethods | undefined;

  addRuntime(runtime: SandboxRuntime) {
    this.patchWindow();

    if (!this.activeRuntimes.includes(runtime)) {
      this.activeRuntimes.push(runtime);
    }
  }

  removeRuntime(runtime: SandboxRuntime) {
    const index = this.activeRuntimes.indexOf(runtime);

    if (index >= 0) {
      this.activeRuntimes.splice(index, 1);
    }

    if (this.activeRuntimes.length === 0) {
      this.restoreWindow();
    }
  }

  nativeAddEventListener(
    type: string,
    listener: EventListenerTarget,
    options?: AddEventListenerOptions | boolean,
  ) {
    return this.getNativeMethods().addEventListener.call(
      window,
      type,
      listener,
      options,
    );
  }

  nativeCancelAnimationFrame(id: RafId) {
    const native = this.getNativeMethods();

    if (native.cancelAnimationFrame) {
      native.cancelAnimationFrame.call(window, id);
    } else {
      native.clearTimeout.call(window, id);
    }
  }

  nativeClearInterval(id?: TimerId) {
    return this.getNativeMethods().clearInterval.call(window, id);
  }

  nativeClearTimeout(id?: TimerId) {
    return this.getNativeMethods().clearTimeout.call(window, id);
  }

  nativeRemoveEventListener(
    type: string,
    listener: EventListenerTarget,
    options?: EventListenerOptions | boolean,
  ) {
    return this.getNativeMethods().removeEventListener.call(
      window,
      type,
      listener,
      options,
    );
  }

  nativeRequestAnimationFrame(callback: FrameRequestCallback) {
    const native = this.getNativeMethods();

    return native.requestAnimationFrame
      ? native.requestAnimationFrame.call(window, callback)
      : Number(native.setTimeout.call(window, () => callback(performance.now()), 16));
  }

  nativeSetInterval(
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ): TimerId {
    return this.getNativeMethods().setInterval.apply(window, [
      handler,
      timeout,
      ...args,
    ] as unknown as Parameters<typeof window.setInterval>) as unknown as TimerId;
  }

  nativeSetTimeout(
    handler: TimerHandler,
    timeout?: number,
    ...args: unknown[]
  ): TimerId {
    return this.getNativeMethods().setTimeout.apply(window, [
      handler,
      timeout,
      ...args,
    ] as unknown as Parameters<typeof window.setTimeout>) as unknown as TimerId;
  }

  private getNativeMethods() {
    if (!this.nativeMethods) {
      this.nativeMethods = {
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

    return this.nativeMethods;
  }

  private getCurrentRuntime() {
    return this.activeRuntimes.at(-1);
  }

  private patchWindow() {
    if (this.installed) {
      return;
    }

    const native = this.getNativeMethods();
    this.globalHandlerPatches = new Map();

    window.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      const runtime = this.getCurrentRuntime();

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
      this.activeRuntimes.forEach((runtime) => runtime.clearTimeout(id));

      return native.clearTimeout.call(window, id);
    }) as typeof window.clearTimeout;
    window.setInterval = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      const runtime = this.getCurrentRuntime();

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
      this.activeRuntimes.forEach((runtime) => runtime.clearInterval(id));

      return native.clearInterval.call(window, id);
    }) as typeof window.clearInterval;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      const runtime = this.getCurrentRuntime();

      if (runtime) {
        return runtime.requestAnimationFrame(callback);
      }

      return native.requestAnimationFrame
        ? native.requestAnimationFrame.call(window, callback)
        : Number(native.setTimeout.call(window, () => callback(performance.now()), 16));
    };
    window.cancelAnimationFrame = (id: RafId) => {
      this.activeRuntimes.forEach((runtime) => runtime.cancelAnimationFrame(id));

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
      const runtime = this.getCurrentRuntime();

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
      this.activeRuntimes.forEach((runtime) =>
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
      this.globalHandlerPatches.set(key, patch);

      Object.defineProperty(window, key, {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get: () => this.getCurrentRuntime()?.getGlobalHandler(key) ?? patch.current,
        set: (value) => {
          if (!this.getCurrentRuntime()?.setGlobalHandler(key, value)) {
            patch.current = value;
          }
        },
      });
    }

    this.installed = true;
  }

  private restoreWindow() {
    if (!this.installed || !this.nativeMethods) {
      return;
    }

    window.setTimeout = this.nativeMethods.setTimeout;
    window.clearTimeout = this.nativeMethods.clearTimeout;
    window.setInterval = this.nativeMethods.setInterval;
    window.clearInterval = this.nativeMethods.clearInterval;
    window.requestAnimationFrame = this.nativeMethods.requestAnimationFrame;
    window.cancelAnimationFrame = this.nativeMethods.cancelAnimationFrame;
    window.addEventListener = this.nativeMethods.addEventListener;
    window.removeEventListener = this.nativeMethods.removeEventListener;

    this.globalHandlerPatches?.forEach((patch, key) => {
      if (patch.existed && patch.descriptor) {
        Object.defineProperty(window, key, patch.descriptor);
      } else {
        Reflect.deleteProperty(window, key);
      }
    });
    this.globalHandlerPatches = undefined;
    this.installed = false;
    this.nativeMethods = undefined;
  }
}
