export const workspaceSections = [
  "agents",
  "knowledge",
  "forms",
  "requests",
  "conversations",
  "employees",
  "usage",
  "settings",
] as const;

export type WorkspaceSection = (typeof workspaceSections)[number];

export function isWorkspaceSection(value: string): value is WorkspaceSection {
  return workspaceSections.some((section) => section === value);
}

function validConversationTail(parts: string[]) {
  let index = 0;
  if (parts[index] === "requests") {
    if (!parts[index + 1]) return false;
    index += 2;
  }
  if (parts[index] === "delete") {
    if (!parts[index + 1]) return false;
    index += 2;
  }
  if (parts[index] === "share") index += 1;
  if (parts[index] === "photos") {
    if (!parts[index + 1]) return false;
    index += 2;
  }
  return index === parts.length;
}

export function isConversationRoute(route: string[]) {
  return (
    route[0] === "conversations" &&
    !!route[1] &&
    validConversationTail(route.slice(2))
  );
}

export function isWorkspaceObjectRoute(
  section: WorkspaceSection,
  route: string[],
) {
  if (section === "agents") {
    if (route.length === 1 && route[0] === "new") return true;
    if (route.length === 2 && ["edit", "publish"].includes(route[1]))
      return true;
    if (route.length >= 3 && route[1] === "conversations")
      return validConversationTail(route.slice(3));
    return false;
  }
  if (section === "knowledge")
    return (
      (route.length === 1 && !!route[0]) ||
      (route.length === 2 && route[1] === "add-document")
    );
  if (section === "forms")
    return (
      (route.length === 1 && route[0] === "new") ||
      (route.length === 2 && route[1] === "edit")
    );
  if (section === "employees")
    return (
      (route.length === 1 && route[0] === "invite") ||
      (route.length === 2 && route[1] === "access")
    );
  if (["requests", "conversations"].includes(section))
    return (
      route.length === 1 ||
      (route.length === 2 && route[1] === "delete") ||
      (route.length === 3 && route[1] === "photos")
    );
  return false;
}
