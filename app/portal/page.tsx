import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { clientAddresses } from "@/lib/platform/accounts/people";
import { accounts, acting, serviceRuntime } from "@/lib/platform/service/runtime";
import { Frame } from "../workspace/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your portal", robots: { index: false, follow: false } };

/** The Client's way in: the Accounts they speak for. */
export default async function Portal() {
  const runtime = await serviceRuntime();
  if (!runtime) notFound();
  const person = await acting();
  if (!person || person.role !== "customer") redirect("/workspace");
  const mine = [];
  for (const item of await accounts(runtime.pool)) if ((await clientAddresses(runtime.pool, item.account.webPresenceId)).includes(person.id)) mine.push(item);
  if (mine.length === 1) redirect(`/portal/${mine[0].account.webPresenceId}`);
  return (
    <Frame title="Your portal" who={person.name}>
      {mine.length ? <ul className="space-y-1">{mine.map(item => <li key={item.account.webPresenceId}><Link className="underline" href={`/portal/${item.account.webPresenceId}`}>{item.name}</Link></li>)}</ul>
        : <p>You are not listed as speaking for any business yet. Your Specialist can add you.</p>}
    </Frame>
  );
}
