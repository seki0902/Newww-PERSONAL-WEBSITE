import type { Block } from "../schema/content";
import { ComparisonBlock } from "./ComparisonBlock";
import { InteractiveDemoBlock } from "./InteractiveDemoBlock";
import { ImageBlock } from "./ImageBlock";
import { MetricsBlock } from "./MetricsBlock";
import { TextBlock } from "./TextBlock";
import { VideoBlock } from "./VideoBlock";

export function BlockRenderer({ block, projectId, resolveAsset }: { block: Block; projectId: string; resolveAsset?: (assetId: string) => string | undefined }) {
  switch (block.type) {
    case "text": return <TextBlock block={block} />;
    case "image": return <ImageBlock block={block} />;
    case "video": return <VideoBlock block={block} />;
    case "metrics": return <MetricsBlock block={block} />;
    case "comparison": return <ComparisonBlock block={block} />;
    case "interactive_demo": return <InteractiveDemoBlock block={block} projectId={projectId} resolveAsset={resolveAsset} />;
  }
}
