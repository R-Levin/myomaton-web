import { areas, goals, projects, responses, type Answers } from "../../lib/platform/intake/model";
export function intakeAnswers(project: string = projects[0]): Answers {
  return { project, businessName: "Synthetic Review Test Business", website: project === projects[1] ? "" : "https://example.test/", publicProfile: "",
    goals: [goals[0], goals[1]], audience: "Local business teams", offer: "Training services", difference: "Not yet established",
    problem: "Clarify our offer", reviewFocus: "How to help the right people find us", responses: [responses[0], responses[1]],
    serviceArea: areas[0], locations: "Synthetic Town", contactName: "Synthetic Test Prospect", email: "synthetic@example.test", role: "", phone: "", additional: "" };
}
