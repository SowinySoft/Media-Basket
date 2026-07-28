import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Media Basket",
  description: "All your media accounts in one basket",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
