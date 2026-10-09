import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  Dimensions, ActivityIndicator, StatusBar, BackHandler,
  TouchableWithoutFeedback, PanResponder, ScrollView, Platform
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
const IconPlay = ({ size = 32, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>);
const IconPause = ({ size = 32, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Svg>);
const IconBackward = ({ size = 28, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></Svg>);
const IconForward = ({ size = 28, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></Svg>);
const IconBack = ({ size = 28, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><Path d="M19 12H5M12 19l-7-7 7-7"/></Svg>);
const IconClose = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><Path d="M18 6L6 18M6 6l12 12" /></Svg>);
const IconSubs = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 11H9.5v-1.5h-1.5v-2H9.5V10H11v5zm6 0h-1.5v-1.5h-1.5v-2h1.5V10H17v5z"/></Svg>);
const IconAudio = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></Svg>);
const IconLock = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></Svg>);
const IconUnlock = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></Svg>);
const IconSettings = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Circle cx="12" cy="12" r="3"/><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></Svg>);
const IconNextEp = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M5 4l10 8-10 8V4z"/><Path d="M19 5v14"/></Svg>);
const IconBrightness = ({ size = 32, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Circle cx="12" cy="12" r="5"/><Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></Svg>);
const IconVolume = ({ size = 32, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></Svg>);

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
  const nextEpOpacity = useRef(new Animated.Value(0)).current;
  const gestureToastOpacity = useRef(new Animated.Value(0)).current;
  
  // Side Panel Animations
  const panelTranslateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const panelBackdropOpacity = useRef(new Animated.Value(0)).current;

  const [status, setStatus] = useState({});
  const [showUI, setShowUI] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  
  // Settings / Adjustments
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSkipIndicator, setShowSkipIndicator] = useState(null); 

  // Side Panel State
  const [activeMenu, setActiveMenu] = useState(null); // 'main', 'quality', 'subs', 'audio', 'speed', 'aspect'
  
  // Customization
  const [subColor, setSubColor] = useState('#FFFFFF');
  const [subSize, setSubSize] = useState(20);
  const [subHeight, setSubHeight] = useState(40);
  const [subBackground, setSubBackground] = useState(true);

  // Network & Stream State
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  // Quality State
  const [activeUrl, setActiveUrl] = useState(null); 
  const [streamHeaders, setStreamHeaders] = useState({});
  const [qualityList, setQualityList] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [currentAutoRes, setCurrentAutoRes] = useState('');

  // Audio State
  const [audioTracks, setAudioTracks] = useState(['Default Track']);

  // Gestures (Volume / Brightness)
  const [brightnessOverlay, setBrightnessOverlay] = useState(0); 
  const [volume, setVolume] = useState(1.0); 
  const [gestureText, setGestureText] = useState(null);
  const [gestureType, setGestureType] = useState(null);

  // Intro / Outro
  const [introData, setIntroData] = useState({ start: 0, end: 0 });
  const [outroData, setOutroData] = useState({ start: 0, end: 0 });
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [showNextEpCard, setShowNextEpCard] = useState(false);
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
        closeSheet();
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
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false);
      backHandler.remove();
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
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
        setFatalError(`Unable to play this episode.\nAll servers are currently unresponsive for Episode ${episodeNum} (${targetType.toUpperCase()}).`);
        setLoadingStream(false);
        return;
      }

      if (finalStreamData.intro) setIntroData(finalStreamData.intro);
      if (finalStreamData.outro) setOutroData(finalStreamData.outro);
      
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
              const heightStr = `${resMatch[1]}p`;
              qualities.push({ label: heightStr, uri: streamUri });
            }
          }
        }
        
        // Add 144p as fallback visual string if not natively available but keep Auto functionality.
        if (!qualities.find(q => q.label === '144p')) {
           // We just inject visual option, it will fallback to auto if forced.
           qualities.push({ label: '144p', uri: masterUrl });
        }

        // Sort descending
        qualities.sort((a,b) => {
            if (a.label === 'Auto') return -1;
            if (b.label === 'Auto') return 1;
            return parseInt(b.label) - parseInt(a.label);
        });

        setQualityList(qualities);
      } catch(e) {}

      setStreamData(finalStreamData);
      setActiveUrl(masterUrl);
      setStreamHeaders({
        "Referer": ref,
        "Origin": new URL(ref).origin,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
      });
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
    const durationSecs = Math.floor((status.durationMillis || 1) / 1000);

    if (status.naturalSize?.height && selectedQuality === 'Auto') {
      setCurrentAutoRes(`${status.naturalSize.height}p`);
    }

    if (subtitlesEnabled && parsedSubs.length > 0) {
      const activeCue = parsedSubs.find(c => currentMs >= c.startMs && currentMs <= c.endMs);
      if (activeCue && activeCue.text !== currentSubText) setCurrentSubText(activeCue.text);
      else if (!activeCue && currentSubText !== '') setCurrentSubText('');
    } else if (currentSubText !== '') {
      setCurrentSubText('');
    }

    // Intro Logic
    if (introData.end > 0 && currentSecs >= introData.start && currentSecs < introData.end) {
      if (!showSkipButton && !skipTimerRef.current) {
        setShowSkipButton(true);
        Animated.spring(skipIntroOpacity, { toValue: 1, useNativeDriver: true }).start();
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

    // Outro / Next Ep Logic (Show in last 30s or during outro block)
    const inOutro = (outroData.end > 0 && currentSecs >= outroData.start && currentSecs < outroData.end) || 
                    (durationSecs > 60 && currentSecs >= durationSecs - 30);
    
    if (inOutro && !showNextEpCard) {
      setShowNextEpCard(true);
      Animated.spring(nextEpOpacity, { toValue: 1, useNativeDriver: true }).start();
    } else if (!inOutro && showNextEpCard) {
      Animated.timing(nextEpOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowNextEpCard(false);
      });
    }

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
          setGestureType('brightness');
          setBrightnessOverlay(prev => {
            let next = prev + (dy * 0.0035);
            next = Math.max(0, Math.min(next, 0.85));
            setGestureText(`${Math.round((1 - next) * 100)}%`);
            gestureToastOpacity.setValue(1);
            return next;
          });
        } else {
          setGestureType('volume');
          setVolume(prev => {
            let next = prev - (dy * 0.005);
            next = Math.max(0, Math.min(next, 2.0));
            if (videoRef.current) {
              videoRef.current.setVolumeAsync(Math.min(next, 1.0));
            }
            setGestureText(`${Math.round(next * 100)}%`);
            gestureToastOpacity.setValue(1);
            return next;
          });
        }
      },
      onPanResponderRelease: () => {
        Animated.timing(gestureToastOpacity, { toValue: 0, duration: 400, delay: 600, useNativeDriver: true }).start(() => {
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
    }, 4500);
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

  // Side Panel Navigation
  const openSheet = (menuName) => {
    setActiveMenu(menuName);
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    Animated.parallel([
      Animated.spring(panelTranslateX, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
      Animated.timing(panelBackdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
    ]).start();
  };

  const closeSheet = () => {
    Animated.parallel([
      Animated.timing(panelTranslateX, { toValue: SCREEN_WIDTH, duration: 250, useNativeDriver: true }),
      Animated.timing(panelBackdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true })
    ]).start(() => {
      setActiveMenu(null);
      resetHideTimer();
    });
  };

  // Double-tap & Tap Overlay
  const handleTouchOverlay = (evt) => {
    if (activeMenu) { 
      closeSheet();
      return; 
    }
    if (isLocked) {
      showUIControls(); 
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

  const handleSliderChange = async (val) => {
    if (!videoRef.current || !status.isLoaded) return;
    await videoRef.current.setPositionAsync(val);
    resetHideTimer();
  };

  const handleNextEpisode = () => {
    // === UPDATE THIS IF YOUR ROUTING NEEDS DIFFER ===
    closeSheet();
    navigation.replace('Player', {
      animeTitle,
      episodeNum: episodeNum + 1,
      animeId,
      userUid,
      targetType
    });
  };

  const formatTime = (millis) => {
    if (isNaN(millis) || millis < 0) return "00:00";
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
      </View>
    );
  }

  if (fatalError || !streamData) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to play this episode</Text>
        <Text style={styles.errorSub}>{fatalError}</Text>
        <View style={{flexDirection: 'row', gap: 15}}>
           <TouchableOpacity style={styles.errorBtn} onPress={handleClosePlayer}>
             <Text style={styles.errorBtnText}>Go Back</Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Video
        ref={videoRef}
        style={styles.videoPlayer}
        source={{ 
          uri: activeUrl,
          overrideFileExtensionAndroid: 'm3u8',
          headers: streamHeaders
        }}
        useNativeControls={false}
        resizeMode={resizeMode}
        onPlaybackStatusUpdate={setStatus}
        shouldPlay
      />

      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${brightnessOverlay})` }]} pointerEvents="none" />

      {subtitlesEnabled && currentSubText !== '' && (
        <View style={[styles.subtitleContainer, { bottom: subHeight + (showUI ? 60 : 0) }]} pointerEvents="none">
          <Text style={[styles.subtitleText, { color: subColor, fontSize: subSize, backgroundColor: subBackground ? 'rgba(0,0,0,0.6)' : 'transparent' }]}>
            {currentSubText}
          </Text>
        </View>
      )}

      {(!status.isLoaded || (status.isBuffering && status.isPlaying)) && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {gestureText && (
        <Animated.View style={[styles.gestureToastContainer, { opacity: gestureToastOpacity }]} pointerEvents="none">
           {gestureType === 'brightness' ? <IconBrightness size={24} color="#FFF"/> : <IconVolume size={24} color="#FFF"/>}
           <Text style={styles.gestureToastText}>{gestureText}</Text>
        </Animated.View>
      )}

      <View {...panResponder.panHandlers} style={[StyleSheet.absoluteFillObject, { zIndex: 5 }]}>
        <TouchableWithoutFeedback onPress={handleTouchOverlay}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      </View>

      {showSkipIndicator === 'left' && !isLocked && (
        <View style={styles.skipLeftInd} pointerEvents="none">
          <IconBackward size={36} color="#FFF" />
          <Text style={styles.skipText}>-10s</Text>
        </View>
      )}
      {showSkipIndicator === 'right' && !isLocked && (
        <View style={styles.skipRightInd} pointerEvents="none">
          <IconForward size={36} color="#FFF" />
          <Text style={styles.skipText}>+10s</Text>
        </View>
      )}

      {showSkipButton && !isLocked && (
        <Animated.View style={[styles.skipIntroFloat, { opacity: skipIntroOpacity }]}>
          <TouchableOpacity 
            onPress={() => videoRef.current?.setPositionAsync(introData.end * 1000)} 
            style={styles.skipIntroBtnInner}
            activeOpacity={0.8}
          >
            <Text style={styles.skipIntroText}>Skip Intro</Text>
            <IconForward size={16} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {showNextEpCard && !isLocked && (
        <Animated.View style={[styles.nextEpFloat, { opacity: nextEpOpacity }]}>
          <Text style={styles.nextEpLabel}>UP NEXT</Text>
          <Text style={styles.nextEpTitle} numberOfLines={1}>Episode {episodeNum + 1}</Text>
          <View style={styles.nextEpRow}>
             <TouchableOpacity onPress={() => setShowNextEpCard(false)} style={styles.nextEpCancel}><Text style={styles.nextEpCancelText}>Cancel</Text></TouchableOpacity>
             <TouchableOpacity onPress={handleNextEpisode} style={styles.nextEpBtnPrimary}>
               <IconPlay size={16} color="#FFF"/>
               <Text style={styles.nextEpPrimaryText}>Play Next</Text>
             </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <Animated.View style={[styles.uiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'box-none' : 'none'}>
        
        {!isLocked && (
          <View style={styles.topBarWrapper}>
            <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Defs><LinearGradient id="topCinematic" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#000000" stopOpacity="0.85" /><Stop offset="1" stopColor="#000000" stopOpacity="0" /></LinearGradient></Defs>
              <Rect width="100%" height="100%" fill="url(#topCinematic)" />
            </Svg>

            <View style={styles.topBarContent}>
              <View style={styles.topLeftGroup}>
                <TouchableOpacity onPress={handleClosePlayer} style={styles.iconBtn} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                  <IconBack size={28} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.titleColumn}>
                  <Text style={styles.mainTitle} numberOfLines={1}>{animeTitle}</Text>
                  <Text style={styles.subTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
                </View>
              </View>
              
              {/* Optional Lock Button Top Right */}
              <TouchableOpacity onPress={() => setIsLocked(true)} style={styles.iconBtn}>
                  <IconUnlock size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!isLocked && (
          <View style={styles.centerControls} pointerEvents="box-none">
            <TouchableOpacity onPress={seekBackward} style={styles.iconBtnCenter} activeOpacity={0.7}>
              <IconBackward size={48} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
              {status.isPlaying ? <IconPause size={56} color="#FFF" /> : <IconPlay size={56} color="#FFF" />}
            </TouchableOpacity>
            <TouchableOpacity onPress={seekForward} style={styles.iconBtnCenter} activeOpacity={0.7}>
              <IconForward size={48} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
        
        {isLocked && (
           <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
              <TouchableOpacity onPress={() => setIsLocked(false)} style={styles.unlockCenterBtn}>
                  <IconLock size={32} color="#FFF" />
                  <Text style={styles.unlockText}>Tap to Unlock</Text>
              </TouchableOpacity>
           </View>
        )}

        {!isLocked && (
          <View style={styles.bottomBarWrapper}>
            <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <Defs><LinearGradient id="botCinematic" x1="0" y1="1" x2="0" y2="0"><Stop offset="0" stopColor="#000000" stopOpacity="0.95" /><Stop offset="1" stopColor="#000000" stopOpacity="0" /></LinearGradient></Defs>
              <Rect width="100%" height="100%" fill="url(#botCinematic)" />
            </Svg>

            <View style={styles.bottomContent}>
              <View style={styles.progressRow}>
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

              <View style={styles.bottomToolsRow}>
                <View style={styles.toolsLeft}>
                   <TouchableOpacity onPress={togglePlayPause} style={styles.iconBtn}>{status.isPlaying ? <IconPause size={24} color="#FFF"/> : <IconPlay size={24} color="#FFF"/>}</TouchableOpacity>
                </View>
                <View style={styles.toolsRight}>
                    <TouchableOpacity onPress={() => openSheet('speed')} style={styles.iconBtn}><Text style={styles.speedBtnText}>{playbackSpeed}x</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => openSheet('audio')} style={styles.iconBtn}><IconAudio size={24} color="#FFF" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => openSheet('subs')} style={styles.iconBtn}><IconSubs size={24} color={subtitlesEnabled ? "#FFF" : "#777"} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => openSheet('main')} style={styles.iconBtn}><IconSettings size={24} color="#FFF" /></TouchableOpacity>
                    <TouchableOpacity onPress={handleNextEpisode} style={styles.iconBtn}><IconNextEp size={24} color="#FFF" /></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
      </Animated.View>

      {/* RIGHT SIDE SETTINGS PANEL (Netflix Style) */}
      {activeMenu !== null && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={closeSheet}>
            <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: panelBackdropOpacity }]} />
          </TouchableWithoutFeedback>

          <Animated.View style={[styles.sidePanelSurface, { transform: [{ translateX: panelTranslateX }] }]}>
            
            {activeMenu === 'main' && (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetHeaderTitle}>Settings</Text>
                  <TouchableOpacity onPress={closeSheet}><IconClose size={24} color="#FFF" /></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity style={styles.panelRow} onPress={() => setActiveMenu('quality')}>
                    <Text style={styles.panelText}>Quality</Text><Text style={styles.panelValue}>{selectedQuality === 'Auto' ? `Auto (${currentAutoRes})` : selectedQuality} ›</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.panelRow} onPress={() => setActiveMenu('aspect')}>
                    <Text style={styles.panelText}>Aspect Ratio</Text><Text style={styles.panelValue}>{resizeMode === ResizeMode.CONTAIN ? 'Fit' : resizeMode === ResizeMode.COVER ? 'Fill' : 'Stretch'} ›</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.panelRow} onPress={() => setActiveMenu('audio')}>
                    <Text style={styles.panelText}>Audio</Text><Text style={styles.panelValue}>{audioTracks[0]} ›</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.panelRow} onPress={() => setActiveMenu('subs')}>
                    <Text style={styles.panelText}>Subtitles</Text><Text style={styles.panelValue}>{subtitlesEnabled ? 'English' : 'Off'} ›</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            )}

            {activeMenu === 'quality' && (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeaderRow}>
                  <TouchableOpacity onPress={() => setActiveMenu('main')}><IconBack size={24} color="#FFF" /></TouchableOpacity>
                  <Text style={styles.sheetHeaderTitle}>Video Quality</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {qualityList.map((q) => (
                    <TouchableOpacity key={q.label} style={[styles.panelRow, selectedQuality === q.label && styles.panelRowActive]} onPress={() => { setSelectedQuality(q.label); setActiveUrl(q.uri); closeSheet(); }}>
                      <Text style={[styles.panelText, selectedQuality === q.label && {color: BRAND_RED, fontWeight:'bold'}]}>{q.label === 'Auto' ? `Auto (${currentAutoRes})` : q.label}</Text>
                      {selectedQuality === q.label && <Text style={{color: BRAND_RED}}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeMenu === 'aspect' && (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeaderRow}>
                  <TouchableOpacity onPress={() => setActiveMenu('main')}><IconBack size={24} color="#FFF" /></TouchableOpacity>
                  <Text style={styles.sheetHeaderTitle}>Aspect Ratio</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {[{l:'Fit to Screen', v:ResizeMode.CONTAIN}, {l:'Crop to Fill', v:ResizeMode.COVER}, {l:'Stretch', v:ResizeMode.STRETCH}].map((r) => (
                    <TouchableOpacity key={r.l} style={[styles.panelRow, resizeMode === r.v && styles.panelRowActive]} onPress={() => { setResizeMode(r.v); closeSheet(); }}>
                      <Text style={[styles.panelText, resizeMode === r.v && {color: BRAND_RED, fontWeight:'bold'}]}>{r.l}</Text>
                      {resizeMode === r.v && <Text style={{color: BRAND_RED}}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeMenu === 'audio' && (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeaderRow}>
                   <TouchableOpacity onPress={() => setActiveMenu('main')}><IconBack size={24} color="#FFF" /></TouchableOpacity>
                   <Text style={styles.sheetHeaderTitle}>Audio Tracks</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {audioTracks.map((a, i) => (
                    <TouchableOpacity key={i} style={[styles.panelRow, styles.panelRowActive]}>
                      <Text style={[styles.panelText, {color: BRAND_RED, fontWeight:'bold'}]}>{a}</Text>
                      <Text style={{color: BRAND_RED}}>✓</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeMenu === 'speed' && (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeaderRow}>
                  <Text style={styles.sheetHeaderTitle}>Playback Speed</Text>
                  <TouchableOpacity onPress={closeSheet}><IconClose size={24} color="#FFF" /></TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                    <TouchableOpacity key={s} style={[styles.panelRow, playbackSpeed === s && styles.panelRowActive]} onPress={() => { setPlaybackSpeed(s); videoRef.current?.setRateAsync(s, true); closeSheet(); }}>
                      <Text style={[styles.panelText, playbackSpeed === s && {color: BRAND_RED, fontWeight:'bold'}]}>{s === 1.0 ? 'Normal' : `${s}x`}</Text>
                      {playbackSpeed === s && <Text style={{color: BRAND_RED}}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {activeMenu === 'subs' && (
              <View style={styles.sheetContent}>
                <View style={styles.sheetHeaderRow}>
                  <TouchableOpacity onPress={() => setActiveMenu('main')}><IconBack size={24} color="#FFF" /></TouchableOpacity>
                  <Text style={styles.sheetHeaderTitle}>Subtitles</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  <TouchableOpacity style={[styles.panelRow, !subtitlesEnabled && styles.panelRowActive]} onPress={() => { setSubtitlesEnabled(false); }}>
                    <Text style={[styles.panelText, !subtitlesEnabled && {color: BRAND_RED, fontWeight:'bold'}]}>Off</Text>
                    {!subtitlesEnabled && <Text style={{color: BRAND_RED}}>✓</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.panelRow, subtitlesEnabled && styles.panelRowActive]} onPress={() => { setSubtitlesEnabled(true); }}>
                    <Text style={[styles.panelText, subtitlesEnabled && {color: BRAND_RED, fontWeight:'bold'}]}>English</Text>
                    {subtitlesEnabled && <Text style={{color: BRAND_RED}}>✓</Text>}
                  </TouchableOpacity>
                  
                  <View style={{height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15}} />
                  <Text style={styles.subStyleLabel}>Color</Text>
                  <View style={styles.colorPalette}>
                    {['#FFFFFF', '#F47521', '#FACC15', '#4ADE80'].map(c => (
                      <TouchableOpacity key={c} onPress={() => setSubColor(c)} style={[styles.colorChip, { backgroundColor: c }, subColor === c && styles.colorChipActive]} />
                    ))}
                  </View>

                  <Text style={styles.subStyleLabel}>Size & Background</Text>
                  <View style={styles.pillGroup}>
                    {[16, 20, 24, 28].map(s => (
                      <TouchableOpacity key={s} onPress={() => setSubSize(s)} style={[styles.pillBtn, subSize === s && styles.pillBtnActive]}>
                        <Text style={[styles.pillText, subSize === s && styles.pillTextActive]}>{s}px</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => setSubBackground(!subBackground)} style={[styles.pillBtn, subBackground && styles.pillBtnActive]}>
                      <Text style={[styles.pillText, subBackground && styles.pillTextActive]}>BG</Text>
                    </TouchableOpacity>
                  </View>
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

  gestureToastContainer: { position: 'absolute', top: 35, alignSelf: 'center', backgroundColor: 'rgba(10,10,10,0.85)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', zIndex: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  gestureToastText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  subtitleContainer: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 9, paddingHorizontal: 30 },
  subtitleText: { fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 4, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6, maxWidth: '90%', lineHeight: 30 },

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  
  topBarWrapper: { width: '100%', position: 'absolute', top: 0, height: 130 },
  topBarContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 35, paddingTop: 30 },
  topLeftGroup: { flexDirection: 'row', alignItems: 'center' },
  titleColumn: { marginLeft: 15 },
  mainTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.3, textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  subTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', marginTop: 3 },
  iconBtn: { padding: 8 },

  centerControls: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 60 },
  playPauseBtn: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  iconBtnCenter: { padding: 15 },
  
  unlockCenterBtn: { flexDirection: 'column', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  unlockText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 8 },

  skipLeftInd: { position: 'absolute', left: '15%', top: '42%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 25, borderRadius: 50, zIndex: 25 },
  skipRightInd: { position: 'absolute', right: '15%', top: '42%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 25, borderRadius: 50, zIndex: 25 },
  skipText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginTop: 6 },

  skipIntroFloat: { position: 'absolute', bottom: 110, right: 35, zIndex: 30 },
  skipIntroBtnInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, gap: 8 },
  skipIntroText: { color: '#000', fontWeight: '900', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },

  nextEpFloat: { position: 'absolute', bottom: 100, right: 35, zIndex: 30, backgroundColor: 'rgba(20,20,20,0.95)', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', minWidth: 220 },
  nextEpLabel: { color: '#AAA', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 },
  nextEpTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 15 },
  nextEpRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, alignItems: 'center' },
  nextEpCancel: { padding: 5 },
  nextEpCancelText: { color: '#AAA', fontSize: 13, fontWeight: 'bold' },
  nextEpBtnPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: BRAND_RED, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 4, gap: 5 },
  nextEpPrimaryText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },

  bottomBarWrapper: { width: '100%', position: 'absolute', bottom: 0, height: 140, justifyContent: 'flex-end' },
  bottomContent: { paddingHorizontal: 35, paddingBottom: 25 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  timeText: { color: '#FFF', fontSize: 13, fontFamily: 'monospace', textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2, minWidth: 45, textAlign: 'center' },
  slider: { flex: 1, marginHorizontal: 15, height: 40 },
  bottomToolsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toolsLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  toolsRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  speedBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800', paddingHorizontal: 5 },

  sidePanelSurface: { position: 'absolute', top: 0, bottom: 0, right: 0, width: Math.min(SCREEN_WIDTH * 0.45, 380), backgroundColor: 'rgba(15,15,15,0.96)', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 25, paddingTop: 30, paddingBottom: 20, zIndex: 60 },
  sheetContent: { flex: 1 },
  sheetHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  sheetHeaderTitle: { color: '#FFF', fontSize: 20, fontWeight: '900' },
  
  panelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  panelRowActive: { backgroundColor: 'rgba(255,255,255,0.03)' },
  panelText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  panelValue: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 'bold' },

  subStyleLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 10 },
  colorPalette: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  colorChip: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: 'transparent' },
  colorChipActive: { borderColor: '#FFF' },
  pillGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  pillBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 },
  pillBtnActive: { backgroundColor: '#FFF' },
  pillText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  pillTextActive: { color: '#000' },

  errorContainer: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  errorTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  errorSub: { color: BRAND_RED, fontSize: 13, textAlign: 'center', marginBottom: 25, lineHeight: 20 },
  errorBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  errorBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 }
});
