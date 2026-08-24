import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#635bff",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://docus-ai.netlify.app"),
  title: {
    default: "Docus — Instant AI Document Summarizer & Analytics",
    template: "%s | Docus AI",
  },
  description:
    "Transform PDFs, legal contracts, financial reports, and images into clear, actionable AI summaries in seconds. Real-time Q&A, multi-language translation, and instant PDF exports. Powered by Google Gemini AI.",
  keywords: [
    "document summarizer",
    "AI PDF summary",
    "Gemini AI summary",
    "legal document summary",
    "financial report summary",
    "instant document summary",
    "PDF to text AI",
    "document intelligence",
    "multilingual PDF translation",
  ],
  authors: [{ name: "Docus AI Team" }],
  creator: "Docus AI",
  publisher: "Docus AI",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://docus-ai.netlify.app",
    siteName: "Docus AI",
    title: "Docus — Instant AI Document Summarizer & Analytics",
    description:
      "Upload complex PDFs or images and get structured AI-powered summaries, key takeaways, and real-time interactive Q&A in seconds.",
    images: [
      {
        url: "/icon.svg",
        width: 1200,
        height: 630,
        alt: "Docus AI Document Summarizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Docus — Instant AI Document Summarizer",
    description:
      "Transform complex PDFs and images into structured AI summaries, key takeaways, and interactive Q&A in seconds.",
    images: ["/icon.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
