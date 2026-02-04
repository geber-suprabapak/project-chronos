import "~/styles/globals.css";

import { type Metadata } from "next";
import { Inter, Castoro, JetBrains_Mono } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "~/components/theme-provider";
import { Toaster } from "~/components/ui/sonner";

export const metadata: Metadata = {
  title: "Chronos",
  description: "Project Chronos Dev",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const serif = Castoro({
  weight: "400",
  style: "normal",
  subsets: ["latin"],
  variable: "--font-serif",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <head />
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
