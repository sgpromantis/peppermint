import type { Metadata } from "next";
import "./globals.css";
import Fathom from "@/component/Fathom";

export const metadata: Metadata = {
  title: "promantis Helpdesk",
  description:
    "promantis ist ein selbst-gehostetes Ticketsystem für Ihre Projekte und Ihren IT-Support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <Fathom />
        {children}
      </body>
    </html>
  );
}
