/**
 * 创建远程 scope class。
 */
export function createRemoteScopeClass(remoteName: string) {
  const normalizedName = remoteName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `federlet-scope-${normalizedName}`;
}

/**
 * 创建远程容器 class。
 */
export function createRemoteContainerClassName(
  baseClassName: string,
  remoteName: string,
) {
  return `${baseClassName} ${createRemoteScopeClass(remoteName)}`;
}
