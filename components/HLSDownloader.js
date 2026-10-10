import * as FileSystem from 'expo-file-system';

/**
 * Resolves relative HLS URLs against the playlist base URL
 */
function resolveUrl(relativeOrAbsoluteUrl, baseUrl) {
  if (relativeOrAbsoluteUrl.startsWith('http://') || relativeOrAbsoluteUrl.startsWith('https://')) {
    return relativeOrAbsoluteUrl;
  }
  if (relativeOrAbsoluteUrl.startsWith('/')) {
    const urlObj = new URL(baseUrl);
    return `${urlObj.origin}${relativeOrAbsoluteUrl}`;
  }
  const baseParts = baseUrl.split('?')[0].split('/');
  baseParts.pop();
  return `${baseParts.join('/')}/${relativeOrAbsoluteUrl}`;
}

/**
 * Parses master playlist to find highest resolution/bandwidth media playlist
 */
async function extractMediaPlaylistUrl(m3u8Url, headers = {}) {
  const res = await fetch(m3u8Url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch manifest`);

  const content = await res.text();

  if (!content.includes('#EXT-X-STREAM-INF')) {
    return { mediaUrl: m3u8Url, rawContent: content };
  }

  const lines = content.split('\n');
  let bestVariantUrl = null;
  let maxBandwidth = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;

      let nextIndex = i + 1;
      while (nextIndex < lines.length && (lines[nextIndex].trim().startsWith('#') || !lines[nextIndex].trim())) {
        nextIndex++;
      }

      if (nextIndex < lines.length && bandwidth > maxBandwidth) {
        maxBandwidth = bandwidth;
        bestVariantUrl = lines[nextIndex].trim();
      }
    }
  }

  if (!bestVariantUrl) {
    throw new Error('No valid variant stream found in master playlist');
  }

  const resolvedMediaUrl = resolveUrl(bestVariantUrl, m3u8Url);
  const mediaRes = await fetch(resolvedMediaUrl, { headers });
  const mediaContent = await mediaRes.text();

  return { mediaUrl: resolvedMediaUrl, rawContent: mediaContent };
}

/**
 * Downloads HLS stream, AES keys, subtitles, and chapter metadata
 */
export async function downloadEpisodeBundle({
  apiData,
  targetFolder,
  onProgress,
  abortController,
}) {
  const targetDir = `${FileSystem.documentDirectory}kameko_vault/${targetFolder}/`;

  // 1. Prepare directory
  const dirInfo = await FileSystem.getInfoAsync(targetDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  }

  const requestHeaders = {
    'Referer': apiData.referer || '',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  };

  // 2. Download Subtitles (.vtt files)
  const downloadedSubtitles = [];
  if (Array.isArray(apiData.subtitles)) {
    for (let i = 0; i < apiData.subtitles.length; i++) {
      if (abortController?.signal?.aborted) throw new Error('Canceled');

      const sub = apiData.subtitles[i];
      if (!sub.file) continue;

      const cleanLabel = (sub.label || `track_${i}`).toLowerCase().replace(/[^a-z0-9]/g, '_');
      const subFileName = `sub_${cleanLabel}.vtt`;
      const subLocalUri = targetDir + subFileName;

      try {
        await FileSystem.downloadAsync(sub.file, subLocalUri, { headers: requestHeaders });
        downloadedSubtitles.push({
          label: sub.label || 'English',
          localUri: subLocalUri,
          default: sub.default || false,
        });
      } catch (err) {
        // Skip individual failing subtitle track without aborting video download
      }
    }
  }

  // 3. Save Offline Metadata (timings + subtitles)
  const metaPayload = {
    intro: apiData.intro || { start: 0, end: 0 },
    outro: apiData.outro || { start: 0, end: 0 },
    subtitles: downloadedSubtitles,
  };
  await FileSystem.writeAsStringAsync(`${targetDir}meta.json`, JSON.stringify(metaPayload));

  // 4. Resolve Master Playlist & Parse Chunks
  const { mediaUrl, rawContent } = await extractMediaPlaylistUrl(apiData.m3u8, requestHeaders);
  const lines = rawContent.split('\n');

  const segmentsToDownload = [];
  const keysToDownload = [];
  const rewrittenLines = [];

  let keyIndex = 0;
  let segIndex = 0;

  for (let line of lines) {
    const trimmed = line.trim();

    // Intercept AES-128 Encryption Keys
    if (trimmed.startsWith('#EXT-X-KEY')) {
      const uriMatch = trimmed.match(/URI="([^"]+)"/);
      if (uriMatch) {
        const rawKeyUri = uriMatch[1];
        const fullKeyUrl = resolveUrl(rawKeyUri, mediaUrl);
        const localKeyName = `enc_${keyIndex}.key`;

        keysToDownload.push({
          url: fullKeyUrl,
          localUri: targetDir + localKeyName,
        });

        rewrittenLines.push(trimmed.replace(rawKeyUri, localKeyName));
        keyIndex++;
        continue;
      }
    }

    // Intercept .ts Segments
    if (trimmed.length > 0 && !trimmed.startsWith('#')) {
      const fullSegUrl = resolveUrl(trimmed, mediaUrl);
      const localSegName = `chunk_${segIndex}.ts`;

      segmentsToDownload.push({
        url: fullSegUrl,
        localUri: targetDir + localSegName,
      });

      rewrittenLines.push(localSegName);
      segIndex++;
    } else {
      rewrittenLines.push(trimmed);
    }
  }

  if (segmentsToDownload.length === 0) {
    throw new Error('No media chunks found inside the resolved playlist');
  }

  // 5. Download Decryption Keys
  for (const key of keysToDownload) {
    if (abortController?.signal?.aborted) throw new Error('Canceled');
    await FileSystem.downloadAsync(key.url, key.localUri, { headers: requestHeaders });
  }

  // 6. Download Segments via Concurrency Pool (5 simultaneous requests)
  const total = segmentsToDownload.length;
  const CONCURRENCY = 5;
  let completed = 0;

  for (let i = 0; i < total; i += CONCURRENCY) {
    if (abortController?.signal?.aborted) throw new Error('Canceled');

    const batch = segmentsToDownload.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (seg) => {
        await FileSystem.downloadAsync(seg.url, seg.localUri, { headers: requestHeaders });
        completed++;
        if (onProgress) {
          onProgress(Math.round((completed / total) * 100));
        }
      })
    );
  }

  // 7. Write Local Playlist
  const localM3u8Uri = `${targetDir}local.m3u8`;
  await FileSystem.writeAsStringAsync(localM3u8Uri, rewrittenLines.join('\n'));

  return {
    success: true,
    localM3u8Uri,
    localMetaUri: `${targetDir}meta.json`,
    targetDir,
  };
}

/**
 * Completely purges an episode folder and all its contents
 */
export async function deleteEpisodeFolder(targetFolder) {
  const targetDir = `${FileSystem.documentDirectory}kameko_vault/${targetFolder}/`;
  const info = await FileSystem.getInfoAsync(targetDir);
  if (info.exists) {
    await FileSystem.deleteAsync(targetDir, { idempotent: true });
  }
}
