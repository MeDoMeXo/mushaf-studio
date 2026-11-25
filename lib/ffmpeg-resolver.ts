import { existsSync } from 'fs';
import path from 'path';

// Auto-detect FFmpeg/ffprobe binaries across platforms (including Windows WinGet paths)
let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;

export function resolveFfmpegPath(): string {
  if (cachedFfmpegPath) return cachedFfmpegPath;
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return (cachedFfmpegPath = process.env.FFMPEG_PATH);
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const candidates = [
      path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-9.1-full_build', 'bin', 'ffmpeg.exe'),
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    ];
    for (const cand of candidates) {
      if (existsSync(cand)) return (cachedFfmpegPath = cand);
    }
  }
  return (cachedFfmpegPath = 'ffmpeg');
}

export function resolveFfprobePath(): string {
  if (cachedFfprobePath) return cachedFfprobePath;
  if (process.env.FFPROBE_PATH && existsSync(process.env.FFPROBE_PATH)) {
    return (cachedFfprobePath = process.env.FFPROBE_PATH);
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const candidates = [
      path.join(localAppData, 'Microsoft', 'WinGet', 'Packages', 'Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe', 'ffmpeg-9.1-full_build', 'bin', 'ffprobe.exe'),
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffprobe.exe'),
      'C:\\ffmpeg\\bin\\ffprobe.exe',
      'C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe',
    ];
    for (const cand of candidates) {
      if (existsSync(cand)) return (cachedFfprobePath = cand);
    }
  }
  return (cachedFfprobePath = 'ffprobe');
}
