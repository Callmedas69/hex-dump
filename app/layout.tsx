import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";

const nokiaTitle = localFont({ src: "../public/Nokian_title.ttf", variable: "--font-nokia-title", weight: "400", display: "swap", adjustFontFallback: false });
const nokiaBody = localFont({ src: "../public/nokiafc22-body.ttf", variable: "--font-nokia-body", weight: "400", display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: "Bitcoin Hex Encoder & Decoder",
  description: "Encode, decode, and discover messages inside Bitcoin bytes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nokiaTitle.variable} ${nokiaBody.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><Providers>{children}</Providers></body>
    </html>
  );
}
