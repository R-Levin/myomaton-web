import { eq, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { organizations } from "../../lib/platform/db/schema/organizations";
import { webPresences } from "../../lib/platform/db/schema/web-presences";
import { subjects } from "../../lib/platform/db/schema/subjects";
import { subjectTypes } from "../../lib/platform/db/schema/subject-types";
import { designSystems } from "../../lib/platform/db/schema/design-systems";
import { actions } from "../../lib/platform/db/schema/actions";
import { managedSites } from "../../lib/platform/db/schema/managed-sites";
import { pages } from "../../lib/platform/db/schema/pages";
import { sections } from "../../lib/platform/db/schema/sections";
import { navigations } from "../../lib/platform/db/schema/navigations";
import { navigationItems } from "../../lib/platform/db/schema/navigation-items";
import { myomatonAction } from "./myomaton-action";
import { myomatonDesignConfiguration } from "./myomaton-design-system";

// Operator-only initialization, not a repair or synchronization service.
export async function bootstrapMyomaton(db: NodePgDatabase, existingPresenceId?: string) {
  if (existingPresenceId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingPresenceId)) {
    throw new Error("Invalid existing Web Presence UUID.");
  }
  const requestedId = existingPresenceId?.toLowerCase();
  return db.transaction(async (tx) => {
    // Serialize this operator command, including first creation, before any reads/writes.
    await tx.execute(sql`select pg_advisory_xact_lock(179052, 1)`);
    const matches = await tx.select({ id: webPresences.id }).from(webPresences)
      .where(or(
        sql`lower(btrim(${webPresences.primaryDomain})) = 'myomaton.com'`,
        sql`lower(btrim(${webPresences.name})) = 'myomaton'`,
        requestedId ? eq(webPresences.id, requestedId) : undefined,
      )).limit(2).for("update");
    if (matches.length > 1) throw new Error("Ambiguous/conflicting Myomaton Web Presence identity; no changes made.");
    if (requestedId && matches[0]?.id !== requestedId) {
      throw new Error("Requested existing Web Presence was not found or conflicts with Myomaton identity; no changes made.");
    }
    // Presence existence is the authority boundary, not a claim of baseline completeness.
    // Never inspect/recreate missing children or compare customized values to source defaults.
    if (matches[0]) return { created: false, webPresenceId: matches[0].id };

    const existingOrganizations = await tx.select({ id: organizations.id }).from(organizations)
      .where(sql`lower(btrim(${organizations.name})) = 'open practical robotics'`).limit(1).for("update");
    if (existingOrganizations.length) {
      throw new Error("Existing customer organization without a recognized Web Presence. Refusing to recreate or adopt state; inspect it and supply --web-presence-id if renamed.");
    }
    const [projectType] = await tx.select({ id: subjectTypes.id, status: subjectTypes.status }).from(subjectTypes)
      .where(eq(subjectTypes.key, "project")).limit(1).for("share");
    if (!projectType || projectType.status !== "active") {
      throw new Error("An active project Subject Type is required. Run db:seed for missing reference data; existing inactive reference data requires operator review.");
    }

    const [organization] = await tx.insert(organizations).values({ name: "Open Practical Robotics" }).returning({ id: organizations.id });
    const [presence] = await tx.insert(webPresences).values({
      organizationId: organization.id, name: "Myomaton", primaryDomain: "myomaton.com", locale: "en-US", timezone: "America/New_York",
    }).returning({ id: webPresences.id });
    await tx.insert(subjects).values({ webPresenceId: presence.id, subjectTypeId: projectType.id,
      name: "Myomaton", description: "An open practical robotics project." });
    await tx.insert(designSystems).values({ webPresenceId: presence.id, name: "Myomaton", configuration: myomatonDesignConfiguration });
    const [action] = await tx.insert(actions).values({ ...myomatonAction, webPresenceId: presence.id }).returning({ id: actions.id });
    const [managedSite] = await tx.insert(managedSites).values({ webPresenceId: presence.id, name: "Myomaton" }).returning({ id: managedSites.id });
    const [page] = await tx.insert(pages).values({ managedSiteId: managedSite.id, slug: "/", name: "Home", title: "Myomaton", sortOrder: 0 }).returning({ id: pages.id });
    const initialSections = [
      {
        type: "hero",
        name: "Hero",
        sortOrder: 0,
        content: {
          heading: "Myomaton",
          text: "Open practical robotics for everyday life.",
        },
      },
      {
        type: "intro",
        name: "Introduction",
        sortOrder: 10,
        content: {
          heading: "Robots we can understand, repair, and make our own.",
          text: "Myomaton explores practical, affordable robotics built around open systems, understandable technology, and useful real-world applications.",
        },
        configuration: { anchor: "about" },
      },
      {
        type: "cta",
        name: "Primary Call to Action",
        sortOrder: 20,
        content: {
          heading: "Follow the project",
          text: "Myomaton is being developed in the open.",
          actionId: action.id,
        },
      },
    ];

    const createdSections = await tx.insert(sections).values(initialSections.map((section) => ({ ...section, pageId: page.id, variant: "default" })))
      .returning({ id: sections.id, type: sections.type });
    const intro = createdSections.find((section) => section.type === "intro")!;
    const [navigation] = await tx.insert(navigations).values({ webPresenceId: presence.id, name: "Primary Navigation" }).returning({ id: navigations.id });
    await tx.insert(navigationItems).values([
      { navigationId: navigation.id, name: "About", label: "About", targetType: "section", targetReference: intro.id, sortOrder: 0 },
      { navigationId: navigation.id, name: "Learn about Myomaton", label: myomatonAction.label, targetType: "action", targetReference: action.id, sortOrder: 10 },
    ]);
    return { created: true, webPresenceId: presence.id };
  });
}
