import Link from "next/link";
import { notFound } from "next/navigation";
import { clientAddresses } from "@/lib/platform/accounts/people";
import { tasks } from "@/lib/platform/service/cycle";
import { accounts, acting, serviceRuntime } from "@/lib/platform/service/runtime";
import { signIn, signOut } from "./actions";
import { Frame, Section, button, primary } from "./ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Specialist workspace", robots: { index: false, follow: false } };

const whoLabel = { core: "Core", specialist: "Specialist", client: "Client" } as const;

/** The Specialist's Queue: every Task across Accounts, and who must act. */
export default async function Workspace() {
  const runtime = await serviceRuntime();
  if (!runtime) notFound();
  const person = await acting();
  const all = await accounts(runtime.pool);
  if (!person) {
    const people = [{ value: "operator:specialist", label: "Specialist (preview)" }];
    for (const { name, account } of all) for (const email of await clientAddresses(runtime.pool, account.webPresenceId))
      people.push({ value: `customer:${email}`, label: `${email}, speaks for ${name}` });
    return (
      <Frame title="Who are you?">
        <p className="mb-4 text-sm text-neutral-600">Local preview: choose who to act as. On protected Core this will be a proper sign-in.</p>
        <form action={signIn} className="space-y-2">
          {people.map(item => (<label key={item.value} className="flex items-center gap-2"><input type="radio" name="person" value={item.value} required />{item.label}</label>))}
          <button className={primary}>Continue</button>
        </form>
      </Frame>
    );
  }
  if (person.role !== "operator") return (
    <Frame title="Specialist workspace" who={person.name}><p>This is the Specialists&apos; workspace. <Link className="underline" href="/portal">Go to your portal</Link>.</p></Frame>);
  const rows = await Promise.all(all.map(async item => ({ ...item, tasks: tasks(await runtime.store.read(item.account)) })));
  return (
    <Frame title="Queue" who={`${person.name}`}>
      <form action={signOut} className="mb-6"><button className={button}>Switch person</button></form>
      {rows.map(row => (
        <Section key={row.account.webPresenceId} title={row.name}>
          {row.tasks.length ? (
            <ul className="mb-2 space-y-1">{row.tasks.map(task => (<li key={task.id}><span className="mr-2 inline-block w-20 text-xs font-medium uppercase text-neutral-500">{whoLabel[task.who]}</span>{task.what}</li>))}</ul>
          ) : <p className="mb-2 text-neutral-600">Nothing waiting.</p>}
          <Link className="underline" href={`/workspace/${row.account.webPresenceId}`}>Open the Account</Link>
        </Section>
      ))}
    </Frame>
  );
}
