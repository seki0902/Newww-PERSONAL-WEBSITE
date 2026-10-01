import { useCallback, useEffect, useState } from "react";
import { intro } from "./content";
import { assetUrl, loadContentBundle } from "./content-bundle/loader";
import type { ContentBundle } from "./content-bundle/schema";
import { EditorApp } from "./editor/EditorApp";
import { getNextProject, getProgress } from "./runtime/flow";
import { setRuntimeProjects, useRuntimeStore } from "./runtime/store";
import type { Project } from "./schema/content";
import { DesktopScreen } from "./renderers/DesktopScreen";
import { ProjectScreen } from "./renderers/ProjectScreen";
import { TarotScreen } from "./renderers/TarotScreen";
import { VideoScreen } from "./renderers/VideoScreen";
import { VisualNovelScreen } from "./renderers/VisualNovelScreen";
import { StartupScreen } from "./renderers/StartupScreen";
import { OnboardingOverlay } from "./renderers/OnboardingOverlay";

function PlayerApp() {
  const state = useRuntimeStore();
  const [bundle, setBundle] = useState<ContentBundle>();
  const [projects, setProjects] = useState<Project[]>();
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string>();
  const [showStartup, setShowStartup] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const startStartup = useCallback(() => { setShowOnboarding(false); setShowStartup(true); }, []);
  const finishStartup = useCallback(() => { setShowStartup(false); setShowOnboarding(true); }, []);
  const finishOnboarding = useCallback(() => setShowOnboarding(false), []);
  useEffect(() => { void loadContentBundle().then(({ bundle: next, projects: nextProjects, preview: source }) => { setRuntimeProjects(nextProjects); setProjects(nextProjects); setBundle(next); setPreview(source); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Content load failed")); }, []);
  const active = projects?.find((project) => project.id === state.activeProjectId);
  if (error) return <main className="bundle-error">内容加载失败：{error}</main>;
  if (!bundle || !projects) return <main className="bundle-error">正在加载内容…</main>;
  const endingBgm = assetUrl(bundle, bundle.ending.bgmAssetId, preview);
  if (showStartup) {
    const next = getNextProject(projects, state.completedProjectIds);
    return <><DesktopScreen projects={projects} unlocked={state.unlockedProjectIds} completed={state.completedProjectIds} inventory={state.inventoryItemIds} progress={getProgress(projects, state.completedProjectIds)} onOpen={state.openProject} onTarot={() => next && state.startTarot(next.id)} onReset={state.resetProgress} content={bundle} preview={preview} audioActive={false} /><StartupScreen onRevealDesktop={state.finishVisualNovel} onComplete={finishStartup} /></>;
  }
  if (state.stage === "intro") return <VisualNovelScreen bundle={bundle} preview={preview} onComplete={startStartup} />;
  if (state.stage === "video") return <VideoScreen intro={intro} onFinish={state.finishVideo} />;
  if (state.stage === "tarot" && active) return <TarotScreen project={active} onComplete={() => state.completeTarot(active.id)} />;
  if (state.stage === "project" && active) return <ProjectScreen project={active} activePageId={state.activePageId} onGotoPage={state.gotoPage} onNextPage={state.nextPage} onPrevPage={state.prevPage} onComplete={() => state.completeProject(active.id)} resolveAsset={(id) => assetUrl(bundle, id, preview)} />;
  if (state.stage === "complete") return <main className="screen complete-screen">{endingBgm && <audio data-testid="ending-bgm" src={endingBgm} loop autoPlay preload="metadata" />}<section><span className="eyebrow">MVP COMPLETE</span><h1>核心项目体验已完成</h1><button className="primary-button" onClick={state.resetProgress}>重新开始</button></section></main>;
  const next = getNextProject(projects, state.completedProjectIds);
  return <><DesktopScreen projects={projects} unlocked={state.unlockedProjectIds} completed={state.completedProjectIds} inventory={state.inventoryItemIds} progress={getProgress(projects, state.completedProjectIds)} onOpen={state.openProject} onTarot={() => next && state.startTarot(next.id)} onReset={state.resetProgress} content={bundle} preview={preview} audioActive={!showOnboarding} />{showOnboarding && <OnboardingOverlay content={bundle.onboarding} resolveAsset={(id) => assetUrl(bundle, id, preview)} onComplete={finishOnboarding} />}</>;
}

export default function App() { return new URLSearchParams(window.location.search).get("editor") === "1" ? <EditorApp /> : <PlayerApp />; }
