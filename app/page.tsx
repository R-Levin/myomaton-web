import { getWebPresenceByDomain } from "@/lib/platform/web-presences/service";

export default async function Home() {
  const presence = await getWebPresenceByDomain("myomaton.com");

  if (!presence) {
    return <main>Web presence not found.</main>;
  }

  return (
    <main>
      <h1>{presence.name}</h1>
      <p>{presence.organization.name}</p>

      {presence.subjects.map((subject) => (
        <div key={subject.id}>
          <p>{subject.name}</p>
          {subject.type && <p>{subject.type.name}</p>}
        </div>
      ))}
    </main>
  );
}