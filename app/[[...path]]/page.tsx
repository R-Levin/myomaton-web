import { cache } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ManagedSitePageView } from "@/components/managed-sites/managed-site-page";
import { getManagedSitePage } from "@/lib/platform/managed-sites/service";
import { deploymentContext } from "@/lib/platform/managed-sites/context";
import { UnavailableHostname } from "@/lib/platform/managed-sites/hostname";
import { pagePathFromSegments } from "@/lib/platform/managed-sites/paths";
import { reviewConversions } from "@/lib/platform/intake/conversion";

type Props = { params: Promise<{ path?: string[] }> };

const getPage = cache(async (webPresenceId: string, managedSiteId: string, hostname: string | null, path: string | null) => {
  void hostname; // Explicit cache identity; no cross-host persistent cache exists.
  if (path === null) notFound();
  const result = await getManagedSitePage({ webPresenceId, managedSiteId }, path);
  if (!result) notFound();
  return result;
});

async function requestPage(path: string | null) {
  await connection();
  const tenant = await deploymentContext().catch(error => { if (error instanceof UnavailableHostname) notFound(); throw error; });
  return { tenant, result: await getPage(tenant.webPresenceId, tenant.managedSiteId, tenant.hostname, path) };
}

export async function generateMetadata({ params }: Props) {
  const { result, tenant } = await requestPage(pagePathFromSegments((await params).path));
  const title = result.page.title.trim() || result.page.name.trim() || result.managedSite.name;
  const canonical = tenant.hostname ? `https://${tenant.hostname}${result.page.slug}` : undefined;
  return { title, ...(canonical ? { alternates: { canonical }, openGraph: { title, url: canonical } } : {}) };
}

export default async function Page({ params }: Props) {
  const { result, tenant } = await requestPage(pagePathFromSegments((await params).path));
  return <ManagedSitePageView page={result} operationalConversions={reviewConversions(result, tenant)} />;
}
