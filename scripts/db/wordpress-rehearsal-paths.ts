import path from "node:path";

const checks = ["configuration", "platform", "home_absolute", "repository_location", "continuation_flag",
  "manifest_absolute", "original_manifest_location", "manifest_parent", "manifest_directory_name", "original_manifest_checksum",
  "manifest_file_protection", "manifest_directory_protection", "manifest_checksum_format", "manifest_checksum", "manifest_structure",
  "distinct_manifests", "role_file_protection", "role_file_format", "role_login", "session_pooler_port", "verify_full_query",
  "url_fragment", "migration_password_presence", "connection_parameters", "ca_readability",
  "private_root_absolute", "private_root_parent", "private_root_name", "private_root_protection"] as const;
export type RehearsalConfigurationCheck = typeof checks[number];
type Paths = Pick<typeof path, "isAbsolute" | "resolve" | "join" | "dirname" | "basename">;

export function configurationCheck(passed: unknown, assertion: RehearsalConfigurationCheck): asserts passed {
  if (!passed) throw Object.assign(Error("Protected rehearsal configuration refused"), {
    code: "WP_REHEARSAL_CONFIGURATION_INVALID", assertion,
  });
}

function absolute(value: unknown, assertion: RehearsalConfigurationCheck, paths: Paths) {
  configurationCheck(typeof value === "string" && paths.isAbsolute(value), assertion);
  return paths.resolve(value);
}

export function rehearsalHome(value: unknown, paths: Paths = path) {
  return absolute(value, "home_absolute", paths);
}

// Lexical normalization only: callers still lstat the selected file/directory
// and enforce ownership, no symlinks, exact modes, contents and checksums.
export function rehearsalManifestPath(homeInput: unknown, fileInput: unknown, original = false, paths: Paths = path) {
  const home = rehearsalHome(homeInput, paths), file = absolute(fileInput, "manifest_absolute", paths);
  if (original) configurationCheck(file === paths.join(home, "miopages-wp-principals-20261106T144226Z/manifest.json"), "original_manifest_location");
  configurationCheck(paths.dirname(paths.dirname(file)) === home, "manifest_parent");
  configurationCheck(/^miopages-wp-principals-[0-9TZ]+$/.test(paths.basename(paths.dirname(file))), "manifest_directory_name");
  return file;
}

export function rehearsalPrivateRoot(homeInput: unknown, rootInput: unknown, paths: Paths = path) {
  const home = rehearsalHome(homeInput, paths), root = absolute(rootInput, "private_root_absolute", paths);
  configurationCheck(paths.dirname(root) === home, "private_root_parent");
  configurationCheck(/^miopages-wp-principals-[0-9TZ]+$/.test(paths.basename(root)), "private_root_name");
  return root;
}

// Never copy error messages, assertion actual/expected values or arbitrary labels.
export function rehearsalConfigurationDiagnostic(error: unknown, fallback: RehearsalConfigurationCheck = "configuration") {
  const source = error as { code?: unknown; assertion?: unknown } | null;
  const assertion = checks.find(check => check === source?.assertion) ?? fallback;
  const code = ["ENOENT", "EACCES", "EPERM"].find(value => value === source?.code) ?? "WP_REHEARSAL_CONFIGURATION_INVALID";
  return { stage: "configuration", code, assertion,
    detail: "The named protected rehearsal configuration check failed; no database operation was started." };
}
