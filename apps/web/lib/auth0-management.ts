const DOMAIN = process.env.AUTH0_DOMAIN;
const CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID;
const CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET;

function base(): string {
  if (!DOMAIN) throw new Error("AUTH0_DOMAIN is not set");
  return `https://${DOMAIN}/api/v2`;
}

async function getManagementToken(): Promise<string> {
  if (!DOMAIN) throw new Error("AUTH0_DOMAIN is not set");
  if (!CLIENT_ID) throw new Error("AUTH0_MGMT_CLIENT_ID is not set");
  if (!CLIENT_SECRET) throw new Error("AUTH0_MGMT_CLIENT_SECRET is not set");

  const res = await fetch(`https://${DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      audience: `https://${DOMAIN}/api/v2/`,
    }),
  });
  if (!res.ok) throw new Error(`Failed to get management token: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function getRoleId(token: string, roleName: string): Promise<string> {
  const res = await fetch(`${base()}/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to list roles: ${res.status}`);
  const roles = (await res.json()) as Array<{ id: string; name: string }>;
  const role = roles.find((r) => r.name === roleName);
  if (!role) throw new Error(`Role "${roleName}" not found in Auth0`);
  return role.id;
}

export async function setUserRole(userId: string, role: string): Promise<void> {
  const token = await getManagementToken();

  // get current roles
  const currentRes = await fetch(`${base()}/users/${encodeURIComponent(userId)}/roles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!currentRes.ok) throw new Error(`Failed to get user roles: ${currentRes.status}`);
  const current = (await currentRes.json()) as Array<{ id: string }>;

  // remove all existing roles in one call (scope: update:users)
  if (current.length > 0) {
    const delRes = await fetch(`${base()}/users/${encodeURIComponent(userId)}/roles`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ roles: current.map((r) => r.id) }),
    });
    if (!delRes.ok) throw new Error(`Failed to remove roles: ${delRes.status}`);
  }

  // assign new role if not buyer (scope: create:role_members)
  if (role !== "") {
    const roleId = await getRoleId(token, role);
    const addRes = await fetch(`${base()}/roles/${roleId}/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ users: [userId] }),
    });
    if (!addRes.ok) throw new Error(`Failed to assign role "${role}": ${addRes.status}`);
  }
}
