# CSP 和 Remote 加载来源治理

## 目标

Federlet 的 remoteEntry 地址由运行时 manifest 下发，不能只依赖代码仓库里的静态配置来保证安全。治理目标是建立两层边界：

- 浏览器层：通过 CSP 限制 Shell 页面允许执行脚本和加载连接的来源。
- 运行时层：Shell 在注册 Module Federation remote 前校验 remoteEntry URL 是否来自受信来源。

这两层要同时存在。CSP 是浏览器最终防线；运行时校验用于尽早拒绝错误或被污染的 manifest，并提供可测试、可审计的失败行为。

## 信任边界

Shell 是唯一可以读取运行时 manifest 并注册 remoteEntry 的主体。Remote 不允许自行追加其他 remote，也不允许绕过 Shell 的 registry 直接修改 Module Federation runtime。

Apollo 或发布流水线注入的 manifest 属于配置输入，不视为天然可信。Shell 必须在使用前校验：

- manifest 结构合法。
- remote 与 Shell 协议版本兼容。
- remoteEntry 来源符合当前环境的来源策略。
- disabled remote 不进入注册流程。

## CSP 治理

生产环境应由部署层或网关为 Shell HTML 下发 CSP。建议从 `Content-Security-Policy-Report-Only` 开始观察，再切到强制模式。

基础策略建议：

```text
default-src 'self';
script-src 'self' https://shell-cdn.example.com https://remote-cdn.example.com;
connect-src 'self' https://apollo.example.com https://remote-cdn.example.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data: https:;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
report-uri https://csp-report.example.com/federlet;
```

治理规则：

- `script-src` 必须包含 Shell 自身静态资源来源和所有受信 remote 静态资源来源。
- `connect-src` 必须包含 Apollo/配置中心来源，以及需要通过 `fetch` 探测 remoteEntry 类型的 remote 来源。
- 生产环境不允许把任意域名或通配符加入 `script-src`。
- 如果 remote 以独立 CDN 发布，必须将 CDN origin 纳入发布审批，而不是让业务直接在 manifest 中写任意 URL。
- 本地开发可以允许 `http://localhost:<port>`，但该策略不得进入生产集群。

## Remote 来源策略

运行时环境新增 `remoteSourcePolicy`，由 Apollo 或发布流水线按环境注入。

策略字段：

- `allowedOrigins`：允许加载 remoteEntry 的 origin 列表，例如 `https://remote-cdn.example.com`。
- `allowedEntryUrls`：允许的 remoteEntry 完整 URL 列表，用于灰度、临时回滚或单个版本白名单。
- `allowLocalhost`：是否允许任意 `localhost`、`127.0.0.1`、`::1` 来源，只应在临时本地联调未知端口时开启。常规本地开发优先用 `allowedOrigins` 精确列出端口。
- `enforceHttps`：是否要求非 localhost remoteEntry 使用 HTTPS，生产环境应开启。

校验规则：

1. remoteEntry 必须是合法 URL。
2. `enforceHttps` 开启时，非 localhost URL 必须使用 `https:`。
3. 完整 URL 命中 `allowedEntryUrls` 时放行。
4. origin 命中 `allowedOrigins` 时放行。
5. `allowLocalhost` 开启且 URL 是 localhost 时放行。
6. 其他情况拒绝注册。

## 失败策略

来源校验失败时，Shell 不注册该 remoteEntry。运行时应抛出明确错误，包含 remote 名称、entry 和失败原因，便于错误边界、日志和监控按 remote 维度聚合。

当前阶段先在注册入口阻断不受信 remote，避免被污染 manifest 进入 Module Federation runtime。后续可以把失败细化到 registry health，让 Shell 继续加载同一 manifest 中其他来源合法的 remote。

## 发布 Checklist

- Apollo manifest 中所有 remoteEntry origin 已纳入 `remoteSourcePolicy`。
- Shell CSP `script-src` 与 `connect-src` 覆盖这些 origin。
- 生产 `remoteSourcePolicy.enforceHttps` 为 `true`。
- 生产不启用 `allowLocalhost`。
- 新增 remote 或切 CDN 时，同时更新 manifest、remote source policy 和 CSP。
- CI 至少运行 `pnpm test` 和 `pnpm typecheck`，覆盖来源策略单测。
