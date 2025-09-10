import "./globals.css";

/* metadata: title / description */
export const metadata = { title: "illusion", description: "Dark forest — flashlight cursor" };

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
