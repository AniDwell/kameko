import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  Dimensions, StatusBar, BackHandler,
  TouchableWithoutFeedback, PanResponder
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Brightness from 'expo-brightness';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

// Native Volume Manager fallback handling
let VolumeManager = null;
try {
  VolumeManager = require('react-native-volume-manager').VolumeManager;
} catch (_) {}

// Modular Component Imports
import AspectRatioButton from './aspect-ratio';
import LockButton from './lock';
import VideoQualitySheet from './video_quality';
import SubtitleSheet from './subtitle';
import AudioSheet from './audio';
import SkipIntroOutro from './intro-outro';
import PlayPauseSkip from './play-pause-skip';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

// Top Bar Icons
const IconBack = ({ size = 28 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5">
    <Path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);
const IconSubs = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Rect x="3" y="5" width="18" height="14" rx="2" ry="2"/>
    <Path d="M7 15h3m4 0h3M7 9h10"/>
  </Svg>
);
const IconAudio = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M3 18v-6a9 9 0 0118 0v6"/>
    <Path d="M21 19a2 2 0 01-2 2h-1v-6h3v4zM3 19a2 2 0 002 2h1v-6H3v4z"/>
  </Svg>
);

export default function Player({ route, navigation }) {
  const { 
    animeTitle = 'Unknown', 
    episodeNum = 1, 
    episodeTitle = '', 
    animeId = null,
    slug = null,
    userUid = null,
    targetType = 'sub'
  } = route?.params || {};

  const videoRef = useRef(null);
  
  // UI Animations
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const gestureToastOpacity = useRef(new Animated.Value(0)).current;
  
  // Playback & UI State
  const [status, setStatus] = useState({});
  const [showUI, setShowUI] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  const [activeMenu, setActiveMenu] = useState(null); 
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [is2xFastForwarding, setIs2xFastForwarding] = useState(false);
  const previousSpeedRef = useRef(1.0);

  // Stream Resolution State
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [fatalError, setFatalError] = useState(null);
  const [activeUrl, setActiveUrl] = useState(null); 
  const [qualityList, setQualityList] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [currentAutoRes, setCurrentAutoRes] = useState('1080p');

  // Subtitles
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [parsedSubs, setParsedSubs] = useState([]);
  const [currentSubText, setCurrentSubText] = useState('');
  const [subSettings, setSubSettings] = useState({ color: '#FFFFFF', size: 16, height: 40 });

  // Real Hardware State Refs & Toast
  const currentBrightnessRef = useRef(0.5);
  const currentVolumeRef = useRef(0.5);
  const [gestureText, setGestureText] = useState(null);

  const hideUITimeout = useRef(null);
  const longPressTimerRef = useRef(null);
  const isLongPressActiveRef = useRef(false);

  // 1. Permanent Landscape Lock Enforcement
  const enforceLandscape = useCallback(async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch (_) {}
    StatusBar.setHidden(true);
  }, []);

  useEffect(() => {
    enforceLandscape();

    // Re-lock if the window orientation changes inadvertently
    const orientationSub = ScreenOrientation.addOrientationChangeListener(() => {
      enforceLandscape();
    });

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeMenu) { 
        setActiveMenu(null); 
        return true; 
      }
      if (isLocked) { 
        setIsLocked(false); 
        showUIControls(); 
        return true; 
      }
      handleClosePlayer();
      return true;
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(orientationSub);
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false);
      backHandler.remove();
    };
  }, [activeMenu, isLocked, enforceLandscape]);

  const handleClosePlayer = async () => {
    await ScreenOrientation.unlockAsync().catch(() => {});
    navigation.goBack();
    return true;
  };

  // 2. Hardware Brightness and Volume Setup
  useEffect(() => {
    async function initHardwareControls() {
      try {
        const { status: bStatus } = await Brightness.requestPermissionsAsync();
        if (bStatus === 'granted') {
          const bVal = await Brightness.getBrightnessAsync();
          currentBrightnessRef.current = bVal >= 0 ? bVal : 0.5;
        }
      } catch (_) {}

      try {
        if (VolumeManager) {
          const vol = await VolumeManager.getVolume();
          currentVolumeRef.current = vol?.volume ?? 0.5;
        }
      } catch (_) {}
    }
    initHardwareControls();
  }, []);

  // 3. Network Stream Resolution
  useEffect(() => {
    let isMounted = true;
    const resolveStream = async () => {
      let typeServers = ['hd-1', 'hd-2', 'vidstream-2'];
      try {
        const srvRes = await fetch(`${VERCEL_API_BASE}/api/servers?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}`);
        const srvJson = await srvRes.json();
        if (srvJson?.success && srvJson?.data) {
          const filtered = srvJson.data.filter(s => s.type === targetType).map(s => s.serverName);
          if (filtered.length > 0) typeServers = filtered;
        }
      } catch (_) {}

      let finalStreamData = null;
      for (const srv of typeServers) {
        try {
          const url = `${VERCEL_API_BASE}/api/stream?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}&server=${srv}&type=${targetType}`;
          const res = await fetch(url);
          const json = await res.json();
          if (json?.success && json?.data?.m3u8) { 
            finalStreamData = json.data; 
            break; 
          }
        } catch (_) {}
      }

      if (!isMounted) return;
      if (!finalStreamData) {
        setFatalError(`All servers are currently unresponsive.`);
        setLoadingStream(false); 
        return;
      }

      const masterUrl = finalStreamData.m3u8;
      
      try {
        const m3Res = await fetch(masterUrl, { 
          headers: { "Referer": finalStreamData.referer || "https://vidwish.live/" }
        });
        const m3Text = await m3Res.text();
        const lines = m3Text.split('\n');
        let qualities = [{ label: 'Auto', uri: masterUrl }];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('RESOLUTION=')) {
            const resMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
            if (resMatch && lines[i + 1]) {
              let streamUri = lines[i + 1].trim();
              if (!streamUri.startsWith('http')) {
                const basePath = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
                streamUri = basePath + streamUri;
              }
              qualities.push({ label: `${resMatch[1]}p`, uri: streamUri });
            }
          }
        }
        const uniqueQualities = []; 
        const seenLabels = new Set();
        for (const q of qualities) { 
          if (!seenLabels.has(q.label)) { 
            seenLabels.add(q.label); 
            uniqueQualities.push(q); 
          } 
        }
        setQualityList(uniqueQualities);
      } catch (_) {}

      setStreamData(finalStreamData);
      setActiveUrl(masterUrl);
      setLoadingStream(false);
    };

    resolveStream();
    return () => { isMounted = false; };
  }, [animeId, episodeNum, targetType]);

  // 4. Subtitle Parser
  useEffect(() => {
    if (!streamData?.subtitles || streamData.subtitles.length === 0) return;
    const loadSubtitles = async () => {
      try {
        const response = await fetch(streamData.subtitles[0].file);
        if (!response.ok) return;
        const vttText = await response.text();
        const cues = [];
        const blocks = vttText.split(/\r?\n\r?\n/);
        for (const block of blocks) {
          const lines = block.split(/\r?\n/);
          const timeLine = lines.find(l => l.includes('-->'));
          if (!timeLine) continue;
          const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
          const parseTime = (ts) => {
            if (!ts) return 0; 
            const parts = ts.split(':'); 
            let s = 0;
            if (parts.length === 3) s += parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2].replace(',', '.'));
            else if (parts.length === 2) s += parseInt(parts[0], 10) * 60 + parseFloat(parts[1].replace(',', '.'));
            return s * 1000;
          };
          const cleanText = lines.slice(lines.indexOf(timeLine) + 1).filter(l => !l.startsWith('WEBVTT') && l.trim() !== '').join('\n').replace(/<[^>]+>/g, ''); 
          cues.push({ startMs: parseTime(startStr), endMs: parseTime(endStr), text: cleanText });
        }
        setParsedSubs(cues);
      } catch (_) {}
    };
    loadSubtitles();
  }, [streamData]);

  // 5. Playback Sync & Firestore Progress Update
  useEffect(() => {
    if (!status.isLoaded) return;
    const currentMs = status.positionMillis || 0;
    const currentSecs = Math.floor(currentMs / 1000);

    if (status.naturalSize?.height) {
      setCurrentAutoRes(`${status.naturalSize.height}p`);
    }

    if (subtitlesEnabled && parsedSubs.length > 0) {
      const activeCue = parsedSubs.find(c => currentMs >= c.startMs && currentMs <= c.endMs);
      if (activeCue && activeCue.text !== currentSubText) setCurrentSubText(activeCue.text);
      else if (!activeCue && currentSubText !== '') setCurrentSubText('');
    } else if (currentSubText !== '') { 
      setCurrentSubText(''); 
    }

    // Save animeId, slug, and progress data into database every 10 seconds
    const durationSecs = Math.floor((status.durationMillis || 1) / 1000);
    if (userUid && animeId && status.isPlaying && currentSecs > 0 && currentSecs % 10 === 0) {
      const isCompleted = currentSecs > (durationSecs * 0.85);
      firestore().collection('users').doc(userUid).collection('progress').doc(String(animeId)).set({
        animeId: String(animeId),
        slug: slug ? String(slug) : String(episodeNum),
        lastWatchedEp: episodeNum,
        progress: currentSecs,
        duration: durationSecs,
        finishedEp: isCompleted,
        timestamp: Date.now()
      }, { merge: true }).catch(() => {});
    }
  }, [status.positionMillis, subtitlesEnabled]);

  // 6. Real Brightness and Real Volume Pan Gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        // Start long press timer for 2x speed
        isLongPressActiveRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
          if (!isLocked && status.isPlaying && videoRef.current) {
            isLongPressActiveRef.current = true;
            previousSpeedRef.current = playbackSpeed;
            videoRef.current.setRateAsync(2.0, true);
            setIs2xFastForwarding(true);
          }
        }, 500);
      },
      onMoveShouldSetPanResponder: (_, gestureState) => 
        Math.abs(gestureState.dy) > 12 && Math.abs(gestureState.dx) < 25,
      onPanResponderMove: async (_, gestureState) => {
        // If movement occurs, cancel long press
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isLocked) return;

        const { moveX, dy } = gestureState;
        const isLeft = moveX < (Dimensions.get('window').width || SCREEN_WIDTH) / 2;

        if (isLeft) {
          // Hardware Screen Brightness
          let delta = -dy * 0.0035;
          let newBrightness = Math.max(0.01, Math.min(1.0, currentBrightnessRef.current + delta));
          currentBrightnessRef.current = newBrightness;
          try {
            await Brightness.setBrightnessAsync(newBrightness);
          } catch (_) {}
          setGestureText(`Brightness: ${Math.round(newBrightness * 100)}%`);
          gestureToastOpacity.setValue(1);
        } else {
          // Hardware System Volume
          let delta = -dy * 0.005;
          let newVol = Math.max(0, Math.min(1.0, currentVolumeRef.current + delta));
          currentVolumeRef.current = newVol;
          try {
            if (VolumeManager) {
              await VolumeManager.setVolume(newVol, { showUI: false });
            } else if (videoRef.current) {
              await videoRef.current.setVolumeAsync(newVol);
            }
          } catch (_) {}
          setGestureText(`Volume: ${Math.round(newVol * 100)}%`);
          gestureToastOpacity.setValue(1);
        }
      },
      onPanResponderRelease: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        // If 2x was triggered, reset back to normal rate
        if (isLongPressActiveRef.current) {
          isLongPressActiveRef.current = false;
          setIs2xFastForwarding(false);
          if (videoRef.current) {
            videoRef.current.setRateAsync(previousSpeedRef.current, true);
          }
        }
        Animated.timing(gestureToastOpacity, { 
          toValue: 0, 
          duration: 400, 
          delay: 300, 
          useNativeDriver: true 
        }).start(() => setGestureText(null));
      },
      onPanResponderTerminate: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
        }
        if (isLongPressActiveRef.current) {
          isLongPressActiveRef.current = false;
          setIs2xFastForwarding(false);
          if (videoRef.current) {
            videoRef.current.setRateAsync(previousSpeedRef.current, true);
          }
        }
      }
    })
  ).current;

  // 7. Auto-hide Overlay
  const resetHideTimer = useCallback(() => {
    if (activeMenu || isLocked) return; 
    setShowUI(true);
    Animated.timing(uiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    hideUITimeout.current = setTimeout(() => {
      if (status.isPlaying && !activeMenu) {
        Animated.timing(uiOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setShowUI(false));
      }
    }, 3500);
  }, [activeMenu, status.isPlaying, isLocked]);

  useEffect(() => {
    if (status.isPlaying) resetHideTimer();
    else {
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
      if (!isLocked) { 
        setShowUI(true); 
        Animated.timing(uiOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start(); 
      }
    }
  }, [status.isPlaying, activeMenu, isLocked, resetHideTimer]);

  const showUIControls = () => { 
    setShowUI(true); 
    Animated.timing(uiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start(); 
    resetHideTimer(); 
  };

  const formatTime = (millis) => {
    if (isNaN(millis) || millis < 0) return "00:00";
    const totalSecs = Math.floor(millis / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSecs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  const handleOpenSettingSheet = (sheetName) => {
    enforceLandscape();
    setActiveMenu(sheetName);
  };

  if (loadingStream) {
    return <View style={styles.loaderContainerFull} />;
  }

  return (
    <View style={styles.container}>
      {/* VIDEO ENGINE */}
      <Video
        ref={videoRef}
        style={styles.videoPlayer}
        source={{ 
          uri: activeUrl, 
          overrideFileExtensionAndroid: 'm3u8',
          headers: { 
            "Referer": streamData?.referer || "https://vidwish.live/", 
            "User-Agent": "Mozilla/5.0" 
          }
        }}
        useNativeControls={false}
        resizeMode={resizeMode}
        onPlaybackStatusUpdate={setStatus}
        shouldPlay
      />

      {/* 2X FAST FORWARD BADGE */}
      {is2xFastForwarding && (
        <View style={styles.speedIndicatorBadge} pointerEvents="none">
          <Text style={styles.speedIndicatorText}>2X SPEED ▶▶</Text>
        </View>
      )}

      {/* SUBTITLE DISPLAY */}
      {subtitlesEnabled && currentSubText !== '' && (
        <View 
          style={[styles.subtitleContainer, { bottom: subSettings.height + (showUI ? 65 : 0) }]} 
          pointerEvents="none"
        >
          <Text style={[styles.subtitleText, { color: subSettings.color, fontSize: subSettings.size }]}>
            {currentSubText}
          </Text>
        </View>
      )}

      {/* HARDWARE VOLUME / BRIGHTNESS TOAST */}
      {gestureText && (
        <Animated.View style={[styles.gestureToastContainer, { opacity: gestureToastOpacity }]} pointerEvents="none">
          <Text style={styles.gestureToastText}>{gestureText}</Text>
        </Animated.View>
      )}

      {/* INTERACTIVE PLAY/PAUSE/DOUBLE-TAP LAYER */}
      <PlayPauseSkip 
        status={status} 
        videoRef={videoRef} 
        resetHideTimer={resetHideTimer} 
        isLocked={isLocked} 
        uiOpacity={uiOpacity} 
        showUI={showUI} 
        setShowUI={setShowUI}
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        panHandlers={panResponder.panHandlers}
      />

      {/* INTRO/OUTRO SKIPPER */}
      <SkipIntroOutro 
        status={status} 
        videoRef={videoRef} 
        introData={streamData?.intro} 
        isLocked={isLocked} 
      />

      {/* CONTROLS OVERLAY LAYER */}
      <Animated.View style={[styles.uiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'box-none' : 'none'}>
        {/* TOP BAR */}
        {!isLocked && (
          <View style={styles.topBarWrapper}>
            <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Defs>
                <LinearGradient id="topCinematic" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#000000" stopOpacity="0.95" />
                  <Stop offset="1" stopColor="#000000" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#topCinematic)" />
            </Svg>

            <View style={styles.topBarContent}>
              <View style={styles.topLeftGroup}>
                <TouchableOpacity onPress={handleClosePlayer} style={styles.iconBtn} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                  <IconBack />
                </TouchableOpacity>
                <View style={styles.titleColumn}>
                  <Text style={styles.mainTitle} numberOfLines={1}>{animeTitle}</Text>
                  <Text style={styles.subTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
                </View>
              </View>

              <View style={styles.topRightGroup}>
                <TouchableOpacity onPress={() => handleOpenSettingSheet('subs')} style={styles.iconBtn}>
                  <IconSubs color={subtitlesEnabled ? "#FFF" : "#777"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleOpenSettingSheet('audio')} style={styles.iconBtn}>
                  <IconAudio />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleOpenSettingSheet('quality')} style={styles.hdBtn}>
                  <Text style={styles.hdBtnText}>HD</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* BOTTOM CONTROLS & TIMELINE */}
        <View style={styles.bottomBarWrapper}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Defs>
              <LinearGradient id="botCinematic" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.95" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#botCinematic)" />
          </Svg>

          <View style={styles.bottomContent}>
            <View style={styles.bottomToolsRow}>
              <View style={styles.toolsLeft}>
                <LockButton 
                  isLocked={isLocked} 
                  setIsLocked={setIsLocked} 
                  uiOpacity={uiOpacity} 
                  setShowUI={setShowUI} 
                  hideUITimeout={hideUITimeout} 
                />
              </View>
              {!isLocked && (
                <View style={styles.toolsRight}>
                  <AspectRatioButton resizeMode={resizeMode} setResizeMode={setResizeMode} />
                </View>
              )}
            </View>

            {!isLocked && (
              <View style={styles.progressRow}>
                <Text style={styles.timeText}>{formatTime(status.positionMillis || 0)}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={status.durationMillis || 100}
                  value={status.positionMillis || 0}
                  minimumTrackTintColor={BRAND_RED}
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#FFF"
                  onSlidingComplete={async (val) => { 
                    if (videoRef.current) { 
                      await videoRef.current.setPositionAsync(val); 
                      resetHideTimer(); 
                    } 
                  }}
                  onSlidingStart={() => { 
                    if (hideUITimeout.current) clearTimeout(hideUITimeout.current); 
                  }}
                />
                <Text style={styles.timeText}>-{formatTime((status.durationMillis || 0) - (status.positionMillis || 0))}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* BOTTOM SHEETS */}
      <VideoQualitySheet 
        activeMenu={activeMenu} 
        setActiveMenu={setActiveMenu} 
        qualityList={qualityList} 
        selectedQuality={selectedQuality} 
        setSelectedQuality={setSelectedQuality} 
        setActiveUrl={setActiveUrl} 
        currentAutoRes={currentAutoRes} 
      />
      <SubtitleSheet 
        activeMenu={activeMenu} 
        setActiveMenu={setActiveMenu} 
        subtitlesEnabled={subtitlesEnabled} 
        setSubtitlesEnabled={setSubtitlesEnabled} 
        subSettings={subSettings} 
        setSubSettings={setSubSettings} 
      />
      <AudioSheet 
        activeMenu={activeMenu} 
        setActiveMenu={setActiveMenu} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoPlayer: { ...StyleSheet.absoluteFillObject },
  loaderContainerFull: { flex: 1, backgroundColor: '#000' },

  speedIndicatorBadge: {
    position: 'absolute',
    top: 55,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    zIndex: 35
  },
  speedIndicatorText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1
  },

  gestureToastContainer: { 
    position: 'absolute', 
    top: '20%', 
    alignSelf: 'center', 
    backgroundColor: 'rgba(10,10,10,0.92)', 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 30, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.2)', 
    zIndex: 20 
  },
  gestureToastText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  subtitleContainer: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 9, paddingHorizontal: 30 },
  subtitleText: { 
    fontWeight: '800', 
    textAlign: 'center', 
    textShadowColor: '#000', 
    textShadowOffset: { width: 1, height: 1 }, 
    textShadowRadius: 3, 
    backgroundColor: 'transparent' 
  },

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  topBarWrapper: { width: '100%', position: 'absolute', top: 0, height: 130 },
  topBarContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  topLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  titleColumn: { paddingHorizontal: 10 },
  mainTitle: { color: '#FFF', fontSize: 17, fontWeight: '700', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  subTitle: { color: 'rgba(255,255,255,0.65)', fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  topRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  iconBtn: { padding: 4, opacity: 0.9 },
  hdBtn: { borderWidth: 1.5, borderColor: '#FFF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, height: 20, justifyContent: 'center', alignItems: 'center' },
  hdBtnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  bottomBarWrapper: { width: '100%', position: 'absolute', bottom: 0, height: 130, justifyContent: 'flex-end' },
  bottomContent: { paddingHorizontal: 24, paddingBottom: 16 },
  bottomToolsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 4 },
  toolsLeft: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  toolsRight: { flexDirection: 'row', alignItems: 'center' },
  
  progressRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  timeText: { color: '#FFF', fontSize: 13, fontFamily: 'monospace', minWidth: 45, textAlign: 'center' },
  slider: { flex: 1, marginHorizontal: 12, height: 28 },
});
