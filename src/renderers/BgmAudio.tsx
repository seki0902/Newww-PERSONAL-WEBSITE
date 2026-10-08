import { useEffect, useRef, useState } from "react";
import "./BgmAudio.css";

export function BgmAudio({ src, muted, volume, testId }: { src: string; muted: boolean; volume: number; testId: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const retryRef = useRef<(reload?: boolean) => void>(() => undefined);
  const [problem, setProblem] = useState<"blocked" | "unavailable">();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let active = true;
    let request = 0;
    audio.volume = volume;
    audio.muted = muted;
    setProblem(undefined);

    const play = (reload = false) => {
      if (!active || muted) return;
      if (reload) audio.load();
      if (audio.error) { setProblem("unavailable"); return; }
      if (!audio.paused) return;
      const current = ++request;
      void audio.play().then(() => {
        if (active && request === current) setProblem(undefined);
      }).catch((error: unknown) => {
        if (!active || request !== current || (error instanceof DOMException && error.name === "AbortError")) return;
        setProblem(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "unavailable");
      });
    };
    retryRef.current = play;
    const retryAfterGesture = (event: Event) => {
      if (!event.isTrusted) return;
      if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
      play();
    };
    if (muted) audio.pause();
    else play();
    window.addEventListener("click", retryAfterGesture);
    window.addEventListener("keydown", retryAfterGesture);
    return () => {
      active = false;
      retryRef.current = () => undefined;
      window.removeEventListener("click", retryAfterGesture);
      window.removeEventListener("keydown", retryAfterGesture);
      audio.pause();
    };
  }, [src, muted, volume]);

  return <>
    <audio ref={audioRef} data-testid={testId} src={src} loop muted={muted} preload="auto" onError={() => setProblem("unavailable")} />
    {!muted && problem && <div className="bgm-feedback" data-testid="bgm-feedback" role="status">
      <span>{problem === "blocked" ? "点击开启背景音乐" : "背景音乐暂时无法加载"}</span>
      <button type="button" onClick={() => retryRef.current(problem === "unavailable")}>{problem === "blocked" ? "开启背景音乐" : "重试背景音乐"}</button>
    </div>}
  </>;
}
