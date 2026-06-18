import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NMAA SA Portal",
  description: "National school-owner portal for NMAA South Africa.",
  icons: {
    icon: "/nmaa-logo.png",
    shortcut: "/nmaa-logo.png",
    apple: "/nmaa-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
