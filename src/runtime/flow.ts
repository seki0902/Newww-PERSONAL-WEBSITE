import type { Project } from "../schema/content";

export const addUnique = (items: string[], item: string) => items.includes(item) ? items : [...items, item];

export function getEnabledProjects(projects: Project[]) { return projects.filter((project) => project.enabled).sort((a, b) => a.order - b.order); }
export function getNextProject(projects: Project[], completedProjectIds: string[]) { return getEnabledProjects(projects).find((project) => !completedProjectIds.includes(project.id)); }
export function getProgress(projects: Project[], completedProjectIds: string[]) {
  const enabled = getEnabledProjects(projects);
  return enabled.length ? Math.round((enabled.filter((project) => completedProjectIds.includes(project.id)).length / enabled.length) * 100) : 0;
}

export function getEnabledProjectPages(project: Project) {
  const pageIds = new Set(project.pageIds ?? []);
  return (project.pages ?? []).filter((page) => page.enabled && pageIds.has(page.id)).sort((a, b) => a.order - b.order);
}

export function getProjectPageNavigation(project: Project, activePageId?: string) {
  const pages = getEnabledProjectPages(project);
  const currentIndex = pages.findIndex((page) => page.id === activePageId);
  return {
    pages,
    currentIndex,
    currentPage: currentIndex >= 0 ? pages[currentIndex] : undefined,
    canPrev: currentIndex > 0,
    canNext: currentIndex >= 0 && currentIndex < pages.length - 1,
  };
}
