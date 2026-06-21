/**
 * 管理 window 自有属性快照和恢复。
 *
 * 多个 sandbox 并发激活时只记录一份基线，并在最后一个 sandbox
 * 释放后统一恢复，避免提前卸载的 remote 误删仍在运行的 remote 属性。
 */
export class WindowPropertySnapshotManager {
  private activeCount = 0;

  private baselineDescriptors: Map<PropertyKey, PropertyDescriptor> | undefined;

  /**
   * 记录快照。
   */
  capture() {
    if (this.activeCount === 0) {
      this.baselineDescriptors = this.getWindowDescriptors();
    }

    this.activeCount += 1;
  }

  /**
   * 释放快照引用，并在最后一个 sandbox 释放时恢复 window。
   */
  release() {
    if (this.activeCount === 0) {
      return;
    }

    this.activeCount -= 1;

    if (this.activeCount === 0) {
      this.restoreSnapshot();
      this.baselineDescriptors = undefined;
    }
  }

  private getWindowDescriptors() {
    const descriptors = new Map<PropertyKey, PropertyDescriptor>();

    Reflect.ownKeys(window).forEach((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(window, key);

      if (descriptor) {
        descriptors.set(key, descriptor);
      }
    });

    return descriptors;
  }

  private descriptorsEqual(
    left: PropertyDescriptor | undefined,
    right: PropertyDescriptor | undefined,
  ) {
    if (!left || !right) {
      return left === right;
    }

    return (
      left.configurable === right.configurable &&
      left.enumerable === right.enumerable &&
      left.get === right.get &&
      left.set === right.set &&
      left.value === right.value &&
      left.writable === right.writable
    );
  }

  private isPlatformRuntimeKey(key: PropertyKey) {
    if (typeof key !== "string") {
      return false;
    }

    return (
      key === "__FEDERATION__" ||
      key === "__FEDERATION__.__INSTANCES__" ||
      key.startsWith("webpackChunk") ||
      key.startsWith("webpackHotUpdate") ||
      key.startsWith("__webpack") ||
      key.startsWith("remote_")
    );
  }

  private restoreSnapshot() {
    if (!this.baselineDescriptors) {
      return;
    }

    Reflect.ownKeys(window).forEach((key) => {
      if (this.isPlatformRuntimeKey(key)) {
        return;
      }

      if (!this.baselineDescriptors?.has(key)) {
        try {
          Reflect.deleteProperty(window, key);
        } catch {
          // Non-configurable properties cannot be removed; keep the app running.
        }
      }
    });

    this.baselineDescriptors.forEach((descriptor, key) => {
      if (this.isPlatformRuntimeKey(key)) {
        return;
      }

      const currentDescriptor = Object.getOwnPropertyDescriptor(window, key);

      if (this.descriptorsEqual(currentDescriptor, descriptor)) {
        return;
      }

      try {
        Object.defineProperty(window, key, descriptor);
      } catch {
        // Some browser globals are not restorable once changed.
      }
    });
  }
}
