import { useEffect, useState } from "react";

export function DesktopClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const pad = (value: number) => String(value).padStart(2, "0");
  return <time data-testid="desktop-clock" dateTime={now.toISOString()}>{now.getMonth() + 1}月{now.getDate()}日 {pad(now.getHours())}:{pad(now.getMinutes())}</time>;
}
