import { useState } from "react";
import type { IntroContent } from "../schema/content";

export function NarrativeScreen({ intro, onFinish }: { intro: IntroContent; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const isLast = index === intro.lines.length - 1;
  const advance = () => isLast ? onFinish() : setIndex((value) => value + 1);
  return <main className="screen narrative-screen"><div className="narrative-panel"><span className="eyebrow">档案系统 / INIT</span><p>{intro.lines[index]}</p><button autoFocus onClick={advance}>{isLast ? "进入转场" : "继续开场"}</button></div></main>;
}
