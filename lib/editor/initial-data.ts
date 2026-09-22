import { siteConfig } from "@/lib/site";
import type { EditorData } from "@/types/editor";

export const initialEditorData: EditorData = {
  root: { props: {} },
  content: [
    {
      type: "Hero",
      props: {
        id: "myomaton-hero",
        eyebrow: siteConfig.name,
        heading: "My Own Robot",
        supportingText: "What should a useful personal robot actually be?",
        ctaLabel: "",
        ctaUrl: "",
        alignment: "left",
        width: "standard",
        spacing: "standard",
      },
    },
    {
      type: "ContentSection",
      props: {
        id: "myomaton-household",
        heading: "A useful robot is a member of the household",
        body: "A household robot does not operate in isolation.\n\nIt has to work with people, other robots, computers, charging systems, shared knowledge, and the ordinary constraints of the home.",
        width: "standard",
        alignment: "left",
        spacing: "standard",
      },
    },
  ],
};
