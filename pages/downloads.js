import * as FileSystem from 'expo-file-system';

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

      let nextLineIndex = i + 1;
      while (nextLineIndex < lines.length && (lines[nextLineIndex].trim().startsWith('#') || !lines[nextLineIndex].trim())) {
        nextLineIndex++;
      }

      if (nextLineIndex < lines.length && bandwidth > maxBandwidth) {
        maxBandwidth = bandwidth;
        bestVariantUrl = lines[nextLineIndex].trim();
      }
    }
  }

  if (!bestVariantUrl) {
    throw new Error('No valid variant streams found in master manifest');
  }

  const resolvedMediaUrl = resolveUrl(bestVariantUrl, m3u8Url);
  const mediaRes = await fetch(resolvedMediaUrl, { headers });
  const mediaContent = await mediaRes.text();

  return { mediaUrl: resolvedMediaUrl, rawContent: mediaContent };
}

/**
 * Downloads HLS stream, subtitles, and chapter metadata using API response payload
 */
export async function downloadEpisodeBundle({
  apiData,        // The exact data object from your API
  targetFolder,   // e.g., "slime_s4_ep24"
  onProgress,     // (pct: number) => void
  signal,         // AbortSignal
}) {
  const targetDir = `${FileSystem.documentDirectory}kameko_vault/${targetFolder}/`;

  // 1. Initialize episode vault directory
  const dirInfo = await FileSystem.getInfoAsync(targetDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
  }

  const requestHeaders = {
    'Referer': apiData.referer,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  };

  // 2. Download Subtitles (.vtt files)
  const downloadedSubtitles = [];
  if (Array.isArray(apiData.subtitles)) {
    for (let i = 0; i < apiData.subtitles.length; i++) {
      const sub = apiData.subtitles[i];
      if (!sub.file) continue;

      const subFileName = `sub_${i}_${(sub.label || 'default').toLowerCase().replace(/\s+/g, '_')}.vtt`;
      const subLocalUri = targetDir + subFileName;

      await FileSystem.downloadAsync(sub.file, subLocalUri, { headers: requestHeaders });
      downloadedSubtitles.push({
        label: sub.label || 'English',
        localUri: subLocalUri,
        default: sub.default || false,
      });
    }
  }

  // 3. Save Offline Metadata (Intro/Outro timings & subtitle paths)
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

    // Handle AES-128 Key Chunks
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

    // Handle .ts Segments
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
    if (signal?.aborted) throw new Error('Canceled');
    await FileSystem.downloadAsync(key.url, key.localUri, { headers: requestHeaders });
  }

  // 6. Download Segments via Concurrency Pool (5 at a time)
  const total = segmentsToDownload.length;
  const CONCURRENCY = 5;
  let completed = 0;

  for (let i = 0; i < total; i += CONCURRENCY) {
    if (signal?.aborted) throw new Error('Canceled');

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

  // 7. Write final rewritten local playlist
  const localM3u8Uri = `${targetDir}local.m3u8`;
  await FileSystem.writeAsStringAsync(localM3u8Uri, rewrittenLines.join('\n'));

  return {
    success: true,
    localM3u8Uri,
    localMetaUri: `${targetDir}meta.json`,
    targetDir,
  };
}
