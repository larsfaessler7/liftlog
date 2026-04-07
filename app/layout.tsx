import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiftLog",
  description: "Track your training",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0C0C0E" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0C0C0E", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}