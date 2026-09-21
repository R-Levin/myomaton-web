import "@puckeditor/core/no-external.css";
import { SiteEditor } from "@/components/editor/site-editor";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { editorAvailable } from "@/lib/content/access";
import { contentRepository } from "@/lib/content/storage";

export default async function EditorPage() {
  if (!editorAvailable()) notFound();
  await connection();
  return <SiteEditor initialContent={await contentRepository.read()} />;
}
