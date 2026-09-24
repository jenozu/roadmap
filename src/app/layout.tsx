import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voyages — Project Cartography",
  description: "A GitHub-connected, pirate-map project roadmap."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
