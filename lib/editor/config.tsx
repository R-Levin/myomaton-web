import type { Config } from "@puckeditor/core";
import { ContentSection, Hero } from "@/components/editor/blocks";
import { ThemedPage } from "@/components/editor/site-theme-provider";
import type { EditorComponents } from "@/types/editor";
import { contentWidthOptions, spacingOptions } from "@/lib/site-theme";

export const editorConfig: Config<EditorComponents> = {
  root: {
    fields: {},
    render: ({ children }) => <ThemedPage>{children}</ThemedPage>,
  },
  components: {
    Hero: {
      fields: {
        eyebrow: { type: "text", label: "Eyebrow / site name" },
        heading: { type: "text", label: "Heading" },
        supportingText: { type: "textarea", label: "Supporting text" },
        ctaLabel: { type: "text", label: "CTA label (optional)" },
        ctaUrl: { type: "text", label: "CTA URL (optional)" },
        alignment: {
          type: "radio",
          label: "Alignment",
          options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }],
        },
        width: {
          type: "radio", label: "Content width",
          options: contentWidthOptions.filter(({ value }) => value !== "narrow"),
        },
        spacing: { type: "radio", label: "Section spacing", options: [...spacingOptions] },
      },
      defaultProps: {
        eyebrow: "",
        heading: "",
        supportingText: "",
        ctaLabel: "",
        ctaUrl: "",
        alignment: "left",
        width: "standard",
        spacing: "standard",
      },
      render: ({ puck, ...props }) => <Hero {...props} isEditing={puck.isEditing} />,
    },
    ContentSection: {
      label: "Content section",
      fields: {
        heading: { type: "text", label: "Heading" },
        body: { type: "textarea", label: "Body text" },
        width: {
          type: "radio",
          label: "Content width",
          options: [...contentWidthOptions],
        },
        alignment: {
          type: "radio", label: "Alignment",
          options: [{ label: "Left", value: "left" }, { label: "Center", value: "center" }],
        },
        spacing: { type: "radio", label: "Section spacing", options: [...spacingOptions] },
      },
      defaultProps: { heading: "", body: "", width: "standard", alignment: "left", spacing: "standard" },
      render: (props) => <ContentSection {...props} />,
    },
  },
};
