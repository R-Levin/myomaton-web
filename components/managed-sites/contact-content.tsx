import type { ContactPresentation } from "../../lib/platform/contact/model";
import { ContactForm } from "./contact-form";
import { PlainTextParagraphs } from "./plain-text-paragraphs";

export function ContactContent({ contact }: { contact: ContactPresentation }) {
  return <div className="managed-site-contact">
    <PlainTextParagraphs text={contact.definition.text} />
    {contact.identity.phone && <p><a href={contact.identity.phone.href}>{contact.identity.phone.label}</a></p>}
    {contact.identity.email && <p><a href={contact.identity.email.href}>{contact.identity.email.label}</a></p>}
    <ContactForm definition={contact.definition} sectionId={contact.sectionId} />
  </div>;
}
