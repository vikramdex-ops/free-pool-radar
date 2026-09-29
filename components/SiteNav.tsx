import Link from "next/link";

/** Primary navigation. Collapses to a horizontally scrollable strip on
 *  mobile rather than a hamburger, so every destination stays one tap away
 *  and the page needs no client-side menu state (§42).
 *
 *  "Live" points at the full filterable set rather than the landing section,
 *  because that is where the §31 filter and §32 sort controls live. The
 *  landing page's own sections — starting soon, new, changed, ended — are one
 *  scroll away and are linked from within it, so they do not need a slot here. */
export function SiteNav() {
  const items = [
    { href: "/live", label: "Live" },
    { href: "/events", label: "Events" },
    { href: "/providers", label: "Providers" },
    { href: "/models", label: "Models" },
    { href: "/compare", label: "Compare" },
    { href: "/timeline", label: "Timeline" },
    { href: "/search", label: "Search" },
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
