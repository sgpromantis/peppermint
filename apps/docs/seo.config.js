const seoConfig = {
  metadataBase: new URL("https://promantis.de"),
  title: {
    template: "promantis Helpdesk",
    default:
      "promantis Helpdesk — professionelles Ticket-Management für Helpdesks & Service Desks.",
  },
  description:
    "promantis Helpdesk — professionelles Ticket-Management für schnelle Bearbeitung interner und externer Anfragen.",
  themeColor: "#006e00",
  openGraph: {
    images: "/og-image.png",
    url: "https://promantis.de",
  },
  manifest: "/site.webmanifest",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png" },
    { rel: "mask-icon", url: "/favicon.ico" },
    { rel: "image/x-icon", url: "/favicon.ico" },
  ],
  twitter: {
    site: "@potts_dev",
    creator: "@potts_dev",
  },
};

export default seoConfig;