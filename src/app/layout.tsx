import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const description = "Investigate tokens on Robinhood Chain Testnet with transparent risk signals and evidence-backed intelligence. Automated analysis, not an audit.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "VibeGuard — Know the Risk Behind Every Token", template: "%s · VibeGuard" },
  description,
  openGraph: { type: "website", siteName: "VibeGuard", title: "VibeGuard — Know the Risk Behind Every Token", description },
  twitter: { card: "summary", title: "VibeGuard — Know the Risk Behind Every Token", description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
