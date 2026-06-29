import { useTheme } from "next-themes";

import { authClient } from "@kan/auth/client";

import PaperGrainBackground from "~/components/PaperGrainBackground";
import Footer from "./Footer";
import Header from "./Header";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const { data: session } = authClient.useSession();
  const isDarkMode = resolvedTheme === "dark";

  return (
    <>
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
          overflow: auto;
          background-color: ${!isDarkMode ? "#fafafa" : "#111111"};
        }
      `}</style>
      <div className="relative min-h-screen min-w-[320px] overflow-hidden bg-light-100 text-light-1000 dark:bg-dark-50 dark:text-dark-1000">
        <PaperGrainBackground />
        <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.18] dark:opacity-[0.08]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(17,24,39,0.2)_1px,transparent_0)] [background-size:18px_18px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.38)_1px,transparent_0)]" />
        </div>
        <Header isLoggedIn={!!session?.user} />
        <div className="relative mx-auto w-full max-w-[1120px]">{children}</div>
        <Footer />
      </div>
    </>
  );
}
