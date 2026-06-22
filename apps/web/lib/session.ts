import { auth0 } from "@/lib/auth0";
import { hasRole } from "@/lib/admin-ticket";

type Auth0Session = NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;

export type AppSession = Auth0Session & {
  isAdmin: boolean;
  hasRole: (role: string) => boolean;
};

export async function getSession(): Promise<AppSession | null> {
  const session = await auth0.getSession();
  if (!session) return null;
  return {
    ...session,
    isAdmin: hasRole(session, "admin"),
    hasRole: (role: string) => hasRole(session, role),
  };
}
