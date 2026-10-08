import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { projects as baseProjects } from "./content";
import { assetUrl, loadContentBundle } from "./content-bundle/loader";
import { mergeProjectPages, type ContentBundle } from "./content-bundle/schema";
import { EditorApp } from "./editor/EditorApp";
import { getNextProject, getProgress } from "./runtime/flow";
import { setRuntimeProjects, useRuntimeStore } from "./runtime/store";
import { DesktopScreen } from "./renderers/DesktopScreen";
import { ProjectScreen } from "./renderers/ProjectScreen";
import { TarotScreen } from "./renderers/TarotScreen";
import { VisualNovelScreen } from "./renderers/VisualNovelScreen";
import { StartupScreen } from "./renderers/StartupScreen";
import { OnboardingOverlay } from "./renderers/OnboardingOverlay";
import { WelcomeOverlay } from "./renderers/WelcomeOverlay";
import { BgmAudio } from "./renderers/BgmAudio";
import { DesktopWindows } from "./renderers/DesktopWindows";

function PlayerApp() {
  const state = useRuntimeStore();
  const [bundle, setBundle] = useState<ContentBundle>();
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string>();
  const [showStartup, setShowStartup] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [muted, setMuted] = useState(false);
  const requestedDesktopId = state.selectedDesktopId ?? bundle?.welcome.choices[0].id;
  const desktopId = bundle?.welcome.choices.some((choice) => choice.id === requestedDesktopId) ? requestedDesktopId : bundle?.welcome.choices[0].id;
  const projects = useMemo(() => bundle ? mergeProjectPages(baseProjects, bundle, desktopId) : undefined, [bundle, desktopId]);
  const selectedDesktop = bundle ? (desktopId ? bundle.desktops[desktopId] : undefined) ?? bundle.desktop : undefined;
  useEffect(() => { if (projects && selectedDesktop) setRuntimeProjects(projects, selectedDesktop, desktopId); }, [projects, selectedDesktop, desktopId]);
  const startStartup = useCallback(() => { setShowOnboarding(false); setShowWelcome(false); setShowStartup(true); }, []);
  const finishStartup = useCallback(() => { setShowStartup(false); setShowOnboarding(true); }, []);
  const finishOnboarding = useCallback(() => { setShowOnboarding(false); setShowWelcome(true); }, []);
  const finishWelcome = useCallback((desktopId: string) => {
    useRuntimeStore.getState().selectDesktop(desktopId);
    setShowWelcome(false);
    window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".desktop-screen button")?.focus());
  }, []);
  useEffect(() => {
    void loadContentBundle().then(({ bundle: next, preview: source }) => {
      setBundle(next);
      setPreview(source);
      const requestedDesktop = new URLSearchParams(window.location.search).get("desktop");
      if (source && requestedDesktop && next.welcome.choices.some((choice) => choice.id === requestedDesktop)) {
        useRuntimeStore.getState().selectDesktop(requestedDesktop);
      }
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Content load failed"));
  }, []);
  const active = projects?.find((project) => project.id === state.activeProjectId);
  if (error) return <main className="bundle-error">内容加载失败：{error}</main>;
  if (!bundle || !projects || !selectedDesktop) return <main className="bundle-error">正在加载内容…</main>;
  const activeFolderTitle = selectedDesktop.icons.find((icon) => icon.id === state.activeFolderIconId)?.label;
  const desktopBundle = { ...bundle, desktop: selectedDesktop };
  const guidanceActive = state.stage === "desktop" && !showStartup && !showOnboarding && !showWelcome && !(state.desktopWindows ?? []).some((window) => !window.minimized);
  const exploring = !showStartup && !["intro", "video", "complete"].includes(state.stage);
  const bgm = state.stage === "complete"
    ? assetUrl(bundle, bundle.ending.bgmAssetId, preview)
    : exploring ? assetUrl(bundle, showOnboarding || showWelcome ? bundle.desktop.bgmAssetId : selectedDesktop.bgmAssetId, preview) : undefined;
  const next = getNextProject(projects, state.completedProjectIds);
  const desktop = (children?: ReactNode, audioActive = true) => <DesktopScreen
    projects={projects}
    unlocked={state.unlockedProjectIds}
    completed={state.completedProjectIds}
    inventory={state.inventoryItemIds}
    progress={getProgress(projects, desktopId ? state.desktopReadProjectIds?.[desktopId] ?? [] : state.completedProjectIds)}
    readProjectIds={desktopId ? state.desktopReadProjectIds?.[desktopId] ?? [] : []}
    guidanceActive={guidanceActive}
    onOpen={state.openProject}
    activeFolderIconId={undefined}
    currentIconId={state.desktopWindows?.find((entry) => entry.id === state.focusedWindowId && !entry.minimized && entry.kind !== "progress")?.iconId ?? (active ? selectedDesktop.icons.find((icon) => icon.projectId === active.id)?.id : undefined)}
    onOpenFolder={state.openFolder}
    onCloseFolder={state.closeFolder}
    onOpenProjectFromFolder={state.openProjectFromFolder}
    onTarot={() => next && state.startTarot(next.id)}
    onReset={state.resetProgress}
    onProgress={() => state.desktopWindowAction({ type: "open-progress" })}
    content={desktopBundle}
    preview={preview}
    audioActive={audioActive}
    muted={muted}
    onMutedChange={setMuted}
  >{children}</DesktopScreen>;
  let screen: ReactNode;
  if (showStartup) {
    screen = <>{desktop(undefined, false)}<StartupScreen onRevealDesktop={state.finishVisualNovel} onComplete={finishStartup} /></>;
  } else if (state.stage === "intro") screen = <VisualNovelScreen bundle={bundle} preview={preview} onComplete={startStartup} muted={muted} onMutedChange={setMuted} />;
  else if (state.stage === "tarot" && active) screen = desktop(<TarotScreen project={active} muted={muted} drawSound={assetUrl(bundle, selectedDesktop.tarotSoundAssetId ?? selectedDesktop.clickSoundAssetId, preview)} onComplete={() => state.completeTarot(active.id)} embedded />);
  else if (state.stage === "project" && active) {
    const projectScreen = <ProjectScreen project={active} activePageId={state.activePageId} onGotoPage={state.gotoPage} onNextPage={state.nextPage} onPrevPage={state.prevPage} onComplete={() => state.completeProject(active.id)} onClose={state.closeProject} folderTitle={activeFolderTitle} fileTitle={state.activeFolderFileLabel} resolveAsset={(id) => assetUrl(bundle, id, preview)} embedded />;
    screen = active.presentation === "report" ? <>{desktop()}{projectScreen}</> : desktop(projectScreen);
  }
  else if (state.stage === "complete") screen = desktop(<section className="complete-window" role="dialog" aria-labelledby="complete-title">
    <section><span className="eyebrow">MVP COMPLETE</span><h1 id="complete-title">核心项目体验已完成</h1>
      <div className="complete-actions">
        <button type="button" className="text-button" aria-label={muted ? "开启声音" : "关闭声音"} onClick={() => setMuted(!muted)}>{muted ? "声音：关" : "声音：开"}</button>
        <button className="primary-button" onClick={state.resetProgress}>重新开始</button>
      </div>
    </section>
  </section>);
  else {
    screen = showOnboarding || showWelcome
      ? <>
        <div className="desktop-intro-background" aria-hidden="true" {...{ inert: "" }}>{desktop(undefined, false)}</div>
        {showOnboarding
          ? <OnboardingOverlay content={bundle.onboarding} resolveAsset={(id) => assetUrl(bundle, id, preview)} onComplete={finishOnboarding} muted={muted} onMutedChange={setMuted} />
          : <WelcomeOverlay content={bundle.welcome} resolveAsset={(id) => assetUrl(bundle, id, preview)} onComplete={finishWelcome} muted={muted} />}
      </>
      : desktop();
  }
  return <>
    {bgm && <BgmAudio key={bgm} src={bgm} muted={muted} volume={bundle.intro.settings.bgmVolume ?? 0.24} testId={state.stage === "complete" ? "ending-bgm" : "desktop-bgm"} />}
    {screen}
    {state.stage === "desktop" && !showStartup && !showOnboarding && !showWelcome && <DesktopWindows muted={muted} desktop={selectedDesktop} projects={projects} resolveAsset={(id) => assetUrl(bundle, id, preview)} />}
  </>;
}

export default function App() { return new URLSearchParams(window.location.search).get("editor") === "1" ? <EditorApp /> : <PlayerApp />; }
