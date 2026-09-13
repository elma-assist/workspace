import type { ReactNode } from "react";
import { Workspace } from "../../../components/Workspace";

export default function OrganizationLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <Workspace />
    </>
  );
}
