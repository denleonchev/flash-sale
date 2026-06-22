import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();
  const isAdmin = session?.isAdmin ?? false;

  return (
    <header>
      {session ? (
        <span>
          {session.user.name ?? session.user.email}
          {isAdmin && " · admin"} ·{" "}
          <a href="/auth/logout">Sign out</a>
        </span>
      ) : (
        <a href="/auth/login">Sign in</a>
      )}
    </header>
  );
}
