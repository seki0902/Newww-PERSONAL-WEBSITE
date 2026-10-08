import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ContentBundle } from "../content-bundle/schema";
import { useReducedMotion } from "./useReducedMotion";
import "./OnboardingOverlay.css";
import "./WelcomeOverlay.css";

export function WelcomeOverlay({ content, resolveAsset, onComplete, muted }: { content: ContentBundle["welcome"]; resolveAsset: (assetId: string | undefined) => string | undefined; onComplete: (desktopId: string) => void; muted: boolean }) {
  const [highlighted, setHighlighted] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);
  const clickSoundRef = useRef<HTMLAudioElement>(null);
  const exitTimer = useRef<number>();
  const reducedMotion = useReducedMotion();
  const clickSound = resolveAsset(content.clickSoundAssetId);
  const background = resolveAsset(content.backgroundAssetId);
  const image = (assetId: string | undefined, fallback: string) => resolveAsset(assetId) ?? `/assets/onboarding/canva-welcome-${fallback}.png`;

  useEffect(() => {
    firstChoiceRef.current?.focus();
    return () => window.clearTimeout(exitTimer.current);
  }, []);

  const enterDesktop = (desktopId: string) => {
    if (leaving) return;
    if (clickSoundRef.current && !muted) {
      clickSoundRef.current.currentTime = 0;
      void clickSoundRef.current.play().catch(() => undefined);
    }
    setLeaving(true);
    exitTimer.current = window.setTimeout(() => onComplete(desktopId), reducedMotion ? 0 : 220);
  };

  const keepFocusInDialog = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <main className={`onboarding-overlay welcome-overlay${leaving ? " is-leaving" : ""}`} data-testid="welcome-overlay">
      {clickSound && <audio ref={clickSoundRef} data-testid="welcome-click-sound" src={clickSound} preload="auto" muted={muted} />}
      <div className="onboarding-backdrop onboarding-backdrop--2" style={background ? { backgroundImage: `url("${background}")` } : undefined} aria-hidden="true" />
      <section className="welcome-window" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="welcome-title" onKeyDown={keepFocusInDialog}>
        <img className="welcome-character" src={image(content.characterAssetId, "character")} alt="" aria-hidden="true" />
        <img className="welcome-dialogue" src={image(content.dialogueAssetId, "dialogue")} alt="" aria-hidden="true" />
        <img className="welcome-nameplate" src={image(content.nameplateAssetId, "nameplate")} alt="" aria-hidden="true" />
        <span className="welcome-name" aria-hidden="true"><span>{content.speakerName}</span></span>
        <h1 className="welcome-message" id="welcome-title">{content.message}</h1>
        {content.choices.map((choice, index) => (
          <button
            key={choice.id}
            ref={index === 0 ? firstChoiceRef : undefined}
            type="button"
            className={`welcome-choice welcome-choice--${index + 1}`}
            onPointerEnter={() => setHighlighted(index)}
            onFocus={() => setHighlighted(index)}
            onClick={() => enterDesktop(choice.id)}
            disabled={leaving}
          >
            <img className="welcome-choice-art" src={highlighted === index ? image(content.highlightedChoiceAssetId, "choice-content") : image(choice.assetId, index === 2 ? "choice-sales" : "choice-education")} alt="" aria-hidden="true" />
            <span>{choice.label}</span>
            {highlighted === index && <img className="welcome-choice-cursor" src={image(content.cursorAssetId, "cursor")} alt="" aria-hidden="true" />}
          </button>
        ))}
      </section>
    </main>
  );
}
