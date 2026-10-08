#!/usr/bin/env node
/**
 * 媒体优化：把素材源目录转成"适合 CDN 分发"的格式。
 *   - 图片 PNG/JPEG → WebP（默认质量 82；转完更大则保留原文件）
 *   - 音频 WAV → OGG/Opus（默认 96kbps，可循环播放）
 *   - 其它（svg/字体/demo 文件）原样拷贝
 * 同时重写 content.json 里素材元数据（fileName/path/mimeType），并输出重命名映射与体积报告。
 *
 * 用法：
 *   node tools/optimize-media.mjs --source ../seki-media --out ../seki-media-opt
 *   # 需要 ffmpeg（可本机安装，或用容器）：
 *   node tools/optimize-media.mjs --source ... --out ... --ffmpeg-docker docker.m.daocloud.io/linuxserver/ffmpeg:latest --work-root /tmp/media-work
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const sourceDir = resolve(value("--source", "../seki-media"));
const outDir = resolve(value("--out", "../seki-media-opt"));
const workRoot = resolve(value("--work-root", "/tmp/media-work"));
const ffmpegDocker = value("--ffmpeg-docker", "");
const ffmpegBin = value("--ffmpeg", process.env.FFMPEG_PATH ?? "ffmpeg");
const imageQuality = Number(value("--image-quality", "82"));
const audioBitrate = value("--audio-bitrate", "96k");

let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("缺少 sharp：npm i -D sharp（CI 与本地都需要）");
  process.exit(1);
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg"]);
const AUDIO_EXT = new Set([".wav"]);
const listFiles = (dir) => {
  const out = [];
  const walk = (current) => {
    if (!existsSync(current)) return;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(full);
    }
  };
  walk(dir);
  return out;
};
const toContainerPath = (hostPath) => "/work" + hostPath.slice(workRoot.length);
const runFfmpeg = (input, output) => {
  const ffmpegArgs = ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-c:a", "libopus", "-b:a", audioBitrate, "-vbr", "on", "-application", "audio", output];
  if (!ffmpegDocker) {
    const result = spawnSync(ffmpegBin, ffmpegArgs, { stdio: "inherit" });
    if (result.status !== 0) throw new Error(`ffmpeg 失败: ${input}`);
    return;
  }
  const result = spawnSync("docker", ["run", "--rm", "-v", `${workRoot}:/work`, ffmpegDocker, ...ffmpegArgs.map((arg, index, all) => (index === all.indexOf("-i") + 1 || index === all.length - 1 ? toContainerPath(arg) : arg))], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg(docker) 失败: ${input}`);
};

const convertImage = async (input, output) => {
  await sharp(input).rotate().webp({ quality: imageQuality, effort: 5 }).toFile(output);
  return statSync(output).size < statSync(input).size;
};

if (!existsSync(join(sourceDir, "content.json"))) {
  console.error(`源目录缺少 content.json: ${sourceDir}`);
  process.exit(1);
}
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
mkdirSync(workRoot, { recursive: true });

const bundle = JSON.parse(readFileSync(join(sourceDir, "content.json"), "utf8"));
const report = { images: [], audio: [], kept: [], renames: {}, beforeBytes: 0, afterBytes: 0 };
const write = (relativePath, data) => {
  const target = join(outDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, data);
  return target;
};

// 1) bundle 素材
for (const asset of bundle.assets) {
  const input = join(sourceDir, asset.path);
  if (!existsSync(input)) { console.warn(`⚠️  缺少文件（跳过）: ${asset.path}`); continue; }
  report.beforeBytes += statSync(input).size;
  const ext = extname(asset.path).toLowerCase();
  if (IMAGE_EXT.has(ext)) {
    const newPath = asset.path.replace(/\.[^.]+$/, ".webp");
    const target = join(outDir, newPath);
    mkdirSync(dirname(target), { recursive: true });
    const smaller = await convertImage(input, target);
    const finalPath = smaller ? newPath : asset.path;
    if (!smaller) cpSync(input, write(asset.path, readFileSync(input)));
    asset.path = finalPath;
    asset.fileName = asset.fileName.replace(/\.[^.]+$/, smaller ? ".webp" : extname(asset.fileName));
    asset.originalName = asset.originalName.replace(/\.[^.]+$/, smaller ? ".webp" : extname(asset.originalName));
    asset.mimeType = smaller ? "image/webp" : asset.mimeType;
    report.images.push({ id: asset.id, from: extname(input), before: statSync(input).size, after: statSync(join(outDir, finalPath)).size });
  } else if (AUDIO_EXT.has(ext)) {
    const newPath = asset.path.replace(/\.[^.]+$/, ".ogg");
    const target = join(outDir, newPath);
    mkdirSync(dirname(target), { recursive: true });
    runFfmpeg(input, target);
    asset.path = newPath;
    asset.fileName = asset.fileName.replace(/\.[^.]+$/, ".ogg");
    asset.originalName = asset.originalName.replace(/\.[^.]+$/, ".ogg");
    asset.mimeType = "audio/ogg";
    report.audio.push({ id: asset.id, before: statSync(input).size, after: statSync(target).size });
  } else {
    cpSync(input, write(asset.path, readFileSync(input)));
    report.kept.push(asset.id);
  }
  report.afterBytes += statSync(join(outDir, asset.path)).size;
}

// 2) static/**（代码里固定引用的素材）
for (const file of listFiles(join(sourceDir, "static"))) {
  const rel = relative(join(sourceDir, "static"), file).split(sep).join("/");
  const ext = extname(rel).toLowerCase();
  report.beforeBytes += statSync(file).size;
  if (IMAGE_EXT.has(ext)) {
    const newRel = rel.replace(/\.[^.]+$/, ".webp");
    const target = join(outDir, "static", newRel);
    mkdirSync(dirname(target), { recursive: true });
    const smaller = await convertImage(file, target);
    if (smaller) {
      report.renames[`static/${rel}`] = `static/${newRel}`;
      report.images.push({ id: `static/${rel}`, before: statSync(file).size, after: statSync(target).size, renamed: true });
      report.afterBytes += statSync(target).size;
      continue;
    }
  }
  cpSync(file, write(join("static", rel), readFileSync(file)));
  report.afterBytes += statSync(file).size;
}

// 3) demos/**（原样拷贝）
for (const file of listFiles(join(sourceDir, "demos"))) {
  const rel = relative(join(sourceDir, "demos"), file).split(sep).join("/");
  cpSync(file, write(join("demos", rel), readFileSync(file)));
  report.beforeBytes += statSync(file).size;
  report.afterBytes += statSync(file).size;
}

writeFileSync(join(outDir, "content.json"), `${JSON.stringify(bundle, null, 2)}\n`);
writeFileSync(join(outDir, "optimize-report.json"), `${JSON.stringify(report, null, 2)}\n`);

const mb = (bytes) => (bytes / 1048576).toFixed(2);
console.log(`图片转换 ${report.images.length} 张，音频 ${report.audio.length} 个，原样拷贝 ${report.kept.length} 个`);
console.log(`体积：${mb(report.beforeBytes)} MB → ${mb(report.afterBytes)} MB（省 ${(100 - report.afterBytes / report.beforeBytes * 100).toFixed(1)}%）`);
console.log(`重命名的静态素材（需要同步改代码）：${Object.keys(report.renames).length} 个`);
