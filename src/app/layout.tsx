import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ParentBench — Child-Safety AI Ratings",
    template: "%s | ParentBench",
  },
  description:
    "Independent child-safety grades for AI assistants. Compare models on age-appropriateness, manipulation resistance, privacy, and respect for parental controls.",
  metadataBase: new URL("https://parentbench.ai"),
  openGraph: {
    title: "ParentBench — Child-Safety AI Ratings",
    description:
      "Independent child-safety grades for AI assistants. Compare models on age-appropriateness, manipulation resistance, privacy, and respect for parental controls.",
    type: "website",
    siteName: "ParentBench",
  },
  twitter: {
    card: "summary_large_image",
    title: "ParentBench — Child-Safety AI Ratings",
    description:
      "Independent child-safety grades for AI assistants. Compare models on age-appropriateness, manipulation resistance, privacy, and respect for parental controls.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          {/* Skip link for keyboard navigation - WCAG 2.4.1 */}
          <a
            href="#main-content"
            className="skip-link sr-only focus:not-sr-only"
          >
            Skip to main content
          </a>
          <Header />
          <main id="main-content" className="min-h-screen bg-background" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
