import { notFound } from "next/navigation";
import { isWorkspaceSection } from "../../../../lib/workspaceRoutes";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; section: string }>;
}) {
  const { section } = await params;
  if (!isWorkspaceSection(section)) notFound();
  return null;
}
