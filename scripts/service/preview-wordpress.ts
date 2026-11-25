import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import sharp from "sharp";
import { enrolReviewSite } from "../wordpress-enrol-review-site";

/**
 * A throwaway WordPress for the workspace preview (rebuild plan, milestone 2): a copy of the
 * WordPress on this computer with an empty database, this branch's delivery plugin and theme,
 * and its own delivery keys, enrolled exactly as a real review site is. Drafts from the
 * workspace land here, and the Principal can open them, leave Notes and edit, without touching
 * any existing local site. Its database is a throwaway MariaDB (`mysqlBin`), because the plugin
 * writes drafts in a MySQL transaction (InnoDB and GET_LOCK), as on the hosting. Everything lives
 * in `root` and goes when the preview stops.
 */
const php = process.env.PHP_BIN ?? "C:/php/php.exe";
const phpFlags = ["-d", "extension_dir=C:/php/ext", "-d", "extension=mysqli", "-d", "extension=gd"];
const phpString = (value: string) => "'" + value.replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
const slash = (path: string) => path.replaceAll("\\", "/");

/** Start a throwaway MariaDB on this computer only, with a random root password; wait until it answers. */
async function throwawayMariaDB(mysqlBin: string, root: string, port: number) {
  const data = join(root, "mariadb"), password = randomBytes(18).toString("base64url");
  const made = spawnSync(join(mysqlBin, "mariadb-install-db.exe"), [`--datadir=${data}`, `--password=${password}`, `--port=${port}`], { encoding: "utf8" });
  if (made.status !== 0) throw Error("Preview MariaDB did not initialise: " + (made.stderr || made.stdout).slice(0, 300));
  const server = spawn(join(mysqlBin, "mariadbd.exe"), [`--datadir=${data}`, `--port=${port}`, "--bind-address=127.0.0.1", "--console"], { stdio: "ignore" });
  const client = (sql: string) => spawnSync(join(mysqlBin, "mariadb.exe"), ["-h", "127.0.0.1", "-P", String(port), "-u", "root", "-e", sql],
    { encoding: "utf8", env: { ...process.env, MYSQL_PWD: password } });
  for (let tries = 0; client("SELECT 1").status !== 0; tries++) {
    if (tries > 60) { server.kill(); throw Error("Preview MariaDB did not start"); }
    await new Promise(done => setTimeout(done, 500));
  }
  if (client("CREATE DATABASE miopages_preview CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci").status !== 0) { server.kill(); throw Error("Preview database not created"); }
  return { server, host: `127.0.0.1:${port}`, password };
}

