import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  Dimensions, ActivityIndicator, StatusBar, BackHandler,
  TouchableWithoutFeedback, ScrollView
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { FontAwesome5 } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

export default function Player({ route, navigation }) {
  const { 
    animeTitle = 'Unknown', 
    episodeNum = 1, 
    episodeTitle = '', 
    animeId = null,
    userUid = null,
    targetType = 'sub'
  } = route?.params || {};

  const videoRef = useRef(null);
  const uiOpacity = useRef(new Animated.Value(1)).current;
  
  const [status, setStatus] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSkipIndicator, setShowSkipIndicator] = useState(null); 
  const [showSettings, setShowSettings] = useState(false);

  // Network & Stream State
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  // Logs & Subtitles
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [parsedSubs, setParsedSubs] = useState([]);
  const [currentSubText, setCurrentSubText] = useState('');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const hideUITimeout = useRef(null);
  const lastTapRef = useRef(0);

  const addLog = (msg, type = "INFO") => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    setLogs(prev => [...prev, `[${timestamp}] [${type}] ${msg}`]);
  };

  // 1. Hardware Initialization
  useEffect(() => {
    StatusBar.setHidden(true);
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleClosePlayer);
    return () => {
      StatusBar.setHidden(false);
      backHandler.remove();
    };
  }, []);

  const handleClosePlayer = async () => {
    addLog("Closing player, returning to previous screen.");
    navigation.goBack();
    return true;
  };

  // 2. Network Resolution Engine
  useEffect(() => {
    let isMounted = true;

    const resolveStream = async () => {
      addLog(`Initializing Engine for Ep ${episodeNum}...`);
      
      let availableServersList = [];
      try {
        addLog("Fetching Available Servers...");
        const srvRes = await fetch(`${VERCEL_API_BASE}/api/servers?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}`);
        const srvJson = await srvRes.json();
        if (srvJson.success && srvJson.data) {
          availableServersList = srvJson.data;
        }
      } catch(e) {
        addLog("Server list fetch failed, falling back to defaults.", "WARN");
      }

      let typeServers = availableServersList.filter(s => s.type === targetType).map(s => s.serverName);
      if (typeServers.length === 0) {
        typeServers = ['hd-1', 'hd-2', 'vidstream-2'];
      }

      const fetchServerStream = async (srv, type) => {
        try {
          const url = `${VERCEL_API_BASE}/api/stream?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}&server=${srv}&type=${type}`;
          const res = await fetch(url);
          const json = await res.json();
          if (json.success && json.data?.m3u8) return json.data;
        } catch (err) {}
        return null;
      };

      let finalStreamData = null;
      for (const srv of typeServers) {
        addLog(`Connecting to ${srv.toUpperCase()} (${targetType.toUpperCase()})...`);
        finalStreamData = await fetchServerStream(srv, targetType);
        if (finalStreamData) {
          addLog(`Connected successfully to ${srv.toUpperCase()}`, "SUCCESS");
          break;
        }
      }

      if (!isMounted) return;

      if (!finalStreamData) {
        setFatalError(`All servers are currently unresponsive for Episode ${episodeNum} (${targetType.toUpperCase()}).`);
        setLoadingStream(false);
        return;
      }

      // We bypass the web proxy and prepare data for Native Header Injection
      addLog(`Stream Found: ${finalStreamData.m3u8}`);
      addLog(`Injecting Referer: ${finalStreamData.referer || 'https://vidwish.live/'}`);
      
      setStreamData(finalStreamData);
      setLoadingStream(false);
    };

    resolveStream();
    return () => { isMounted = false; };
  }, [animeId, episodeNum, targetType]);

  // 3. Custom VTT Subtitle Parser Engine
  useEffect(() => {
    if (!streamData || !streamData.subtitles || streamData.subtitles.length === 0) return;

    const loadSubtitles = async () => {
      try {
        const subUrl = streamData.subtitles[0].file;
        addLog(`Fetching VTT Subtitles...`);
        
        const response = await fetch(subUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const vttText = await response.text();
        addLog(`VTT Fetched. Parsing...`);
        
        const cues = [];
        const blocks = vttText.split(/\r?\n\r?\n/);

        for (const block of blocks) {
          const lines = block.split(/\r?\n/);
          const timeLine = lines.find(l => l.includes('-->'));
          if (!timeLine) continue;

          const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
          
          const parseTime = (ts) => {
            if(!ts) return 0;
            const parts = ts.split(':');
            let s = 0;
            if(parts.length === 3) {
              s += parseInt(parts[0], 10) * 3600;
              s += parseInt(parts[1], 10) * 60;
              s += parseFloat(parts[2].replace(',', '.'));
            } else if (parts.length === 2) {
              s += parseInt(parts[0], 10) * 60;
              s += parseFloat(parts[1].replace(',', '.'));
            }
            return s * 1000;
          };

          const textLines = lines.slice(lines.indexOf(timeLine) + 1).filter(l => !l.startsWith('WEBVTT') && l.trim() !== '');
          const cleanText = textLines.join('\n').replace(/<[^>]+>/g, ''); 

          cues.push({ startMs: parseTime(startStr), endMs: parseTime(endStr), text: cleanText });
        }
        
        setParsedSubs(cues);
        addLog(`Parsed ${cues.length} subtitle cues.`, "SUCCESS");
      } catch (err) {
        addLog(`Subtitle Error: ${err.message}`, "ERROR");
      }
    };

    loadSubtitles();
  }, [streamData]);

  // 4. Subtitle Syncing & Progress Saving
  useEffect(() => {
    if (!status.isLoaded) return;
    
    if (subtitlesEnabled && parsedSubs.length > 0) {
      const currentMs = status.positionMillis;
      const activeCue = parsedSubs.find(c => currentMs >= c.startMs && currentMs <= c.endMs);
      if (activeCue && activeCue.text !== currentSubText) setCurrentSubText(activeCue.text);
      else if (!activeCue && currentSubText !== '') setCurrentSubText('');
    } else if (currentSubText !== '') {
      setCurrentSubText('');
    }

    const currentSecs = Math.floor(status.positionMillis / 1000);
    const durationSecs = Math.floor(status.durationMillis / 1000);
    
    if (userUid && animeId && status.isPlaying && currentSecs > 0 && currentSecs % 10 === 0) {
      const isCompleted = currentSecs > (durationSecs * 0.85);
      firestore().collection('users').doc(userUid).collection('progress').doc(String(animeId)).set({
        animeId: String(animeId),
        lastWatchedEp: episodeNum,
        progress: currentSecs,
        duration: durationSecs,
        finishedEp: isCompleted,
        timestamp: Date.now()
      }, { merge: true }).catch(() => addLog("Firebase sync failed.", "WARN"));
    }
  }, [status.positionMillis, subtitlesEnabled]);

  // 5. UI Auto-Hide Engine
  const resetHideTimer = () => {
    setShowUI(true);
    Animated.timing(uiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    
    hideUITimeout.current = setTimeout(() => {
      if (status.isPlaying && !showSettings && !showLogs) {
        Animated.timing(uiOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setShowUI(false));
      }
    }, 4000);
  };

  useEffect(() => {
    if (status.isPlaying) resetHideTimer();
    else {
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
      setShowUI(true);
      Animated.timing(uiOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [status.isPlaying, showSettings, showLogs]);

  // 6. Gesture Engine (Double Tap to Skip)
  const handleTouchOverlay = (evt) => {
    if (showSettings) { setShowSettings(false); return; }
    
    const now = Date.now();
    const tapDelay = now - lastTapRef.current;
    lastTapRef.current = now;

    if (tapDelay < 300) {
      const touchX = evt.nativeEvent.locationX;
      const screenHalf = Dimensions.get('window').width / 2;
      if (touchX > screenHalf) {
        seekForward(); triggerSkipIndicator('right');
      } else {
        seekBackward(); triggerSkipIndicator('left');
      }
    } else {
      resetHideTimer();
    }
  };

  const triggerSkipIndicator = (direction) => {
    setShowSkipIndicator(direction);
    setTimeout(() => setShowSkipIndicator(null), 600);
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    status.isPlaying ? videoRef.current.pauseAsync() : videoRef.current.playAsync();
    addLog(status.isPlaying ? "User Paused" : "User Played");
    resetHideTimer();
  };

  const seekBackward = async () => {
    if (!videoRef.current || !status.isLoaded) return;
    const newPos = Math.max(0, status.positionMillis - 10000);
    await videoRef.current.setPositionAsync(newPos);
    addLog("Seeked -10s");
    resetHideTimer();
  };

  const seekForward = async () => {
    if (!videoRef.current || !status.isLoaded) return;
    const newPos = Math.min(status.durationMillis, status.positionMillis + 10000);
    await videoRef.current.setPositionAsync(newPos);
    addLog("Seeked +10s");
    resetHideTimer();
  };

  const handleSliderValueChange = async (val) => {
    if (!videoRef.current || !status.isLoaded) return;
    await videoRef.current.setPositionAsync(val);
    addLog(`Scrubbed to ${formatTime(val)}`);
    resetHideTimer();
  };

  const changeSpeed = async () => {
    if (!videoRef.current) return;
    const newSpeed = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
    await videoRef.current.setRateAsync(newSpeed, true);
    setPlaybackSpeed(newSpeed);
    addLog(`Speed set to ${newSpeed}x`);
  };

  const toggleResizeMode = () => {
    const newMode = resizeMode === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN;
    setResizeMode(newMode);
    resetHideTimer();
  };

  const handleVideoError = (error) => {
    addLog(`VIDEO FATAL ERROR: ${error}`, "ERROR");
    setFatalError(error);
  };

  const formatTime = (millis) => {
    if (isNaN(millis)) return "00:00";
    const totalSecs = Math.floor(millis / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  if (loadingStream) {
    return (
      <View style={styles.loaderContainerFull}>
        <ActivityIndicator size="large" color={BRAND_RED} />
        <Text style={styles.bufferText}>Resolving Stream...</Text>
        <ScrollView style={styles.bootLogScroll}>
          {logs.map((l, idx) => (
            <Text key={idx} style={styles.bootLogText}>{l}</Text>
          ))}
        </ScrollView>
      </View>
    );
  }

  if (fatalError || !streamData) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-triangle" size={40} color={BRAND_RED} style={{marginBottom: 15}} />
        <Text style={styles.errorText}>Playback Halted</Text>
        <Text style={styles.errorSubText}>{fatalError || "Failed to parse streaming manifest."}</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={handleClosePlayer}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* NATIVE HEADER INJECTION (Bypasses DRM/Referer checks natively without breaking Extractors) */}
      <Video
        ref={videoRef}
        style={styles.videoPlayer}
        source={{ 
          uri: streamData.m3u8,
          headers: {
            "Referer": streamData.referer || "https://vidwish.live/",
            "Origin": streamData.referer ? new URL(streamData.referer).origin : "https://vidwish.live",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
          }
        }}
        useNativeControls={false}
        resizeMode={resizeMode}
        onError={handleVideoError}
        onPlaybackStatusUpdate={status => {
          setStatus(status);
          if (status.isLoaded && !isReady) {
            setIsReady(true);
            addLog("Stream Extracted and Ready.", "SUCCESS");
          }
          if (status.error) addLog(`Playback Error: ${status.error}`, "ERROR");
        }}
        shouldPlay
      />

      {subtitlesEnabled && currentSubText !== '' && (
        <View style={styles.subtitleContainer} pointerEvents="none">
          <Text style={styles.subtitleText}>{currentSubText}</Text>
        </View>
      )}

      {(!isReady || status.isBuffering) && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={BRAND_RED} />
          <Text style={styles.bufferText}>Buffering...</Text>
        </View>
      )}

      <TouchableWithoutFeedback onPress={handleTouchOverlay}>
        <View style={StyleSheet.absoluteFillObject} />
      </TouchableWithoutFeedback>

      {showSkipIndicator === 'left' && (
        <View style={styles.skipLeftInd}>
          <FontAwesome5 name="backward" size={30} color="#FFF" />
          <Text style={styles.skipText}>-10s</Text>
        </View>
      )}
      {showSkipIndicator === 'right' && (
        <View style={styles.skipRightInd}>
          <FontAwesome5 name="forward" size={30} color="#FFF" />
          <Text style={styles.skipText}>+10s</Text>
        </View>
      )}

      {showLogs && (
        <View style={styles.logOverlay}>
          <View style={styles.logHeader}>
            <Text style={styles.logTitle}><FontAwesome5 name="terminal" size={12}/> LIVE LOGS</Text>
            <TouchableOpacity onPress={() => setShowLogs(false)}><FontAwesome5 name="times" color="#FFF" size={16}/></TouchableOpacity>
          </View>
          <ScrollView style={styles.logScroll}>
            {logs.map((l, idx) => (
              <Text key={idx} style={[styles.logLine, l.includes('ERROR') ? styles.logError : l.includes('SUCCESS') ? styles.logSuccess : null]}>{l}</Text>
            ))}
          </ScrollView>
        </View>
      )}

      <Animated.View style={[styles.uiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'auto' : 'none'}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClosePlayer} style={styles.backBtn} hitSlop={{top:20, bottom:20, left:20, right:20}}>
            <FontAwesome5 name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.animeTitle}>{animeTitle}</Text>
            <Text style={styles.episodeTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
          </View>
        </View>

        <View style={styles.centerControls} pointerEvents="box-none">
          <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
            <FontAwesome5 name={status.isPlaying ? "pause" : "play"} size={34} color="#FFF" style={!status.isPlaying && {marginLeft: 6}} />
          </TouchableOpacity>
        </View>

        {showSettings && (
          <View style={styles.settingsMenu}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <TouchableOpacity style={styles.settingRow} onPress={changeSpeed}>
              <Text style={styles.settingLabel}><FontAwesome5 name="tachometer-alt"/> Speed</Text>
              <Text style={styles.settingValue}>{playbackSpeed}x</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingRow} onPress={toggleResizeMode}>
              <Text style={styles.settingLabel}><FontAwesome5 name="expand"/> Fit Video</Text>
              <Text style={styles.settingValue}>{resizeMode === ResizeMode.CONTAIN ? 'Contain' : 'Cover'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingRow} onPress={() => { setSubtitlesEnabled(!subtitlesEnabled); addLog(`Subtitles ${!subtitlesEnabled}`); }}>
              <Text style={styles.settingLabel}><FontAwesome5 name="closed-captioning"/> Subtitles</Text>
              <Text style={styles.settingValue}>{subtitlesEnabled ? 'ON' : 'OFF'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingRow} onPress={() => { setShowLogs(true); setShowSettings(false); }}>
              <Text style={styles.settingLabel}><FontAwesome5 name="bug"/> Debug Logs</Text>
              <FontAwesome5 name="chevron-right" color="#FFF" size={12}/>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomBar}>
          <View style={styles.progressBarRow}>
            <Text style={styles.timeText}>{formatTime(status.positionMillis || 0)}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={status.durationMillis || 100}
              value={status.positionMillis || 0}
              minimumTrackTintColor={BRAND_RED}
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor={BRAND_RED}
              onSlidingComplete={handleSliderValueChange}
              onSlidingStart={() => { if (hideUITimeout.current) clearTimeout(hideUITimeout.current); }}
            />
            <Text style={styles.timeText}>{formatTime(status.durationMillis || 0)}</Text>
          </View>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setSubtitlesEnabled(!subtitlesEnabled)}>
              {parsedSubs.length > 0 && <Text style={styles.subsBadge}>{subtitlesEnabled ? 'ON' : 'OFF'}</Text>}
              <FontAwesome5 name="closed-captioning" size={20} color={subtitlesEnabled ? "#FFF" : "#666"} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowSettings(!showSettings)}>
              <FontAwesome5 name="cog" size={20} color={showSettings ? BRAND_RED : "#FFF"} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoPlayer: { ...StyleSheet.absoluteFillObject },
  
  loaderContainerFull: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' },
  bootLogScroll: { marginTop: 20, maxHeight: 150, width: '80%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 10 },
  bootLogText: { color: '#4ADE80', fontFamily: 'monospace', fontSize: 9, marginBottom: 2 },
  
  loaderContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.4)' },
  bufferText: { color: BRAND_RED, marginTop: 10, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  
  errorContainer: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  errorSubText: { color: '#EF4444', fontSize: 10, fontFamily: 'monospace', marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 },
  errorBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  errorBtnText: { color: '#FFF', fontWeight: 'bold' },

  subtitleContainer: { position: 'absolute', bottom: 100, width: '100%', alignItems: 'center', zIndex: 9, paddingHorizontal: 20 },
  subtitleText: { color: '#FFF', fontSize: 16, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 25, paddingTop: 40, width: '100%', backgroundColor: 'rgba(0,0,0,0.6)' },
  backBtn: { marginRight: 20 },
  animeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  episodeTitle: { color: '#AAA', fontSize: 12, fontWeight: '600', marginTop: 2 },
  
  centerControls: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playPauseBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  
  skipLeftInd: { position: 'absolute', left: 80, top: '45%', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 40 },
  skipRightInd: { position: 'absolute', right: 80, top: '45%', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 40 },
  skipText: { color: '#FFF', fontSize: 14, fontWeight: '900', marginTop: 5 },

  settingsMenu: { position: 'absolute', bottom: 100, right: 30, backgroundColor: 'rgba(20,20,20,0.95)', borderRadius: 12, padding: 15, width: 220, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  settingsTitle: { color: '#AAA', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  settingLabel: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  settingValue: { color: BRAND_RED, fontSize: 12, fontWeight: 'bold' },

  logOverlay: { position: 'absolute', top: 90, left: 20, width: '40%', height: '50%', backgroundColor: 'rgba(0,0,0,0.85)', borderWidth: 1, borderColor: '#333', borderRadius: 8, zIndex: 50 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, borderBottomWidth: 1, borderBottomColor: '#333', backgroundColor: '#111' },
  logTitle: { color: '#4ADE80', fontSize: 10, fontWeight: 'bold', fontFamily: 'monospace' },
  logScroll: { padding: 10 },
  logLine: { color: '#A3A3A3', fontSize: 9, fontFamily: 'monospace', marginBottom: 4 },
  logError: { color: '#EF4444' },
  logSuccess: { color: '#4ADE80' },

  bottomBar: { width: '100%', paddingHorizontal: 30, paddingBottom: 35, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.7)' },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  timeText: { color: '#FFF', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  slider: { flex: 1, marginHorizontal: 15, height: 40 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 25 },
  actionBtn: { padding: 5, position: 'relative' },
  subsBadge: { color: BRAND_RED, fontSize: 8, fontWeight: '900', position: 'absolute', top: -8, right: -5, backgroundColor: '#000', paddingHorizontal: 3, borderRadius: 3, overflow: 'hidden' }
});
