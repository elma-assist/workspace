import { notFound } from "next/navigation";
import {
  isWorkspaceObjectRoute,
  isWorkspaceSection,
} from "../../../../../lib/workspaceRoutes";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; section: string; route: string[] }>;
}) {
  const { section, route } = await params;
  if (!isWorkspaceSection(section)) notFound();
  if (!isWorkspaceObjectRoute(section, route)) notFound();
  return null;
}