export async function previewWordPress(input: { root: string; source: string; port: number; databasePort: number; mysqlBin: string; organizationId: string;
  account: { webPresenceId: string; managedSiteId: string }; siteName: string }) {
  const { root, port } = input, origin = `http://127.0.0.1:${port}`;
  const site = join(root, "wordpress"), secrets = join(root, "private");
  // WordPress itself, without the source site's content, local helpers or older copies of MioPages' plugin and theme.
  const skip = ["wp-config.php", "wp-content/db.php", "wp-content/plugins/sqlite-database-integration", "wp-content/uploads", "wp-content/mu-plugins", "wp-content/plugins/miopages-delivery", "wp-content/themes/miopages-managed-site"];
  await cp(input.source, site, { recursive: true, filter: from => !skip.some(item => slash(relative(input.source, from)).startsWith(item)) });
  await cp("wordpress/miopages-delivery", join(site, "wp-content/plugins/miopages-delivery"), { recursive: true });
  await cp("wordpress/miopages-managed-site", join(site, "wp-content/themes/miopages-managed-site"), { recursive: true });
  await mkdir(join(site, "wp-content/uploads"), { recursive: true });
  await mkdir(secrets, { recursive: true });

  // A labelled stand-in wordmark: the Client's real one is a Work product, not part of the preview.
  const wordmark = join(root, "wordmark.png");
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="96"><rect width="480" height="96" fill="#ffffff"/>
    <text x="16" y="60" font-family="Arial" font-size="34" fill="#1f1f1f">${input.siteName.replace(/[<&>]/gu, "")} (stand-in)</text></svg>`)).png().toFile(wordmark);
  const enrolled = await enrolReviewSite([secrets, "preview", origin, input.organizationId, input.account.webPresenceId, input.account.managedSiteId,
    "core-delivery", wordmark, randomUUID(), randomUUID(), input.siteName], {});

  const database = await throwawayMariaDB(input.mysqlBin, root, input.databasePort);
  const salts = ["AUTH_KEY", "SECURE_AUTH_KEY", "LOGGED_IN_KEY", "NONCE_KEY", "AUTH_SALT", "SECURE_AUTH_SALT", "LOGGED_IN_SALT", "NONCE_SALT"]
    .map(name => `define('${name}', '${randomBytes(32).toString("hex")}');`).join("\n");
  await writeFile(join(site, "wp-config.php"), `<?php
// Workspace preview only: a throwaway WordPress on this computer.
define('DB_NAME', 'miopages_preview');
define('DB_USER', 'root');
define('DB_PASSWORD', ${phpString(database.password)});
define('DB_HOST', '${database.host}');
define('DB_CHARSET', 'utf8mb4');
define('WP_HOME', '${origin}');
define('WP_SITEURL', '${origin}');
define('WP_HTTP_BLOCK_EXTERNAL', true);
define('WP_AUTO_UPDATE_CORE', false);
define('DISALLOW_FILE_MODS', true);
define('WP_DEBUG', false);
${salts}
require ${phpString(slash(join(secrets, "preview-wordpress-config.php")))};
$table_prefix = 'wp_';
if (!defined('ABSPATH')) define('ABSPATH', __DIR__ . '/');
require_once ABSPATH . 'wp-settings.php';
`);

  // Install: the Principal's own login for this copy (written to a file here, never shown), and the account delivery writes as.
  const login = { user: "principal", password: randomBytes(12).toString("base64url") };
  await writeFile(join(root, "WORDPRESS-LOGIN.txt"), `Preview WordPress (throwaway): ${origin}/wp-admin\nUser: ${login.user}\nPassword: ${login.password}\n`);
  const install = `<?php
define('WP_INSTALLING', true);
$_SERVER['HTTP_HOST'] = '127.0.0.1:${port}'; $_SERVER['REQUEST_URI'] = '/';
require ${phpString(slash(join(site, "wp-load.php")))};
require_once ABSPATH . 'wp-admin/includes/upgrade.php';
require_once ABSPATH . 'wp-admin/includes/plugin.php';
wp_install(${phpString(input.siteName + " (preview)")}, ${phpString(login.user)}, 'principal@preview.test', false, '', ${phpString(login.password)});
update_option('permalink_structure', '/%postname%/');
update_option('blog_public', '0');
$plugin = activate_plugin('miopages-delivery/miopages-delivery.php');
if (is_wp_error($plugin)) { fwrite(STDERR, $plugin->get_error_message()); exit(1); }
switch_theme('miopages-managed-site');
$user = wp_insert_user(['user_login' => 'core-delivery', 'user_pass' => ${phpString(randomBytes(24).toString("hex"))}, 'role' => 'editor', 'display_name' => 'MioPages Core', 'user_email' => 'core-delivery@preview.test']);
if (is_wp_error($user)) { fwrite(STDERR, $user->get_error_message()); exit(1); }
echo 'installed';
`;
  await writeFile(join(root, "install.php"), install);
  const installed = spawnSync(php, [...phpFlags, join(root, "install.php")], { encoding: "utf8", cwd: site });
  if (installed.status !== 0 || !installed.stdout.includes("installed")) database.server.kill();
  if (installed.status !== 0 || !installed.stdout.includes("installed")) throw Error("Preview WordPress did not install: " + (installed.stderr || installed.stdout).slice(0, 400));

  await writeFile(join(root, "router.php"), `<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = realpath(__DIR__ . '/wordpress' . $path);
if (is_string($file) && str_starts_with($file, realpath(__DIR__ . '/wordpress')) && is_file($file) && !str_ends_with($file, '.php')) return false;
if (is_string($file) && is_file($file) && str_ends_with($file, '.php')) { chdir(dirname($file)); require $file; return; }
if (is_string($file) && is_dir($file) && is_file($file . DIRECTORY_SEPARATOR . 'index.php')) { chdir($file); require $file . DIRECTORY_SEPARATOR . 'index.php'; return; }
chdir(__DIR__ . '/wordpress');
require __DIR__ . '/wordpress/index.php';
`);
  const server: ChildProcess = spawn(php, [...phpFlags, "-S", `127.0.0.1:${port}`, "-t", site, join(root, "router.php")], { stdio: "ignore", cwd: site });
  const stop = () => { server.kill(); database.server.kill(); };
  return { origin, stop, config: join(secrets, enrolled.files[0]), login: join(root, "WORDPRESS-LOGIN.txt").split(sep).join("/") };
}
