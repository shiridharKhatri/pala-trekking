import { ContentPageView, contentMetadata } from "@/components/ContentPageView";

export const generateMetadata = () => contentMetadata("cancellation-policy");

export default function Page() {
  return <ContentPageView slug="cancellation-policy" />;
}
