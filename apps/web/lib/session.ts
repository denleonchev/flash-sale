import { auth0 } from "@/lib/auth0";
import { hasRole } from "@/lib/admin-ticket";
import { isDemoUser, readDemoRole } from "@/lib/demo-session";

type Auth0Session = NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;

export type AppSession = Auth0Session & {
  isAdmin: boolean;
  isDemo: boolean;
  hasRole: (role: string) => boolean;
};

export async function getSession(): Promise<AppSession | null> {
  const session = await auth0.getSession();
  if (!session) return null;

  const isDemo = isDemoUser(session.user.sub);
  const demoRole = isDemo ? await readDemoRole() : "";
  const holdsRole = (role: string) => (isDemo ? demoRole === role : hasRole(session, role));

  return {
    ...session,
    isAdmin: holdsRole("admin"),
    isDemo,
    hasRole: holdsRole,
  };
}
