declare module "*.mjs" {
  export function resolveRtpgBaseDir(customCwd?: string): string;
  export function resolveStorageDir(customCwd?: string): string;
  export function resolveDatabaseUrl(customCwd?: string): string;
}
