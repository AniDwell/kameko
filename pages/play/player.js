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
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';
const CUSTOM_PROXY_URL = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url=';

// --- PREMIUM SVG ICONS ---
const IconPlay = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>);
const IconPause = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Svg>);
const IconBackward = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></Svg>);
const IconForward = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></Svg>);
const IconSettings = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Circle cx="12" cy="12" r="3"/><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></Svg>);
const IconSubs = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Rect x="3" y="5" width="18" height="14" rx="2" ry="2"/><Path d="M7 15h3m4 0h3M7 9h10"/></Svg>);
const IconAudio = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M3 18v-6a9 9 0 0118 0v6"/><Path d="M21 19a2 2 0 01-2 2h-1v-6h3v4zM3 19a2 2 0 002 2h1v-6H3v4z"/></Svg>);
const IconSkip = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M5 4l10 8-10 8V4z"/><Path d="M19 5v14"/></Svg>);
const IconBack = ({ size=24, color="#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M19 12H5M12 19l-7-7 7-7"/></Svg>);

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
  const [activeMenu, setActiveMenu] = useState(null); // 'main', 'quality', 'subs', 'audio'
  const [subColor, setSubColor] = useState('#FFFFFF');
  const [subSize, setSubSize] = useState(16);
  const [subHeight, setSubHeight] = useState(40);

  // Network & Stream State
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [activeUrl, setActiveUrl] = useState(null);
  const [qualityList, setQualityList] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [audioTracks, setAudioTracks] = useState(['Default Track']);

  // Swipe Gestures
  const [brightnessOverlay, setBrightnessOverlay] = useState(0); // 0 (bright) to 0.8 (dark)
  const [volume, setVolume] = useState(1.0); // 0.0 to 2.0 (Simulated 200%)
  const [gestureText, setGestureText] = useState(null);

  // Intro / Outro
  const [introData, setIntroData] = useState({ start: 0, end: 0 });
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [skipDismissed, setSkipDismissed] = useState(false);
  const skipTimer = useRef(null);

  // Subtitles
  const [parsedSubs, setParsedSubs] = useState([]);
  const [currentSubText, setCurrentSubText] = useState('');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const hideUITimeout = useRef(null);
  const lastTapRef = useRef(0);

  // 1. Force Landscape & Initialization
  useEffect(() => {
    async function lockScreen() {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      StatusBar.setHidden(true);
    }
    lockScreen();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleClosePlayer);
    return () => {
      ScreenOrientation.unlockAsync();
      StatusBar.setHidden(false);
      backHandler.remove();
    };
  }, []);

  const handleClosePlayer = async () => {
    await ScreenOrientation.unlockAsync();
    navigation.goBack();
    return true;
  };

  // 2. Silent Background Server Resolution & M3U8 Quality Parsing
  useEffect(() => {
    let isMounted = true;

    const resolveStream = async () => {
      let typeServers = ['hd-1', 'hd-2', 'vidstream-2'];
      try {
        const srvRes = await fetch(`${VERCEL_API_BASE}/api/servers?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}`);
        const srvJson = await srvRes.json();
        if (srvJson.success && srvJson.data) {
          const filtered = srvJson.data.filter(s => s.type === targetType).map(s => s.serverName);
          if (filtered.length > 0) typeServers = filtered;
        }
      } catch(e) {}

      let finalData = null;
      for (const srv of typeServers) {
        try {
          const url = `${VERCEL_API_BASE}/api/stream?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}&server=${srv}&type=${type}`;
          const res = await fetch(url);
          const json = await res.json();
          if (json.success && json.data?.m3u8) {
            finalData = json.data;
            break;
          }
        } catch (err) {}
      }

      if (!isMounted || !finalData) return;

      if (finalData.intro) setIntroData(finalData.intro);
      
      const masterUrl = finalData.m3u8;
      const ref = finalData.referer || "https://vidwish.live/";
      
      // Parse M3U8 for Qualities
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
        setQualityList(qualities);
      } catch(e) {}

      setStreamData(finalData);
      setActiveUrl(`${CUSTOM_PROXY_URL}${encodeURIComponent(masterUrl)}&referer=${encodeURIComponent(ref)}`);
      setLoadingStream(false);
    };

    resolveStream();
    return () => { isMounted = false; };
  }, [animeId, episodeNum, targetType]);

  // 3. Subtitle Engine
  useEffect(() => {
    if (!streamData || !streamData.subtitles || streamData.subtitles.length === 0) return;
    const loadSubtitles = async () => {
      try {
        const response = await fetch(streamData.subtitles[0].file);
        const vttText = await response.text();
        const cues = [];
        const blocks = vttText.split(/\r?\n\r?\n/);
        for (const block of blocks) {
          const lines = block.split(/\r?\n/);
          const timeLine = lines.find(l => l.includes('-->'));
          if (!timeLine) continue;
          const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
          const parseTime = (ts) => {
            const parts = ts.split(':'); let s = 0;
            if(parts.length === 3) s = parseInt(parts[0])*3600 + parseInt(parts[1])*60 + parseFloat(parts[2].replace(',', '.'));
            else s = parseInt(parts[0])*60 + parseFloat(parts[1].replace(',', '.'));
            return s * 1000;
          };
          const cleanText = lines.slice(lines.indexOf(timeLine) + 1).filter(l => !l.startsWith('WEBVTT') && l.trim() !== '').join('\n').replace(/<[^>]+>/g, ''); 
          cues.push({ startMs: parseTime(startStr), endMs: parseTime(endStr), text: cleanText });
        }
        setParsedSubs(cues);
      } catch (err) {}
    };
    loadSubtitles();
  }, [streamData]);

  // 4. Playback Tick (Subs, Intro, Progress)
  useEffect(() => {
    if (!status.isLoaded) return;
    const currentMs = status.positionMillis;
    const currentSecs = Math.floor(currentMs / 1000);

    // Subtitles
    if (subtitlesEnabled && parsedSubs.length > 0) {
      const activeCue = parsedSubs.find(c => currentMs >= c.startMs && currentMs <= c.endMs);
      if (activeCue && activeCue.text !== currentSubText) setCurrentSubText(activeCue.text);
      else if (!activeCue && currentSubText !== '') setCurrentSubText('');
    }

    // Skip Intro Logic
    if (introData.end > 0 && currentSecs >= introData.start && currentSecs < introData.end && !skipDismissed) {
      if (!showSkipButton) {
        setShowSkipButton(true);
        Animated.spring(skipIntroOpacity, { toValue: 1, useNativeDriver: true }).start();
        skipTimer.current = setTimeout(() => {
          Animated.timing(skipIntroOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowSkipButton(false));
        }, 5000);
      }
    } else {
      if (showSkipButton) {
        Animated.timing(skipIntroOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowSkipButton(false));
      }
    }

    // Progress Save
    if (userUid && animeId && status.isPlaying && currentSecs > 0 && currentSecs % 10 === 0) {
      const isCompleted = currentSecs > (status.durationMillis / 1000 * 0.85);
      firestore().collection('users').doc(userUid).collection('progress').doc(String(animeId)).set({
        animeId: String(animeId), lastWatchedEp: episodeNum, progress: currentSecs,
        duration: Math.floor(status.durationMillis/1000), finishedEp: isCompleted, timestamp: Date.now()
      }, { merge: true }).catch(()=>{});
    }
  }, [status.positionMillis]);

  // 5. Swipe Gestures Engine (PanResponder)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 15,
      onPanResponderMove: (evt, gestureState) => {
        const { moveX, dy } = gestureState;
        const isLeft = moveX < SCREEN_WIDTH / 2;
        
        if (isLeft) {
          // Brightness (Overlay Opacity 0 to 0.85)
          let newB = brightnessOverlay + (dy * 0.005);
          newB = Math.max(0, Math.min(newB, 0.85));
          setBrightnessOverlay(newB);
          setGestureText(`Brightness: ${Math.round((1 - newB) * 100)}%`);
        } else {
          // Volume (Simulated up to 200%)
          let newV = volume - (dy * 0.01);
          newV = Math.max(0, Math.min(newV, 2.0));
          setVolume(newV);
          if (videoRef.current) videoRef.current.setVolumeAsync(Math.min(newV, 1.0)); // Cap native volume at 1.0
          setGestureText(`Volume: ${Math.round(newV * 100)}%`);
        }
      },
      onPanResponderRelease: () => {
        setTimeout(() => setGestureText(null), 1000);
      }
    })
  ).current;

  // 6. UI Auto-Hide
  const resetHideTimer = () => {
    setShowUI(true);
    Animated.timing(uiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    hideUITimeout.current = setTimeout(() => {
      if (status.isPlaying && !activeMenu) {
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
  }, [status.isPlaying, activeMenu]);

  // 7. Double Tap
  const handleTouchOverlay = (evt) => {
    if (activeMenu) { setActiveMenu(null); return; }
    const now = Date.now(); const tapDelay = now - lastTapRef.current; lastTapRef.current = now;
    if (tapDelay < 300) {
      const touchX = evt.nativeEvent.locationX;
      if (touchX > SCREEN_WIDTH / 2) { seekForward(); triggerSkipIndicator('right'); } 
      else { seekBackward(); triggerSkipIndicator('left'); }
    } else {
      resetHideTimer();
    }
  };

  const triggerSkipIndicator = (direction) => {
    setShowSkipIndicator(direction);
    setTimeout(() => setShowSkipIndicator(null), 600);
  };

  // Playback Controls
  const togglePlayPause = () => { if (!videoRef.current) return; status.isPlaying ? videoRef.current.pauseAsync() : videoRef.current.playAsync(); resetHideTimer(); };
  const seekBackward = async () => { if (!videoRef.current || !status.isLoaded) return; await videoRef.current.setPositionAsync(Math.max(0, status.positionMillis - 10000)); resetHideTimer(); };
  const seekForward = async () => { if (!videoRef.current || !status.isLoaded) return; await videoRef.current.setPositionAsync(Math.min(status.durationMillis, status.positionMillis + 10000)); resetHideTimer(); };
  const handleSliderChange = async (val) => { if (!videoRef.current) return; await videoRef.current.setPositionAsync(val); resetHideTimer(); };
  
  const handleQualityChange = (qualityObj) => {
    setSelectedQuality(qualityObj.label);
    setActiveUrl(`${CUSTOM_PROXY_URL}${encodeURIComponent(qualityObj.uri)}&referer=${encodeURIComponent(streamData.referer || 'https://vidwish.live/')}`);
    setActiveMenu(null);
  };

  const formatTime = (millis) => {
    if (isNaN(millis)) return "00:00";
    const totalSecs = Math.floor(millis / 1000);
    const h = Math.floor(totalSecs / 3600), m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0'), s = (totalSecs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  if (loadingStream || !activeUrl) {
    return (
      <View style={styles.loaderContainerFull}>
        <ActivityIndicator size="large" color={BRAND_RED} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* VIDEO ENGINE */}
      <Video
        ref={videoRef}
        style={styles.videoPlayer}
        source={{ uri: activeUrl, headers: { "User-Agent": "Mozilla/5.0" } }}
        useNativeControls={false}
        resizeMode={resizeMode}
        onPlaybackStatusUpdate={setStatus}
        shouldPlay
      />

      {/* BRIGHTNESS OVERLAY */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${brightnessOverlay})`, pointerEvents: 'none', zIndex: 1 }]} />

      {/* SUBTITLES OVERLAY */}
      {subtitlesEnabled && currentSubText !== '' && (
        <View style={[styles.subtitleContainer, { bottom: subHeight }]} pointerEvents="none">
          <Text style={[styles.subtitleText, { color: subColor, fontSize: subSize }]}>{currentSubText}</Text>
        </View>
      )}

      {/* PREMIUM WHITE BUFFERING SPINNER */}
      {(!status.isLoaded || status.isBuffering) && (
        <View style={styles.bufferingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* GESTURE TEXT (Volume/Brightness) */}
      {gestureText && (
        <View style={styles.gestureIndicator}>
          <Text style={styles.gestureText}>{gestureText}</Text>
        </View>
      )}

      {/* PAN RESPONDER & DOUBLE TAP LAYER */}
      <View {...panResponder.panHandlers} style={[StyleSheet.absoluteFillObject, { zIndex: 5 }]}>
        <TouchableWithoutFeedback onPress={handleTouchOverlay}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      </View>

      {/* SKIP ANIMATIONS */}
      {showSkipIndicator === 'left' && (
        <View style={styles.skipLeftInd}>
          <IconBackward size={36} color="#FFF" />
          <Text style={styles.skipText}>10s</Text>
        </View>
      )}
      {showSkipIndicator === 'right' && (
        <View style={styles.skipRightInd}>
          <IconForward size={36} color="#FFF" />
          <Text style={styles.skipText}>10s</Text>
        </View>
      )}

      {/* SKIP INTRO FLOATING BUTTON */}
      {showSkipButton && (
        <Animated.View style={[styles.skipIntroFloat, { opacity: skipIntroOpacity }]}>
          <TouchableOpacity onPress={() => videoRef.current?.setPositionAsync(introData.end * 1000)} style={styles.skipIntroBtnInner}>
            <Text style={styles.skipIntroText}>Skip Intro</Text>
            <IconForward size={14} color="#000" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* MAIN UI LAYER */}
      <Animated.View style={[styles.uiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'auto' : 'none'}>
        
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClosePlayer} style={styles.backBtn} hitSlop={{top:20, bottom:20, left:20, right:20}}>
            <IconBack size={26} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.animeTitle}>{animeTitle}</Text>
            <Text style={styles.episodeTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
          </View>
        </View>

        {/* CENTER PLAY/PAUSE */}
        <View style={styles.centerControls} pointerEvents="box-none">
          <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
            {status.isPlaying ? <IconPause size={38} color="#FFF" /> : <IconPlay size={38} color="#FFF" />}
          </TouchableOpacity>
        </View>

        {/* DYNAMIC SETTINGS MENUS */}
        {activeMenu === 'main' && (
          <View style={styles.settingsMenu}>
            <Text style={styles.menuHeader}>Settings</Text>
            <TouchableOpacity style={styles.menuRow} onPress={() => setActiveMenu('quality')}>
              <Text style={styles.menuText}>Quality</Text>
              <Text style={styles.menuValue}>{selectedQuality} ›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => setActiveMenu('audio')}>
              <Text style={styles.menuText}>Audio Track</Text>
              <Text style={styles.menuValue}>{audioTracks[0]} ›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => setActiveMenu('subs')}>
              <Text style={styles.menuText}>Subtitle Style</Text>
              <Text style={styles.menuValue}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => {
              const next = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
              setPlaybackSpeed(next); videoRef.current?.setRateAsync(next, true);
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
            <TouchableOpacity onPress={() => setActiveMenu('main')} style={{marginBottom: 10}}><Text style={styles.menuValue}>‹ Back</Text></TouchableOpacity>
            <Text style={styles.menuHeader}>Video Quality</Text>
            {qualityList.map((q, i) => (
              <TouchableOpacity key={i} style={styles.menuRow} onPress={() => handleQualityChange(q)}>
                <Text style={[styles.menuText, selectedQuality === q.label && {color: BRAND_RED}]}>{q.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeMenu === 'subs' && (
          <View style={styles.settingsMenu}>
            <TouchableOpacity onPress={() => setActiveMenu('main')} style={{marginBottom: 10}}><Text style={styles.menuValue}>‹ Back</Text></TouchableOpacity>
            <Text style={styles.menuHeader}>Subtitle Options</Text>
            
            <Text style={styles.subMenuLabel}>Color</Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
              {['#FFFFFF', '#F47521', '#FACC15', '#4ADE80'].map(c => (
                <TouchableOpacity key={c} onPress={() => setSubColor(c)} style={[styles.colorDot, {backgroundColor: c}, subColor === c && styles.colorDotActive]} />
              ))}
            </View>

            <Text style={styles.subMenuLabel}>Size</Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
              {[12, 16, 20, 24].map(s => (
                <TouchableOpacity key={s} onPress={() => setSubSize(s)} style={styles.sizeBtn}><Text style={[styles.sizeBtnText, subSize === s && {color: BRAND_RED}]}>{s}</Text></TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subMenuLabel}>Height Offset</Text>
            <View style={{flexDirection: 'row', gap: 10}}>
              {[20, 40, 80].map(h => (
                <TouchableOpacity key={h} onPress={() => setSubHeight(h)} style={styles.sizeBtn}><Text style={[styles.sizeBtnText, subHeight === h && {color: BRAND_RED}]}>{h}</Text></TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {activeMenu === 'audio' && (
          <View style={styles.settingsMenu}>
            <TouchableOpacity onPress={() => setActiveMenu('main')} style={{marginBottom: 10}}><Text style={styles.menuValue}>‹ Back</Text></TouchableOpacity>
            <Text style={styles.menuHeader}>Audio Tracks</Text>
            <Text style={{color: '#666', fontSize: 10, marginBottom: 10}}>*Expo AV uses stream default</Text>
            {audioTracks.map((a, i) => (
              <TouchableOpacity key={i} style={styles.menuRow}>
                <Text style={[styles.menuText, {color: BRAND_RED}]}>{a}</Text>
              </TouchableOpacity>
            ))}
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
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor={BRAND_RED}
              onSlidingComplete={handleSliderChange}
              onSlidingStart={() => { if (hideUITimeout.current) clearTimeout(hideUITimeout.current); }}
            />
            <Text style={styles.timeText}>{formatTime(status.durationMillis || 0)}</Text>
          </View>
          
          <View style={styles.actionRow}>
            <View style={{flexDirection: 'row', gap: 20}}>
              <TouchableOpacity onPress={() => setSubtitlesEnabled(!subtitlesEnabled)}>
                <IconSubs size={22} color={subtitlesEnabled ? "#FFF" : "#666"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveMenu(activeMenu === 'audio' ? null : 'audio')}>
                <IconAudio size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <View style={{flexDirection: 'row', gap: 20, alignItems: 'center'}}>
              {/* Permanent UI Skip Next Button */}
              <TouchableOpacity onPress={() => {/* Logic to fetch next ep */}} style={styles.nextEpBtn}>
                <IconSkip size={18} color="#FFF" />
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => setActiveMenu(activeMenu ? null : 'main')}>
                <IconSettings size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
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
  bufferingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 4, pointerEvents: 'none' },
  
  gestureIndicator: { position: 'absolute', top: 40, left: '50%', transform: [{translateX: -50}], backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 15, paddingVertical: 5, borderRadius: 20, zIndex: 20 },
  gestureText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  subtitleContainer: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 9, paddingHorizontal: 40 },
  subtitleText: { fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowOffset: {width: 1, height: 1}, textShadowRadius: 4, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 25, paddingTop: 30, width: '100%', backgroundColor: 'rgba(0,0,0,0.5)' },
  backBtn: { marginRight: 20 },
  animeTitle: { color: '#FFF', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  episodeTitle: { color: '#CCC', fontSize: 13, fontWeight: '600', marginTop: 2 },
  
  centerControls: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playPauseBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  
  skipLeftInd: { position: 'absolute', left: '15%', top: '45%', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 20, borderRadius: 50 },
  skipRightInd: { position: 'absolute', right: '15%', top: '45%', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 20, borderRadius: 50 },
  skipText: { color: '#FFF', fontSize: 12, fontWeight: '900', marginTop: 5 },

  skipIntroFloat: { position: 'absolute', bottom: 120, right: 40, zIndex: 30 },
  skipIntroBtnInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, gap: 5 },
  skipIntroText: { color: '#000', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },

  settingsMenu: { position: 'absolute', bottom: 90, right: 30, backgroundColor: 'rgba(15,15,15,0.95)', borderRadius: 12, padding: 20, width: 250, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  menuHeader: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  menuRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  menuText: { color: '#DDD', fontSize: 14, fontWeight: '600' },
  menuValue: { color: BRAND_RED, fontSize: 13, fontWeight: 'bold' },
  
  subMenuLabel: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 8 },
  colorDot: { width: 24, height: 24, borderRadius: 12 },
  colorDotActive: { borderWidth: 2, borderColor: '#FFF' },
  sizeBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  sizeBtnText: { color: '#FFF', fontWeight: 'bold' },

  bottomBar: { width: '100%', paddingHorizontal: 30, paddingBottom: 25, paddingTop: 30, backgroundColor: 'rgba(0,0,0,0.7)' },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  timeText: { color: '#FFF', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  slider: { flex: 1, marginHorizontal: 15, height: 40 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10 },
  nextEpBtn: { padding: 5 }
});
