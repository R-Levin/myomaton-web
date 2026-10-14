import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReviewInterview } from "@/components/intake/interview";
import { deploymentContext } from "@/lib/platform/managed-sites/context";
import { intakeEnabled } from "@/lib/platform/intake/availability";

export const metadata = { title: "Your Free Web Presence Review — MioPages", robots: { index: false, follow: false } };
export default async function ReviewIntakePage() {
  await connection();
  if (!intakeEnabled(await deploymentContext())) notFound();
  return <ReviewInterview />;
}
