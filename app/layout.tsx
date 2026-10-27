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
  description: "A quiet, private diary for the films you've watched.",
};

// Clerk's widgets take literal colors, so these mirror the @theme tokens in globals.css.
const clerkAppearance = {
  variables: {
    colorPrimary: "#e9b35f", // amber
    colorPrimaryForeground: "#0f0d0b", // night
    colorBackground: "#1a1714", // reel
    colorForeground: "#f3ece1", // ivory
    colorMutedForeground: "#bfb3a3", // parchment
    colorInput: "#0f0d0b", // night
    colorInputForeground: "#f3ece1", // ivory
    colorBorder: "#7d705f", // seam-strong
    colorDanger: "#f2917f", // ember
    colorRing: "#e9b35f", // amber
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${inter.variable} min-h-dvh font-sans antialiased`}>
        <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/" appearance={clerkAppearance}>
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
