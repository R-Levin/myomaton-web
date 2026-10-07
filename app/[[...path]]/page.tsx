import { cache } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { ManagedSitePageView } from "@/components/managed-sites/managed-site-page";
import { getManagedSitePage } from "@/lib/platform/managed-sites/service";
import { deploymentSelection } from "@/lib/platform/managed-sites/deployment";
import { pagePathFromSegments } from "@/lib/platform/managed-sites/paths";

type Props = { params: Promise<{ path?: string[] }> };

const getPage = cache(async (path: string | null) => {
  if (path === null) notFound();
  await connection();
  const result = await getManagedSitePage(deploymentSelection(), path);
  if (!result) notFound();
  return result;
});

export async function generateMetadata({ params }: Props) {
  const result = await getPage(pagePathFromSegments((await params).path));
  return { title: result.page.title.trim() || result.page.name.trim() || result.managedSite.name };
}

export default async function Page({ params }: Props) {
  const result = await getPage(pagePathFromSegments((await params).path));
  return <ManagedSitePageView page={result} />;
}
