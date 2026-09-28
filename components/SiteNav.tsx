import Link from "next/link";

/** Primary navigation. Collapses to a horizontally scrollable strip on
 *  mobile rather than a hamburger, so every destination stays one tap away
 *  and the page needs no client-side menu state (§42). */
export function SiteNav() {
  const items = [
    { href: "/#live", label: "Live" },
    { href: "/#soon", label: "Starting soon" },
    { href: "/#new", label: "New" },
    { href: "/#changed", label: "Changed" },
    { href: "/#ended", label: "Ended" },
    { href: "/providers", label: "Providers" },
    { href: "/models", label: "Models" },
    { href: "/timeline", label: "Timeline" },
    { href: "/methodology", label: "Methodology" },
  ];

  return (
    <nav className="nav" aria-label="Primary">
      <div className="wrap nav-inner">
        <Link href="/" className="nav-brand">
          <span className="dot dot-live" aria-hidden="true" />
          FREE POOL RADAR
        </Link>
        <ul className="nav-list">
          {items.map((i) => (
            <li key={i.href}>
              <Link href={i.href} className="nav-link">
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
