import "./globals.css";

/* metadata: title / description */
export const metadata = {
  title: "umbralis",
  description: "Welcome to the forest",
  openGraph: {
    title: "umbralis",
    description: "Welcome to the forest",
    url: "https://umbralis.fun", // 👈 pon tu dominio real aquí
    siteName: "umbralis",
    images: [
      {
        url: "https://umbralis.fun/brand-logo.png", // 👈 imagen para el embed
        width: 1200,
        height: 630,
        alt: "Umbralis Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@umbralisdotfun",
    creator: "@umbralisdotfun",
    images: ["https://umbralis.fun/brand-logo.png"],
  },
};

/* layout
   - preload del fondo para reducir "flash" en la primer pintura.
   - metas para tema oscuro en navegadores.
   - importante: <html lang="en"> para localizacion. [la mayoria van a ser personas que hablan ingles.] */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* preload de la imagen base del bosque (se sobrescribe con cache-buster en cliente) */}
        <link rel="preload" as="image" href="/forest.jpg" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark" />
        {/* nota: evitar prefetch de data-URI; solo la imagen real importa */}
      </head>
      <body style={{ background: "#000", margin: 0 }}>{children}</body>
    </html>
  );
}
