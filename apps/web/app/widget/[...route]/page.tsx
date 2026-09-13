import { notFound } from "next/navigation";
import Widget from "../page";
import { isConversationRoute } from "../../../lib/workspaceRoutes";

export default async function WidgetConversationPage({
  params,
}: {
  params: Promise<{ route: string[] }>;
}) {
  const { route } = await params;
  if (!route[0] || (route.length > 1 && !isConversationRoute(route.slice(1))))
    notFound();
  return <Widget />;
}
