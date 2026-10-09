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
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

// --- PREMIUM SVG ICONS (Matches Web Player) ---
const IconPlay = ({ size = 68 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M8 5v14l11-7z" /></Svg>);
const IconPause = ({ size = 68 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Svg>);
const IconBackward = ({ size = 44 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" /></Svg>);
const IconForward = ({ size = 44 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" /></Svg>);
const IconBack = ({ size = 24 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M19 12H5M12 19l-7-7 7-7" /></Svg>);
const IconClose = ({ size = 24 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2"><Path d="M18 6L6 18M6 6l12 12" /></Svg>);
const IconSubs = ({ size = 24 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11H9.5v-1.5h-1.5v-2H9.5V10H11v5zm6 0h-1.5v-1.5h-1.5v-2h1.5V10H17v5z" /></Svg>);
const IconAudio = ({ size = 24 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" /></Svg>);
const IconLock = ({ size = 24, locked = false }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={locked ? BRAND_RED : "#FFF"}>{locked ? <Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/> : <Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/>}</Svg>);
const IconScaleFit = ({ size = 24 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/></Svg>);
const IconScaleCrop = ({ size = 24 }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF"><Path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/></Svg>);

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
  
  // UI Animations
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const skipIntroOpacity = useRef(new Animated.Value(0)).current;
  const gestureToastOpacity = useRef(new Animated.Value(0)).current;
  
  // Bottom Sheet Animations
  const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const sheetBackdropOpacity = useRef(new Animated.Value(0)).current;

  const [status, setStatus] = useState({});
  const [showUI, setShowUI] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  
  // Settings / Adjustments
  const scaleModes = [ResizeMode.CONTAIN, ResizeMode.COVER, ResizeMode.STRETCH];
  const [scaleModeIndex, setScaleModeIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSkipIndicator, setShowSkipIndicator] = useState(null); 

  // Bottom Sheets State
  const [activeMenu, setActiveMenu] = useState(null); // 'quality', 'subs', 'audio', 'speed'
  
  // Subtitle Customization
  const [subColor, setSubColor] = useState('#FFFFFF');
  const [subSize, setSubSize] = useState(16);
  const [subHeight, setSubHeight] = useState(10); // Changed default height to sit right above progress bar

  // Network & Stream State
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  // Quality State
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [currentAutoRes, setCurrentAutoRes] = useState('1080p');
  const [qualityList, setQualityList] = useState([]);

  // Audio State
  const [audioTracks, setAudioTracks] = useState(['Default Track']);

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
      if (activeMenu) { closeSheet(); return true; }
      if (isLocked) { setIsLocked(false); showUIControls(); return true; }
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

      if (finalStreamData.intro) setIntroData(finalStreamData.intro);

      const masterUrl = finalStreamData.m3u8;
      const ref = finalStreamData.referer || "https://vidwish.live/";
      
      try {
        const m3Res = await fetch(masterUrl, { headers: { "Referer": ref }});
        const m3Text = await m3Res.text();
        const lines = m3Text.split('\n');
        let qualities = [{ label: 'Auto', uri: masterUrl }];
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('RESOLUTION=')) {
            const resMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
            if (resMatch && lines[i+1]) {
              let streamUri = lines[i+1].trim();
              if (!streamUri.startsWith('http')) {
                const basePath = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
                streamUri = basePath + streamUri;
              }
              qualities.push({ label: `${resMatch[1]}p`, uri: streamUri });
            }
          }
        }
        // Deduplicate qualities just in case
        const uniqueQualities = [];
        const seenLabels = new Set();
        for (const q of qualities) {
            if(!seenLabels.has(q.label)) {
                seenLabels.add(q.label);
                uniqueQualities.push(q);
            }
        }
        setQualityList(uniqueQualities);
      } catch(e) {}

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

  // 5. Swipe Gestures
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 15 && Math.abs(gestureState.dx) < 25,
      onPanResponderMove: (_, gestureState) => {
        if (isLocked) return;
        const { moveX, dy } = gestureState;
        const isLeft = moveX < Dimensions.get('window').width / 2;

        if (isLeft) {
          setBrightnessOverlay(prev => {
            let next = prev + (dy * 0.0035);
            next = Math.max(0, Math.min(next, 0.85));
            setGestureText(`Brightness: ${Math.round((1 - next) * 100)}%`);
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
            setGestureText(`Volume: ${Math.round(next * 100)}%`);
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
  }

  // Web-Style Bottom Sheet Navigation
  const openSheet = (menuName) => {
    setActiveMenu(menuName);
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    Animated.parallel([
      Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }),
      Animated.timing(sheetBackdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, { toValue: SCREEN_HEIGHT, duration: 250, useNativeDriver: true }),
      Animated.timing(sheetBackdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true })
    ]).start(() => {
      setActiveMenu(null);
      resetHideTimer();
    });
  };

  const handleTouchOverlay = (evt) => {
    if (activeMenu) { closeSheet(); return; }
    if (isLocked) { showUIControls(); return; }

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

  const handleSliderChange = async (val) => {
    if (!videoRef.current || !status.isLoaded) return;
    await videoRef.current.setPositionAsync(val);
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

  const activeStreamUrl = qualityList.find(q => q.label === selectedQuality)?.uri || streamData?.m3u8;

  if (loadingStream) {
    return (
      <View style={styles.loaderContainerFull}>
        <View style={styles.loaderRing} />
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
          uri: activeStreamUrl,
          overrideFileExtensionAndroid: 'm3u8',
          headers: {
            "Referer": streamData.referer || "https://vidwish.live/",
            "Origin": streamData.referer ? new URL(streamData.referer).origin : "https://vidwish.live",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
          }
        }}
        useNativeControls={false}
        resizeMode={scaleModes[scaleModeIndex]}
        onPlaybackStatusUpdate={setStatus}
        shouldPlay
      />

      {/* HARDWARE BRIGHTNESS OVERLAY */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${brightnessOverlay})` }]} pointerEvents="none" />

      {/* CUSTOM VTT SUBTITLE DISPLAY (Matches Web Exact Layout) */}
      {subtitlesEnabled && currentSubText !== '' && (
        <View style={[styles.subtitleContainer, { bottom: subHeight + (showUI ? 65 : 0) }]} pointerEvents="none">
          <Text style={[styles.subtitleText, { color: subColor, fontSize: subSize }]}>
            {currentSubText}
          </Text>
        </View>
      )}

      {/* WEB-MATCHING WHITE SPINNER */}
      {(!status.isLoaded || status.isBuffering) && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
           <View style={styles.loaderRing} />
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
      {showSkipIndicator === 'left' && !isLocked && (
        <View style={styles.skipLeftInd} pointerEvents="none">
          <Text style={styles.skipFloatText}>-10s</Text>
          <IconBackward />
        </View>
      )}
      {showSkipIndicator === 'right' && !isLocked && (
        <View style={styles.skipRightInd} pointerEvents="none">
          <IconForward />
          <Text style={styles.skipFloatText}>+10s</Text>
        </View>
      )}

      {/* SKIP INTRO FLOATING BUTTON */}
      {showSkipButton && !isLocked && (
        <Animated.View style={[styles.skipIntroFloat, { opacity: skipIntroOpacity }]}>
          <TouchableOpacity 
            onPress={() => { videoRef.current?.setPositionAsync(introData.end * 1000); setShowSkipButton(false); }} 
            style={styles.skipIntroBtnInner}
            activeOpacity={0.8}
          >
            <Text style={styles.skipIntroText}>Skip Intro</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* UI OVERLAY LAYER (Matches Web UI Layout Exactly) */}
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
                <View style={styles.titleColumn}>
                  <Text style={styles.mainTitle} numberOfLines={1}>{animeTitle || 'Loading...'}</Text>
                  <Text style={styles.subTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
                </View>
              </View>

              <View style={styles.topRightGroup}>
                <TouchableOpacity onPress={() => openSheet('subs')} style={styles.iconBtn}>
                  <IconSubs color={subtitlesEnabled ? "#FFF" : "#777"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openSheet('audio')} style={styles.iconBtn}>
                  <IconAudio />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openSheet('quality')} style={styles.hdBtn}>
                  <Text style={styles.hdBtnText}>HD</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* CENTER CONTROLS */}
        {!isLocked && (
          <View style={styles.centerControls} pointerEvents="box-none">
            <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
              {status.isPlaying ? <IconPause /> : <IconPlay />}
            </TouchableOpacity>
          </View>
        )}

        {/* BOTTOM AREA */}
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
            {/* Tools Row */}
            <View style={styles.bottomToolsRow}>
              <View style={styles.toolsLeft}>
                <TouchableOpacity 
                  onPress={() => { setIsLocked(!isLocked); if(!isLocked){ hideUITimeout.current && clearTimeout(hideUITimeout.current); Animated.timing(uiOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowUI(false)); } }} 
                  style={styles.iconBtn}
                >
                  <IconLock locked={isLocked} />
                </TouchableOpacity>
                
                {!isLocked && (
                  <>
                    <TouchableOpacity onPress={() => setScaleModeIndex((scaleModeIndex + 1) % 3)} style={styles.iconBtn}>
                      {scaleModeIndex === 0 ? <IconScaleFit /> : scaleModeIndex === 1 ? <IconScaleCrop /> : <IconScaleCrop />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openSheet('speed')}>
                      <Text style={styles.speedBtnText}>{playbackSpeed.toFixed(2)}x</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {!isLocked && (
                <View style={styles.toolsRight}>
                  <TouchableOpacity onPress={handleClosePlayer} style={styles.iconBtn}>
                     <IconScaleCrop size={22} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Scrubber Row */}
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
                  onSlidingComplete={handleSliderChange}
                  onSlidingStart={() => { if (hideUITimeout.current) clearTimeout(hideUITimeout.current); }}
                />
                <Text style={styles.timeText}>-{formatTime((status.durationMillis || 0) - (status.positionMillis || 0))}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>

      {/* WEB-MATCHING BOTTOM SHEETS */}
      {activeMenu !== null && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={closeSheet}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'transparent' }]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.bottomSheetSurface, { transform: [{ translateY: sheetTranslateY }] }]}>
            
            {/* QUALITY SHEET */}
            {activeMenu === 'quality' && (
              <View style={styles.sheetContent}>
                <Text style={styles.sheetHeaderTitle}>Video Quality</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity style={[styles.sheetItem, selectedQuality === 'Auto' && styles.sheetItemActive]} onPress={() => { setSelectedQuality('Auto'); closeSheet(); }}>
                    <Text style={[styles.sheetItemText, selectedQuality === 'Auto' && styles.sheetItemTextActive]}>Auto ({currentAutoRes})</Text>
                  </TouchableOpacity>
                  {qualityList.filter(q=>q.label!=='Auto').map((q, i) => (
                    <TouchableOpacity key={i} style={[styles.sheetItem, selectedQuality === q.label && styles.sheetItemActive]} onPress={() => { setSelectedQuality(q.label); closeSheet(); }}>
                      <Text style={[styles.sheetItemText, selectedQuality === q.label && styles.sheetItemTextActive]}>{q.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* AUDIO SHEET */}
            {activeMenu === 'audio' && (
              <View style={styles.sheetContent}>
                <Text style={styles.sheetHeaderTitle}>Audio Tracks</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity style={styles.sheetItemActive}>
                    <Text style={styles.sheetItemTextActive}>Default Audio (Japanese)</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {/* SUBTITLES SHEET */}
            {activeMenu === 'subs' && (
              <View style={styles.sheetContent}>
                <Text style={styles.sheetHeaderTitle}>Subtitles</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity style={[styles.sheetItem, !subtitlesEnabled && styles.sheetItemActive]} onPress={() => { setSubtitlesEnabled(false); closeSheet(); }}>
                    <Text style={[styles.sheetItemText, !subtitlesEnabled && styles.sheetItemTextActive]}>Off</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sheetItem, subtitlesEnabled && styles.sheetItemActive]} onPress={() => { setSubtitlesEnabled(true); closeSheet(); }}>
                    <Text style={[styles.sheetItemText, subtitlesEnabled && styles.sheetItemTextActive]}>English (Default)</Text>
                  </TouchableOpacity>

                  <Text style={styles.subStyleLabel}>Color</Text>
                  <View style={styles.colorPalette}>
                    {['#FFFFFF', '#F47521', '#FACC15', '#4ADE80', '#60A5FA', '#EF4444'].map(c => (
                      <TouchableOpacity key={c} onPress={() => setSubColor(c)} style={[styles.colorChip, { backgroundColor: c }, subColor === c && styles.colorChipActive]} />
                    ))}
                  </View>

                  <Text style={styles.subStyleLabel}>Size</Text>
                  <View style={styles.pillGroup}>
                    {[12, 14, 16, 20].map(s => (
                      <TouchableOpacity key={s} onPress={() => setSubSize(s)} style={[styles.pillBtn, subSize === s && styles.pillBtnActive]}>
                        <Text style={[styles.pillText, subSize === s && styles.pillTextActive]}>{s}px</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* SPEED SHEET */}
            {activeMenu === 'speed' && (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.ssLabel}>Speed</Text>
                  <Text style={styles.ssValText}>{playbackSpeed.toFixed(2)}x</Text>
                </View>
                <Slider
                  style={styles.sheetSlider}
                  minimumValue={0.25}
                  maximumValue={3.0}
                  step={0.05}
                  value={playbackSpeed}
                  minimumTrackTintColor={BRAND_RED}
                  maximumTrackTintColor="rgba(255,255,255,0.15)"
                  thumbTintColor="#FFF"
                  onValueChange={(val) => {
                    setPlaybackSpeed(val);
                    videoRef.current?.setRateAsync(val, true);
                  }}
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10}}>
                  {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(s => (
                    <TouchableOpacity key={s} onPress={() => { setPlaybackSpeed(s); videoRef.current?.setRateAsync(s, true); }} style={[styles.pillBtn, playbackSpeed === s && styles.pillBtnActive]}>
                      <Text style={[styles.pillText, playbackSpeed === s && styles.pillTextActive]}>{s.toFixed(2)}x</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoPlayer: { ...StyleSheet.absoluteFillObject },

  loaderContainerFull: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  bufferingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 4 },
  
  // Custom Dynamic Spinner perfectly matching web loader-ring
  loaderRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.1)',
    borderLeftColor: BRAND_RED,
  },

  gestureToastContainer: { position: 'absolute', top: '20%', alignSelf: 'center', backgroundColor: 'rgba(10,10,10,0.9)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', zIndex: 20 },
  gestureToastText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },

  subtitleContainer: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 9, paddingHorizontal: 30 },
  subtitleText: { fontWeight: '800', textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3, backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0 },

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  
  topBarWrapper: { width: '100%', position: 'absolute', top: 0, height: 150 },
  topBarContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20 },
  topLeftGroup: { flexDirection: 'row', alignItems: 'flex-start' },
  titleColumn: { paddingHorizontal: 8, paddingVertical: 4 },
  mainTitle: { color: '#FFF', fontSize: 18, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  subTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontStyle: 'italic', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, marginTop: 2 },
  
  topRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  iconBtn: { padding: 0, opacity: 0.9 },
  hdBtn: { borderWidth: 1.5, borderColor: '#FFF', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, height: 18, justifyContent: 'center', alignItems: 'center' },
  hdBtnText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  centerControls: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 60 },
  playPauseBtn: { width: 68, height: 68, justifyContent: 'center', alignItems: 'center' },

  skipLeftInd: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', alignItems: 'center', justifyContent: 'center', zIndex: 25 },
  skipRightInd: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', alignItems: 'center', justifyContent: 'center', zIndex: 25 },
  skipFloatText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, position: 'absolute', top: '50%' },

  skipIntroFloat: { position: 'absolute', bottom: 85, right: 24, zIndex: 45 },
  skipIntroBtnInner: { backgroundColor: 'rgba(20, 20, 20, 0.85)', borderColor: 'rgba(255,255,255,0.4)', borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 4 },
  skipIntroText: { color: '#FFF', fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },

  bottomBarWrapper: { width: '100%', position: 'absolute', bottom: 0, height: 150, justifyContent: 'flex-end' },
  bottomContent: { paddingHorizontal: 24, paddingBottom: 20 },
  bottomToolsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 5 },
  toolsLeft: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  toolsRight: { flexDirection: 'row', alignItems: 'center' },
  speedBtnText: { color: '#FFF', fontSize: 14, fontWeight: '500', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  
  progressRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  timeText: { color: '#FFF', fontSize: 13, fontFamily: 'monospace', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, minWidth: 45, textAlign: 'center' },
  slider: { flex: 1, marginHorizontal: 15, height: 28 },

  // WEB-MATCHING BOTTOM SHEETS
  bottomSheetSurface: { position: 'absolute', bottom: 0, alignSelf: 'center', width: '100%', maxWidth: 600, backgroundColor: '#121212', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', zIndex: 60 },
  sheetContent: { width: '100%' },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  sheetHeaderTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  
  sheetItem: { padding: 16, backgroundColor: '#1E1E1E', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  sheetItemActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  sheetItemText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '500' },
  sheetItemTextActive: { color: '#000', fontWeight: 'bold' },

  ssHeaderRow: { flexDirection: 'column', gap: 4 },
  ssLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  ssValText: { fontSize: 20, color: '#FFF', fontWeight: 'bold' },
  sheetSlider: { width: '100%', height: 28, marginVertical: 10 },
  
  pillBtn: { backgroundColor: 'transparent', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  pillBtnActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  pillText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500' },
  pillTextActive: { color: '#000', fontWeight: 'bold' },

  subStyleLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 15, marginBottom: 5 },
  colorPalette: { flexDirection: 'row', gap: 10 },
  colorChip: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorChipActive: { borderColor: '#FFF' },
  pillGroup: { flexDirection: 'row', gap: 10 },

  errorContainer: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  errorTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  errorSub: { color: BRAND_RED, fontSize: 12, textAlign: 'center', marginBottom: 20 },
  errorBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  errorBtnText: { color: '#FFF', fontWeight: 'bold' }
});
