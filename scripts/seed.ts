import "dotenv/config";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { organizations } from "../lib/platform/db/schema/organizations";
import { microsites } from "../lib/platform/db/schema/microsites";
import { pages } from "../lib/platform/db/schema/pages";
import { sections } from "../lib/platform/db/schema/sections";
import { subjects } from "../lib/platform/db/schema/subjects";
import { subjectTypes } from "../lib/platform/db/schema/subject-types";
import { webPresences } from "../lib/platform/db/schema/web-presences";
import { designSystems } from "../lib/platform/db/schema/design-systems";
import { myomatonDesignConfiguration } from "./seed-data/myomaton-design-system";
import { actions } from "../lib/platform/db/schema/actions";
import { myomatonAction, upgradeMyomatonCtaContent } from "./seed-data/myomaton-action";
import { navigations } from "../lib/platform/db/schema/navigations";
import { navigationItems } from "../lib/platform/db/schema/navigation-items";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString,
});

const db = drizzle({ client: pool });

async function seed() {
  const [projectType] = await db
    .insert(subjectTypes)
    .values({
      key: "project",
      name: "Project",
      description:
        "A project, initiative, or undertaking represented by a web presence.",
    })
    .onConflictDoNothing({ target: subjectTypes.key })
    .returning();

  const existingProjectType =
    projectType ??
    (
      await db
        .select()
        .from(subjectTypes)
        .where(eq(subjectTypes.key, "project"))
        .limit(1)
    )[0];

  const existingOrganization = (
    await db
      .select()
      .from(organizations)
      .where(eq(organizations.name, "Open Practical Robotics"))
      .limit(1)
  )[0];

  const organization =
    existingOrganization ??
    (
      await db
        .insert(organizations)
        .values({
          name: "Open Practical Robotics",
        })
        .returning()
    )[0];

  const existingPresence = (
    await db
      .select()
      .from(webPresences)
      .where(eq(webPresences.primaryDomain, "myomaton.com"))
      .limit(1)
  )[0];

  const presence =
    existingPresence ??
    (
      await db
        .insert(webPresences)
        .values({
          organizationId: organization.id,
          name: "Myomaton",
          primaryDomain: "myomaton.com",
          locale: "en-US",
          timezone: "America/New_York",
        })
        .returning()
    )[0];

  const existingSubject = (
    await db
      .select()
      .from(subjects)
      .where(eq(subjects.webPresenceId, presence.id))
      .limit(1)
  )[0];

  if (!existingSubject) {
    await db.insert(subjects).values({
      webPresenceId: presence.id,
      subjectTypeId: existingProjectType.id,
      name: "Myomaton",
      description: "An open practical robotics project.",
    });
  }

  await db.transaction(async (tx) => {
    // Serialize this seed's check-and-insert operations without schema changes.
    await tx.execute(sql`select pg_advisory_xact_lock(179052, 1)`);

    // Preserve an existing identity, including one intentionally made inactive.
    const [existingDesignSystem] = await tx
      .select({ id: designSystems.id })
      .from(designSystems)
      .where(eq(designSystems.webPresenceId, presence.id))
      .limit(1);

    if (!existingDesignSystem) {
      await tx.insert(designSystems).values({
        webPresenceId: presence.id,
        name: "Myomaton",
        configuration: myomatonDesignConfiguration,
      });
    }

    const [existingAction] = await tx
      .select()
      .from(actions)
      .where(and(eq(actions.webPresenceId, presence.id), eq(actions.name, myomatonAction.name)))
      .limit(1);

    const action = existingAction ?? (await tx
      .insert(actions)
      .values({ ...myomatonAction, webPresenceId: presence.id })
      .returning())[0];

    const [existingMicrosite] = await tx
      .select()
      .from(microsites)
      .where(and(eq(microsites.webPresenceId, presence.id), eq(microsites.name, "Myomaton")))
      .limit(1);

    const microsite = existingMicrosite ?? (await tx
      .insert(microsites)
      .values({ webPresenceId: presence.id, name: "Myomaton" })
      .returning())[0];

    const [existingPage] = await tx
      .select()
      .from(pages)
      .where(and(eq(pages.micrositeId, microsite.id), eq(pages.slug, "/")))
      .limit(1);

    const page = existingPage ?? (await tx
      .insert(pages)
      .values({ micrositeId: microsite.id, slug: "/", name: "Home", title: "Myomaton", sortOrder: 0 })
      .returning())[0];

    const seedSections = [
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

    let createdSections = 0;
    for (const section of seedSections) {
      const [existingSection] = await tx
        .select({ id: sections.id, content: sections.content })
        .from(sections)
        .where(and(eq(sections.pageId, page.id), eq(sections.type, section.type), eq(sections.name, section.name)))
        .limit(1);

      if (!existingSection) {
        await tx.insert(sections).values({ ...section, pageId: page.id, variant: "default" });
        createdSections += 1;
      } else if (section.type === "cta") {
        const content = upgradeMyomatonCtaContent(existingSection.content, action.id);
        if (content) {
          await tx.update(sections)
            .set({ content, updatedAt: new Date(), version: sql`${sections.version} + 1` })
            .where(and(eq(sections.id, existingSection.id), eq(sections.content, existingSection.content)));
        }
      }
    }

    const [existingNavigation] = await tx.select().from(navigations)
      .where(and(eq(navigations.webPresenceId, presence.id), eq(navigations.name, "Primary Navigation")))
      .limit(1);
    const navigation = existingNavigation ?? (await tx.insert(navigations)
      .values({ webPresenceId: presence.id, name: "Primary Navigation" }).returning())[0];
    const [intro] = await tx.select({ id: sections.id }).from(sections)
      .where(and(eq(sections.pageId, page.id), eq(sections.type, "intro"), eq(sections.name, "Introduction"))).limit(1);
    const seedNavigationItems = [
      ...(intro ? [{ name: "About", label: "About", targetType: "section", targetReference: intro.id, sortOrder: 0 }] : []),
      { name: "Learn about Myomaton", label: action.label, targetType: "action", targetReference: action.id, sortOrder: 10 },
    ];
    let createdNavigationItems = 0;
    for (const item of seedNavigationItems) {
      const inserted = await tx.insert(navigationItems).values({ ...item, navigationId: navigation.id })
        .onConflictDoNothing({ target: [navigationItems.navigationId, navigationItems.name] }).returning({ id: navigationItems.id });
      createdNavigationItems += inserted.length;
    }
    console.log(`Navigation seed created: ${existingNavigation ? 0 : 1} navigations, ${createdNavigationItems} items.`);
    console.log(`Design system seed created: ${existingDesignSystem ? 0 : 1} design systems.`);
    console.log(`Action seed created: ${existingAction ? 0 : 1} actions.`);
    console.log(`Microsite seed created: ${existingMicrosite ? 0 : 1} microsites, ${existingPage ? 0 : 1} pages, ${createdSections} sections.`);
  });

  console.log("Development seed complete.");
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
