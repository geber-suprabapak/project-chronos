// Type declarations for Next.js App Router
declare namespace NextPage {
  interface PageProps {
    params?: Record<string, string>;
    searchParams?: Record<string, string | string[] | undefined>;
  }
}

// Augment the global namespace
declare global {
  type PageProps = NextPage.PageProps;
}