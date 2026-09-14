import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const nokiaTitle = localFont({
  src: "../public/Nokian_title.ttf",
  variable: "--font-nokia-title",
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});
const nokiaBody = localFont({
  src: "../public/nokiafc22-body.ttf",
  variable: "--font-nokia-body",
  weight: "400",
  display: "swap",
  adjustFontFallback: false,
});

const title = "HexOnion | Hex Tools & Private Message Links";
const description =
  "Convert text and inspect Bitcoin bytes with the local hex tool, or use Dead drop to create an encrypted message link that expires after 24 hours.";

export const metadata: Metadata = {
  title,
  description,
  applicationName: "HexOnion",
  appleWebApp: {
    title: "Onion",
  },
  openGraph: {
    title,
    description,
    siteName: "HexOnion",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nokiaTitle.variable} ${nokiaBody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
