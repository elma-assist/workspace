import { PublicConversation } from "../../../../components/sharing/PublicConversation";

export default async function AgentPage({
  params,
}: {
  params: Promise<{ organizationSlug: string; agentSlug: string }>;
}) {
  const { organizationSlug, agentSlug } = await params;
  const path = `${encodeURIComponent(organizationSlug)}/${encodeURIComponent(agentSlug)}`;
  return <PublicConversation key={path} agentPath={path} />;
}
