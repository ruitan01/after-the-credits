import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "After the Credits",
    template: "%s · After the Credits",
  },
  description: "A quiet diary for the films you've watched. Private, and kept in your own browser.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${inter.variable} min-h-dvh font-sans antialiased`}>
        <ClerkProvider>
          <a
            href="#main"
            className="sr-only rounded bg-amber px-4 py-2 font-medium text-night focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-2xl px-4 pt-8 pb-24 outline-none sm:px-6 sm:pt-12">
            {children}
          </main>
        </ClerkProvider>
      </body>
    </html>
  );
}
