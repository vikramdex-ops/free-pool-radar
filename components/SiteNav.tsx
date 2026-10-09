import Link from "next/link";

/** Primary navigation. Collapses to a horizontally scrollable strip on
 *  mobile rather than a hamburger, so every destination stays one tap away
 *  and the page needs no client-side menu state (§42).
 *
 *  The strip deliberately hides its scrollbar (PRI-001), so the scroll
 *  affordance is a neutral edge fade (`.nav-scroll::after`) instead — never
 *  a state colour. The list itself is focusable (`tabIndex={0}`) with an
 *  accessible name, so keyboard users can arrow-scroll it: without that, a
 *  scroll container is not keyboard-operable (WCAG 2.1.1) and five of the
 *  eight destinations would be unreachable by keyboard on narrow screens.
 *
 *  "Live" points at the full filterable set rather than the landing section,
 *  because that is where the §31 filter and §32 sort controls live. The
 *  landing page's own sections — starting soon, new, changed, ended — are one
 *  scroll away and are linked from within it, so they do not need a slot here. */
import { ThemeToggle } from "./ThemeToggle";
import { REPO_URL } from "./JsonLd";


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
        {/* The landmark lives on the scroll container, not on the list.
            `role="region"` on a <ul> replaces its list role, which orphans the
            <li> children and fails axe's `listitem` rule. The list keeps
            tabIndex so it is still the keyboard-operable scroll target. */}
        <div
          className="nav-scroll"
          role="region"
          aria-label="Primary destinations"
        >
          <ul className="nav-list" tabIndex={0}>
            {items.map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="nav-link">
                  {i.label}
                </Link>
              </li>
            ))}
            <li className="nav-overflow">
              {/* The disclosure is a native <details>, not a client-side menu:
                  the project renders no client menu state (§42) and this keeps
                  the control keyboard-operable with no JavaScript. */}
              <details className="nav-more">
                <summary className="nav-link nav-overflow-btn">
                  More
                  <svg viewBox="0 0 16 16" className="nav-chev" aria-hidden="true">
                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </summary>
                <ul id="nav-overflow-menu" className="nav-overflow-menu">
                  <li>
                    <a
                      href={REPO_URL}
                      className="nav-link"
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      GitHub <span aria-hidden="true">↗</span>
                    </a>
                  </li>
                  <li>
                    <Link href="/ecosystem" className="nav-link">Ecosystem</Link>
                  </li>
                  <li>
                    <Link href="/developers" className="nav-link">Developers</Link>
                  </li>
                </ul>
              </details>
            </li>
          </ul>
        </div>
        <div className="nav-right">
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}


