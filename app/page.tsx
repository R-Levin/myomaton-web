import { cache } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { SectionRenderer } from "@/components/microsites/section-renderer";
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

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      {result.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </main>
  );
}
