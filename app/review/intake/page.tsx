import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ReviewInterview } from "@/components/intake/interview";
import { deploymentContext } from "@/lib/platform/managed-sites/context";
import { intakeEnabled } from "@/lib/platform/intake/availability";
import { UnavailableHostname } from "@/lib/platform/managed-sites/hostname";

async function intakeContext() {
  const tenant = await deploymentContext().catch(error => { if (error instanceof UnavailableHostname) notFound(); throw error; });
  if (!intakeEnabled(tenant)) notFound();
  return tenant;
}
export async function generateMetadata() {
  await intakeContext();
  return { title: "Your Free Web Presence Review — MioPages", robots: { index: false, follow: false } };
}
export default async function ReviewIntakePage() {
  await connection();
  await intakeContext();
  return <ReviewInterview />;
}
