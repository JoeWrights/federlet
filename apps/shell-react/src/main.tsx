// 异步引导入口，避免 Module Federation shared 依赖在初始化前被同步消费。
import("./bootstrap");
