import { notFound } from "next/navigation";
import { PublicConversation } from "../../../components/sharing/PublicConversation";
import { isConversationRoute } from "../../../lib/workspaceRoutes";

export default async function SharedConversationPage({
  params,
}: {
  params: Promise<{ route: string[] }>;
}) {
  const { route } = await params;
  if (!isConversationRoute(route)) notFound();
  return <PublicConversation initialConversationId={route[1]} />;
}
