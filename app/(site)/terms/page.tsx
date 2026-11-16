import { ContentPageView, contentMetadata } from "@/components/ContentPageView";

export const generateMetadata = () => contentMetadata("terms");

export default function Page() {
  return <ContentPageView slug="terms" />;
}
