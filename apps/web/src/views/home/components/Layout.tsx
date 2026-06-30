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
        <Header isLoggedIn={!!session?.user} />
        <div className="relative mx-auto w-full max-w-[1120px]">{children}</div>
        <Footer />
      </div>
    </>
  );
}
