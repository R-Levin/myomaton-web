import { getWebPresenceByDomain } from "@/lib/platform/web-presences/service";

export default async function Home() {
  const presence = await getWebPresenceByDomain("myomaton.com");

  if (!presence) {
    return <main>Web presence not found.</main>;
  }

  return (
    <main>
      <h1>{presence.subjectName}</h1>
      <p>{presence.organizationName}</p>
      <p>{presence.subjectType}</p>
    </main>
  );
}
