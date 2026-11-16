import { ContentPageView, contentMetadata } from "@/components/ContentPageView";

export const generateMetadata = () => contentMetadata("privacy");

export default function Page() {
  return <ContentPageView slug="privacy" />;
}
