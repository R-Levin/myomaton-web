import { notFound } from "next/navigation";
import { editorAvailable } from "@/lib/content/access";
import { WorkingPreview } from "@/components/editor/working-preview";

export default function PreviewPage() {
  if (!editorAvailable()) notFound();
  return <WorkingPreview />;
}
