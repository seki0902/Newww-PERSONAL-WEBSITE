import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAsset, type ContentBundle } from "../content-bundle/schema";
import { assetUrl } from "../content-bundle/loader";
import "./SceneAssets.css";
import { usePortraitMask } from "./usePortraitMask";
import { useReducedMotion } from "./useReducedMotion";

export function VisualNovelScreen({ bundle, preview, onComplete, muted, onMutedChange }: { bundle: ContentBundle; preview: boolean; onComplete: () => void; muted: boolean; onMutedChange: (muted: boolean) => void }) {
  const scenes = useMemo(() => bundle.intro.scenes.filter((scene) => scene.enabled).sort((a, b) => a.order - b.order), [bundle]);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [revealedSceneIndex, setRevealedSceneIndex] = useState<number>();
  const [transitioning, setTransitioning] = useState(false);
  const reducedMotion = useReducedMotion();
  const audioRef = useRef<HTMLAudioElement>(null);
  const textSoundRef = useRef<HTMLAudioElement>(null);
  const clickSoundRef = useRef<HTMLAudioElement>(null);
  const scene = scenes[sceneIndex];
  const text = scene?.text ?? "";
  const isFinished = shown >= text.length;
  const isLast = sceneIndex === scenes.length - 1;
  const needsSceneReveal = sceneIndex === 0 || scenes[sceneIndex - 1]?.backgroundAssetId !== scene?.backgroundAssetId;
  const sceneRevealed = !needsSceneReveal || revealedSceneIndex === sceneIndex;
  const background = assetUrl(bundle, scene?.backgroundAssetId, preview);
  const character = assetUrl(bundle, scene?.characterAssetId, preview);
  const suppliedBackground = getAsset(bundle, scene?.backgroundAssetId)?.presentation?.backgroundLayout === "cropped";
  const suppliedCharacter = getAsset(bundle, scene?.characterAssetId)?.presentation?.portraitStyle === "white-cutout";
  const portraitMask = usePortraitMask(suppliedCharacter ? character : undefined);
  const characterReady = !suppliedCharacter || portraitMask !== undefined;
  const bgm = assetUrl(bundle, bundle.intro.settings.bgmAssetId, preview);
  const textSound = assetUrl(bundle, bundle.intro.settings.textSoundAssetId, preview);
  const clickSound = assetUrl(bundle, bundle.intro.settings.clickSoundAssetId, preview);
  const playEffect = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio || muted) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [muted]);

  useEffect(() => { setShown(0); }, [sceneIndex]);
  useEffect(() => {
    if (!sceneRevealed || isFinished || !text) return;
    if (reducedMotion) { setShown(text.length); return; }
    const speed = bundle.intro.settings.typewriterSpeed ?? 28;
    const timer = window.setTimeout(() => setShown((value) => Math.min(value + 1, text.length)), speed);
    return () => window.clearTimeout(timer);
  }, [shown, text, isFinished, sceneRevealed, reducedMotion, bundle.intro.settings.typewriterSpeed]);
  useEffect(() => {
    const interval = bundle.intro.settings.textSoundInterval ?? 4;
    if (shown === 0 || shown >= text.length || shown % interval !== 0) return;
    playEffect(textSoundRef.current);
  }, [shown, text.length, playEffect, bundle.intro.settings.textSoundInterval]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = bundle.intro.settings.bgmVolume ?? 0.24; }, [bundle.intro.settings.bgmVolume]);

  const advance = () => {
    playEffect(clickSoundRef.current);
    if (!isFinished) { setShown(text.length); return; }
    if (!isLast) { setSceneIndex((value) => value + 1); return; }
  };
  const enterDesktop = () => {
    if (transitioning) return;
    playEffect(clickSoundRef.current);
    if (reducedMotion) { onComplete(); return; }
    setTransitioning(true);
    window.setTimeout(onComplete, 620);
  };
  const startBgm = () => { if (audioRef.current && !muted) void audioRef.current.play().catch(() => undefined); };
  const toggleMuted = () => {
    const next = !muted;
    for (const audio of [audioRef.current, textSoundRef.current, clickSoundRef.current]) if (audio) audio.muted = next;
    onMutedChange(next);
    if (!next && audioRef.current) void audioRef.current.play().catch(() => undefined);
  };

  if (!scene) return <main className="bundle-error">没有可播放的开场 Scene。</main>;
  return <main className={`visual-novel ${transitioning ? "computer-transition" : ""}`} onClick={startBgm}>
    {bgm && <audio ref={audioRef} data-testid="intro-bgm" src={bgm} loop muted={muted} />}
    {textSound && <audio ref={textSoundRef} data-testid="text-sound" src={textSound} preload="auto" muted={muted} />}
    {clickSound && <audio ref={clickSoundRef} data-testid="click-sound" src={clickSound} preload="auto" muted={muted} />}
    <div className="novel-stage" style={background && !suppliedBackground ? { backgroundImage: `url(${background})` } : undefined}>
      {suppliedBackground && <div className="novel-supplied-background" style={{ backgroundImage: `url(${background})` }} aria-hidden="true" />}
      <div className="novel-shine" />
      {sceneRevealed && character && characterReady && <img key={scene.id} data-scene={scene.id} className={`novel-character ${scene.characterPosition ?? "right"}${suppliedCharacter ? " novel-supplied-hr" : ""}`} src={character} style={portraitMask ? { maskImage: `url(${portraitMask})`, maskSize: "100% 100%", maskRepeat: "no-repeat" } : undefined} alt={scene.speaker ?? "人物立绘"} />}
      {!sceneRevealed && <button className="novel-scene-reveal" onClick={() => setRevealedSceneIndex(sceneIndex)} aria-label="显示人物和对话" />}
      {sceneRevealed && isLast && isFinished && <button className="computer-hotspot computer-screen-target" data-testid="computer-hotspot" onClick={(event) => { event.stopPropagation(); enterDesktop(); }} aria-label="点击电脑屏幕开机" />}
    </div>
    {sceneRevealed && <section key={scene.id} className={`dialogue-box ${!scene.characterAssetId ? "inner-thought" : ""}`} onClick={advance} role="button" tabIndex={0} onKeyDown={(event) => event.target === event.currentTarget && event.key === "Enter" && advance()} aria-label="推进对白">
      <button className="sound-toggle" onClick={(event) => { event.stopPropagation(); toggleMuted(); }} aria-label={muted ? "开启声音" : "关闭声音"}>{muted ? "声音：关" : "声音：开"}</button>
      {scene.speaker && <strong className="speaker-name">{scene.speaker}</strong>}
      <p aria-live="polite">{text.slice(0, shown)}{!isFinished && <span className="typing-cursor">▌</span>}</p>
      <span className="advance-hint">{isLast && isFinished ? "点击电脑继续" : "点击推进  ▶"}</span>
    </section>}
  </main>;
}
