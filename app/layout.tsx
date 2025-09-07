import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@sendbird/uikit-react/dist/index.css";
import AuthNav from "./components/auth-nav";
import { ThemeProvider } from "next-themes";
import { Auth0Provider } from "@auth0/nextjs-auth0";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_BASE_URL ||
      process.env.APP_BASE_URL ||
      "http://localhost:3000"
  ),
  title: {
    default: "FireLinks — Обединени срещу пожарите",
    template: "%s • FireLinks",
  },
  description:
    "Платформа за доброволци и координация при горски пожари. Карти в реално време, известия и екипна работа.",
  applicationName: "FireLinks",
  referrer: "origin-when-cross-origin",
  keywords: [
    "пожари",
    "доброволци",
    "координация",
    "карти",
    "известия",
    "FireLinks",
  ],
  openGraph: {
    type: "website",
    locale: "bg_BG",
    siteName: "FireLinks",
    url: "/",
    title: "FireLinks — Обединени срещу пожарите",
    description:
      "Платформа за доброволци и координация при горски пожари. Карти в реално време, известия и екипна работа.",
    images: [
      {
        url: "/img/ai.jpg",
        width: 1200,
        height: 630,
        alt: "FireLinks",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FireLinks — Обединени срещу пожарите",
    description:
      "Платформа за доброволци и координация при горски пожари.",
    images: ["/img/ai.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: "/img/logo.svg",
  },
  themeColor: "#ef4444",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <Auth0Provider>
            {children}
          </Auth0Provider>
        </ThemeProvider>
        {/* Portal root for Sendbird UIKit menus/modals */}
        <div id="sendbird-portal-root" />
      </body>
    </html>
  );
}
