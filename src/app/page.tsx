"use client";

import Image from "next/image";
import { Press_Start_2P } from "next/font/google";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"] });

export default function Page() {
  return (
    <main className="scene">
      {/* Centro: logo + texto */}
      <div className="center">
        <Image
          src="/brand-logo.png"   // <- coloca aquí tu archivo del logo (blanco/negro)
          alt="UMBRALIS"
          width={900}
          height={220}
          priority
          className="logo"
        />

        {/* Texto debajo del logo */}
        <p className={`soon ${pixel.className}`}>
          THIS WILL BE AN EXPERIENCE YOU WILL NEVER FORGET
        </p>
      </div>

      {/* Texto inferior pequeño */}
      <p className={`bottom-text ${pixel.className}`}>
        THE FOREST IS WAITING FOR YOU...
      </p>

      {/* Botones inferiores */}
      <div className="btn-group">
        <a
          href="https://x.com/umbralisdotfun"
          target="_blank"
          rel="noopener noreferrer"
          className={`tw-btn ${pixel.className}`}
          aria-label="Twitter"
        >
          Twitter
        </a>
        <a
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          className={`tw-btn ${pixel.className}`}
          aria-label="Contract Address"
        >
          CA
        </a>
      </div>
    </main>
  );
}
