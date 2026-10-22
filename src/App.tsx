import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { projects as baseProjects } from "./content";
import { assetUrl, loadContentBundle } from "./content-bundle/loader";
import { mergeProjectPages, type ContentBundle } from "./content-bundle/schema";
import { EditorApp } from "./editor/EditorApp";
import { getProgress } from "./runtime/flow";
import { setRuntimeProjects, useRuntimeStore } from "./runtime/store";
import { DesktopScreen } from "./renderers/DesktopScreen";
import { ProjectScreen } from "./renderers/ProjectScreen";
import { TarotScreen } from "./renderers/TarotScreen";
import { VisualNovelScreen } from "./renderers/VisualNovelScreen";
import { RouteConfirmation } from "./renderers/RouteConfirmation";
import { DesktopGuide } from "./renderers/DesktopGuide";
import type { Project } from "./schema/content";
import { BgmAudio } from "./renderers/BgmAudio";
import { DesktopWindows } from "./renderers/DesktopWindows";

function PlayerApp() {
  const state = useRuntimeStore();
  const [bundle, setBundle] = useState<ContentBundle>();
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string>();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [ritualProject, setRitualProject] = useState<Project>();
  const [muted, setMuted] = useState(false);
  const requestedDesktopId = state.selectedDesktopId ?? bundle?.welcome.choices[0].id;
  const desktopId = bundle?.welcome.choices.some((choice) => choice.id === requestedDesktopId) ? requestedDesktopId : bundle?.welcome.choices[0].id;
  const projects = useMemo(() => bundle ? mergeProjectPages(baseProjects, bundle, desktopId) : undefined, [bundle, desktopId]);
  const selectedDesktop = bundle ? (desktopId ? bundle.desktops[desktopId] : undefined) ?? bundle.desktop : undefined;
  useEffect(() => { if (projects && selectedDesktop) setRuntimeProjects(projects, selectedDesktop, desktopId); }, [projects, selectedDesktop, desktopId]);
  const enterComputer = useCallback(() => { useRuntimeStore.getState().finishVisualNovel(); setShowWelcome(true); }, []);
  const finishWelcome = useCallback((desktopId: string) => {
    useRuntimeStore.getState().selectDesktop(desktopId);
    setShowWelcome(false);
    setShowGuide(!useRuntimeStore.getState().desktopGuideCompleted);
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
  const guidanceActive = state.stage === "desktop" && !showGuide && !showWelcome && !ritualProject && !(state.desktopWindows ?? []).some((window) => !window.minimized);
  const exploring = !["intro", "video", "complete"].includes(state.stage);
  const bgm = state.stage === "complete"
    ? assetUrl(bundle, bundle.ending.bgmAssetId, preview)
    : exploring ? assetUrl(bundle, selectedDesktop.bgmAssetId, preview) : undefined;
  const finishGuide = () => {
    state.finishDesktopGuide();
    setShowGuide(false);
    if (!state.tarotIntroSeen && !state.completedTarotIds.length) setRitualProject(projects.find(project => project.enabled));
  };
  const closeRitual = () => { state.dismissTarotIntro(); setRitualProject(undefined); };
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
    onTarot={() => { const enabled = projects.filter(project => project.enabled); setRitualProject(enabled[Math.floor(Math.random() * enabled.length)]); }}
    onChooseRoute={() => setShowWelcome(true)}
    onShowGuide={() => setShowGuide(true)}
    routeLabel={bundle.welcome.choices.find(choice => choice.id === desktopId)?.label}
    pdfUrl={bundle.portfolioPdfUrl}
    onReset={state.resetProgress}
    onProgress={() => state.desktopWindowAction({ type: "open-progress" })}
    content={desktopBundle}
    preview={preview}
    audioActive={audioActive}
    muted={muted}
    onMutedChange={setMuted}
  >{children}</DesktopScreen>;
  let screen: ReactNode;
  if (state.stage === "intro") screen = <VisualNovelScreen bundle={bundle} preview={preview} onComplete={enterComputer} onSkip={enterComputer} muted={muted} onMutedChange={setMuted} />;
  else if (state.stage === "tarot" && active) screen = desktop(<TarotScreen project={active} muted={muted} drawSound={assetUrl(bundle, selectedDesktop.tarotSoundAssetId ?? selectedDesktop.clickSoundAssetId, preview)} onComplete={() => state.completeTarot(active.id)} embedded />);
  else if (state.stage === "project" && active) {
    const projectScreen = <ProjectScreen project={active} activePageId={state.activePageId} onGotoPage={state.gotoPage} onNextPage={state.nextPage} onPrevPage={state.prevPage} onComplete={() => state.completeProject(active.id)} onClose={state.closeProject} folderTitle={activeFolderTitle} fileTitle={state.activeFolderFileLabel} resolveAsset={(id) => assetUrl(bundle, id, preview)} embedded />;
    screen = active.presentation === "report" ? <>{desktop()}{projectScreen}</> : desktop(projectScreen);
  }
  else if (state.stage === "complete" && !showWelcome) screen = desktop(<section className="complete-window" role="dialog" aria-labelledby="complete-title">
    <section><span className="eyebrow">MVP COMPLETE</span><h1 id="complete-title">核心项目体验已完成</h1>
      <div className="complete-actions">
        <button type="button" className="text-button" aria-label={muted ? "开启声音" : "关闭声音"} onClick={() => setMuted(!muted)}>{muted ? "声音：关" : "声音：开"}</button>
        <button className="primary-button" onClick={state.resetProgress}>重新开始</button>
      </div>
    </section>
  </section>);
  else {
    screen = showWelcome
      ? <>
        <div className="desktop-intro-background" aria-hidden="true" {...{ inert: "" }}>{desktop(undefined, false)}</div>
        <RouteConfirmation choices={bundle.welcome.choices} currentId={desktopId} getProjects={id => mergeProjectPages(baseProjects, bundle, id)} onConfirm={finishWelcome} onCancel={state.selectedDesktopId ? () => setShowWelcome(false) : undefined} />
      </>
      : desktop();
  }
  return <>
    <div className="landscape-prompt" role="status"><span aria-hidden="true">▱ ↻</span><strong>请横屏查看作品集</strong><p>旋转手机后即可继续探索。</p></div>
    {bgm && <BgmAudio key={bgm} src={bgm} muted={muted} volume={bundle.intro.settings.bgmVolume ?? 0.24} testId={state.stage === "complete" ? "ending-bgm" : "desktop-bgm"} />}
    {screen}
    {state.stage === "desktop" && !showWelcome && <DesktopWindows muted={muted} desktop={selectedDesktop} projects={projects} resolveAsset={(id) => assetUrl(bundle, id, preview)} />}
    {state.stage === "desktop" && !showWelcome && showGuide && <DesktopGuide onComplete={finishGuide} muted={muted} onMutedChange={setMuted} openSound={assetUrl(bundle, bundle.onboarding.openSoundAssetId, preview)} purrSound={assetUrl(bundle, bundle.onboarding.purrSoundAssetId, preview)} />}
    {state.stage === "desktop" && !showWelcome && ritualProject && <div className="route-overlay" data-testid="optional-tarot"><button type="button" className="novel-skip" onClick={closeRitual}>跳过，先看项目 →</button><TarotScreen project={ritualProject} embedded muted={muted} drawSound={assetUrl(bundle, selectedDesktop.tarotSoundAssetId ?? selectedDesktop.clickSoundAssetId, preview)} onClose={closeRitual} onComplete={() => { state.completeTarot(ritualProject.id); closeRitual(); }} /></div>}
  </>;
}

export default function App() { return new URLSearchParams(window.location.search).get("editor") === "1" ? <EditorApp /> : <PlayerApp />; }
