import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderPage } from "../../lib/simple-site/render";
import type { Site } from "../../lib/simple-site/site";

/**
 * Puts the site on the review WordPress (miopages.org) as draft pages for the Principal to look at:
 * the MioPages Simple theme, the logo, one draft page per page, and the menu. Re-running updates the
 * same pages (their ids are kept in wordpress.json beside site.json).
 *
 *   npx tsx scripts/simple-site/to-wordpress.ts --site runtime-content/simple-site/c0
 */
const flag = (name: string) => { const at = process.argv.indexOf(name); return at > 0 ? process.argv[at + 1] : undefined; };
const ssh = ["-o", "ConnectTimeout=20", "-i", "C:/Users/mplxs/.ssh/miopages_wp_20i", "miopages.org@ssh.us.stackcp.com", "bash -s"];
const wp = "/usr/php84/usr/bin/php /usr/local/bin/wp --path=$HOME/public_html";
const b64 = (text: string | Buffer) => Buffer.from(text).toString("base64");

function remote(script: string) {
  return execFileSync("C:/Windows/System32/OpenSSH/ssh.exe", ssh, { input: "set -e\n" + script, encoding: "utf8", env: { ...process.env, MSYS_NO_PATHCONV: "1" }, maxBuffer: 50_000_000 });
}

async function main() {
  const folder = flag("--site") ?? "runtime-content/simple-site/c0";
  const site = JSON.parse(await readFile(join(folder, "site.json"), "utf8")) as Site;
  const stateFile = join(folder, "wordpress.json");
  const state = JSON.parse(await readFile(stateFile, "utf8").catch(() => "{}")) as { pages?: Record<string, number>; navigation?: number; logo?: number };
  state.pages ??= {};

  // The theme: copied as files, then switched on.
  const theme = execFileSync("tar", ["-czf", "-", "-C", "wordpress", "miopages-simple"], { maxBuffer: 20_000_000 });
  remote(`echo '${b64(theme)}' | base64 -d | tar -xz -C $HOME/public_html/wp-content/themes\n${wp} theme activate miopages-simple >/dev/null`);

  // The logo, once; the footer line.
  if (!state.logo) {
    const logo = await readFile("brand/miopages/MioPagesDV.png");
    state.logo = Number(remote(`T=$(mktemp --suffix=.png); echo '${b64(logo)}' | base64 -d > $T\n${wp} media import $T --title="MioPages logo" --porcelain; rm -f $T`).trim());
  }
  remote(`${wp} option update site_logo ${state.logo} >/dev/null\n` +
    `${wp} option update blogdescription "$(echo '${b64(site.footer)}' | base64 -d)" >/dev/null\n${wp} option update blogname "$(echo '${b64(site.business)}' | base64 -d)" >/dev/null`);

  // A draft page for each page that has none yet.
  for (const page of site.pages) if (!state.pages[page.path])
    state.pages[page.path] = Number(remote(`${wp} post create --post_type=page --post_status=draft --post_title="$(echo '${b64(page.title)}' | base64 -d)" --porcelain`).trim());
  await writeFile(stateFile, JSON.stringify(state, null, 1));

  // Each page's content, with links to the other drafts (shown to a signed-in reviewer).
  const link = (path: string) => `/?page_id=${state.pages![path]}&preview=true`;
  for (const page of site.pages) {
    const id = state.pages[page.path]!;
    remote(`echo '${b64(renderPage(page, link))}' | base64 -d | ${wp} post update ${id} - --post_title="$(echo '${b64(page.title)}' | base64 -d)" >/dev/null`);
  }

  // The menu, in the site's page order (WordPress's own navigation; the theme shows the latest one).
  const menu = site.pages.map(page => `<!-- wp:navigation-link {"label":${JSON.stringify(page.menuLabel)},"url":${JSON.stringify(link(page.path))},"kind":"custom"} /-->`).join("\n");
  if (state.navigation) remote(`echo '${b64(menu)}' | base64 -d | ${wp} post update ${state.navigation} - >/dev/null`);
  else state.navigation = Number(remote(`echo '${b64(menu)}' | base64 -d | ${wp} post create - --post_type=wp_navigation --post_status=publish --post_title="Site menu" --porcelain`).trim());
  await writeFile(stateFile, JSON.stringify(state, null, 1));

  console.log("On miopages.org (drafts; sign in to see them):");
  for (const page of site.pages) console.log(`  ${page.menuLabel.padEnd(24)} https://miopages.org${link(page.path)}`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
