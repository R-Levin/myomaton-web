import { cache } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { MicrositePageView } from "@/components/microsites/microsite-page";
import { getMicrositePageByDomain } from "@/lib/platform/microsites/service";

const getHomePage = cache(async () => {
  await connection();
  return getMicrositePageByDomain("myomaton.com", "/");
});

export async function generateMetadata() {
  const result = await getHomePage();
  return { title: result?.page.title ?? "Myomaton" };
}

export default async function Home() {
  const result = await getHomePage();
  if (!result) notFound();

  return <MicrositePageView page={result} />;
}
