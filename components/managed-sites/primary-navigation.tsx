import type { Navigation, NavigationItem } from "@/lib/platform/navigations/model";

function Items({ items }: { items: NavigationItem[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.href}>{item.label}</a>
          {item.children.length > 0 && <Items items={item.children} />}
        </li>
      ))}
    </ul>
  );
}

export function PrimaryNavigation({ navigation }: { navigation: Navigation | null | undefined }) {
  if (!navigation?.items.length) return null;
  return (
    <header className="managed-site-header">
      <nav aria-label={navigation.name}><Items items={navigation.items} /></nav>
    </header>
  );
}
