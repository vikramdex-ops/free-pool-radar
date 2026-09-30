import type { Metadata } from "next";
import { isAdminConfigured } from "@/lib/auth";
import { signIn } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * The one public route under /admin.
 *
 * It has to be reachable, or nobody could obtain the cookie every other
 * internal route requires. It carries no data — the form is the whole page — so
 * leaving it open leaks nothing, and the middleware keeps everything beneath it
 * closed.
 */
export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const configured = isAdminConfigured();
  const params = await searchParams;
  // Only a same-site path is carried forward. Anything else is discarded here
  // rather than trusted, so the form cannot be used to bounce a signed-in admin
  // off to another host.
  const next =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "";

  return (
    <main id="main" className="wrap">
      <header className="page-head">
        <p className="label">Internal</p>
        <h1 className="page-title">Sign in</h1>
        <p className="page-lede">
          Operational routes are restricted. The password is held on the server
          and is never sent to the browser.
        </p>
      </header>

      <div className="sect" style={{ paddingTop: 0, maxWidth: "26rem" }}>
        {configured ? (
          <SignInForm next={next} error={params.error} />
        ) : (
          <div className="empty">
            <p className="empty-title">Not configured</p>
            <p>
              This deployment has no admin credentials set, so sign-in is
              disabled rather than left open. Set them in the deployment
              environment to enable the internal routes.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function SignInForm({ next, error }: { next: string; error?: string }) {
  return (
    <form action={signIn} className="panel" style={{ padding: "1.25rem" }}>
      {/* One message for a wrong password, an empty field and a misconfigured
          deployment. Anything more specific is a free oracle for guessing. */}
      {error ? (
        <p className="form-error" role="alert">
          {error === "unconfigured"
            ? "Admin sign-in is not configured on this deployment."
            : error === "throttled"
              ? "Too many failed attempts. Try again in a few minutes."
              : "That password is not correct."}
        </p>
      ) : null}
      <label className="label" htmlFor="password">
        Admin password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        // The field is a password manager target, not a styled element; the
        // surrounding panel carries the visual weight.
        style={{
          marginTop: "0.5rem",
          width: "100%",
          padding: "0.5rem 0.625rem",
          background: "var(--t-raise)",
          border: "1px solid var(--t-rule)",
          borderRadius: "2px",
          color: "var(--t-ink)",
          fontFamily: "var(--f-mono)",
        }}
      />
      {/* Read back as a path only, and only one that starts with a single
          slash, so it cannot become an open redirect. */}
      <input type="hidden" name="next" value={next} />
      <button type="submit" className="btn" style={{ marginTop: "0.875rem" }}>
        Sign in
      </button>
    </form>
  );
}
