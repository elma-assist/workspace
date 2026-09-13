import { PublicConversation } from "../../components/sharing/PublicConversation";
export const metadata = {
  title: "Shared conversation — Elma",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function SharedPage() {
  return <PublicConversation />;
}
