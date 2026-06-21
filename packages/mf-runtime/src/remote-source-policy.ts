import type { RemoteSourcePolicy } from "@federlet/shared-types";

/**
 * 远程入口来源策略错误码。
 */
export type RemoteSourcePolicyErrorCode =
  | "REMOTE_SOURCE_INVALID_URL"
  | "REMOTE_SOURCE_HTTPS_REQUIRED"
  | "REMOTE_SOURCE_NOT_ALLOWED";

/**
 * 远程入口来源策略验证结果。
 */
export interface RemoteSourcePolicyValidationResult {
  /**
   * 是否允许加载远程入口。
   */
  allowed: boolean;
  /**
   * 错误码。
   */
  code?: RemoteSourcePolicyErrorCode;
  /**
   * 错误原因。
   */
  reason?: string;
}

/**
 * 远程入口来源策略错误选项。
 */
export interface RemoteSourcePolicyErrorOptions {
  /**
   * 错误码。
   */
  code: RemoteSourcePolicyErrorCode;
  /**
   * 远程入口 URL。
   */
  entry: string;
  /**
   * 错误原因。
   */
  reason: string;
  /**
   * 远程应用名称。
   */
  remoteName: string;
}

/**
 * 远程入口来源策略错误。
 */
export class RemoteSourcePolicyError extends Error {
  /**
   * 错误码。
   */
  code: RemoteSourcePolicyErrorCode;
  /**
   * 远程入口 URL。
   */
  entry: string;
  /**
   * 远程应用名称。
   */
  remoteName: string;

  constructor({ code, entry, reason, remoteName }: RemoteSourcePolicyErrorOptions) {
    super(reason);
    this.name = "RemoteSourcePolicyError";
    this.code = code;
    this.entry = entry;
    this.remoteName = remoteName;
  }
}

/**
 * 解析远程入口 URL。
 * @param entry - 远程入口 URL。
 * @returns 远程入口 URL。
 */
function parseRemoteEntryUrl(entry: string) {
  try {
    return new URL(entry);
  } catch {
    return null;
  }
}

/**
 * 判断是否为 localhost。
 * @param url - 远程入口 URL。
 * @returns 是否为 localhost。
 */
function isLocalhost(url: URL) {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "::1" ||
    url.hostname === "[::1]"
  );
}

/**
 * 标准化 origin。
 * @param origin - origin。
 * @returns 标准化后的 origin。
 */
function normalizeOrigin(origin: string) {
  return parseRemoteEntryUrl(origin)?.origin ?? origin.replace(/\/+$/, "");
}

/**
 * 标准化远程入口 URL。
 * @param entry - 远程入口 URL。
 * @returns 标准化后的远程入口 URL。
 */
function normalizeEntryUrl(entry: string) {
  return parseRemoteEntryUrl(entry)?.href ?? entry;
}

/**
 * 验证远程入口来源。
 * @param entry - 远程入口 URL。
 * @param policy - 远程入口来源策略。
 * @returns 远程入口来源策略验证结果。
 */
export function validateRemoteEntrySource(
  entry: string,
  policy?: RemoteSourcePolicy,
): RemoteSourcePolicyValidationResult {
  if (!policy) {
    return { allowed: true };
  }

  const url = parseRemoteEntryUrl(entry);

  if (!url) {
    return {
      allowed: false,
      code: "REMOTE_SOURCE_INVALID_URL",
      reason: `Remote entry URL is invalid: ${entry}`,
    };
  }

  const localhost = isLocalhost(url);

  if (policy.enforceHttps && !localhost && url.protocol !== "https:") {
    return {
      allowed: false,
      code: "REMOTE_SOURCE_HTTPS_REQUIRED",
      reason: `Remote entry must use HTTPS: ${entry}`,
    };
  }

  if (
    policy.allowedEntryUrls?.map(normalizeEntryUrl).includes(url.href) ||
    policy.allowedOrigins?.map(normalizeOrigin).includes(url.origin) ||
    (policy.allowLocalhost && localhost)
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: "REMOTE_SOURCE_NOT_ALLOWED",
    reason: `Remote entry origin is not allowed: ${url.origin}`,
  };
}

/**
 * 断言远程入口来源。
 * @param remoteName - 远程应用名称。
 * @param entry - 远程入口 URL。
 * @param policy - 远程入口来源策略。
 */
export function assertRemoteEntrySourceAllowed(
  remoteName: string,
  entry: string,
  policy?: RemoteSourcePolicy,
) {
  const result = validateRemoteEntrySource(entry, policy);

  if (!result.allowed) {
    throw new RemoteSourcePolicyError({
      code: result.code ?? "REMOTE_SOURCE_NOT_ALLOWED",
      entry,
      reason: result.reason ?? `Remote entry is not allowed: ${entry}`,
      remoteName,
    });
  }
}
