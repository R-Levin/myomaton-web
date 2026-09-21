import { connection } from "next/server";
import { contentRepository } from "@/lib/content/storage";
import { PageRenderer } from "@/components/editor/page-renderer";

export default async function Home() {
  await connection();
  const { published } = await contentRepository.read();
  return published ? <PageRenderer snapshot={published.snapshot} /> : <main />;
}
