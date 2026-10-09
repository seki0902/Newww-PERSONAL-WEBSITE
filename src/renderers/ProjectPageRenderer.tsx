import type { Block, ProjectPage } from "../schema/content";
import { BlockRenderer } from "../blocks/BlockRenderer";

export function ProjectPageRenderer({ page, blocks, direction, projectId, resolveAsset }: { page: ProjectPage; blocks: Block[]; direction: "next" | "prev"; projectId: string; resolveAsset?: (assetId: string) => string | undefined }) {
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const kamiCase = /^(b1|b2|b3|b4|b5|c2|c3|c4|c5|c6|c7)-/.exec(page.id)?.[1]?.toUpperCase();
  const caseEyebrow = kamiCase ? `${kamiCase} · ${page.navLabel}` : `${projectId.replace(/^project-/, "A")} · ${page.navLabel}`;

  return (
    <section className={`project-page-content project-page-enter-${direction}`} aria-label={page.title} data-page-kind={page.kind} data-project-id={projectId} data-kami-case={kamiCase}>
      <header className="project-page-heading">
        <span className="project-page-number" aria-hidden="true">{String(page.order).padStart(2, "0")}</span>
        <div className="project-page-title-block">
          <span className="eyebrow">{caseEyebrow}</span>
          <h1>{page.title}</h1>
          {page.subtitle ? <p className="project-page-subtitle">{page.subtitle}</p> : null}
        </div>
      </header>
      <div className="project-content">
        {page.blockIds.map((blockId) => {
          const block = blocksById.get(blockId);
          const repeatedTitle = Boolean(kamiCase && block && "title" in block && block.title === page.title);
          return block ? <div key={block.id} className="project-content-block" data-block-type={block.type} data-block-id={block.id} data-repeated-title={repeatedTitle ? "true" : undefined}><BlockRenderer block={block} projectId={projectId} resolveAsset={resolveAsset} /></div> : null;
        })}
      </div>
    </section>
  );
}
