import { NotFoundView } from "@/components/NotFoundView";

// notFound() inside the public site (missing trek, gateway, page): the site
// header and footer are already on the page.
export default function NotFound() {
  return <NotFoundView />;
}
