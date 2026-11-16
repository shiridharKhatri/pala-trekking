import { ContentPageView, contentMetadata } from "@/components/ContentPageView";

export const generateMetadata = () => contentMetadata("about");

export default function Page() {
  return <ContentPageView slug="about" />;
}
