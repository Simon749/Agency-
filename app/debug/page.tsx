import { auth, clerkClient } from '@clerk/nextjs/server';

export default async function DebugPage() {
  const { userId, sessionClaims } = await auth();
  
  if (!userId) return <pre>NOT SIGNED IN</pre>;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  return (
    <pre style={{ padding: 40, fontSize: 14 }}>
      {JSON.stringify({
        userId,
        sessionClaims_publicMetadata: sessionClaims?.publicMetadata,
        actual_publicMetadata: user.publicMetadata,
      }, null, 2)}
    </pre>
  );
}