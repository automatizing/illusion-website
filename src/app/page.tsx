"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";

/* Fuentes (typewriter + subtítulo) */
import { Special_Elite, IM_Fell_English } from "next/font/google";
const typewriterFont = Special_Elite({ weight: "400", subsets: ["latin"] });
const fellFont = IM_Fell_English({ weight: "400", subsets: ["latin"] });

/* ================================
   Hook de sonido ambiente del bosque
   ================================ */
function useForestAmbience() {
  useEffect(() => {
    const audio = new Audio("/audio/forest.mp3"); // coloca forest.mp3 en /public/audio/
    audio.loop = true;
    audio.volume = 0.2; // volumen bajo
    audio.preload = "auto";

    // intenta reproducir
    audio.play().catch(() => {
      // si autoplay falla, esperar un click del usuario
      const resume = () => {
        audio.play().catch(() => {});
        document.removeEventListener("click", resume);
      };
      document.addEventListener("click", resume);
    });

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);
}

/** Overlay permanente con carrusel de iconos (fade in/out garantizados) */
function TeaserOverlay() {
  // Frases (rotan aparte, desincronizadas del icono)
  const phrases = [
    "access will open soon.",
    "the path is almost clear.",
    "return at nightfall.",
    "the forest is still listening.",
  ];

  // Iconos: Question Mark y Pino
  const IconQMark = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path d="M24 35.5a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z" fill="currentColor"/>
      <path d="M24 8c-5.9 0-10 3.5-10 8.6 0 1 .8 1.8 1.8 1.8s1.8-.8 1.8-1.8c0-3.2 2.5-5 6.4-5 3.4 0 5.9 1.6 5.9 4.4 0 2-1.2 3.3-3.8 4.7-3.5 1.9-5.2 4.1-5 7.6.1 1 .8 1.7 1.8 1.7h.2c.9 0 1.7-.8 1.8-1.7-.1-2.1.7-3.4 3.5-4.9 3.6-1.9 5.7-4.2 5.7-7.7C31.9 11 28.7 8 24 8z" fill="currentColor"/>
    </svg>
  );
  const IconPine = ({ className = "" }: { className?: string }) => (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M32 4l14 14h-9l12 12h-10l11 11H34v9h-4v-9H14l11-11H15L27 18h-9L32 4z" fill="currentColor"/>
    </svg>
  );

  // Un único icono en el DOM
  const [iconIdx, setIconIdx] = useState<0 | 1>(0); // 0 = ?, 1 = pino
  const [visible, setVisible] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);

  const IN_MS = 800;
  const HOLD_MS = 1600;
  const OUT_MS = 800;
  const GAP_MS = 100;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const runCycleFor = React.useCallback((idx: 0 | 1) => {
    clearTimers();
    setIconIdx(idx);
    setVisible(false);

    timers.current.push(
      window.setTimeout(() => {
        const node = hostRef.current;
        if (node) void node.offsetHeight;
        requestAnimationFrame(() => setVisible(true));
      }, 16) as unknown as number
    );

    timers.current.push(
      window.setTimeout(() => setVisible(false), IN_MS + HOLD_MS) as unknown as number
    );

    timers.current.push(
      window.setTimeout(() => {
        const next = idx === 0 ? 1 : 0;
        timers.current.push(
          window.setTimeout(() => runCycleFor(next as 0 | 1), GAP_MS) as unknown as number
        );
      }, IN_MS + HOLD_MS + OUT_MS) as unknown as number
    );
  }, []);

  useEffect(() => {
    runCycleFor(0);
    return clearTimers;
  }, [runCycleFor]);

  // Texto rotatorio independiente
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [phrasePhase, setPhrasePhase] = useState<"show" | "hide">("show");
  useEffect(() => {
    const INTERVAL = 2600;
    let swapId: number | null = null;

    const cycle = () => {
      setPhrasePhase("hide");
      swapId = window.setTimeout(() => {
        setPhraseIdx((v) => (v + 1) % phrases.length);
        setPhrasePhase("show");
      }, 420) as unknown as number;
    };

    const id = window.setInterval(cycle, INTERVAL);
    return () => {
      window.clearInterval(id);
      if (swapId) window.clearTimeout(swapId);
    };
  }, [phrases.length]);

  const Icon = iconIdx === 0 ? IconQMark : IconPine;
  const iconClass = `soon-icon-el ${visible ? "is-visible" : "is-hidden"}`;

  return (
    <div className="soon-overlay" role="dialog" aria-modal="true" aria-label="Coming soon">
      <div className="soon-wrap">
        <div className="soon-icon-stage" ref={hostRef} aria-hidden="true">
          <Icon className={iconClass} />
        </div>

        <p className={`soon-title ${typewriterFont.className}`}>
          soon you will be able to enter the forest…
        </p>

        <p
          className={`soon-sub ${fellFont.className} ${
            phrasePhase === "show" ? "is-showing" : "is-hiding"
          }`}
          aria-live="polite"
        >
          {phrases[phraseIdx]}
        </p>
      </div>
    </div>
  );
}

/** Página: overlay único cubriendo todo (sin salida) */
export default function Page() {
  useForestAmbience(); // ⬅️ Activa el audio ambiente

  useEffect(() => {
    const src = `/forest.jpg?v=${Date.now()}`;
    const img = new Image();
    img.onload = () => {
      document.documentElement.style.setProperty("--forest-url", `url("${src}")`);
    };
    img.onerror = () => {
      document.documentElement.style.setProperty("--forest-url", `url("/forest.jpg")`);
    };
    img.src = src;
  }, []);

  return (
    <main className="scene" data-bg-ready="true">
      <div className="vignette" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />
      <TeaserOverlay />
    </main>
  );
}
