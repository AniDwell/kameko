import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  Dimensions, ActivityIndicator, StatusBar, BackHandler,
  TouchableWithoutFeedback, PanResponder
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

// --- IN-MEMORY CACHE ---
const tmdbCache = {
  seriesQueries: new Map(),
  seasonMaps: new Map(),
  episodeData: new Map()
};

const cleanTitle = (str = '') => {
  return str
    .toLowerCase()
    .replace(/\(dub\)|\(sub\)|\(uncensored\)|season \d+|part \d+/gi, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const calculateSimilarity = (s1, s2) => {
  const norm1 = cleanTitle(s1);
  const norm2 = cleanTitle(s2);
  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const words1 = new Set(norm1.split(' '));
  const words2 = new Set(norm2.split(' '));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  const jaccard = intersection.size / union.size;
  const startsWithBonus = norm1.startsWith(norm2) || norm2.startsWith(norm1) ? 0.2 : 0;
  return Math.min(1.0, jaccard + startsWithBonus);
};

// --- PREMIUM SVG ICONS ---
const IconPlay = ({ size = 42, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
  </Svg>
);

const IconPause = ({ size = 42, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </Svg>
);

// Circular 10s Rewind Arrow
const IconReplay10 = ({ size = 36, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4a8 8 0 107.8 6.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 1.5L9 4.5l3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <SvgText x="12" y="15" fill={color} fontSize="6" fontWeight="bold" textAnchor="middle">10</SvgText>
  </Svg>
);

// Circular 10s Forward Arrow
const IconForward10 = ({ size = 36, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 4a8 8 0 11-7.8 6.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M12 1.5l3 3-3 3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <SvgText x="12" y="15" fill={color} fontSize="6" fontWeight="bold" textAnchor="middle">10</SvgText>
  </Svg>
);

const IconSettings = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Circle cx="12" cy="12" r="3"/>
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </Svg>
);

const IconSubs = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Rect x="3" y="5" width="18" height="14" rx="2" ry="2"/>
    <Path d="M7 15h3m4 0h3M7 9h10"/>
  </Svg>
);

const IconSkip = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M5 4l10 8-10 8V4z"/>
    <Path d="M19 5v14"/>
  </Svg>
);

const IconBack = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <Path d="M19 12H5M12 19l-7-7 7-7"/>
  </Svg>
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
  const infoOverlayOpacity = useRef(new Animated.Value(0)).current;

  // Double tap animation states
  const skipLeftAnim = useRef(new Animated.Value(0)).current;
  const skipRightAnim = useRef(new Animated.Value(0)).current;
  const [doubleTapSide, setDoubleTapSide] = useState(null);

  const [status, setStatus] = useState({});
  const [showUI, setShowUI] = useState(true);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Settings & Subs Styling
  const [activeMenu, setActiveMenu] = useState(null);
  const [subColor, setSubColor] = useState('#FFFFFF');
  const [subSize, setSubSize] = useState(16);
  const [subHeight, setSubHeight] = useState(30);

  // Stream Resolution
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [fatalError, setFatalError] = useState(null);

  // TMDB Metadata State
  const [tmdbMeta, setTmdbMeta] = useState(null);

  // Gestures
  const [brightnessOverlay, setBrightnessOverlay] = useState(0); 
  const [volume, setVolume] = useState(1.0); 
  const [gestureText, setGestureText] = useState(null);

  // Subtitles
  const [parsedSubs, setParsedSubs] = useState([]);
  const [currentSubText, setCurrentSubText] = useState('');
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);

  const hideUITimeout = useRef(null);
  const overlayTimerRef = useRef(null);
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
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    };
  }, []);

  const handleClosePlayer = async () => {
    await ScreenOrientation.unlockAsync().catch(() => {});
    navigation.goBack();
    return true;
  };

  // 2. Netflix Overlay Fade Logic
  const triggerNetflixOverlay = useCallback(() => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    Animated.timing(infoOverlayOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true
    }).start();

    overlayTimerRef.current = setTimeout(() => {
      Animated.timing(infoOverlayOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      }).start();
    }, 5500);
  }, [infoOverlayOpacity]);

  // 3. TMDB Search & Season Mapping
  useEffect(() => {
    let isCancelled = false;

    const fetchAndMapTMDB = async () => {
      setTmdbMeta(null);

      try {
        const queryNorm = cleanTitle(animeTitle);
        let seriesDetails = tmdbCache.seriesQueries.get(queryNorm);

        if (!seriesDetails) {
          const searchUrl = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(animeTitle)}&include_adult=false`;
          const sRes = await fetch(searchUrl);
          const sJson = await sRes.json();
          const results = sJson?.results || [];

          if (results.length === 0) return;

          let bestMatch = null;
          let highestScore = -1;

          for (const item of results) {
            const scoreName = calculateSimilarity(animeTitle, item.name || '');
            const scoreOrig = calculateSimilarity(animeTitle, item.original_name || '');
            const candidateScore = Math.max(scoreName, scoreOrig);

            if (candidateScore > highestScore) {
              highestScore = candidateScore;
              bestMatch = item;
            }
          }

          if (!bestMatch || highestScore < 0.25) return;

          const detailUrl = `https://api.themoviedb.org/3/tv/${bestMatch.id}?api_key=${TMDB_API_KEY}&append_to_response=content_ratings,alternative_titles`;
          const dRes = await fetch(detailUrl);
          seriesDetails = await dRes.json();
          tmdbCache.seriesQueries.set(queryNorm, seriesDetails);
        }

        if (isCancelled || !seriesDetails?.id) return;

        let seasonDistribution = tmdbCache.seasonMaps.get(seriesDetails.id);
        if (!seasonDistribution) {
          const validSeasons = (seriesDetails.seasons || [])
            .filter(s => s.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);

          let totalAcc = 0;
          seasonDistribution = validSeasons.map(s => {
            const entry = {
              seasonNumber: s.season_number,
              episodeCount: s.episode_count || 0,
              priorTotal: totalAcc
            };
            totalAcc += (s.episode_count || 0);
            return entry;
          });
          tmdbCache.seasonMaps.set(seriesDetails.id, seasonDistribution);
        }

        const globalEp = parseInt(episodeNum, 10) || 1;
        let matchedSeason = 1;
        let matchedEpisode = globalEp;
        let foundInMap = false;

        for (const s of seasonDistribution) {
          if (globalEp > s.priorTotal && globalEp <= (s.priorTotal + s.episodeCount)) {
            matchedSeason = s.seasonNumber;
            matchedEpisode = globalEp - s.priorTotal;
            foundInMap = true;
            break;
          }
        }

        if (!foundInMap && seasonDistribution.length > 0) {
          const lastSeason = seasonDistribution[seasonDistribution.length - 1];
          matchedSeason = lastSeason.seasonNumber;
          matchedEpisode = Math.max(1, globalEp - lastSeason.priorTotal);
        }

        const epCacheKey = `tmdb_episode_${seriesDetails.id}_${matchedSeason}_${matchedEpisode}`;
        let episodeInfo = tmdbCache.episodeData.get(epCacheKey);

        if (!episodeInfo) {
          const epUrl = `https://api.themoviedb.org/3/tv/${seriesDetails.id}/season/${matchedSeason}/episode/${matchedEpisode}?api_key=${TMDB_API_KEY}`;
          const epRes = await fetch(epUrl);
          if (epRes.ok) {
            episodeInfo = await epRes.json();
            tmdbCache.episodeData.set(epCacheKey, episodeInfo);
          }
        }

        if (isCancelled) return;

        const ratings = seriesDetails.content_ratings?.results || [];
        const inRating = ratings.find(r => r.iso_3166_1 === 'IN')?.rating;
        const usRating = ratings.find(r => r.iso_3166_1 === 'US')?.rating;
        const certification = inRating || usRating || ratings[0]?.rating || null;
        const genres = (seriesDetails.genres || []).map(g => g.name).slice(0, 3).join(' • ');

        setTmdbMeta({
          seasonNumber: matchedSeason,
          episodeNumber: matchedEpisode,
          title: episodeInfo?.name || episodeTitle || `Episode ${episodeNum}`,
          overview: episodeInfo?.overview || seriesDetails.overview || '',
          certification,
          genres
        });
        triggerNetflixOverlay();
      } catch (_) {}
    };

    fetchAndMapTMDB();
    return () => { isCancelled = true; };
  }, [animeTitle, episodeNum, triggerNetflixOverlay]);

  // 4. Stream Resolution Engine
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

      setStreamData(finalStreamData);
      setLoadingStream(false);
    };

    resolveStream();
    return () => { isMounted = false; };
  }, [animeId, episodeNum, targetType]);

  // 5. VTT Subtitle Parser
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
            if (parts.length === 3) s = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2].replace(',', '.'));
            else s = parseInt(parts[0], 10) * 60 + parseFloat(parts[2].replace(',', '.'));
            return s * 1000;
          };

          const textLines = lines.slice(lines.indexOf(timeLine) + 1).filter(l => !l.startsWith('WEBVTT') && l.trim() !== '');
          const clean = textLines.join('\n').replace(/<[^>]+>/g, '');
          cues.push({ startMs: parseTime(startStr), endMs: parseTime(endStr), text: clean });
        }
        setParsedSubs(cues);
      } catch (_) {}
    };

    loadSubtitles();
  }, [streamData]);

  // 6. Playback Tick
  useEffect(() => {
    if (!status.isLoaded) return;
    const currentMs = status.positionMillis || 0;
    const currentSecs = Math.floor(currentMs / 1000);

    if (subtitlesEnabled && parsedSubs.length > 0) {
      const activeCue = parsedSubs.find(c => currentMs >= c.startMs && currentMs <= c.endMs);
      if (activeCue && activeCue.text !== currentSubText) setCurrentSubText(activeCue.text);
      else if (!activeCue && currentSubText !== '') setCurrentSubText('');
    } else if (currentSubText !== '') {
      setCurrentSubText('');
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

  // 7. Swipe Gestures
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
      onPanResponderRelease: () => setTimeout(() => setGestureText(null), 1000)
    })
  ).current;

  // 8. Controls Visibility & Double-Tap Trigger
  const showControls = () => {
    setShowUI(true);
    Animated.timing(uiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    triggerNetflixOverlay();
    resetHideTimer();
  };

  const hideControls = () => {
    if (activeMenu) setActiveMenu(null);
    Animated.timing(uiOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setShowUI(false));
  };

  const toggleControls = () => {
    if (showUI) hideControls();
    else showControls();
  };

  const resetHideTimer = () => {
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    hideUITimeout.current = setTimeout(() => {
      if (status.isPlaying && !activeMenu) {
        hideControls();
      }
    }, 4500);
  };

  const triggerDoubleTapAnimation = (side) => {
    setDoubleTapSide(side);
    const anim = side === 'left' ? skipLeftAnim : skipRightAnim;
    anim.setValue(0);
    Animated.sequence([
      Animated.spring(anim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true
      }),
      Animated.timing(anim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      })
    ]).start(() => setDoubleTapSide(null));
  };

  const handleTouchOverlay = (evt) => {
    const now = Date.now();
    const tapDelay = now - lastTapRef.current;
    lastTapRef.current = now;

    if (tapDelay < 300) {
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
      const touchX = evt.nativeEvent.locationX;
      if (touchX > Dimensions.get('window').width / 2) {
        seekForward();
        triggerDoubleTapAnimation('right');
      } else {
        seekBackward();
        triggerDoubleTapAnimation('left');
      }
    } else {
      toggleControls();
    }
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

  // Rotation interpolations for double tap
  const leftRotate = skipLeftAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '-35deg', '0deg']
  });
  const leftScale = skipLeftAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.25, 1]
  });

  const rightRotate = skipRightAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '35deg', '0deg']
  });
  const rightScale = skipRightAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.25, 1]
  });

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
      {/* 1. NATIVE EXPO VIDEO */}
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

      {/* 2. BRIGHTNESS TINT OVERLAY */}
      <View 
        style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${brightnessOverlay})` }]} 
        pointerEvents="none" 
      />

      {/* 3. SUBTITLE RENDERING */}
      {subtitlesEnabled && currentSubText !== '' && (
        <View style={[styles.subtitleContainer, { bottom: subHeight }]} pointerEvents="none">
          <Text style={[styles.subtitleText, { color: subColor, fontSize: subSize }]}>
            {currentSubText}
          </Text>
        </View>
      )}

      {/* 4. NETFLIX-STYLE METADATA OVERLAY */}
      {tmdbMeta && (
        <Animated.View style={[styles.netflixOverlayWrapper, { opacity: infoOverlayOpacity }]} pointerEvents="none">
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="infoGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.8" />
                <Stop offset="0.5" stopColor="#000000" stopOpacity="0.35" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#infoGrad)" />
          </Svg>
          <View style={styles.netflixInfoCard}>
            <View style={styles.metaRowHeader}>
              {tmdbMeta.certification && (
                <View style={styles.certBadge}>
                  <Text style={styles.certBadgeText}>{tmdbMeta.certification}</Text>
                </View>
              )}
              {tmdbMeta.genres ? <Text style={styles.genreTags}>{tmdbMeta.genres}</Text> : null}
            </View>
            <Text style={styles.metaEpisodeHeader} numberOfLines={1}>
              S{tmdbMeta.seasonNumber} E{tmdbMeta.episodeNumber} — {tmdbMeta.title}
            </Text>
            {tmdbMeta.overview ? (
              <Text style={styles.metaDescription} numberOfLines={3}>
                {tmdbMeta.overview}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      )}

      {/* 5. DYNAMIC WHITE BUFFERING SPINNER */}
      {(!status.isLoaded || status.isBuffering) && (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* 6. GESTURE TOAST */}
      {gestureText && (
        <View style={styles.gestureIndicator} pointerEvents="none">
          <Text style={styles.gestureText}>{gestureText}</Text>
        </View>
      )}

      {/* 7. TOUCH / PAN SENSOR */}
      <View {...panResponder.panHandlers} style={[StyleSheet.absoluteFillObject, { zIndex: 5 }]}>
        <TouchableWithoutFeedback onPress={handleTouchOverlay}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      </View>

      {/* 8. ANIMATED DOUBLE-TAP ROTATING OVERLAYS */}
      {doubleTapSide === 'left' && (
        <Animated.View 
          style={[
            styles.skipOverlayLeft, 
            { opacity: skipLeftAnim, transform: [{ rotate: leftRotate }, { scale: leftScale }] }
          ]} 
          pointerEvents="none"
        >
          <IconReplay10 size={54} color="#FFF" />
          <Text style={styles.skipFeedbackText}>-10s</Text>
        </Animated.View>
      )}

      {doubleTapSide === 'right' && (
        <Animated.View 
          style={[
            styles.skipOverlayRight, 
            { opacity: skipRightAnim, transform: [{ rotate: rightRotate }, { scale: rightScale }] }
          ]} 
          pointerEvents="none"
        >
          <IconForward10 size={54} color="#FFF" />
          <Text style={styles.skipFeedbackText}>+10s</Text>
        </Animated.View>
      )}

      {/* 9. CONTROLS OVERLAY (SEAMLESS GRADIENTS) */}
      <Animated.View style={[styles.uiLayer, { opacity: uiOpacity }]} pointerEvents={showUI ? 'auto' : 'none'}>
        
        {/* TOP BAR WITH SMOOTH GRADIENT */}
        <View style={styles.topBar}>
          <Svg height={110} width="100%" style={styles.topGradientSvg} pointerEvents="none">
            <Defs>
              <LinearGradient id="topG" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.85" />
                <Stop offset="0.5" stopColor="#000000" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#topG)" />
          </Svg>
          <TouchableOpacity onPress={handleClosePlayer} style={styles.backBtn} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <IconBack size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.animeTitle} numberOfLines={1}>{animeTitle}</Text>
            <Text style={styles.episodeTitle}>
              {tmdbMeta ? `Season ${tmdbMeta.seasonNumber} • Episode ${tmdbMeta.episodeNumber}` : `Episode ${episodeNum}`}
            </Text>
          </View>
        </View>

        {/* CENTER CONTROLS (SOFT SHADOWS, LARGER ICONS) */}
        <View style={styles.centerControls} pointerEvents="box-none">
          <TouchableOpacity onPress={seekBackward} style={styles.centerActionBtn} activeOpacity={0.7}>
            <IconReplay10 size={40} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity onPress={togglePlayPause} style={styles.centerPlayPauseBtn} activeOpacity={0.75}>
            {status.isPlaying ? <IconPause size={48} color="#FFF" /> : <IconPlay size={48} color="#FFF" />}
          </TouchableOpacity>

          <TouchableOpacity onPress={seekForward} style={styles.centerActionBtn} activeOpacity={0.7}>
            <IconForward10 size={40} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* SETTINGS MENUS */}
        {activeMenu === 'main' && (
          <View style={styles.settingsMenu}>
            <Text style={styles.menuHeader}>Settings</Text>
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

        {/* BOTTOM CONTROLS WITH EXTENDED SEAMLESS MULTI-STOP GRADIENT */}
        <View style={styles.bottomBarContainer}>
          <Svg height={160} width="100%" style={styles.bottomGradientSvg} pointerEvents="none">
            <Defs>
              <LinearGradient id="botSeamlessG" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.92" />
                <Stop offset="0.35" stopColor="#000000" stopOpacity="0.65" />
                <Stop offset="0.7" stopColor="#000000" stopOpacity="0.25" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#botSeamlessG)" />
          </Svg>

          <View style={styles.bottomControlsContent}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
                <TouchableOpacity onPress={() => setSubtitlesEnabled(!subtitlesEnabled)} style={styles.iconHitSlop}>
                  <IconSubs size={22} color={subtitlesEnabled ? "#FFF" : "#666"} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                <TouchableOpacity onPress={() => {/* Next episode navigation hook */}} style={styles.iconHitSlop}>
                  <IconSkip size={20} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setActiveMenu(activeMenu ? null : 'main')} style={styles.iconHitSlop}>
                  <IconSettings size={22} color={activeMenu ? BRAND_RED : "#FFF"} />
                </TouchableOpacity>
              </View>
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

  // Netflix Overlay
  netflixOverlayWrapper: {
    position: 'absolute',
    top: 75,
    left: 25,
    width: SCREEN_WIDTH * 0.45,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 14,
    zIndex: 8
  },
  netflixInfoCard: { zIndex: 2 },
  metaRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  certBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  certBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  genreTags: { color: '#CCC', fontSize: 10, fontWeight: '600' },
  metaEpisodeHeader: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginVertical: 4, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  metaDescription: { color: '#BBB', fontSize: 10, lineHeight: 14, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },

  // Double Tap Indicators
  skipOverlayLeft: {
    position: 'absolute',
    left: '18%',
    top: '40%',
    alignItems: 'center',
    zIndex: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8
  },
  skipOverlayRight: {
    position: 'absolute',
    right: '18%',
    top: '40%',
    alignItems: 'center',
    zIndex: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 8
  },
  skipFeedbackText: { color: '#FFF', fontSize: 14, fontWeight: '900', marginTop: 4, textShadowColor: '#000', textShadowRadius: 4 },

  // UI Layer
  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },

  // Top Bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingTop: 20, paddingBottom: 25, width: '100%' },
  topGradientSvg: { position: 'absolute', top: 0, left: 0, right: 0 },
  backBtn: { marginRight: 18 },
  animeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3, textShadowColor: '#000', textShadowRadius: 4 },
  episodeTitle: { color: '#AAA', fontSize: 11, fontWeight: '600', marginTop: 2, textShadowColor: '#000', textShadowRadius: 3 },

  // Center Controls (Soft Shadows)
  centerControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 50 },
  centerPlayPauseBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.85,
    shadowRadius: 12,
    elevation: 8
  },
  centerActionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5
  },

  // Settings Menu
  settingsMenu: { position: 'absolute', bottom: 95, right: 25, backgroundColor: 'rgba(18,18,18,0.96)', borderRadius: 12, padding: 18, width: 260, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
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

  // Bottom Controls (Extended Seamless Gradient)
  bottomBarContainer: { width: '100%', position: 'relative', justifyContent: 'flex-end' },
  bottomGradientSvg: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomControlsContent: { paddingHorizontal: 25, paddingBottom: 22, paddingTop: 10 },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  timeText: { color: '#FFF', fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'], textShadowColor: '#000', textShadowRadius: 3 },
  slider: { flex: 1, marginHorizontal: 10, height: 35 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  iconHitSlop: { padding: 4 }
});
