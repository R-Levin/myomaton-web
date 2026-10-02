import { cache } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { MicrositePageView } from "@/components/microsites/microsite-page";
import { getMicrositePage } from "@/lib/platform/microsites/service";
import { micrositeDeployment } from "@/lib/platform/microsites/deployment";
import { pagePathFromSegments } from "@/lib/platform/microsites/paths";

type Props = { params: Promise<{ path?: string[] }> };

const getPage = cache(async (path: string | null) => {
  if (path === null) notFound();
  await connection();
  const result = await getMicrositePage(micrositeDeployment, path);
  if (!result) notFound();
  return result;
});

export async function generateMetadata({ params }: Props) {
  const result = await getPage(pagePathFromSegments((await params).path));
  return { title: result.page.title.trim() || result.page.name.trim() || result.microsite.name };
}

export default async function Page({ params }: Props) {
  const result = await getPage(pagePathFromSegments((await params).path));
  return <MicrositePageView page={result} />;
}
