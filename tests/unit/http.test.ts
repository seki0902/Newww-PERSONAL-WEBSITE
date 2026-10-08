import { describe, expect, it } from "vitest";
import { mimeTypeForPath, parseRange, safeResolve } from "../../server/lib/http.mjs";

describe("parseRange", () => {
  it("解析闭区间、开区间与后缀区间", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=100-", 1000)).toEqual({ start: 100, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
  });

  it("拒绝越界或非法请求", () => {
    expect(parseRange(undefined, 100)).toBeNull();
    expect(parseRange("bytes=abc", 100)).toBeNull();
    expect(parseRange("bytes=200-300", 100)).toBeNull();
    expect(parseRange("bytes=-", 100)).toBeNull();
  });

  it("把 end 裁剪到文件末尾", () => {
    expect(parseRange("bytes=50-9999", 100)).toEqual({ start: 50, end: 99 });
  });
});

describe("safeResolve", () => {
  it("允许目录内路径", () => {
    expect(safeResolve("/srv/app/dist", "/assets/index.js")).toBe("/srv/app/dist/assets/index.js");
    expect(safeResolve("/srv/app/dist", "assets/../index.html")).toBe("/srv/app/dist/index.html");
  });

  it("拒绝逃逸出目录的路径", () => {
    expect(() => safeResolve("/srv/app/dist", "../secrets.env")).toThrow(/escapes/);
    expect(() => safeResolve("/srv/app/dist", "../../etc/passwd")).toThrow(/escapes/);
  });
});

describe("mimeTypeForPath", () => {
  it("覆盖站点用到的主要类型", () => {
    expect(mimeTypeForPath("a.png")).toBe("image/png");
    expect(mimeTypeForPath("a.WOFF2")).toBe("font/woff2");
    expect(mimeTypeForPath("a.ogg")).toBe("audio/ogg");
    expect(mimeTypeForPath("a.unknown")).toBe("application/octet-stream");
  });
});
