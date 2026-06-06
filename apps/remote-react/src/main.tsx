// 异步引导入口，避免 React shared 在 Module Federation 初始化前同步加载。
import("./bootstrap");
