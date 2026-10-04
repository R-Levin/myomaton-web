import type { Navigation, NavigationItem } from "@/lib/platform/navigations/model";

function Items({ items, currentPath }: { items: NavigationItem[]; currentPath?: string }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <a href={item.href} aria-current={currentPath && item.href === currentPath ? "page" : undefined}>{item.label}</a>
          {item.children.length > 0 && <Items items={item.children} currentPath={currentPath} />}
        </li>
      ))}
    </ul>
  );
}

export function PrimaryNavigation({ navigation, currentPath }: { navigation: Navigation | null | undefined; currentPath?: string }) {
  if (!navigation?.items.length) return null;
  return (
    <nav aria-label={navigation.name}><Items items={navigation.items} currentPath={currentPath} /></nav>
  );
}
