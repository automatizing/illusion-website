"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/* fuentes de google para el typewriter y el titulo */
import { Special_Elite, IM_Fell_English } from "next/font/google";
const typewriterFont = Special_Elite({ weight: "400", subsets: ["latin"] });
const fellFont = IM_Fell_English({ weight: "400", subsets: ["latin"] });

/** fases de la escena (flujo completo de la experiencia) */
type Phase = "loading" | "gate" | "prestory" | "story" | "entered";

/* audio y ritmo del typeo (valores suaves para no saturar) */
const KEY_MASTER_GAIN = 0.09;
const MIN_KEY_GAP_MS = 90;
const KEY_SOUND_CHANCE = 0.75;

/* movimiento de camara/parallax (límites) */
const CAM_MAX_YAW = 10;      // ±10° horiz
const CAM_MAX_PITCH = 6;     // ±6°  vert
const BG_SHIFT_X_MAX = 24;   // px (sutil)
const BG_SHIFT_Y_MAX = 12;   // px (sutil)

/* ================================
   Componente de Historia (typewriter + SFX)
   Muestra varias “diapositivas” con texto que se escribe solo.
   Controles: mute / skip.
   ================================ */
function StoryScreens({
  mounted,
  interactive,
  onDone,
}: {
  mounted: boolean;     // se monta solo en las fases story/prestory
  interactive: boolean; // permite avanzar
  onDone: () => void;   // callback cuando termina
}) {
  /* guion de la historia */
  const slides = [
    "You wake up at the edge of a narrow path. The air is cold and damp.",
    "You don’t remember how you got here. All you have is a flashlight.",
    "The forest seems to be watching you.",
    "Somewhere in the dark, scattered notes hold the truth. Find them before the forest finds you.",
  ];

  // rutas de audio locales
  const TYPE_SFX_URLS = [
    "/audio/typewriter-key-1.mp3",
    "/audio/typewriter-key-2.mp3",
    "/audio/typewriter-key-3.mp3",
  ];
  const ADVANCE_SFX_URL = "/audio/advance.mp3";

  /* estado básico del tipeo */
  const [i, setI] = useState(0);          // indice de slide
  const [muted, setMuted] = useState(false); // mute global
  const mutedRef = useRef(false);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  /* Pequeñas transiciones entre slides */
  const [slideVisible, setSlideVisible] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const FADE_OUT_MS = 180;
  const FADE_IN_MS = 220;

  /* typewriter: cuenta de caracteres y bandera */
  const [typedCount, setTypedCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeout = useRef<number | null>(null);
  const reduceMotion = useRef(false); // respeta prefers-reduced-motion

  const autoAdvanceTimer = useRef<number | null>(null);

  /* pool de audio para evitar “cortes” al reproducir muchas teclas */
  type AudioVariantPool = { variants: HTMLAudioElement[][]; nextVar: number; nextIdx: number[] };
  const keyPools = useRef<AudioVariantPool>({ variants: [], nextVar: 0, nextIdx: [] });
  const POOL_PER_VARIANT = 4;
  const lastKeyAt = useRef(0);

  /* crea los pools de sonido solo una vez (montaje) */
  useEffect(() => {
    try {
      reduceMotion.current =
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    const variants = TYPE_SFX_URLS.map((url) =>
      Array.from({ length: POOL_PER_VARIANT }, () => {
        const a = new Audio(url);
        a.preload = "auto";
        a.volume = KEY_MASTER_GAIN;
        return a;
      })
    );
    keyPools.current = { variants, nextVar: 0, nextIdx: variants.map(() => 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearTypingTimeout = () => {
    if (typingTimeout.current) {
      window.clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
  };

  /* reproduce el sonido de tecla con leve variación para que suene orgánico */
  const playKey = useCallback(() => {
    if (mutedRef.current) return;
    const now = performance.now();
    if (now - lastKeyAt.current < MIN_KEY_GAP_MS) return; // evita saturacion
    lastKeyAt.current = now;

    const pool = keyPools.current;
    if (!pool.variants.length) return;
    const varIdx = pool.nextVar;
    pool.nextVar = (pool.nextVar + 1) % pool.variants.length;

    const channels = pool.variants[varIdx];
    const idx = pool.nextIdx[varIdx] % channels.length;
    pool.nextIdx[varIdx] = (idx + 1) % channels.length;

    const a = channels[idx];
    try {
      a.currentTime = 0;
      a.playbackRate = 0.97 + Math.random() * 0.06;
      a.volume = KEY_MASTER_GAIN;
      a.play().catch(() => {});
    } catch {}
  }, []);

  /* sonido al pasar/terminar una slide */
  const playAdvance = useCallback(() => {
    if (mutedRef.current) return;
    const a = new Audio(ADVANCE_SFX_URL);
    a.preload = "auto";
    a.volume = 0.9;
    a.playbackRate = 0.98 + Math.random() * 0.04;
    a.play().catch(() => {});
  }, []);

  /* logica de typeo: avanza caracter por caracter con pequeñas pausas.
     importante: respeta reduceMotion (muestra todo de una). */
  const startTyping = useCallback(
    (fullText: string) => {
      clearTypingTimeout();

      if (reduceMotion.current) {
        setTypedCount(fullText.length);
        setIsTyping(false);
        return;
      }

      setIsTyping(true);

      const tick = (idx: number) => {
        if (idx >= fullText.length) {
          setIsTyping(false);
          return;
        }
        const ch = fullText[idx];
        const isNonSpace = /\S/.test(ch);
        const shouldSound = isNonSpace && Math.random() < KEY_SOUND_CHANCE;
        if (shouldSound) playKey();

        let delay = 55 + Math.random() * 35;           // base
        if (ch === " ") delay += 30 + Math.random() * 20;          // espacios
        if (/[,\u2014\u2013]/.test(ch)) delay += 220 + Math.random() * 80; // comas/guiones
        if (/[.;:!?…]/.test(ch)) delay += 360 + Math.random() * 160;       // pausas largas
        if (ch === "\n") delay += 420 + Math.random() * 180;                // saltos de línea

        setTypedCount(idx + 1);
        typingTimeout.current = window.setTimeout(() => tick(idx + 1), delay);
      };

      typingTimeout.current = window.setTimeout(() => tick(0), 300);
    },
    [playKey]
  );

  /* cada vez que cambia la slide, reinicia el tipeo */
  useEffect(() => {
    if (!mounted) return;
    const text = slides[i];
    setTypedCount(0);
    startTyping(text);
    return () => clearTypingTimeout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, i]);

  /* asegura estados visuales al (re)montar */
  useEffect(() => {
    setSlideVisible(true);
    setTransitioning(false);
  }, [mounted]);

  /* avanza: si no termino de escribir, completa; si termino, pasa a la siguiente o finaliza */
  const advance = useCallback(() => {
    if (!interactive || transitioning) return;

    const full = slides[i];
    const finished = typedCount >= full.length;

    if (!finished) {
      clearTypingTimeout();
      setTypedCount(full.length);
      setIsTyping(false);
      return;
    }

    setTransitioning(true);
    setSlideVisible(false);

    window.setTimeout(() => {
      const isLast = i >= slides.length - 1;
      if (isLast) {
        playAdvance();
        onDone(); // avisa al padre que cierre historia y entre al bosque
        setTransitioning(false);
        return;
      }

      setI((v) => v + 1);
      setTypedCount(0);
      playAdvance();

      setSlideVisible(true);
      window.setTimeout(() => setTransitioning(false), FADE_IN_MS);
    }, FADE_OUT_MS);
  }, [interactive, transitioning, i, slides, typedCount, onDone, playAdvance]);

  /* auto-skip cuando termina de escribirse una slide */
  useEffect(() => {
    if (!interactive || transitioning) return;
    const full = slides[i];
    const finished = typedCount >= full.length;

    if (autoAdvanceTimer.current) {
      window.clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (finished) {
      autoAdvanceTimer.current = window.setTimeout(() => {
        advance();
      }, 700);
    }
    return () => {
      if (autoAdvanceTimer.current) {
        window.clearTimeout(autoAdvanceTimer.current);
        autoAdvanceTimer.current = null;
      }
    };
  }, [typedCount, interactive, transitioning, i, slides, advance]);

  /* atajos de teclado: avanzar/omitir/escapar */
  useEffect(() => {
    if (!interactive) return;
    const onKey = (e: KeyboardEvent) => {
      if (transitioning) return;
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight") {
        e.preventDefault();
        advance();
      } else if (e.key === "Escape") {
        onDone();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactive, transitioning, advance, onDone]);

  if (!mounted) return null;

  /* texto visible hasta el caracter actual + cursor visual */
  const visibleText = slides[i].slice(0, typedCount);
  const finishedSlide = typedCount >= slides[i].length;

  /* iconos inline simples para los FABs */
  const IconVolumeOn = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h3l4-3v10l-4-3H4z" fill="currentColor" />
      <path d="M15 9c1.6 1.2 1.6 4.8 0 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 7.5c3 2.2 3 7.8 0 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
  const IconVolumeOff = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h3l4-3v10l-4-3H4z" fill="currentColor" />
      <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  const IconFastForward = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7l6 5-6 5V7z" fill="currentColor" />
      <path d="M13 7l6 5-6 5V7z" fill="currentColor" />
    </svg>
  );

  return (
    <>
      {/* capa de historia con texto animado */}
      <div className="story-screen" role="region" aria-label="Story">
        <div
          className={`story-inner ${typewriterFont.className}`}
          style={{
            opacity: slideVisible ? 1 : 0,
            transition: `opacity ${slideVisible ? FADE_IN_MS : FADE_OUT_MS}ms ease-in-out`,
          }}
        >
          <p aria-live="polite">
            {visibleText}
            {!finishedSlide && (
              <span
                style={{
                  display: "inline-block",
                  width: "0.6ch",
                  borderBottom: "2px solid #e8e8e8",
                  marginLeft: "2px",
                  transform: "translateY(-1px)",
                  opacity: 0.85,
                }}
                aria-hidden="true"
              />
            )}
          </p>
        </div>
      </div>

      {/* botones: mute y skip */}
      <div className="story-ui" aria-label="Story controls">
        <button
          className="story-fab"
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-pressed={muted}
          title={muted ? "Unmute" : "Mute"}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <IconVolumeOff /> : <IconVolumeOn />}
          <span className="sr-only">{muted ? "Unmute" : "Mute"}</span>
        </button>

        <button
          className="story-fab"
          type="button"
          onClick={() => {
            const full = slides[i];
            const finished = typedCount >= full.length;
            if (!finished) {
              clearTypingTimeout();
              setTypedCount(full.length);
              setIsTyping(false);
            } else {
              onDone();
            }
          }}
          title={typedCount < slides[i].length ? "Complete slide" : "Skip"}
          aria-label={typedCount < slides[i].length ? "Complete slide" : "Skip"}
        >
          <IconFastForward />
          <span className="sr-only">
            {typedCount < slides[i].length ? "Complete slide" : "Skip"}
          </span>
        </button>
      </div>
    </>
  );
}

/* ================================
   Home: controla fases, fondo, cámara, linterna y transiciones.
   ================================ */
export default function Home() {
  const [phase, setPhase] = useState<Phase>("loading"); // flujo principal

  // precarga del fondo con bust de cache (IMPORTANTE: no rompe SSR)
  const [bgReady, setBgReady] = useState(false);
  useEffect(() => {
    // se ejecuta solo en cliente
    const src = `/forest.jpg?v=${Date.now()}`; // evita usar la versión cacheada
    const img = new Image();
    img.onload = () => {
      document.documentElement.style.setProperty("--forest-url", `url("${src}")`);
      setBgReady(true);
    };
    img.onerror = () => {
      // fallback sin bust si falla (por si el asset no existe)
      document.documentElement.style.setProperty("--forest-url", `url("/forest.jpg")`);
      setBgReady(true);
    };
    img.src = src;
  }, []);

  // loading progress (0–100) con easing suave
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);

  // crossfade de loading → gate
  const [crossfading, setCrossfading] = useState(false);
  const CROSS_MS = 650;

  // transiciones de “pre-historia” y “pantalla negra” al entrar al bosque
  const [prestoryFading, setPrestoryFading] = useState(false);
  const [showBlackout, setShowBlackout] = useState(false);
  const [blackoutFading, setBlackoutFading] = useState(false);

  // “look around”: rotacion de cámara y target de puntero
  const yawDeg = useRef(0);
  const pitchDeg = useRef(0);
  const yawTargetDeg = useRef(0);
  const pitchTargetDeg = useRef(0);
  const pointerLocked = useRef(false); // IMPORTANTE: activa captura cruda del ratón

  // sensibilidad del mouse para la camara
  const yawSens = 0.18;
  const pitchSens = 0.14;

  // linterna: target y posición suavizada para el halo
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const vw = useRef(typeof window !== "undefined" ? window.innerWidth : 0);
  const vh = useRef(typeof window !== "undefined" ? window.innerHeight : 0);

  /* actualiza dimensiones en resize (para ratios correctos) */
  useEffect(() => {
    const onResize = () => {
      vw.current = window.innerWidth;
      vh.current = window.innerHeight;
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* animacion del loading (random para que parezca una carga real) */
  useEffect(() => {
    if (phase !== "loading") return;

    const duration = 3400 + Math.random() * 1700;
    const start = performance.now();
    progressRef.current = 0;
    setProgress(0);

    let id = requestAnimationFrame(function step(now) {
      const t = Math.min(1, (now - start) / duration);
      // easing cubico para entrada/salida suave
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const p = Math.floor(eased * 100);
      progressRef.current = p;
      setProgress(p);

      if (t < 1) {
        id = requestAnimationFrame(step);
      } else {
        // pequena pausa antes de cruzar a “gate”
        setTimeout(() => {
          setCrossfading(true);
          setTimeout(() => {
            setPhase("gate");
            setCrossfading(false);
          }, CROSS_MS + 20);
        }, 350);
      }
    });

    return () => cancelAnimationFrame(id);
  }, [phase, CROSS_MS]);

  /* camara + linterna: solo cuando ya “entraste” al bosque */
  useEffect(() => {
    if (phase !== "entered") {
      // al salir de esta fase, limpia animación y cursor
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      document.documentElement.style.cursor = "default";
      return;
    }

    // inicializa posiciones al centro y oculta cursor real
    target.current.x = window.innerWidth / 2;
    target.current.y = window.innerHeight / 2;
    current.current.x = target.current.x;
    current.current.y = target.current.y;
    document.documentElement.style.cursor = "none";

    // “pointer lock”: captura el mouse para giros más directos (click para entrar)
    const onPointerLockChange = () => {
      pointerLocked.current = document.pointerLockElement === document.documentElement;
    };
    const onClickToLock = () => {
      if (!pointerLocked.current) {
        document.documentElement.requestPointerLock?.();
      }
    };

    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

    // mouse: con lock usa movement X/Y, sin lock posiciona por cursor
    const onMouseMove = (e: MouseEvent) => {
      if (pointerLocked.current) {
        yawDeg.current = clamp(yawDeg.current + e.movementX * yawSens, -CAM_MAX_YAW, CAM_MAX_YAW);
        pitchDeg.current = clamp(pitchDeg.current - e.movementY * pitchSens, -CAM_MAX_PITCH, CAM_MAX_PITCH);

        const nx = clamp(current.current.x + e.movementX * 1.0, 0, vw.current);
        const ny = clamp(current.current.y + e.movementY * 1.0, 0, vh.current);
        target.current.x = nx;
        target.current.y = ny;
      } else {
        const rx = e.clientX / vw.current - 0.5;
        const ry = e.clientY / vh.current - 0.5;
        yawTargetDeg.current = rx * 2 * CAM_MAX_YAW;
        pitchTargetDeg.current = -ry * 2 * CAM_MAX_PITCH;

        target.current.x = e.clientX;
        target.current.y = e.clientY;
      }
    };

    // touch: usa posición del dedo como referencia de cámara/linterna [ESTO ES PARA TELEFONOS]
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const rx = t.clientX / vw.current - 0.5;
      const ry = t.clientY / vh.current - 0.5;
      yawTargetDeg.current = rx * 2 * CAM_MAX_YAW;
      pitchTargetDeg.current = -ry * 2 * CAM_MAX_PITCH;

      target.current.x = t.clientX;
      target.current.y = t.clientY;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("click", onClickToLock);

    // bucle de animación: suaviza linterna y aplica parallax/cámara
    const animate = () => {
      rafId.current = requestAnimationFrame(animate);

      // suavizado linterna (seguimiento con lerp)
      const ease = 0.18;
      current.current.x += (target.current.x - current.current.x) * ease;
      current.current.y += (target.current.y - current.current.y) * ease;

      const r = document.documentElement;
      r.style.setProperty("--cursor-x", `${current.current.x}px`);
      r.style.setProperty("--cursor-y", `${current.current.y}px`);

      // easing de yaw/pitch cuando NO hay pointer lock
      if (!pointerLocked.current) {
        yawDeg.current += (yawTargetDeg.current - yawDeg.current) * 0.08;
        pitchDeg.current += (pitchTargetDeg.current - pitchDeg.current) * 0.08;
      }

      // normalizados a [-1..1]
      const nx = yawDeg.current / CAM_MAX_YAW;
      const ny = pitchDeg.current / CAM_MAX_PITCH;

      // parallax del fondo + inclinación “cámara”
      const bgx = -nx * BG_SHIFT_X_MAX;
      const bgy = -ny * BG_SHIFT_Y_MAX;

      r.style.setProperty("--cam-rot-y", `${-yawDeg.current}deg`);
      r.style.setProperty("--cam-rot-x", `${-pitchDeg.current}deg`);
      r.style.setProperty("--bg-x", `${bgx}px`);
      r.style.setProperty("--bg-y", `${bgy}px`);
    };

    animate();

    // limpieza al salir de la fase
    return () => {
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("click", onClickToLock);
      document.exitPointerLock?.();
      document.documentElement.style.cursor = "default";
    };
  }, [phase]);

  /* cambia de gate → historia con breve precarga/oscurecimiento */
  const onGateEnter = () => {
    setPhase("prestory");
    setPrestoryFading(false);

    const HOLD_MS = 900;
    const FADE_MS = 600;

    setTimeout(() => {
      setPrestoryFading(true);
      setTimeout(() => {
        setPhase("story");
      }, FADE_MS);
    }, HOLD_MS);
  };

  /* cuando termina la historia, entra al bosque con blackout corto */
  const enterForest = () => {
    if (phase === "entered") return;

    setShowBlackout(true);
    requestAnimationFrame(() => {
      setPhase("entered");
      setTimeout(() => {
        setBlackoutFading(true);
        const DURATION = 450;
        setTimeout(() => {
          setShowBlackout(false);
          setBlackoutFading(false);
        }, DURATION);
      }, 16);
    });
  };

  return (
    <main
      className="scene"
      data-bg-ready={bgReady ? "true" : "false"} /* hace aparecer el fondo */
    >
      {/* capas atmosféricas */}
      <div className="vignette" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />

      {/* linterna solo luego de "entrar" */}
      {phase === "entered" && <div className="flashlight-overlay" aria-hidden="true" />}

      {/* overlay (Loading / Gate) con crossfade entre capas */}
      {(phase === "loading" || phase === "gate" || crossfading) && (
        <div
          className={`overlay-screen`}
          role="dialog"
          aria-modal="true"
          aria-live="polite"
          tabIndex={0}
          onClick={phase === "gate" ? onGateEnter : undefined}
          onKeyDown={(e) => {
            if (phase === "gate" && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onGateEnter();
            }
          }}
        >
          <div className="overlay-stack">
            {/* capa: loading con barra de progreso */}
            <div
              className={`loading-layer ${
                crossfading ? "is-fading" : phase === "gate" ? "is-hidden" : ""
              }`}
            >
              <div className="loading-wrap">
                <p className={`loading-title ${fellFont.className}`}>
                  this is an experience you will never forget.
                </p>
                <div className="myst-bar" aria-label="Loading">
                  <div className="myst-bar-fill" style={{ width: `${progress}%` }} aria-hidden="true" />
                  <div className="myst-bar-sheen" aria-hidden="true" />
                  <div className="myst-bar-noise" aria-hidden="true" />
                </div>
              </div>
            </div>

            {/* capa: gate (clic para entrar) */}
            <div className={`gate-layer ${phase === "gate" || crossfading ? "is-visible" : ""}`}>
              <div
                className="gate-wrap"
                onClick={(e) => {
                  e.stopPropagation();
                  onGateEnter();
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onGateEnter();
                  }
                }}
              >
                <p className={`gate-title ${fellFont.className}`}>click anywhere to enter</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* pantallas de historia (montada en prestory/story; interactiva solo en story) */}
      <StoryScreens
        mounted={phase === "prestory" || phase === "story"}
        interactive={phase === "story"}
        onDone={enterForest}
      />

      {/* Transiciones visuales de negro */}
      {phase === "prestory" && (
        <div className={`prestory-overlay ${prestoryFading ? "is-fading" : ""}`} aria-hidden="true" />
      )}
      {showBlackout && <div className={`blackout ${blackoutFading ? "is-fading" : ""}`} />}
    </main>
  );
}