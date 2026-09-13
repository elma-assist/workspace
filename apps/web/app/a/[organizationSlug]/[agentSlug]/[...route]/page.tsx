import { notFound } from "next/navigation";
import { PublicConversation } from "../../../../../components/sharing/PublicConversation";
import { isConversationRoute } from "../../../../../lib/workspaceRoutes";

export default async function AgentConversationPage({
  params,
}: {
  params: Promise<{
    organizationSlug: string;
    agentSlug: string;
    route: string[];
  }>;
}) {
  const { organizationSlug, agentSlug, route } = await params;
  if (!isConversationRoute(route)) notFound();
  const path = `${encodeURIComponent(organizationSlug)}/${encodeURIComponent(agentSlug)}`;
  return (
    <PublicConversation
      key={path}
      agentPath={path}
      initialConversationId={route[1]}
    />
  );
}
