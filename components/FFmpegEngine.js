import * as FileSystem from 'expo-file-system';
import { FFmpegKit, FFmpegKitConfig, ReturnCode } from 'ffmpeg-kit-react-native';

// Secure internal app directory (invisible to standard file managers)
const VAULT_DIR = FileSystem.documentDirectory + 'kameko_vault/';

class FFmpegEngine {
  constructor() {
    this.activeSessions = new Map();
    this.ensureVaultExists();
  }

  // 1. Storage Management
  async ensureVaultExists() {
    try {
      const dirInfo = await FileSystem.getInfoAsync(VAULT_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Vault Initialization Failed:', error);
    }
  }

  getFilePath(fileName) {
    // Strips invalid characters to prevent file system crashes
    const safeName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return VAULT_DIR + safeName;
  }

  // 2. High-Speed HLS to MP4 Engine
  async downloadHLS({ m3u8Url, fileName, assumedDurationMs = 1440000, onProgress }) {
    await this.ensureVaultExists();
    const outputPath = this.getFilePath(fileName);

    // Delete existing incomplete file if it exists
    const fileInfo = await FileSystem.getInfoAsync(outputPath);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(outputPath, { idempotent: true });
    }

    /* 
      SUPER-FAST M3U8 DOWNLOAD COMMAND:
      -y: Overwrite automatically.
      -protocol_whitelist: Required for remote HTTPS streaming and crypto/TLS for encrypted HLS.
      -reconnect*: Aggressive retry logic to prevent failure on minor network drops.
      -threads 0: Automatically utilize all available CPU threads for network fetching.
      -c copy: CRITICAL. Copies the video/audio streams directly without re-encoding (instant packaging).
      -bsf:a aac_adtstoasc: Bitstream filter required to pack AAC audio from HLS into an MP4 container safely.
    */
    const command = `-y -protocol_whitelist file,http,https,tcp,tls,crypto -reconnect 1 -reconnect_at_eof 1 -reconnect_streamed 1 -reconnect_delay_max 5 -threads 0 -i "${m3u8Url}" -c copy -bsf:a aac_adtstoasc "${outputPath}"`;

    return new Promise((resolve, reject) => {
      // 3. Precise Progress Tracking
      FFmpegKitConfig.enableStatisticsCallback(statistics => {
        const timeInMs = statistics.getTime();
        if (timeInMs > 0 && onProgress) {
          // Cap at 99% until fully completed
          const percentage = Math.min(Math.round((timeInMs / assumedDurationMs) * 100), 99);
          onProgress(percentage);
        }
      });

      // 4. Execution
      FFmpegKit.executeAsync(command, async (session) => {
        const returnCode = await session.getReturnCode();
        const sessionId = session.getSessionId();
        
        // Clean up tracking map
        this.activeSessions.delete(sessionId);

        if (ReturnCode.isSuccess(returnCode)) {
          if (onProgress) onProgress(100);
          resolve({ success: true, localUri: outputPath });
        } else if (ReturnCode.isCancel(returnCode)) {
          // Cleanup partial file on cancel
          await FileSystem.deleteAsync(outputPath, { idempotent: true });
          resolve({ success: false, status: 'canceled' });
        } else {
          // Retrieve detailed logs if failed
          const failLogs = await session.getLogsAsString();
          console.error('FFMPEG ERROR:', failLogs);
          await FileSystem.deleteAsync(outputPath, { idempotent: true });
          reject(new Error('Compilation failed. Check network or stream DRM.'));
        }
      }).then(session => {
        // Store session so it can be canceled later
        this.activeSessions.set(outputPath, session.getSessionId());
      });
    });
  }

  // 5. Active Cancellation Handling
  async cancelDownload(fileName) {
    const outputPath = this.getFilePath(fileName);
    const sessionId = this.activeSessions.get(outputPath);
    
    if (sessionId) {
      await FFmpegKit.cancel(sessionId);
      this.activeSessions.delete(outputPath);
      return true;
    }
    return false;
  }

  async cancelAll() {
    await FFmpegKit.cancel();
    this.activeSessions.clear();
  }

  // 6. Delete File safely
  async deleteFile(fileName) {
    const outputPath = this.getFilePath(fileName);
    try {
      await FileSystem.deleteAsync(outputPath, { idempotent: true });
      return true;
    } catch (e) {
      return false;
    }
  }
}

// Export as a singleton so sessions are maintained globally across the app
export default new FFmpegEngine();
