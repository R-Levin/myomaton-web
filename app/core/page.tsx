import { notFound } from "next/navigation";
import { CoreJourney } from "./journey";
import { coreOrigin } from "@/lib/platform/intake/hosted-core";

export const dynamic = "force-dynamic";
export const metadata = { title: "MioPages Core", robots: { index: false, follow: false } };

export default function ProtectedCorePage() {
  if (!coreOrigin()) notFound();
  return <CoreJourney />;
}
