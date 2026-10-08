import { useEffect, useRef, useState } from "react";
import "./StartupScreen.css";

const points: [number, number][] = [[0, 0], [330, 13], [860, 31], [1400, 43], [1690, 44], [1930, 44], [2250, 64], [2680, 76], [2940, 77], [3170, 77], [3530, 94], [3900, 100]];

function progressAt(time: number) {
  for (let index = 1; index < points.length; index += 1) {
    if (time <= points[index][0]) {
      const [startTime, startValue] = points[index - 1];
      const [endTime, endValue] = points[index];
      const position = (time - startTime) / (endTime - startTime);
      const eased = position * position * (3 - 2 * position);
      return startValue + (endValue - startValue) * eased;
    }
  }
  return 100;
}

export function StartupScreen({ onRevealDesktop, onComplete }: { onRevealDesktop: () => void; onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const frame = useRef<number>();
  const revealed = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(now - startedAt, 4800);
      setProgress(progressAt(elapsed));
      if (elapsed >= 4350 && !revealed.current) {
        revealed.current = true;
        setLeaving(true);
        onRevealDesktop();
      }
      if (elapsed >= 4800 && !finished.current) {
        finished.current = true;
        onComplete();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current) cancelAnimationFrame(frame.current); };
  }, [onComplete, onRevealDesktop]);

  const switched = progress >= 64;
  const completed = progress >= 100;
  return <main className={`startup-screen${leaving ? " is-leaving" : ""}`} aria-label="SEKI OS 系统启动中">
    <div className="startup-sky" aria-hidden="true" />
    <div className="startup-artwork" aria-hidden="true">
    <div className="startup-scene" aria-hidden="true" />
    <div className="startup-cloud startup-cloud-left" aria-hidden="true" />
    <div className="startup-cloud startup-cloud-right" aria-hidden="true" />
    <svg className="startup-original-layer" viewBox="0 0 1672 941" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <image href="/assets/canva-original/MAHV_kZZuSY.png" x="0" y="0" width="239" height="295" />
      <image href="/assets/canva-original/MAHV_mLKkCQ.png" x="238" y="0" width="260" height="157" />
      <image href="/assets/canva-original/MAHV_mFriGQ.png" x="0" y="372" width="20" height="79" />
      <image href="/assets/canva-original/MAHV_lPoNak.png" x="0" y="509" width="140" height="256" />
      <image href="/assets/canva-original/MAHV_iDthYI.png" x="0" y="666" width="518" height="197" />
      <image href="/assets/canva-original/MAHV_pm1j1g.png" x="0" y="784" width="518" height="157" />
      <image href="/assets/canva-original/MAHV_saoD2c.png" x="1313" y="744" width="359" height="197" />
      <defs><clipPath id="startup-cat-body"><rect width="122" height="119" /></clipPath><clipPath id="startup-cat-tail"><rect x="118" width="62" height="119" /></clipPath></defs>
      <g transform="translate(756 215)">
        <g transform="translate(120 105)"><g className="startup-cat-tail"><g transform="translate(-120 -105)"><image href="/assets/canva-original/MAHV_pfICPo.png" width="180" height="119" clipPath="url(#startup-cat-tail)" /></g></g></g>
        <image href="/assets/canva-original/MAHV_pfICPo.png" width="180" height="119" clipPath="url(#startup-cat-body)" />
      </g>
    </svg>
    <div className="startup-darkening" aria-hidden="true" />
    <i className="startup-twinkle startup-twinkle-a" aria-hidden="true" /><i className="startup-twinkle startup-twinkle-b" aria-hidden="true" />
    </div>
    <section className="startup-ui" aria-live="polite">
      <h1>SEKI OS</h1>
      <div className={`startup-slogan${switched ? " is-switched" : ""}`}><span>Explore. Build. Grow.</span><span>探索 · 构建 · 成长</span></div>
      <div className="startup-progress" role="progressbar" aria-label="启动进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <div className="startup-progress-fill" style={{ width: `${progress}%` }} /><div className="startup-progress-star" style={{ left: `${progress}%` }} />
      </div>
      <p className="startup-status">{completed ? "启动完成" : "系统启动中……"}</p>
      <p className="startup-welcome">欢迎加入【好公司】<br />请准备开始你的入职探索</p>
    </section>
  </main>;
}
