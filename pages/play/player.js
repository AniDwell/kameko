import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  Dimensions, ActivityIndicator, StatusBar, BackHandler,
  TouchableWithoutFeedback, PanResponder, ScrollView
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

// --- PREMIUM SVG ICONS ---
const IconPlay = ({ size = 26, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>);
const IconPause = ({ size = 26, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Svg>);
const IconBackward = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></Svg>);
const IconForward = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></Svg>);
const IconSubs = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11H9.5v-1.5h-1.5v-2H9.5V10H11v5zm6 0h-1.5v-1.5h-1.5v-2h1.5V10H17v5z"/></Svg>);
const IconAudio = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></Svg>);
const IconSkip = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M5 4l10 8-10 8V4z"/><Path d="M19 5v14"/></Svg>);
const IconBack = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M19 12H5M12 19l-7-7 7-7"/></Svg>);
const IconClose = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M18 6L6 18M6 6l12 12"/></Svg>);
const IconChevronRight = ({ size = 16, color = "#888" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><Path d="M9 18l6-6-6-6" /></Svg>);
const IconUnlock = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></Svg>);
const IconLocked = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></Svg>);
const IconFit = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></Svg>);

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
  
  // UI Animation Refs
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const skipIntroOpacity = useRef(new Animated.Value(0)).current;
  const gestureToastOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateX = useRef(new Animated.Value(450)).current;
  const panelBackdropOpacity = useRef(new Animated.Value(0)).current;

  const [status, setStatus] = useState({});
  const [showUI, setShowUI] = useState(true);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSkipIndicator, setShowSkipIndicator] = useState(null); 
  const [isLocked, setIsLocked] = useState(false);
  const isLockedRef = useRef(false);

  // Settings Menus & Side Drawers
  const [activeMenu, setActiveMenu] = useState(null); // 'speed', 'quality', 'subs', 'audio', 'subStyle'
  const [subColor, setSubColor] = useState('#FFFFFF');
  const [subSize, setSubSize] = useState(16);
  const [subHeight, setSubHeight] = useState(30);

  // Network & Stream State
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  // Quality State
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [currentAutoRes, setCurrentAutoRes] = useState('1080p');

  // Gestures (Volume / Brightness)
  const [brightnessOverlay, setBrightnessOverlay] = useState(0); 
  const [volume, setVolume] = useState(1.0); 
  const [gestureText, setGestureText] = useState(null);

  // Skip Intro State
  const [introData, setIntroData] = useState({ start: 0, end: 0 });
  const [showSkipButton, setShowSkipButton] = useState(false);
  const skipTimerRef = useRef(null);

  // Subtitles
  const [parsedSubs, setParsedSubs] = useState([]);
  const [currentSubText, setCurrentSubText] = useState('');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const hideUITimeout = useRef(null);
  const lastTapRef = useRef(0);

  // 1. Force Landscape & Hardware Navigation
  useEffect(() => {
    async function lockOrientation() {
      try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch (_) {}
      StatusBar.setHidden(true);
    }
    lockOrientation();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeMenu) {
        if (activeMenu === 'subStyle') openPanel('subs');
        else closePanel();
        return true;
      }
      if (isLocked) { toggleLock(); return true; }
      handleClosePlayer();
      return true;
    });

    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false);
      backHandler.remove();
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    };
  }, [activeMenu, isLocked]);

  const handleClosePlayer = async () => {
    await ScreenOrientation.unlockAsync().catch(() => {});
    navigation.goBack();
    return true;
  };

  // 2. Direct Network Resolution Engine (UNCHANGED AS REQUESTED)
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
        setFatalError(`All servers are currently unresponsive for Episode ${episodeNum} (${targetType.toUpperCase()}).`);
        setLoadingStream(false);
        return;
      }

      if (finalStreamData.intro) {
        setIntroData(finalStreamData.intro);
      }

      setStreamData(finalStreamData);
      setLoadingStream(false);
    };

    resolveStream();
    return () => { isMounted = false; };
  }, [animeId, episodeNum, targetType]);

  // 3. Subtitle Engine
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
            if (parts.length === 3) {
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
      } catch (_) {}
    };

    loadSubtitles();
  }, [streamData]);

  // 4. Playback Tick
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

    if (introData.end > 0 && currentSecs >= introData.start && currentSecs < introData.end) {
      if (!showSkipButton && !skipTimerRef.current) {
        setShowSkipButton(true);
        Animated.timing(skipIntroOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        skipTimerRef.current = setTimeout(() => {
          Animated.timing(skipIntroOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => { setShowSkipButton(false); });
        }, 6000);
      }
    } else if (showSkipButton) {
      Animated.timing(skipIntroOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => { setShowSkipButton(false); });
      if (skipTimerRef.current) { clearTimeout(skipTimerRef.current); skipTimerRef.current = null; }
    }

    const durationSecs = Math.floor((status.durationMillis || 1) / 1000);
    if (userUid && animeId && status.isPlaying && currentSecs > 0 && currentSecs % 10 === 0) {
      const isCompleted = currentSecs > (durationSecs * 0.85);
      firestore().collection('users').doc(userUid).collection('progress').doc(String(animeId)).set({
        animeId: String(animeId),
        lastWatchedEp: episodeNum,
        progress: currentSecs,
        duration: durationSecs,
        finishedEp: isCompleted,
        timestamp: Date.now()
      }, { merge: true }).catch(() => {});
    }
  }, [status.positionMillis, subtitlesEnabled]);

  // Lock System Integration
  const toggleLock = () => {
    const newState = !isLocked;
    setIsLocked(newState);
    isLockedRef.current = newState;
    if (newState) { closePanel(); }
    resetHideTimer();
  };

  // 5. Swipe Gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 15 && Math.abs(gestureState.dx) < 25,
      onPanResponderMove: (_, gestureState) => {
        if (isLockedRef.current) return;
        const { moveX, dy } = gestureState;
        const isLeft = moveX < Dimensions.get('window').width / 2;

        if (isLeft) {
          setBrightnessOverlay(prev => {
            let next = prev + (dy * 0.0035);
            next = Math.max(0, Math.min(next, 0.85));
            setGestureText(`☀ Brightness ${Math.round((1 - next) * 100)}%`);
            gestureToastOpacity.setValue(1);
            return next;
          });
        } else {
          setVolume(prev => {
            let next = prev - (dy * 0.005);
            next = Math.max(0, Math.min(next, 2.0));
            if (videoRef.current) { videoRef.current.setVolumeAsync(Math.min(next, 1.0)); }
            setGestureText(`🔊 Volume ${Math.round(next * 100)}%`);
            gestureToastOpacity.setValue(1);
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        Animated.timing(gestureToastOpacity, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }).start(() => { setGestureText(null); });
      }
    })
  ).current;

  // 6. UI Auto-Hide Engine
  const resetHideTimer = useCallback(() => {
    if (activeMenu) return; 
    setShowUI(true);
    Animated.timing(uiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    
    hideUITimeout.current = setTimeout(() => {
      if (status.isPlaying && !activeMenu) {
        Animated.timing(uiOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setShowUI(false));
      }
    }, 4500);
  }, [activeMenu, status.isPlaying]);

  useEffect(() => {
    if (status.isPlaying) resetHideTimer();
    else {
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
      setShowUI(true);
      Animated.timing(uiOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [status.isPlaying, activeMenu, resetHideTimer]);

  const openPanel = (panelName) => {
    setActiveMenu(panelName);
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    Animated.parallel([
      Animated.spring(panelTranslateX, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }),
      Animated.timing(panelBackdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
    ]).start();
  };

  const closePanel = () => {
    Animated.parallel([
      Animated.timing(panelTranslateX, { toValue: 450, duration: 220, useNativeDriver: true }),
      Animated.timing(panelBackdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true })
    ]).start(() => {
      setActiveMenu(null);
      resetHideTimer();
    });
  };

  const handleTouchOverlay = (evt) => {
    if (activeMenu) { closePanel(); return; }
    
    if (isLocked) {
      resetHideTimer(); // Briefly shows the lock icon then fades out
      return;
    }

    const now = Date.now();
    const tapDelay = now - lastTapRef.current;
    lastTapRef.current = now;

    if (tapDelay < 300) {
      const touchX = evt.nativeEvent.locationX;
      if (touchX > Dimensions.get('window').width / 2) {
        seekForward();
        triggerSkipIndicator('right');
      } else {
        seekBackward();
        triggerSkipIndicator('left');
      }
    } else {
      if (showUI) {
        Animated.timing(uiOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowUI(false));
        if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
      } else {
        resetHideTimer();
      }
    }
  };

  const triggerSkipIndicator = (direction) => {
    setShowSkipIndicator(direction);
    setTimeout(() => setShowSkipIndicator(null), 600);
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    status.isPlaying ? videoRef.current.pauseAsync() : videoRef.current.playAsync();
    resetHideTimer();
  };

  const seekBackward = async () => {
    if (!videoRef.current || !status.isLoaded) return;
    await videoRef.current.setPositionAsync(Math.max(0, status.positionMillis - 10000));
    resetHideTimer();
  };

  const seekForward = async () => {
    if (!videoRef.current || !status.isLoaded) return;
    await videoRef.current.setPositionAsync(Math.min(status.durationMillis, status.positionMillis + 10000));
    resetHideTimer();
  };

  const cycleScaleMode = () => {
    setResizeMode(prev => prev === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN);
    resetHideTimer();
  };

  const formatTime = (millis) => {
    if (isNaN(millis)) return "00:00";
    const totalSecs = Math.floor(millis / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(totalSecs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  if (loadingStream) {
    return (
      <View style={styles.loaderContainerFull}>
        <ActivityIndicator size="large" color={BRAND_RED} />
        <Text style={styles.loaderText}>Connecting to stream...</Text>
      </View>
    );
  }

  if (fatalError || !streamData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Playback Halted</Text>
        <Text style={styles.errorSub}>{fatalError || "Unable to play stream."}</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={handleClosePlayer}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* NATIVE EXPO VIDEO ENGINE */}
      <Video
        ref={videoRef}
        style={styles.videoPlayer}
        source={{ 
          uri: streamData.m3u8,
          overrideFileExtensionAndroid: 'm3u8',
          headers: {
            "Referer": streamData.referer || "https://vidwish.live/",
            "Origin": streamData.referer ? new URL(streamData.referer).origin : "https://vidwish.live",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
          }
        }}
        useNativeControls={false}
        resizeMode={resizeMode}
        onPlaybackStatusUpdate={setStatus}
        shouldPlay
      />

      {/* HARDWARE BRIGHTNESS OVERLAY */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${brightnessOverlay})` }]} pointerEvents="none" />

      {/* CUSTOM VTT SUBTITLE DISPLAY */}
      {subtitlesEnabled && currentSubText !== '' && (
        <View style={[styles.subtitleContainer, { bottom: subHeight + (showUI ? 65 : 0) }]} pointerEvents="none">
          <Text style={[styles.subtitleText, { color: subColor, fontSize: subSize }]}>{currentSubText}</Text>
        </View>
      )}

      {/* DYNAMIC WHITE BUFFERING SPINNER */}
      {(!status.isLoaded || status.isBuffering) && (
        <View style={styles.bufferingOverlay} pointerEvents="none"><ActivityIndicator size="large" color="#FFFFFF" /></View>
      )}

      {/* SWIPE GESTURE TOAST */}
      {gestureText && (
        <Animated.View style={[styles.gestureToastContainer, { opacity: gestureToastOpacity }]} pointerEvents="none">
          <Text style={styles.gestureToastText}>{gestureText}</Text>
        </Animated.View>
      )}

      {/* TOUCH & PAN RESPONDER LAYER */}
      <View {...panResponder.panHandlers} style={[StyleSheet.absoluteFillObject, { zIndex: 5 }]}>
        <TouchableWithoutFeedback onPress={handleTouchOverlay}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      </View>

      {/* DOUBLE TAP ANIMATIONS */}
      {showSkipIndicator === 'left' && (
        <View style={styles.skipLeftInd} pointerEvents="none"><IconBackward size={36} color="#FFF" /><Text style={styles.skipText}>-10s</Text></View>
      )}
      {showSkipIndicator === 'right' && (
        <View style={styles.skipRightInd} pointerEvents="none"><IconForward size={36} color="#FFF" /><Text style={styles.skipText}>+10s</Text></View>
      )}

      {/* DYNAMIC SKIP INTRO BUTTON */}
      {showSkipButton && !isLocked && (
        <Animated.View style={[styles.skipIntroFloat, { opacity: skipIntroOpacity }]}>
          <TouchableOpacity onPress={() => videoRef.current?.setPositionAsync(introData.end * 1000)} style={styles.skipIntroBtnInner} activeOpacity={0.8}>
            <Text style={styles.skipIntroText}>SKIP INTRO</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* LOCKED UI */}
      {isLocked && (
        <Animated.View style={[styles.lockedUiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'box-none' : 'none'}>
          <TouchableOpacity onPress={toggleLock} style={styles.heroLockBtn}>
            <IconLocked size={32} color="#FFF" />
            <Text style={styles.unlockHeroText}>Tap to Unlock</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* MAIN UI OVERLAY LAYER (HTML WEB PLAYER STYLE) */}
      {!isLocked && (
        <Animated.View style={[styles.uiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'box-none' : 'none'}>
          
          {/* TOP BAR WITH CINEMATIC GRADIENT */}
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
              <View style={styles.topLeft}>
                <TouchableOpacity onPress={handleClosePlayer} style={styles.backBtn} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                  <IconBack size={24} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.titleColumn}>
                  <Text style={styles.animeTitle} numberOfLines={1}>{animeTitle}</Text>
                  <Text style={styles.episodeTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
                </View>
              </View>
              
              <View style={styles.topRight}>
                <TouchableOpacity onPress={() => openPanel('subs')} style={styles.iconBtnWrapper}>
                  <IconSubs size={22} color={subtitlesEnabled ? "#FFF" : "#777"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openPanel('audio')} style={styles.iconBtnWrapper}>
                  <IconAudio size={22} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openPanel('quality')} style={styles.hdBtn}>
                  <Text style={styles.hdText}>HD</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* CENTER CONTROLS */}
          <View style={styles.centerControls} pointerEvents="box-none">
            <TouchableOpacity onPress={seekBackward} style={styles.skipCircleBtn} activeOpacity={0.7}>
              <IconBackward size={32} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
              {status.isPlaying ? <IconPause size={42} color="#FFF" /> : <IconPlay size={42} color="#FFF" />}
            </TouchableOpacity>

            <TouchableOpacity onPress={seekForward} style={styles.skipCircleBtn} activeOpacity={0.7}>
              <IconForward size={32} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* BOTTOM BAR WITH CINEMATIC GRADIENT */}
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

            <View style={styles.toolsRow}>
              <View style={styles.toolsGroup}>
                <TouchableOpacity onPress={toggleLock} style={styles.iconBtnWrapper}>
                  <IconUnlock size={22} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={cycleScaleMode} style={styles.iconBtnWrapper}>
                  <IconFit size={22} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openPanel('speed')} style={styles.iconBtnWrapper}>
                  <Text style={styles.speedText}>{playbackSpeed.toFixed(2)}x</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.toolsGroup}>
                {/* Next Episode Hook */}
                <TouchableOpacity onPress={() => {/* Next Ep Hook */}} style={styles.iconBtnWrapper}>
                  <IconSkip size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.progressBarRow}>
              <Text style={styles.timeText}>{formatTime(status.positionMillis || 0)}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={status.durationMillis || 100}
                value={status.positionMillis || 0}
                minimumTrackTintColor={BRAND_RED}
                maximumTrackTintColor="rgba(255,255,255,0.25)"
                thumbTintColor={BRAND_RED}
                onSlidingComplete={handleSliderChange}
                onSlidingStart={() => { if (hideUITimeout.current) clearTimeout(hideUITimeout.current); }}
              />
              <Text style={styles.timeText}>-{formatTime(Math.max(0, (status.durationMillis || 0) - (status.positionMillis || 0)))}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* SIDE DRAWER PANELS (SETTINGS / QUALITY / SUBS / AUDIO / SPEED) */}
      {activeMenu !== null && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {/* Dismiss Backdrop */}
          <TouchableWithoutFeedback onPress={closePanel}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: panelBackdropOpacity }]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.sideDrawerSurface, { transform: [{ translateX: panelTranslateX }] }]}>
            
            {activeMenu === 'quality' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.panelHeaderRow}>
                  <Text style={styles.panelHeaderTitle}>Video Quality</Text>
                  <TouchableOpacity onPress={closePanel}><IconClose size={20} color="#888" /></TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.drawerSelectableRow} onPress={() => { setSelectedQuality('Auto'); closePanel(); }}>
                  <Text style={[styles.drawerOptionLabel, selectedQuality === 'Auto' && styles.activeSelectedText]}>Auto ({currentAutoRes})</Text>
                  {selectedQuality === 'Auto' && <Text style={{ color: BRAND_RED, fontWeight: 'bold' }}>✓</Text>}
                </TouchableOpacity>

                {['1080p', '720p', '480p', '360p'].map((q) => (
                  <TouchableOpacity key={q} style={styles.drawerSelectableRow} onPress={() => { setSelectedQuality(q); closePanel(); }}>
                    <Text style={[styles.drawerOptionLabel, selectedQuality === q && styles.activeSelectedText]}>{q}</Text>
                    {selectedQuality === q && <Text style={{ color: BRAND_RED, fontWeight: 'bold' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {activeMenu === 'speed' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.panelHeaderRow}>
                  <Text style={styles.panelHeaderTitle}>Playback Speed</Text>
                  <TouchableOpacity onPress={closePanel}><IconClose size={20} color="#888" /></TouchableOpacity>
                </View>
                
                {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                  <TouchableOpacity key={s} style={styles.drawerSelectableRow} onPress={() => { setPlaybackSpeed(s); videoRef.current?.setRateAsync(s, true); closePanel(); }}>
                    <Text style={[styles.drawerOptionLabel, playbackSpeed === s && styles.activeSelectedText]}>{s.toFixed(2)}x</Text>
                    {playbackSpeed === s && <Text style={{ color: BRAND_RED, fontWeight: 'bold' }}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {activeMenu === 'audio' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.panelHeaderRow}>
                  <Text style={styles.panelHeaderTitle}>Audio Tracks</Text>
                  <TouchableOpacity onPress={closePanel}><IconClose size={20} color="#888" /></TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.drawerSelectableRow} onPress={() => closePanel()}>
                  <Text style={[styles.drawerOptionLabel, styles.activeSelectedText]}>Default Audio</Text>
                  <Text style={{ color: BRAND_RED, fontWeight: 'bold' }}>✓</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {activeMenu === 'subs' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.panelHeaderRow}>
                  <Text style={styles.panelHeaderTitle}>Subtitles</Text>
                  <TouchableOpacity onPress={closePanel}><IconClose size={20} color="#888" /></TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.drawerSelectableRow} onPress={() => { setSubtitlesEnabled(!subtitlesEnabled); closePanel(); }}>
                  <Text style={[styles.drawerOptionLabel, !subtitlesEnabled && styles.activeSelectedText]}>Off</Text>
                  {!subtitlesEnabled && <Text style={{ color: BRAND_RED, fontWeight: 'bold' }}>✓</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerSelectableRow} onPress={() => { setSubtitlesEnabled(true); closePanel(); }}>
                  <Text style={[styles.drawerOptionLabel, subtitlesEnabled && styles.activeSelectedText]}>English (Default)</Text>
                  {subtitlesEnabled && <Text style={{ color: BRAND_RED, fontWeight: 'bold' }}>✓</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerOptionRow} onPress={() => setActiveMenu('subStyle')} style={{ marginTop: 20 }}>
                  <Text style={styles.drawerOptionLabel}>Customize Styles</Text>
                  <IconChevronRight size={16} color="#888" />
                </TouchableOpacity>
              </ScrollView>
            )}

            {activeMenu === 'subStyle' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.drawerBackNavRow} onPress={() => setActiveMenu('subs')}>
                  <IconBack size={18} color={BRAND_RED} />
                  <Text style={styles.drawerBackNavText}>Subtitles</Text>
                </TouchableOpacity>
                <Text style={styles.panelHeaderTitle}>Customize Styles</Text>

                <Text style={styles.subStyleSectionLabel}>Font Color</Text>
                <View style={styles.colorPaletteCluster}>
                  {['#FFFFFF', '#F47521', '#FACC15', '#4ADE80'].map(c => (
                    <TouchableOpacity 
                      key={c} 
                      onPress={() => setSubColor(c)} 
                      style={[styles.colorChip, { backgroundColor: c }, subColor === c && styles.colorChipActive]} 
                    />
                  ))}
                </View>

                <Text style={styles.subStyleSectionLabel}>Font Size</Text>
                <View style={styles.choiceGroupRow}>
                  {[14, 16, 20, 24].map(s => (
                    <TouchableOpacity key={s} onPress={() => setSubSize(s)} style={[styles.choicePill, subSize === s && styles.choicePillActive]}>
                      <Text style={[styles.choicePillText, subSize === s && { color: BRAND_RED }]}>{s}px</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.subStyleSectionLabel}>Position Offset</Text>
                <View style={styles.choiceGroupRow}>
                  {[20, 35, 60].map(h => (
                    <TouchableOpacity key={h} onPress={() => setSubHeight(h)} style={[styles.choicePill, subHeight === h && styles.choicePillActive]}>
                      <Text style={[styles.choicePillText, subHeight === h && { color: BRAND_RED }]}>{h}px</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  videoPlayer: { ...StyleSheet.absoluteFillObject },

  loaderContainerFull: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#888', marginTop: 12, fontSize: 12, letterSpacing: 0.5 },
  bufferingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 4 },

  gestureToastContainer: { position: 'absolute', top: 30, alignSelf: 'center', backgroundColor: 'rgba(10,10,10,0.85)', paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', zIndex: 40 },
  gestureToastText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  subtitleContainer: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 9, paddingHorizontal: 30 },
  subtitleText: { fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, maxWidth: '90%', lineHeight: 22 },

  lockedUiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  heroLockBtn: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  unlockHeroText: { color: '#FFF', marginTop: 8, fontSize: 14, fontWeight: 'bold' },

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  
  topBarWrapper: { width: '100%', position: 'absolute', top: 0, paddingBottom: 40 },
  topBarContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 25, paddingTop: 20 },
  topLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  backBtn: { marginRight: 15 },
  titleColumn: { marginLeft: 5, flex: 1, paddingRight: 20 },
  animeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  episodeTitle: { color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', fontSize: 12, fontWeight: '600', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },

  iconBtnWrapper: { padding: 5 },
  hdBtn: { borderStyle: 'solid', borderWidth: 1.5, borderColor: '#FFF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, height: 22, justifyContent: 'center' },
  hdText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  centerControls: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 50 },
  playPauseBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  skipCircleBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },

  skipLeftInd: { position: 'absolute', left: '16%', top: '40%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 20, borderRadius: 50, zIndex: 25 },
  skipRightInd: { position: 'absolute', right: '16%', top: '40%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 20, borderRadius: 50, zIndex: 25 },
  skipText: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 4 },

  skipIntroFloat: { position: 'absolute', bottom: 95, right: 25, zIndex: 30 },
  skipIntroBtnInner: { backgroundColor: 'rgba(20,20,20,0.85)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  skipIntroText: { color: '#FFF', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

  bottomBarWrapper: { width: '100%', position: 'absolute', bottom: 0, paddingHorizontal: 25, paddingBottom: 15, paddingTop: 40 },
  toolsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  toolsGroup: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  speedText: { color: '#FFF', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  progressBarRow: { flexDirection: 'row', alignItems: 'center' },
  timeText: { color: '#FFF', fontSize: 11, fontWeight: '600', fontFamily: 'monospace', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, minWidth: 40, textAlign: 'center' },
  slider: { flex: 1, marginHorizontal: 10, height: 35 },

  sideDrawerSurface: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 340, backgroundColor: '#121212', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 18, zIndex: 50 },
  panelHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  panelHeaderTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  drawerBackNavRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  drawerBackNavText: { color: BRAND_RED, fontSize: 13, fontWeight: '700' },
  drawerOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  drawerOptionLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: '600' },
  drawerSelectableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, backgroundColor: '#1E1E1E', borderRadius: 8, paddingHorizontal: 16, marginBottom: 8 },
  activeSelectedText: { color: '#FFF', fontWeight: 'bold' },

  subStyleSectionLabel: { color: '#777', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  colorPaletteCluster: { flexDirection: 'row', gap: 12 },
  colorChip: { width: 26, height: 26, borderRadius: 13 },
  colorChipActive: { borderWidth: 2, borderColor: '#FFF' },
  choiceGroupRow: { flexDirection: 'row', gap: 8 },
  choicePill: { backgroundColor: 'transparent', borderStyle: 'solid', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  choicePillActive: { borderColor: '#FFF', backgroundColor: '#FFF' },
  choicePillText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },

  errorContainer: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  errorTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  errorSub: { color: BRAND_RED, fontSize: 11, textAlign: 'center', marginBottom: 20 },
  errorBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 6 },
  errorBtnText: { color: '#FFF', fontWeight: 'bold' }
});
