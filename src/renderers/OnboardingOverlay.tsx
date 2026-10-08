import { useEffect, useRef, useState } from "react";
import { staticAsset } from "../lib/media";
import type { ContentBundle } from "../content-bundle/schema";
import "./OnboardingOverlay.css";
import { useReducedMotion } from "./useReducedMotion";

export function OnboardingOverlay({ content, resolveAsset, onComplete, muted, onMutedChange }: { content: ContentBundle["onboarding"]; resolveAsset: (assetId: string | undefined) => string | undefined; onComplete: () => void; muted: boolean; onMutedChange: (muted: boolean) => void }) {
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  const reducedMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const openSoundRef = useRef<HTMLAudioElement>(null);
  const purrSoundRef = useRef<HTMLAudioElement>(null);
  const openedSound = useRef(false);
  const current = content.pages[page];
  const captionComplete = shown >= current.caption.length;
  const openSound = resolveAsset(content.openSoundAssetId);
  const purrSound = resolveAsset(content.purrSoundAssetId);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const purr = purrSoundRef.current;
    if (muted) {
      purr?.pause();
      return;
    }
    if (!openedSound.current && openSoundRef.current) {
      openedSound.current = true;
      openSoundRef.current.volume = .32;
      void openSoundRef.current.play().catch(() => undefined);
    }
    if (purr) {
      purr.volume = .11;
      void purr.play().catch(() => undefined);
    }
    return () => purr?.pause();
  }, [muted, openSound, purrSound]);

  useEffect(() => {
    if (reducedMotion) {
      setShown(current.caption.length);
      return;
    }
    if (shown >= current.caption.length) return;
    const timer = window.setTimeout(() => setShown((value) => Math.min(value + 1, current.caption.length)), content.typewriterSpeed);
    return () => window.clearTimeout(timer);
  }, [content.typewriterSpeed, current.caption.length, reducedMotion, shown]);

  const continueOnboarding = () => {
    if (!captionComplete || leaving) return;
    if (page === 0) {
      setPage(1);
      setShown(reducedMotion ? content.pages[1].caption.length : 0);
      return;
    }
    purrSoundRef.current?.pause();
    setLeaving(true);
    window.setTimeout(onComplete, 220);
  };

  const toggleMuted = () => {
    const next = !muted;
    if (openSoundRef.current) openSoundRef.current.muted = next;
    if (purrSoundRef.current) purrSoundRef.current.muted = next;
    onMutedChange(next);
  };

  return (
    <main className={`onboarding-overlay${leaving ? " is-leaving" : ""}`} data-testid="onboarding-overlay">
      {openSound && <audio ref={openSoundRef} data-testid="onboarding-open-sound" src={openSound} preload="auto" muted={muted} />}
      {purrSound && <audio ref={purrSoundRef} data-testid="onboarding-purr-sound" src={purrSound} preload="auto" loop muted={muted} />}
      <div className={`onboarding-backdrop onboarding-backdrop--${page + 1}`} aria-hidden="true" />
      <section className="onboarding-window" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="onboarding-title" tabIndex={-1}>
        <header className="onboarding-titlebar">
          <img src={staticAsset("onboarding/canva-sleeping-cat.webp")} alt="" aria-hidden="true" />
          <h1 id="onboarding-title">{content.title}</h1>
          <button type="button" className="onboarding-sound-toggle" onClick={toggleMuted} aria-label={muted ? "开启声音" : "关闭声音"}><span aria-hidden="true">♪</span></button>
          <span className="onboarding-window-controls" aria-hidden="true"><i>−</i><i>×</i></span>
        </header>
        <div className="onboarding-body">
          <div className="onboarding-art" aria-hidden="true">
            <i className="onboarding-spark onboarding-spark--one" />
            <i className="onboarding-spark onboarding-spark--two" />
            <div className="onboarding-cat-breathe"><img src={staticAsset("onboarding/canva-sleeping-cat.webp")} alt="" /></div>
            <span className="onboarding-snore"><i>z</i><i>z</i><i>z</i></span>
          </div>
          <div className="onboarding-copy" key={page}>
            <p className="onboarding-caption" data-testid="onboarding-caption" aria-live="polite">
              {current.caption.slice(0, shown)}
              {!captionComplete && <span className="onboarding-cursor" aria-hidden="true">▍</span>}
            </p>
            <button
              type="button"
              className={`onboarding-start${page === 1 && captionComplete ? " is-guided" : ""}`}
              data-testid="onboarding-start"
              onClick={continueOnboarding}
              disabled={!captionComplete || leaving}
            >
              {content.buttonLabel} <span aria-hidden="true">→</span>
            </button>
            <small>{content.hint}</small>
          </div>
        </div>
      </section>
    </main>
  );
}
