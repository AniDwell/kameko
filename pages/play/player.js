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
const IconSettings = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Circle cx="12" cy="12" r="3"/><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></Svg>);
const IconSubs = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><Path d="M7 15h3m4 0h3M7 9h10"/></Svg>);
const IconSkip = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M5 4l10 8-10 8V4z"/><Path d="M19 5v14"/></Svg>);
const IconBack = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><Path d="M19 12H5M12 19l-7-7 7-7"/></Svg>);
const IconChevronRight = ({ size = 16, color = "#888" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><Path d="M9 18l6-6-6-6" /></Svg>);
const IconClose = ({ size = 20, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><Path d="M18 6L6 18M6 6l12 12" /></Svg>);

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

  // Settings Menus & Side Drawers
  const [activeMenu, setActiveMenu] = useState(null); // 'main', 'quality', 'subs'
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
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (_) {}
      StatusBar.setHidden(true);
    }
    lockOrientation();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeMenu) {
        if (activeMenu === 'quality' || activeMenu === 'subs') openPanel('main');
        else closePanel();
        return true;
      }
      handleClosePlayer();
      return true;
    });

    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false);
      backHandler.remove();
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    };
  }, [activeMenu]);

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

  // 4. Playback Tick (Subtitle sync, Auto Skip Intro, Progress)
  useEffect(() => {
    if (!status.isLoaded) return;
    const currentMs = status.positionMillis || 0;
    const currentSecs = Math.floor(currentMs / 1000);

    // Auto resolution badge detection
    if (status.naturalSize?.height) {
      setCurrentAutoRes(`${status.naturalSize.height}p`);
    }

    // Subtitle sync
    if (subtitlesEnabled && parsedSubs.length > 0) {
      const activeCue = parsedSubs.find(c => currentMs >= c.startMs && currentMs <= c.endMs);
      if (activeCue && activeCue.text !== currentSubText) setCurrentSubText(activeCue.text);
      else if (!activeCue && currentSubText !== '') setCurrentSubText('');
    } else if (currentSubText !== '') {
      setCurrentSubText('');
    }

    // Skip intro timer logic
    if (introData.end > 0 && currentSecs >= introData.start && currentSecs < introData.end) {
      if (!showSkipButton && !skipTimerRef.current) {
        setShowSkipButton(true);
        Animated.spring(skipIntroOpacity, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }).start();
        skipTimerRef.current = setTimeout(() => {
          Animated.timing(skipIntroOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
            setShowSkipButton(false);
          });
        }, 6000);
      }
    } else if (showSkipButton) {
      Animated.timing(skipIntroOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowSkipButton(false);
      });
      if (skipTimerRef.current) {
        clearTimeout(skipTimerRef.current);
        skipTimerRef.current = null;
      }
    }

    // Firestore Progress Sync
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

  // 5. Swipe Gestures (Brightness on Left, Volume on Right)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 15 && Math.abs(gestureState.dx) < 25,
      onPanResponderMove: (_, gestureState) => {
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
            if (videoRef.current) {
              videoRef.current.setVolumeAsync(Math.min(next, 1.0));
            }
            setGestureText(`🔊 Volume ${Math.round(next * 100)}%`);
            gestureToastOpacity.setValue(1);
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        Animated.timing(gestureToastOpacity, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }).start(() => {
          setGestureText(null);
        });
      }
    })
  ).current;

  // 6. UI Auto-Hide Engine
  const resetHideTimer = useCallback(() => {
    if (activeMenu) return; // Don't hide if menu is open
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

  // Drawer Panel Navigation
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

  // Double-tap & Tap Overlay
  const handleTouchOverlay = (evt) => {
    if (activeMenu) { 
      closePanel();
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

  // Playback Operations
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

  const handleSliderChange = async (val) => {
    if (!videoRef.current || !status.isLoaded) return;
    await videoRef.current.setPositionAsync(val);
    resetHideTimer();
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
      <View 
        style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${brightnessOverlay})` }]} 
        pointerEvents="none" 
      />

      {/* CUSTOM VTT SUBTITLE DISPLAY */}
      {subtitlesEnabled && currentSubText !== '' && (
        <View style={[styles.subtitleContainer, { bottom: subHeight + (showUI ? 65 : 0) }]} pointerEvents="none">
          <Text style={[styles.subtitleText, { color: subColor, fontSize: subSize }]}>
            {currentSubText}
          </Text>
        </View>
      )}

      {/* DYNAMIC WHITE BUFFERING SPINNER */}
      {(!status.isLoaded || status.isBuffering) && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
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
        <View style={styles.skipLeftInd} pointerEvents="none">
          <IconBackward size={36} color="#FFF" />
          <Text style={styles.skipText}>-10s</Text>
        </View>
      )}
      {showSkipIndicator === 'right' && (
        <View style={styles.skipRightInd} pointerEvents="none">
          <IconForward size={36} color="#FFF" />
          <Text style={styles.skipText}>+10s</Text>
        </View>
      )}

      {/* DYNAMIC SKIP INTRO FLOATING BUTTON */}
      {showSkipButton && (
        <Animated.View style={[styles.skipIntroFloat, { opacity: skipIntroOpacity }]}>
          <TouchableOpacity 
            onPress={() => videoRef.current?.setPositionAsync(introData.end * 1000)} 
            style={styles.skipIntroBtnInner}
            activeOpacity={0.8}
          >
            <Text style={styles.skipIntroText}>Skip Intro</Text>
            <IconForward size={14} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* UI OVERLAY LAYER */}
      <Animated.View style={[styles.uiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'box-none' : 'none'}>
        
        {/* TOP BAR WITH CINEMATIC GRADIENT */}
        <View style={styles.topBarWrapper}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Defs>
              <LinearGradient id="topCinematic" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.95" />
                <Stop offset="0.65" stopColor="#000000" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#topCinematic)" />
          </Svg>

          <View style={styles.topBarContent}>
            <TouchableOpacity onPress={handleClosePlayer} style={styles.backBtn} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
              <IconBack size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.titleColumn}>
              <Text style={styles.animeTitle} numberOfLines={1}>{animeTitle}</Text>
              <Text style={styles.episodeTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
            </View>
          </View>
        </View>

        {/* CENTER CONTROLS */}
        <View style={styles.centerControls} pointerEvents="box-none">
          <TouchableOpacity onPress={seekBackward} style={styles.skipCircleBtn} activeOpacity={0.7}>
            <IconBackward size={28} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
            {status.isPlaying ? <IconPause size={38} color="#FFF" /> : <IconPlay size={38} color="#FFF" />}
          </TouchableOpacity>

          <TouchableOpacity onPress={seekForward} style={styles.skipCircleBtn} activeOpacity={0.7}>
            <IconForward size={28} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* BOTTOM BAR WITH CINEMATIC GRADIENT */}
        <View style={styles.bottomBarWrapper}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Defs>
              <LinearGradient id="botCinematic" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.95" />
                <Stop offset="0.75" stopColor="#000000" stopOpacity="0.6" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#botCinematic)" />
          </Svg>

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
            <Text style={styles.timeText}>{formatTime(status.durationMillis || 0)}</Text>
          </View>

          <View style={styles.actionRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <TouchableOpacity onPress={() => setSubtitlesEnabled(!subtitlesEnabled)} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <IconSubs size={22} color={subtitlesEnabled ? "#FFF" : "#555"} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
              <TouchableOpacity onPress={() => {/* Next Ep Hook */}} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <IconSkip size={20} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => openPanel('main')} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <IconSettings size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* SIDE DRAWER PANELS (SETTINGS / QUALITY / SUBS) */}
      {activeMenu !== null && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          {/* Dismiss Backdrop */}
          <TouchableWithoutFeedback onPress={closePanel}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: panelBackdropOpacity }]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.sideDrawerSurface, { transform: [{ translateX: panelTranslateX }] }]}>
            
            {activeMenu === 'main' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.panelHeaderRow}>
                  <Text style={styles.panelHeaderTitle}>Settings</Text>
                  <TouchableOpacity onPress={closePanel}>
                    <IconClose size={20} color="#888" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.drawerOptionRow} onPress={() => openPanel('quality')}>
                  <Text style={styles.drawerOptionLabel}>Quality</Text>
                  <View style={styles.subRouteIndicator}>
                    <Text style={styles.drawerOptionValue}>{selectedQuality === 'Auto' ? `Auto (${currentAutoRes})` : selectedQuality}</Text>
                    <IconChevronRight size={16} color="#888" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerOptionRow} onPress={() => openPanel('subs')}>
                  <Text style={styles.drawerOptionLabel}>Subtitles Style</Text>
                  <View style={styles.subRouteIndicator}>
                    <Text style={styles.drawerOptionValue}>Customize</Text>
                    <IconChevronRight size={16} color="#888" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerOptionRow} onPress={() => {
                  const next = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
                  setPlaybackSpeed(next);
                  videoRef.current?.setRateAsync(next, true);
                }}>
                  <Text style={styles.drawerOptionLabel}>Playback Speed</Text>
                  <Text style={styles.drawerOptionValue}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerOptionRow} onPress={() => setResizeMode(resizeMode === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN)}>
                  <Text style={styles.drawerOptionLabel}>Aspect Ratio</Text>
                  <Text style={styles.drawerOptionValue}>{resizeMode === ResizeMode.CONTAIN ? 'Fit to Screen' : 'Fill Screen'}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {activeMenu === 'quality' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.drawerBackNavRow} onPress={() => openPanel('main')}>
                  <IconBack size={18} color={BRAND_RED} />
                  <Text style={styles.drawerBackNavText}>Settings</Text>
                </TouchableOpacity>
                <Text style={styles.panelHeaderTitle}>Video Quality</Text>

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

            {activeMenu === 'subs' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.drawerBackNavRow} onPress={() => openPanel('main')}>
                  <IconBack size={18} color={BRAND_RED} />
                  <Text style={styles.drawerBackNavText}>Settings</Text>
                </TouchableOpacity>
                <Text style={styles.panelHeaderTitle}>Subtitle Styles</Text>

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

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  
  topBarWrapper: { width: '100%', paddingTop: 20, paddingBottom: 35, paddingHorizontal: 25, position: 'absolute', top: 0 },
  topBarContent: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: 15 },
  titleColumn: { marginLeft: 10, flex: 1 },
  animeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  episodeTitle: { color: '#AAA', fontSize: 11, fontWeight: '600', marginTop: 2 },

  centerControls: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 50 },
  playPauseBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' },
  skipCircleBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

  skipLeftInd: { position: 'absolute', left: '16%', top: '40%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 20, borderRadius: 50, zIndex: 25 },
  skipRightInd: { position: 'absolute', right: '16%', top: '40%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 20, borderRadius: 50, zIndex: 25 },
  skipText: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 4 },

  skipIntroFloat: { position: 'absolute', bottom: 100, right: 30, zIndex: 30 },
  skipIntroBtnInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,15,15,0.92)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', gap: 8 },
  skipIntroText: { color: '#FFF', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },

  bottomBarWrapper: { width: '100%', position: 'absolute', bottom: 0, paddingHorizontal: 25, paddingBottom: 15, paddingTop: 35 },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  timeText: { color: '#DDD', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  slider: { flex: 1, marginHorizontal: 10, height: 38 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  sideDrawerSurface: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 340, backgroundColor: '#0F0F0F', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 18, zIndex: 50 },
  panelHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  panelHeaderTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  drawerBackNavRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  drawerBackNavText: { color: BRAND_RED, fontSize: 13, fontWeight: '700' },
  drawerOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  drawerOptionLabel: { color: '#EEE', fontSize: 13, fontWeight: '600' },
  drawerOptionValue: { color: '#AAA', fontSize: 12, fontWeight: '600' },
  subRouteIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  drawerSelectableRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  activeSelectedText: { color: BRAND_RED, fontWeight: '800' },

  subStyleSectionLabel: { color: '#777', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  colorPaletteCluster: { flexDirection: 'row', gap: 12 },
  colorChip: { width: 26, height: 26, borderRadius: 13 },
  colorChipActive: { borderWidth: 2, borderColor: '#FFF' },
  choiceGroupRow: { flexDirection: 'row', gap: 8 },
  choicePill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5 },
  choicePillActive: { borderWidth: 1, borderColor: BRAND_RED },
  choicePillText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  errorContainer: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  errorTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  errorSub: { color: BRAND_RED, fontSize: 11, textAlign: 'center', marginBottom: 20 },
  errorBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 6 },
  errorBtnText: { color: '#FFF', fontWeight: 'bold' }
});
