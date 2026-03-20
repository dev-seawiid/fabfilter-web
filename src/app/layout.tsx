import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fabfilter Web",
  description: "Browser-based audio processor with real-time FFT visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
