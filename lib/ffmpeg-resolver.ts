import { existsSync } from 'fs';
import path from 'path';

/**
 * Auto-detect FFmpeg/ffprobe binaries across platforms (including Windows
 * WinGet / Scoop / Chocolatey paths and explicit PATH search).
 *
 * On Windows, `child_process.spawn('ffprobe')` fails with ENOENT even when
 * ffprobe.exe is on PATH because CreateProcess does not append the `.exe`
 * extension for bare names. We therefore walk PATH ourselves and return the
 * fully-qualified path to the executable. Only when every lookup fails do we
 * fall back to the bare name (letting the caller surface a clear error).
 */
let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;

/** Directories to search for the binary, derived from PATH + well-known spots. */
function buildSearchDirs(winExtras: string[]): string[] {
  const dirs: string[] = [];
  // 1. Well-known Windows install locations (passed in via winExtras).
  if (process.platform === 'win32') {
    dirs.push(...winExtras);
  }
  // 2. Every directory on PATH (cross-platform). On Windows the separator is
  //    `;`, on POSIX it is `:`.
  const pathEnv = process.env.PATH || process.env.Path || '';
  const sep = process.platform === 'win32' ? ';' : ':';
  for (const dir of pathEnv.split(sep)) {
    const trimmed = dir.trim();
    if (trimmed && !dirs.includes(trimmed)) dirs.push(trimmed);
  }
  // 3. Common POSIX locations (Homebrew, /usr/local, snap).
  if (process.platform !== 'win32') {
    dirs.push('/usr/local/bin', '/usr/bin', '/opt/homebrew/bin', '/snap/bin');
  }
  return dirs;
}

/** Resolve a binary by walking search dirs for the platform-correct filename. */
function resolveBinary(
  bareName: string,
  envVar: string,
  winExtras: string[]
): string {
  const ext = process.platform === 'win32' ? '.exe' : '';
  const fileName = `${bareName}${ext}`;

  // 1. Explicit env override always wins.
  const envVal = process.env[envVar];
  if (envVal && existsSync(envVal)) return envVal;

  // 2. Walk search dirs.
  for (const dir of buildSearchDirs(winExtras)) {
    const candidate = path.join(dir, fileName);
    if (existsSync(candidate)) return candidate;
  }

  // 3. Last resort: return the bare name. On Windows this will ENOENT unless
  //    the caller uses shell:true, but we keep it so callers can detect the
  //    failure and fall back (e.g. probe via ffmpeg).
  return bareName;
}

export function resolveFfmpegPath(): string {
  if (cachedFfmpegPath) return cachedFfmpegPath;
  const localAppData = process.env.LOCALAPPDATA || '';
  const winExtras = process.platform === 'win32'
    ? [
        path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-9.1-full_build', 'bin'),
        path.join(localAppData, 'Microsoft', 'WinGet', 'Links'),
        'C:\\ffmpeg\\bin',
        'C:\\Program Files\\ffmpeg\\bin',
        'C:\\ProgramData\\chocolatey\\bin',
        path.join(localAppData, 'scoop', 'apps', 'ffmpeg', 'current', 'bin'),
      ]
    : [];
  return (cachedFfmpegPath = resolveBinary('ffmpeg', 'FFMPEG_PATH', winExtras));
}

export function resolveFfprobePath(): string {
  if (cachedFfprobePath) return cachedFfprobePath;
  const localAppData = process.env.LOCALAPPDATA || '';
  const winExtras = process.platform === 'win32'
    ? [
        path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-9.1-full_build', 'bin'),
        path.join(localAppData, 'Microsoft', 'WinGet', 'Links'),
        'C:\\ffmpeg\\bin',
        'C:\\Program Files\\ffmpeg\\bin',
        'C:\\ProgramData\\chocolatey\\bin',
        path.join(localAppData, 'scoop', 'apps', 'ffmpeg', 'current', 'bin'),
      ]
    : [];
  return (cachedFfprobePath = resolveBinary('ffprobe', 'FFPROBE_PATH', winExtras));
}

/**
 * Whether the resolved ffprobe path points to a real file on disk. When false,
 * ffprobe is unavailable and callers should fall back to probing via ffmpeg.
 */
export function isFfprobeAvailable(): boolean {
  const p = resolveFfprobePath();
  return p !== 'ffprobe' && p !== 'ffprobe.exe' && existsSync(p);
}

/**
 * Whether the resolved ffmpeg path points to a real file on disk.
 */
export function isFfmpegAvailable(): boolean {
  const p = resolveFfmpegPath();
  return p !== 'ffmpeg' && p !== 'ffmpeg.exe' && existsSync(p);
}
