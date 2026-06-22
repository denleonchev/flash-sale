import { auth0 } from "@/lib/auth0";
import { isAdminSession } from "@/lib/admin-ticket";

export async function SiteHeader() {
  const session = await auth0.getSession();
  const isAdmin = session ? isAdminSession(session) : false;

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
