import type { Block, ProjectPage } from "../schema/content";
import { BlockRenderer } from "../blocks/BlockRenderer";

export function ProjectPageRenderer({ page, blocks, direction, projectId, resolveAsset }: { page: ProjectPage; blocks: Block[]; direction: "next" | "prev"; projectId: string; resolveAsset?: (assetId: string) => string | undefined }) {
  const blocksById = new Map(blocks.map((block) => [block.id, block]));

  return (
    <section className={`project-page-content project-page-enter-${direction}`} aria-label={page.title} data-page-kind={page.kind}>
      <header className="project-page-heading">
        <span className="eyebrow">{page.navLabel}</span>
        <h1>{page.title}</h1>
      </header>
      <div className="project-content">
        {page.blockIds.map((blockId) => {
          const block = blocksById.get(blockId);
          return block ? <BlockRenderer key={block.id} block={block} projectId={projectId} resolveAsset={resolveAsset} /> : null;
        })}
      </div>
    </section>
  );
}
