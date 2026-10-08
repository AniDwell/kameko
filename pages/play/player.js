import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  Dimensions, ActivityIndicator, StatusBar, BackHandler,
  TouchableWithoutFeedback, PanResponder
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

// --- PREMIUM SVG ICONS ---
const IconPlay = ({ size = 26, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>
);
const IconPause = ({ size = 26, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Svg>
);
const IconBackward = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></Svg>
);
const IconForward = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></Svg>
);
const IconSettings = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Circle cx="12" cy="12" r="3"/><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></Svg>
);
const IconSubs = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><Path d="M7 15h3m4 0h3M7 9h10"/></Svg>
);
const IconSkip = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M5 4l10 8-10 8V4z"/><Path d="M19 5v14"/></Svg>
);
const IconBack = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><Path d="M19 12H5M12 19l-7-7 7-7"/></Svg>
);

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
  const skipIntroOpacity = useRef(new Animated.Value(0)).current;

  const [status, setStatus] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSkipIndicator, setShowSkipIndicator] = useState(null); 

  // Settings Menus
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

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleClosePlayer);
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false);
      backHandler.remove();
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    };
  }, []);

  const handleClosePlayer = async () => {
    await ScreenOrientation.unlockAsync().catch(() => {});
    navigation.goBack();
    return true;
  };

  // 2. Direct Network Resolution Engine
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
        Animated.timing(skipIntroOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
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
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 15,
      onPanResponderMove: (_, gestureState) => {
        const { moveX, dy } = gestureState;
        const isLeft = moveX < Dimensions.get('window').width / 2;

        if (isLeft) {
          setBrightnessOverlay(prev => {
            let next = prev + (dy * 0.003);
            next = Math.max(0, Math.min(next, 0.85));
            setGestureText(`Brightness ${Math.round((1 - next) * 100)}%`);
            return next;
          });
        } else {
          setVolume(prev => {
            let next = prev - (dy * 0.005);
            next = Math.max(0, Math.min(next, 2.0));
            if (videoRef.current) {
              videoRef.current.setVolumeAsync(Math.min(next, 1.0));
            }
            setGestureText(`Volume ${Math.round(next * 100)}%`);
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        setTimeout(() => setGestureText(null), 1000);
      }
    })
  ).current;

  // 6. UI Auto-Hide Engine
  const resetHideTimer = () => {
    setShowUI(true);
    Animated.timing(uiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    
    hideUITimeout.current = setTimeout(() => {
      if (status.isPlaying && !activeMenu) {
        Animated.timing(uiOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setShowUI(false));
      }
    }, 4500);
  };

  useEffect(() => {
    if (status.isPlaying) resetHideTimer();
    else {
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
      setShowUI(true);
      Animated.timing(uiOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [status.isPlaying, activeMenu]);

  // Double-tap & Tap Overlay
  const handleTouchOverlay = (evt) => {
    if (activeMenu) { 
      setActiveMenu(null); 
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
      resetHideTimer();
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
        <ActivityIndicator size="large" color="#FFFFFF" />
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
        <View style={[styles.subtitleContainer, { bottom: subHeight }]} pointerEvents="none">
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
        <View style={styles.gestureIndicator} pointerEvents="none">
          <Text style={styles.gestureText}>{gestureText}</Text>
        </View>
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
          <IconBackward size={32} color="#FFF" />
          <Text style={styles.skipText}>-10s</Text>
        </View>
      )}
      {showSkipIndicator === 'right' && (
        <View style={styles.skipRightInd} pointerEvents="none">
          <IconForward size={32} color="#FFF" />
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
            <IconForward size={14} color="#000" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* UI OVERLAY LAYER */}
      <Animated.View style={[styles.uiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'auto' : 'none'}>
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClosePlayer} style={styles.backBtn} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <IconBack size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.animeTitle} numberOfLines={1}>{animeTitle}</Text>
            <Text style={styles.episodeTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
          </View>
        </View>

        {/* CENTER CONTROLS */}
        <View style={styles.centerControls} pointerEvents="box-none">
          <TouchableOpacity onPress={seekBackward} style={styles.skipCircleBtn} activeOpacity={0.7}>
            <IconBackward size={28} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
            {status.isPlaying ? <IconPause size={34} color="#FFF" /> : <IconPlay size={34} color="#FFF" />}
          </TouchableOpacity>

          <TouchableOpacity onPress={seekForward} style={styles.skipCircleBtn} activeOpacity={0.7}>
            <IconForward size={28} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* SETTINGS MENUS */}
        {activeMenu === 'main' && (
          <View style={styles.settingsMenu}>
            <Text style={styles.menuHeader}>Settings</Text>
            <TouchableOpacity style={styles.menuRow} onPress={() => setActiveMenu('quality')}>
              <Text style={styles.menuText}>Quality</Text>
              <Text style={styles.menuValue}>
                {selectedQuality === 'Auto' ? `Auto (${currentAutoRes})` : selectedQuality} ›
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => setActiveMenu('subs')}>
              <Text style={styles.menuText}>Subtitles Style</Text>
              <Text style={styles.menuValue}>Customize ›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => {
              const next = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
              setPlaybackSpeed(next);
              videoRef.current?.setRateAsync(next, true);
            }}>
              <Text style={styles.menuText}>Speed</Text>
              <Text style={styles.menuValue}>{playbackSpeed}x</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuRow} onPress={() => setResizeMode(resizeMode === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN)}>
              <Text style={styles.menuText}>Aspect Ratio</Text>
              <Text style={styles.menuValue}>{resizeMode === ResizeMode.CONTAIN ? 'Fit' : 'Fill'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeMenu === 'quality' && (
          <View style={styles.settingsMenu}>
            <TouchableOpacity onPress={() => setActiveMenu('main')} style={{ marginBottom: 12 }}>
              <Text style={styles.backMenuText}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.menuHeader}>Video Quality</Text>
            
            <TouchableOpacity style={styles.menuRow} onPress={() => { setSelectedQuality('Auto'); setActiveMenu(null); }}>
              <Text style={[styles.menuText, selectedQuality === 'Auto' && { color: BRAND_RED, fontWeight: 'bold' }]}>
                Auto ({currentAutoRes})
              </Text>
              {selectedQuality === 'Auto' && <Text style={{ color: BRAND_RED }}>✓</Text>}
            </TouchableOpacity>

            {['1080p', '720p', '480p', '360p'].map((q) => (
              <TouchableOpacity key={q} style={styles.menuRow} onPress={() => { setSelectedQuality(q); setActiveMenu(null); }}>
                <Text style={[styles.menuText, selectedQuality === q && { color: BRAND_RED, fontWeight: 'bold' }]}>{q}</Text>
                {selectedQuality === q && <Text style={{ color: BRAND_RED }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeMenu === 'subs' && (
          <View style={styles.settingsMenu}>
            <TouchableOpacity onPress={() => setActiveMenu('main')} style={{ marginBottom: 12 }}>
              <Text style={styles.backMenuText}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.menuHeader}>Subtitle Styles</Text>

            <Text style={styles.subMenuLabel}>Color</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {['#FFFFFF', '#F47521', '#FACC15', '#4ADE80'].map(c => (
                <TouchableOpacity 
                  key={c} 
                  onPress={() => setSubColor(c)} 
                  style={[styles.colorDot, { backgroundColor: c }, subColor === c && styles.colorDotActive]} 
                />
              ))}
            </View>

            <Text style={styles.subMenuLabel}>Size</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {[14, 16, 20, 24].map(s => (
                <TouchableOpacity key={s} onPress={() => setSubSize(s)} style={[styles.stylePill, subSize === s && styles.stylePillActive]}>
                  <Text style={[styles.stylePillText, subSize === s && { color: BRAND_RED }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subMenuLabel}>Position Offset</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[20, 35, 60].map(h => (
                <TouchableOpacity key={h} onPress={() => setSubHeight(h)} style={[styles.stylePill, subHeight === h && styles.stylePillActive]}>
                  <Text style={[styles.stylePillText, subHeight === h && { color: BRAND_RED }]}>{h}px</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* BOTTOM BAR */}
        <View style={styles.bottomBar}>
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
              <TouchableOpacity onPress={() => setSubtitlesEnabled(!subtitlesEnabled)}>
                <IconSubs size={22} color={subtitlesEnabled ? "#FFF" : "#666"} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
              {introData.end > 0 && (
                <TouchableOpacity 
                  onPress={() => videoRef.current?.setPositionAsync(introData.end * 1000)}
                  style={styles.miniSkipBtn}
                >
                  <Text style={styles.miniSkipText}>Skip Intro</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => {/* Next Ep Hook */}}>
                <IconSkip size={20} color="#FFF" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setActiveMenu(activeMenu ? null : 'main')}>
                <IconSettings size={22} color={activeMenu ? BRAND_RED : "#FFF"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  videoPlayer: { ...StyleSheet.absoluteFillObject },

  loaderContainerFull: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' },
  loaderText: { color: '#888', marginTop: 12, fontSize: 12, letterSpacing: 0.5 },
  bufferingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 4 },

  gestureIndicator: { position: 'absolute', top: 35, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, zIndex: 20 },
  gestureText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },

  subtitleContainer: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 9, paddingHorizontal: 30 },
  subtitleText: { fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.2)' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 25, paddingBottom: 15, width: '100%', backgroundColor: 'rgba(0,0,0,0.65)' },
  backBtn: { marginRight: 18 },
  animeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  episodeTitle: { color: '#AAA', fontSize: 11, fontWeight: '600', marginTop: 2 },

  centerControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40 },
  playPauseBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  skipCircleBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },

  skipLeftInd: { position: 'absolute', left: '16%', top: '44%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 18, borderRadius: 45 },
  skipRightInd: { position: 'absolute', right: '16%', top: '44%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 18, borderRadius: 45 },
  skipText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 4 },

  skipIntroFloat: { position: 'absolute', bottom: 100, right: 30, zIndex: 30 },
  skipIntroBtnInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, gap: 5 },
  skipIntroText: { color: '#000', fontWeight: '900', fontSize: 11, textTransform: 'uppercase' },

  settingsMenu: { position: 'absolute', bottom: 85, right: 25, backgroundColor: 'rgba(18,18,18,0.96)', borderRadius: 12, padding: 18, width: 260, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuHeader: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 12 },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  menuText: { color: '#DDD', fontSize: 13, fontWeight: '600' },
  menuValue: { color: BRAND_RED, fontSize: 12, fontWeight: 'bold' },
  backMenuText: { color: BRAND_RED, fontSize: 13, fontWeight: 'bold' },

  subMenuLabel: { color: '#777', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 6 },
  colorDot: { width: 22, height: 22, borderRadius: 11 },
  colorDotActive: { borderWidth: 2, borderColor: '#FFF' },
  stylePill: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 4 },
  stylePillActive: { borderColor: BRAND_RED, borderWidth: 1 },
  stylePillText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },

  bottomBar: { width: '100%', paddingHorizontal: 25, paddingBottom: 20, paddingTop: 15, backgroundColor: 'rgba(0,0,0,0.75)' },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  timeText: { color: '#FFF', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  slider: { flex: 1, marginHorizontal: 10, height: 35 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },

  miniSkipBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  miniSkipText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  errorContainer: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  errorTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  errorSub: { color: BRAND_RED, fontSize: 11, textAlign: 'center', marginBottom: 20 },
  errorBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 6 },
  errorBtnText: { color: '#FFF', fontWeight: 'bold' }
});
