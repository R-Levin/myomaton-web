import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { fingerprint } from "../../lib/platform/canonical/model";
import { adaptiveOnboardingVersion } from "../../lib/platform/intake/adaptive";
import { normalizeAnswers } from "../../lib/platform/intake/model";
import type { IntakeView } from "../../lib/platform/intake/service";

export async function readRetainedC0(file: string) {
  const metadata = await lstat(file);
  if (!metadata.isFile() || metadata.size > 128_000) throw Error("Invalid retained evidence file");
  const bytes = await readFile(file);
  if (createHash("sha256").update(bytes).digest("hex") !== "1ffa67e188af39edc21b996bd73b65742263d843c21020fcc2e3f24361c79a05") {
    throw Error("Retained evidence checksum mismatch");
  }
  const { browserCapture, preparedSourceFingerprint } = JSON.parse(bytes.toString("utf8"));
  const view: IntakeView = browserCapture.view;
  const { answers, provenance, prepared, step } = view;
  if (view.questionnaireVersion !== adaptiveOnboardingVersion || view.state !== "draft" || view.intent !== "DIRECT_START" ||
      prepared?.scenario !== "c0" || fingerprint(prepared) !== preparedSourceFingerprint ||
      !provenance || Object.keys(answers).some(key => provenance[key]?.confirmation !== "unconfirmed") ||
      fingerprint(answers) !== fingerprint(normalizeAnswers(answers, adaptiveOnboardingVersion)) || step !== 3) {
    throw Error("Retained evidence binding mismatch");
  }
  return { answers, provenance, prepared, step };
}
