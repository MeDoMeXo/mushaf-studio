import { existsSync, readdirSync } from 'fs';
import path from 'path';

/**
 * Auto-detect FFmpeg/ffprobe binaries across platforms (Windows WinGet /
 * Scoop / Chocolatey, plus an explicit PATH walk).
 *
 * Why the PATH walk: on Windows `child_process.spawn('ffprobe')` fails with
 * ENOENT even when ffprobe.exe is on PATH (CreateProcess quirks with bare
 * names), so we resolve the fully-qualified path ourselves.
 *
 * Why the WinGet scan is version-agnostic: the WinGet package folder name
 * embeds the ffmpeg version (e.g. `ffmpeg-7.1.1-full_build`), which changes
 * with every release. Hardcoding one version misses every other install.
 * We therefore enumerate any `*ffmpeg*` package dir and search inside for
 * `bin/<exe>` (direct or one level down).
 *
 * Failures (bare-name fallback) are NOT cached — so FFmpeg installed while
 * the server is running is picked up on the very next export attempt
 * without requiring a process restart.
 */
let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;
let warnedMissing = false;

/** List immediate subdirectories of `base` matching `filter`. Never throws. */
function listSubDirs(base: string, filter: RegExp): string[] {
  try {
    if (!existsSync(base)) return [];
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && filter.test(d.name))
      .map((d) => path.join(base, d.name));
  } catch {
    return [];
  }
}

/** Search `root/bin/<exe>` and `root/<any-subdir>/bin/<exe>`. */
function findUnderRoot(root: string, fileName: string): string | null {
  const direct = path.join(root, 'bin', fileName);
  if (existsSync(direct)) return direct;
  for (const sub of listSubDirs(root, /./)) {
    const cand = path.join(sub, 'bin', fileName);
    if (existsSync(cand)) return cand;
  }
  return null;
}

/** Every directory on PATH (plus common POSIX fallback dirs). */
function buildPathDirs(): string[] {
  const dirs: string[] = [];
  const pathEnv = process.env.PATH || process.env.Path || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  for (const dir of pathEnv.split(sep)) {
    const trimmed = dir.trim().replace(/^"|"$/g, '');
    if (trimmed && !dirs.includes(trimmed)) dirs.push(trimmed);
  }
  if (process.platform !== 'win32') {
    dirs.push('/usr/local/bin', '/usr/bin', '/opt/homebrew/bin', '/snap/bin');
  }
  return dirs;
}

/** Windows roots scanned recursively-ish for any ffmpeg layout. */
function windowsScanRoots(): string[] {
  const localAppData = process.env.LOCALAPPDATA || '';
  const roots: string[] = [];
  if (localAppData) {
    // WinGet packages — any publisher containing "ffmpeg" (Gyan.FFmpeg, BtbN.FFmpeg, …)
    roots.push(...listSubDirs(path.join(localAppData, 'Microsoft', 'WinGet', 'Packages'), /ffmpeg/i));
    roots.push(path.join(localAppData, 'scoop', 'apps', 'ffmpeg', 'current'));
  }
  return roots;
}

/** Windows dirs checked directly as `dir/<exe>`. */
function windowsDirectDirs(): string[] {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  return [
    path.join(localAppData, 'Microsoft', 'WinGet', 'Links'),
    path.join(localAppData, 'scoop', 'apps', 'ffmpeg', 'current', 'bin'),
    'C:\\ffmpeg\\bin',
    path.join(programFiles, 'ffmpeg', 'bin'),
    path.join(programFiles, 'FFmpeg', 'bin'),
    'C:\\tools\\ffmpeg\\bin',
    'C:\\ProgramData\\chocolatey\\bin',
  ];
}

function resolveBinary(bareName: string, envVar: string): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const fileName = `${bareName}${ext}`;

  // 1. Explicit env override always wins.
  const envVal = process.env[envVar];
  if (envVal && existsSync(envVal)) return envVal;

  // 2. Bundled npm static binaries (preferred over potentially outdated OS packages).
  const bundledPath =
    bareName === 'ffmpeg'
      ? path.join(process.cwd(), 'node_modules', 'ffmpeg-static', fileName)
      : path.join(
          process.cwd(),
          'node_modules',
          'ffprobe-static',
          'bin',
          process.platform,
          process.arch,
          fileName
        );
  if (existsSync(bundledPath)) return bundledPath;

  if (process.platform === 'win32') {
    // 3. Version-agnostic WinGet / Scoop package scan.
    for (const root of windowsScanRoots()) {
      const hit = findUnderRoot(root, fileName);
      if (hit) return hit;
    }
    // 4. Well-known direct install locations.
    for (const dir of windowsDirectDirs()) {
      const cand = path.join(dir, fileName);
      if (existsSync(cand)) return cand;
    }
  }

  // 5. Walk every PATH entry (platform-correct separator + extension).
  for (const dir of buildPathDirs()) {
    const cand = path.join(dir, fileName);
    if (existsSync(cand)) return cand;
  }

  // 6. Last resort: bare name (callers detect failure and fall back).
  return bareName;
}

/** Cache only successful resolutions — failures re-scan next call. */
function cachedResolve(
  cacheKey: 'ffmpeg' | 'ffprobe',
  bareName: string,
  envVar: string
): string {
  const cached = cacheKey === 'ffmpeg' ? cachedFfmpegPath : cachedFfprobePath;
  if (cached) return cached;
  const resolved = resolveBinary(bareName, envVar);
  if (resolved !== bareName) {
    if (cacheKey === 'ffmpeg') cachedFfmpegPath = resolved;
    else cachedFfprobePath = resolved;
  }
  return resolved;
}

function warnMissing(kind: 'FFmpeg' | 'ffprobe'): void {
  if (warnedMissing) return;
  warnedMissing = true;
  console.warn(
    `[ffmpeg-resolver] ${kind} was not found on this machine — video export will fail. ` +
      'Install FFmpeg (winget install Gyan.FFmpeg on Windows, brew install ffmpeg on macOS, ' +
      'or apt install ffmpeg on Linux) — the resolver picks it up on the next export attempt ' +
      'without restarting — or set the FFMPEG_PATH / FFPROBE_PATH env vars to the binaries.'
  );
}

export function resolveFfmpegPath(): string {
  return cachedResolve('ffmpeg', 'ffmpeg', 'FFMPEG_PATH');
}

export function resolveFfprobePath(): string {
  return cachedResolve('ffprobe', 'ffprobe', 'FFPROBE_PATH');
}

/** Whether the resolved ffprobe path points to a real file on disk. */
export function isFfprobeAvailable(): boolean {
  const p = resolveFfprobePath();
  const ok = p !== 'ffprobe' && p !== 'ffprobe.exe' && existsSync(p);
  if (!ok) warnMissing('ffprobe');
  return ok;
}

/** Whether the resolved ffmpeg path points to a real file on disk. */
export function isFfmpegAvailable(): boolean {
  const p = resolveFfmpegPath();
  const ok = p !== 'ffmpeg' && p !== 'ffmpeg.exe' && existsSync(p);
  if (!ok) warnMissing('FFmpeg');
  return ok;
}
