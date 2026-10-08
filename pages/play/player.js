import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  ActivityIndicator, StatusBar, BackHandler,
  TouchableWithoutFeedback, PanResponder, useWindowDimensions,
  ScrollView, Platform
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

// --- CONFIGURATION CONSTANTS ---
const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const AUTO_HIDE_DELAY = 4500;
const FALLBACK_OUTRO_SECONDS = 45;

// --- IN-MEMORY CACHE ---
const memoryCache = {
  seriesQueries: new Map(),
  seasonMaps: new Map(),
  episodeData: new Map(),
  parsedSubtitles: new Map()
};

// --- STRING MATCHING HELPERS ---
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
  const prefixBonus = norm1.startsWith(norm2) || norm2.startsWith(norm1) ? 0.2 : 0;
  return Math.min(1.0, jaccard + prefixBonus);
};

// --- PREMIUM SVG ICONS ---
const IconPlay = ({ size = 28, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);
const IconPause = ({ size = 28, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </Svg>
);
const IconReplay10 = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8zm-1.5 6.5h-1V15h1v-3.5zm3.5 0h-2v3.5h2V11.5zm0 1v1.5h-1v-1.5h1z" />
  </Svg>
);
const IconForward10 = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8zm-1.5 6.5h-1V15h1v-3.5zm3.5 0h-2v3.5h2V11.5zm0 1v1.5h-1v-1.5h1z" />
  </Svg>
);
const IconSettings = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="3"/>
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
  </Svg>
);
const IconSubtitles = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
    <Path d="M7 15h4M15 15h2M7 11h2M13 11h4"/>
  </Svg>
);
const IconNextEp = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 4l10 8-10 8V4zM19 5v14"/>
  </Svg>
);
const IconBackArrow = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5M12 19l-7-7 7-7"/>
  </Svg>
);
const IconCheck = ({ size = 16, color = BRAND_RED }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 6L9 17l-5-5"/>
  </Svg>
);

// --- REUSABLE COMPONENT: ANIMATED PRESS SCALE BUTTON ---
const PressableScale = ({ children, onPress, style, scaleTo = 0.92, disabled = false }) => {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  return (
    <TouchableWithoutFeedback 
      onPress={onPress} 
      onPressIn={handlePressIn} 
      onPressOut={handlePressOut}
      disabled={disabled}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

// =========================================================================
// MAIN PLAYER COMPONENT
// =========================================================================
export default function Player({ route, navigation }) {
  const { 
    animeTitle = 'Unknown Anime', 
    episodeNum = 1, 
    episodeTitle = '', 
    animeId = null,
    userUid = null,
    targetType = 'sub'
  } = route?.params || {};

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const panelWidth = Math.min(windowWidth * 0.72, 400);

  // References
  const videoRef = useRef(null);
  const statusRef = useRef({});
  const lastTapRef = useRef(0);
  const tapTimeoutRef = useRef(null);
  const hideControlsTimer = useRef(null);
  const overlayTimerRef = useRef(null);
  const introTimerRef = useRef(null);

  // Core Playback State
  const [status, setStatus] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);

  // Animation Values
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const metaOverlayOpacity = useRef(new Animated.Value(0)).current;
  const drawerAnim = useRef(new Animated.Value(panelWidth)).current;
  const skipButtonAnim = useRef(new Animated.Value(0)).current;
  const nextCardAnim = useRef(new Animated.Value(0)).current;
  const seekIndicatorAnim = useRef(new Animated.Value(0)).current;

  // Drawer / Side Panel Navigation State
  // Values: null | 'main' | 'quality' | 'audio' | 'subtitles' | 'subtitle_style'
  const [activeDrawer, setActiveDrawer] = useState(null);

  // Subtitle Styling State
  const [subColor, setSubColor] = useState('#FFFFFF');
  const [subSize, setSubSize] = useState(16);
  const [subElevation, setSubElevation] = useState(30);
  const [subBgOpacity, setSubBgOpacity] = useState(0.45);

  // Networking, Stream & Server Fallback
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [fatalError, setFatalError] = useState(null);
  const [availableServers, setAvailableServers] = useState([]);
  const [currentServerIndex, setCurrentServerIndex] = useState(0);

  // Multi-Track Subtitles & Parser
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubTrackIndex, setSelectedSubTrackIndex] = useState(-1);
  const [parsedCues, setParsedCues] = useState([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState('');

  // Seeking & Gesture Feedback
  const [seekDelta, setSeekDelta] = useState(0);
  const [seekDirection, setSeekDirection] = useState(null);
  const [brightnessLevel, setBrightnessLevel] = useState(0); // 0 (bright) to 0.85 (dark)
  const [volumeLevel, setVolumeLevel] = useState(1.0); // 0.0 to 2.0 (boosted)
  const [toastMessage, setToastMessage] = useState(null);

  // TMDB Metadata
  const [tmdbMeta, setTmdbMeta] = useState(null);

  // Intro / Outro & Next Episode
  const [introRegion, setIntroRegion] = useState({ start: 0, end: 0 });
  const [outroRegion, setOutroRegion] = useState({ start: 0, end: 0 });
  const [inIntro, setInIntro] = useState(false);
  const [inOutro, setInOutro] = useState(false);
  const [hasNextEpisode, setHasNextEpisode] = useState(false);
  const [nextEpisodeDismissed, setNextEpisodeDismissed] = useState(false);

  // =========================================================================
  // 1. ISOLATED NEXT EPISODE NAVIGATION HANDLER
  // =========================================================================
  const handleNextEpisode = useCallback(() => {
    const nextEpNum = parseInt(episodeNum, 10) + 1;
    // Replace with your app's explicit navigation route if different from 'Player'
    if (navigation && typeof navigation.replace === 'function') {
      navigation.replace('Player', {
        animeTitle,
        episodeNum: nextEpNum,
        episodeTitle: `Episode ${nextEpNum}`,
        animeId,
        userUid,
        targetType
      });
    } else if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate('Player', {
        animeTitle,
        episodeNum: nextEpNum,
        episodeTitle: `Episode ${nextEpNum}`,
        animeId,
        userUid,
        targetType
      });
    }
  }, [navigation, animeTitle, episodeNum, animeId, userUid, targetType]);

  // =========================================================================
  // 2. LIFECYCLE & ORIENTATION LOCK
  // =========================================================================
  useEffect(() => {
    async function lockToLandscape() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (_) {}
      StatusBar.setHidden(true, 'fade');
    }
    lockToLandscape();

    const handleHardwareBack = () => {
      if (activeDrawer !== null) {
        if (activeDrawer !== 'main') {
          setActiveDrawer('main');
        } else {
          closeDrawer();
        }
        return true;
      }
      handleExitPlayer();
      return true;
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);

    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false, 'fade');
      backSubscription.remove();
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (introTimerRef.current) clearTimeout(introTimerRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, [activeDrawer]);

  const handleExitPlayer = async () => {
    await ScreenOrientation.unlockAsync().catch(() => {});
    navigation.goBack();
  };

  // =========================================================================
  // 3. TMDB METADATA & SEASON-EPISODE MAPPING
  // =========================================================================
  useEffect(() => {
    let isCancelled = false;

    const resolveTMDBMetadata = async () => {
      setTmdbMeta(null);

      try {
        const queryClean = cleanTitle(animeTitle);
        let seriesDetails = memoryCache.seriesQueries.get(queryClean);

        if (!seriesDetails) {
          const searchEndpoint = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(animeTitle)}&include_adult=false`;
          const res = await fetch(searchEndpoint);
          const data = await res.json();
          const results = data?.results || [];

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

          if (!bestMatch || highestScore < 0.22) return;

          const detailsUrl = `https://api.themoviedb.org/3/tv/${bestMatch.id}?api_key=${TMDB_API_KEY}&append_to_response=content_ratings,alternative_titles`;
          const dRes = await fetch(detailsUrl);
          seriesDetails = await dRes.json();
          memoryCache.seriesQueries.set(queryClean, seriesDetails);
        }

        if (isCancelled || !seriesDetails?.id) return;

        // Cumulative season breakdown
        let seasonsMap = memoryCache.seasonMaps.get(seriesDetails.id);
        if (!seasonsMap) {
          const canonicalSeasons = (seriesDetails.seasons || [])
            .filter(s => s.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);

          let accumulatedCount = 0;
          seasonsMap = canonicalSeasons.map(s => {
            const record = {
              seasonNumber: s.season_number,
              episodeCount: s.episode_count || 0,
              priorTotal: accumulatedCount
            };
            accumulatedCount += (s.episode_count || 0);
            return record;
          });
          memoryCache.seasonMaps.set(seriesDetails.id, seasonsMap);
        }

        const globalEp = parseInt(episodeNum, 10) || 1;
        let matchedSeason = 1;
        let matchedEpisode = globalEp;
        let mappingSuccess = false;

        for (const s of seasonsMap) {
          if (globalEp > s.priorTotal && globalEp <= (s.priorTotal + s.episodeCount)) {
            matchedSeason = s.seasonNumber;
            matchedEpisode = globalEp - s.priorTotal;
            mappingSuccess = true;
            break;
          }
        }

        if (!mappingSuccess && seasonsMap.length > 0) {
          const finalS = seasonsMap[seasonsMap.length - 1];
          matchedSeason = finalS.seasonNumber;
          matchedEpisode = Math.max(1, globalEp - finalS.priorTotal);
        }

        // Check if next episode exists in TMDB
        const totalIndexedEps = seasonsMap.reduce((acc, curr) => acc + curr.episodeCount, 0);
        if (globalEp < totalIndexedEps) {
          setHasNextEpisode(true);
        }

        // Fetch episode specific entry
        const epCacheKey = `tmdb_episode_${seriesDetails.id}_${matchedSeason}_${matchedEpisode}`;
        let epInfo = memoryCache.episodeData.get(epCacheKey);

        if (!epInfo) {
          const epUrl = `https://api.themoviedb.org/3/tv/${seriesDetails.id}/season/${matchedSeason}/episode/${matchedEpisode}?api_key=${TMDB_API_KEY}`;
          const epRes = await fetch(epUrl);
          if (epRes.ok) {
            epInfo = await epRes.json();
            memoryCache.episodeData.set(epCacheKey, epInfo);
          }
        }

        if (isCancelled) return;

        const ratings = seriesDetails.content_ratings?.results || [];
        const cert = ratings.find(r => r.iso_3166_1 === 'IN')?.rating ||
                     ratings.find(r => r.iso_3166_1 === 'US')?.rating ||
                     ratings[0]?.rating || null;

        const genres = (seriesDetails.genres || []).map(g => g.name).slice(0, 3).join(' • ');

        setTmdbMeta({
          seasonNumber: matchedSeason,
          episodeNumber: matchedEpisode,
          title: epInfo?.name || episodeTitle || `Episode ${episodeNum}`,
          overview: epInfo?.overview || seriesDetails.overview || '',
          certification: cert,
          genres
        });

        triggerNetflixMetadataBanner();
      } catch (_) {
        // Non-blocking catch
      }
    };

    resolveTMDBMetadata();
    return () => { isCancelled = true; };
  }, [animeTitle, episodeNum]);

  // =========================================================================
  // 4. STREAM RESOLUTION & RECOVERY ENGINE
  // =========================================================================
  const resolveCurrentStream = useCallback(async (serverList, startIndex = 0) => {
    setLoadingStream(true);
    setFatalError(null);

    let chosenData = null;
    let activeIdx = startIndex;

    for (let i = startIndex; i < serverList.length; i++) {
      const srv = serverList[i];
      try {
        const url = `${VERCEL_API_BASE}/api/stream?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}&server=${srv}&type=${targetType}`;
        const res = await fetch(url);
        const json = await res.json();
        if (json?.success && json?.data?.m3u8) {
          chosenData = json.data;
          activeIdx = i;
          break;
        }
      } catch (_) {}
    }

    if (!chosenData) {
      setFatalError('Unable to connect to streaming servers. Please verify connection or try again.');
      setLoadingStream(false);
      return;
    }

    // Set intro/outro
    if (chosenData.intro) {
      setIntroRegion({ start: chosenData.intro.start || 0, end: chosenData.intro.end || 0 });
    }
    if (chosenData.outro) {
      setOutroRegion({ start: chosenData.outro.start || 0, end: chosenData.outro.end || 0 });
    }

    // Initialize subtitles list
    const subs = chosenData.subtitles || [];
    setSubtitleTracks(subs);
    if (subs.length > 0) {
      const defaultIdx = subs.findIndex(s => s.default) !== -1 ? subs.findIndex(s => s.default) : 0;
      setSelectedSubTrackIndex(defaultIdx);
    } else {
      setSelectedSubTrackIndex(-1);
    }

    setCurrentServerIndex(activeIdx);
    setStreamData(chosenData);
    setLoadingStream(false);
  }, [animeId, episodeNum, targetType]);

  useEffect(() => {
    let isMounted = true;

    const bootstrapStream = async () => {
      let candidateServers = ['hd-1', 'hd-2', 'vidstream-2'];
      try {
        const srvRes = await fetch(`${VERCEL_API_BASE}/api/servers?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}`);
        const srvJson = await srvRes.json();
        if (srvJson?.success && Array.isArray(srvJson.data)) {
          const filtered = srvJson.data.filter(s => s.type === targetType).map(s => s.serverName);
          if (filtered.length > 0) candidateServers = filtered;
        }
      } catch (_) {}

      if (isMounted) {
        setAvailableServers(candidateServers);
        resolveCurrentStream(candidateServers, 0);
      }
    };

    bootstrapStream();
    return () => { isMounted = false; };
  }, [animeId, episodeNum, targetType, resolveCurrentStream]);

  // =========================================================================
  // 5. WEBVTT SUBTITLE ENGINE (BINARY SEARCH LOOKUP)
  // =========================================================================
  useEffect(() => {
    if (selectedSubTrackIndex < 0 || !subtitleTracks[selectedSubTrackIndex]) {
      setParsedCues([]);
      setCurrentSubtitleText('');
      return;
    }

    const track = subtitleTracks[selectedSubTrackIndex];
    const fileUrl = track.file;
    if (!fileUrl) return;

    if (memoryCache.parsedSubtitles.has(fileUrl)) {
      setParsedCues(memoryCache.parsedSubtitles.get(fileUrl));
      return;
    }

    let isAborted = false;

    const fetchAndParseVTT = async () => {
      try {
        const res = await fetch(fileUrl);
        if (!res.ok) return;
        const rawText = await res.text();
        if (isAborted) return;

        const cues = [];
        const blocks = rawText.split(/\r?\n\r?\n/);

        const parseTimestamp = (ts) => {
          if (!ts) return 0;
          const cleanTs = ts.trim().replace(',', '.');
          const parts = cleanTs.split(':');
          let s = 0;
          if (parts.length === 3) {
            s = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
          } else if (parts.length === 2) {
            s = parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
          }
          return Math.round(s * 1000);
        };

        for (const block of blocks) {
          const lines = block.split(/\r?\n/);
          const timeIndex = lines.findIndex(l => l.includes('-->'));
          if (timeIndex === -1) continue;

          const [startRaw, endRaw] = lines[timeIndex].split('-->');
          if (!startRaw || !endRaw) continue;

          const startMs = parseTimestamp(startRaw);
          const endMs = parseTimestamp(endRaw.trim().split(' ')[0]);

          const textPayload = lines.slice(timeIndex + 1)
            .filter(l => !l.startsWith('WEBVTT') && !l.startsWith('NOTE') && l.trim() !== '')
            .join('\n')
            .replace(/<[^>]+>/g, '')
            .trim();

          if (textPayload) {
            cues.push({ startMs, endMs, text: textPayload });
          }
        }

        // Sort monotonically by startMs
        cues.sort((a, b) => a.startMs - b.startMs);
        memoryCache.parsedSubtitles.set(fileUrl, cues);
        if (!isAborted) setParsedCues(cues);
      } catch (_) {}
    };

    fetchAndParseVTT();
    return () => { isAborted = true; };
  }, [selectedSubTrackIndex, subtitleTracks]);

  // Binary search lookup for high-frequency subtitle syncing
  const getActiveSubtitleAtTime = useCallback((currMs) => {
    if (!parsedCues || parsedCues.length === 0) return '';

    let low = 0;
    let high = parsedCues.length - 1;
    let index = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (parsedCues[mid].startMs <= currMs) {
        index = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (index === -1) return '';

    // Search back up to 25 seconds for overlapping/long-duration cues
    const activeTexts = [];
    const minLookback = currMs - 25000;

    for (let i = index; i >= 0; i--) {
      const cue = parsedCues[i];
      if (cue.startMs < minLookback) break;
      if (currMs >= cue.startMs && currMs <= cue.endMs) {
        activeTexts.unshift(cue.text);
      }
    }

    return activeTexts.join('\n');
  }, [parsedCues]);

  // =========================================================================
  // 6. ANIMATION & OVERLAY DRIVERS
  // =========================================================================
  const triggerNetflixMetadataBanner = useCallback(() => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    Animated.timing(metaOverlayOpacity, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true
    }).start();

    overlayTimerRef.current = setTimeout(() => {
      Animated.timing(metaOverlayOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true
      }).start();
    }, 5500);
  }, [metaOverlayOpacity]);

  const openDrawer = (panelType) => {
    setActiveDrawer(panelType);
    Animated.spring(drawerAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: panelWidth,
      duration: 250,
      useNativeDriver: true
    }).start(() => setActiveDrawer(null));
  };

  const showControls = useCallback(() => {
    setShowUI(true);
    Animated.timing(uiOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true
    }).start();
    resetHideTimer();
  }, [uiOpacity]);

  const hideControls = useCallback(() => {
    if (activeDrawer !== null || isScrubbing) return;
    Animated.timing(uiOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true
    }).start(() => setShowUI(false));
  }, [uiOpacity, activeDrawer, isScrubbing]);

  const toggleControls = useCallback(() => {
    if (showUI) hideControls();
    else showControls();
  }, [showUI, hideControls, showControls]);

  const resetHideTimer = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (statusRef.current?.isPlaying && activeDrawer === null && !isScrubbing) {
        hideControls();
      }
    }, AUTO_HIDE_DELAY);
  }, [activeDrawer, isScrubbing, hideControls]);

  // =========================================================================
  // 7. PLAYBACK STATUS & TICK ENGINE
  // =========================================================================
  const onPlaybackStatusUpdate = (playbackStatus) => {
    statusRef.current = playbackStatus;
    setStatus(playbackStatus);

    if (playbackStatus.isLoaded) {
      if (!isReady) setIsReady(true);

      const posMs = playbackStatus.positionMillis || 0;
      const durMs = playbackStatus.durationMillis || 1;
      const currSec = Math.floor(posMs / 1000);
      const durSec = Math.floor(durMs / 1000);

      // Subtitle Sync
      if (selectedSubTrackIndex >= 0) {
        const text = getActiveSubtitleAtTime(posMs);
        if (text !== currentSubtitleText) {
          setCurrentSubtitleText(text);
        }
      }

      // Intro Region Trigger
      if (introRegion.end > 0 && currSec >= introRegion.start && currSec < introRegion.end) {
        if (!inIntro) {
          setInIntro(true);
          Animated.spring(skipButtonAnim, { toValue: 1, useNativeDriver: true }).start();
        }
      } else if (inIntro) {
        setInIntro(false);
        Animated.timing(skipButtonAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }

      // Outro Region Trigger
      const computedOutroStart = outroRegion.start > 0 ? outroRegion.start : (durSec > 90 ? durSec - FALLBACK_OUTRO_SECONDS : -1);
      if (computedOutroStart > 0 && currSec >= computedOutroStart) {
        if (!inOutro) {
          setInOutro(true);
          if (hasNextEpisode && !nextEpisodeDismissed) {
            Animated.spring(nextCardAnim, { toValue: 1, useNativeDriver: true }).start();
          }
        }
      } else if (inOutro) {
        setInOutro(false);
      }

      // Firestore Watched Progress Sync
      if (userUid && animeId && playbackStatus.isPlaying && currSec > 0 && currSec % 10 === 0) {
        const finished = currSec > durSec * 0.88;
        firestore().collection('users').doc(userUid).collection('progress').doc(String(animeId)).set({
          animeId: String(animeId),
          lastWatchedEp: episodeNum,
          progress: currSec,
          duration: durSec,
          finishedEp: finished,
          timestamp: Date.now()
        }, { merge: true }).catch(() => {});
      }
    }
  };

  // =========================================================================
  // 8. DOUBLE-TAP SEEK ACCUMULATION
  // =========================================================================
  const handleSeekDelta = (deltaSec) => {
    if (!videoRef.current || !statusRef.current?.isLoaded) return;

    const currentPosition = statusRef.current.positionMillis || 0;
    const duration = statusRef.current.durationMillis || 0;
    const target = Math.max(0, Math.min(duration, currentPosition + (deltaSec * 1000)));

    videoRef.current.setPositionAsync(target);
    resetHideTimer();
  };

  const handleDoubleTap = (side) => {
    const isForward = side === 'right';
    const increment = isForward ? 10 : -10;

    setSeekDirection(isForward ? 'forward' : 'backward');
    setSeekDelta(prev => (prev === 0 || (isForward && prev < 0) || (!isForward && prev > 0)) ? increment : prev + increment);

    Animated.sequence([
      Animated.timing(seekIndicatorAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(650),
      Animated.timing(seekIndicatorAnim, { toValue: 0, duration: 250, useNativeDriver: true })
    ]).start(() => setSeekDelta(0));

    handleSeekDelta(increment);
  };

  // =========================================================================
  // 9. DUAL-ZONE SWIPE GESTURES (BRIGHTNESS / VOLUME)
  // =========================================================================
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 18 && Math.abs(g.dx) < 22,
    onPanResponderMove: (_, g) => {
      const isLeft = g.moveX < windowWidth / 2;
      if (isLeft) {
        // Brightness dimming
        setBrightnessLevel(prev => {
          const next = Math.max(0, Math.min(0.85, prev + (g.dy * 0.0035)));
          setToastMessage(`Brightness: ${Math.round((1 - next) * 100)}%`);
          return next;
        });
      } else {
        // Volume adjustment (0% to 200%)
        setVolumeLevel(prev => {
          const next = Math.max(0, Math.min(2.0, prev - (g.dy * 0.005)));
          if (videoRef.current) {
            videoRef.current.setVolumeAsync(Math.min(next, 1.0));
          }
          setToastMessage(`Volume: ${Math.round(next * 100)}%`);
          return next;
        });
      }
    },
    onPanResponderRelease: () => {
      setTimeout(() => setToastMessage(null), 1200);
    }
  }), [windowWidth]);

  // Handle single and double tap delegation
  const handleTouchZone = (evt) => {
    if (activeDrawer !== null) {
      closeDrawer();
      return;
    }

    const now = Date.now();
    const touchX = evt.nativeEvent.locationX;
    const isDoubleTap = now - lastTapRef.current < 280;
    lastTapRef.current = now;

    if (isDoubleTap) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (touchX < windowWidth * 0.35) {
        handleDoubleTap('left');
      } else if (touchX > windowWidth * 0.65) {
        handleDoubleTap('right');
      } else {
        toggleControls();
      }
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        toggleControls();
      }, 290);
    }
  };

  // =========================================================================
  // 10. SEEK TIMELINE & BUTTON HANDLERS
  // =========================================================================
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (status.isPlaying) {
      videoRef.current.pauseAsync();
    } else {
      videoRef.current.playAsync();
    }
    resetHideTimer();
  };

  const handleSlidingStart = () => {
    setIsScrubbing(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
  };

  const handleSliderValueChange = (val) => {
    setScrubPosition(val);
  };

  const handleSlidingComplete = async (val) => {
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(val);
    }
    setIsScrubbing(false);
    resetHideTimer();
  };

  const formatTimestamp = (millis) => {
    if (!millis || isNaN(millis)) return "00:00";
    const totalSecs = Math.floor(millis / 1000);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // =========================================================================
  // 11. SUBTITLE VERTICAL OFFSET CALCULATION
  // =========================================================================
  const computedSubtitleBottom = useMemo(() => {
    let offset = subElevation;
    if (showUI) offset += 72; // Move up to avoid bottom timeline
    if (inIntro || (inOutro && hasNextEpisode && !nextEpisodeDismissed)) offset += 45; // Move up to avoid cards
    return offset;
  }, [subElevation, showUI, inIntro, inOutro, hasNextEpisode, nextEpisodeDismissed]);

  // =========================================================================
  // 12. RENDER: LOADERS & FATAL ERRORS
  // =========================================================================
  if (loadingStream) {
    return (
      <View style={styles.blackBackgroundCenter}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingStreamText}>Connecting to secure stream...</Text>
      </View>
    );
  }

  if (fatalError || !streamData) {
    return (
      <View style={styles.blackBackgroundCenter}>
        <Text style={styles.errorHeader}>Unable to play this episode</Text>
        <Text style={styles.errorSub}>{fatalError || "A network or server issue prevented playback."}</Text>
        <View style={styles.errorButtonsRow}>
          <PressableScale 
            style={styles.errorActionButton} 
            onPress={() => resolveCurrentStream(availableServers, (currentServerIndex + 1) % availableServers.length)}
          >
            <Text style={styles.errorActionText}>Change Server</Text>
          </PressableScale>
          <PressableScale 
            style={[styles.errorActionButton, { backgroundColor: BRAND_RED }]} 
            onPress={() => resolveCurrentStream(availableServers, currentServerIndex)}
          >
            <Text style={styles.errorActionText}>Retry</Text>
          </PressableScale>
          <PressableScale style={styles.errorActionButton} onPress={handleExitPlayer}>
            <Text style={styles.errorActionText}>Go Back</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  // =========================================================================
  // 13. MAIN PLAYER INTERFACE
  // =========================================================================
  return (
    <View style={styles.rootContainer}>
      {/* NATIVE EXPO-AV VIDEO ENGINE */}
      <Video
        ref={videoRef}
        style={StyleSheet.absoluteFillObject}
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
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        shouldPlay
      />

      {/* HARDWARE BRIGHTNESS DIMMING OVERLAY */}
      <View 
        style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${brightnessLevel})` }]} 
        pointerEvents="none" 
      />

      {/* TOAST GESTURE INDICATOR */}
      {toastMessage && (
        <View style={styles.toastContainer} pointerEvents="none">
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* SUBTITLE RENDERER */}
      {selectedSubTrackIndex >= 0 && currentSubtitleText !== '' && (
        <View 
          style={[styles.subtitleContainer, { bottom: computedSubtitleBottom }]} 
          pointerEvents="none"
        >
          <Text 
            style={[
              styles.subtitleText, 
              { 
                color: subColor, 
                fontSize: subSize, 
                backgroundColor: `rgba(0,0,0,${subBgOpacity})` 
              }
            ]}
          >
            {currentSubtitleText}
          </Text>
        </View>
      )}

      {/* WHITE BUFFERING INDICATOR */}
      {(!status.isLoaded || status.isBuffering) && (
        <View style={styles.bufferingContainer} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* DOUBLE TAP ACCUMULATIVE SEEK INDICATOR */}
      <Animated.View 
        style={[
          styles.seekIndicatorContainer,
          seekDirection === 'left' ? styles.seekLeftPos : styles.seekRightPos,
          { opacity: seekIndicatorAnim, transform: [{ scale: seekIndicatorAnim }] }
        ]} 
        pointerEvents="none"
      >
        {seekDirection === 'left' ? <IconReplay10 size={36} /> : <IconForward10 size={36} />}
        <Text style={styles.seekIndicatorText}>{Math.abs(seekDelta)} seconds</Text>
      </Animated.View>

      {/* TOUCH LISTENER & PAN RESPONDER LAYER */}
      <View {...panResponder.panHandlers} style={StyleSheet.absoluteFillObject}>
        <TouchableWithoutFeedback onPress={handleTouchZone}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      </View>

      {/* NETFLIX-STYLE METADATA BANNER OVERLAY */}
      {tmdbMeta && (
        <Animated.View 
          style={[styles.netflixMetaOverlay, { opacity: metaOverlayOpacity }]} 
          pointerEvents="none"
        >
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="metaGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.88" />
                <Stop offset="0.65" stopColor="#000000" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#metaGrad)" />
          </Svg>
          <View style={styles.metaContentBox}>
            <View style={styles.metaHeaderRow}>
              {tmdbMeta.certification && (
                <View style={styles.certBadge}>
                  <Text style={styles.certBadgeText}>{tmdbMeta.certification}</Text>
                </View>
              )}
              {tmdbMeta.genres ? <Text style={styles.genreTags}>{tmdbMeta.genres}</Text> : null}
            </View>
            <Text style={styles.metaEpisodeTitle} numberOfLines={1}>
              S{tmdbMeta.seasonNumber} E{tmdbMeta.episodeNumber} — {tmdbMeta.title}
            </Text>
            {tmdbMeta.overview ? (
              <Text style={styles.metaOverviewText} numberOfLines={3}>
                {tmdbMeta.overview}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      )}

      {/* SKIP INTRO BUTTON */}
      {inIntro && (
        <Animated.View 
          style={[
            styles.skipIntroContainer, 
            { opacity: skipButtonAnim, transform: [{ scale: skipButtonAnim }] }
          ]}
        >
          <PressableScale 
            style={styles.skipIntroButton}
            onPress={() => videoRef.current?.setPositionAsync(introRegion.end * 1000)}
          >
            <Text style={styles.skipIntroText}>Skip Intro</Text>
            <IconForward10 size={16} color="#000" />
          </PressableScale>
        </Animated.View>
      )}

      {/* SKIP OUTRO / PLAY NEXT EPISODE CARD */}
      {inOutro && hasNextEpisode && !nextEpisodeDismissed && (
        <Animated.View 
          style={[
            styles.nextCardContainer, 
            { opacity: nextCardAnim, transform: [{ scale: nextCardAnim }] }
          ]}
        >
          <View style={styles.nextCardHeader}>
            <Text style={styles.nextCardSubtitle}>NEXT EPISODE</Text>
            <TouchableOpacity onPress={() => setNextEpisodeDismissed(true)}>
              <Text style={styles.nextCardDismiss}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.nextCardTitle}>Episode {parseInt(episodeNum, 10) + 1}</Text>
          <PressableScale style={styles.nextCardPlayBtn} onPress={handleNextEpisode}>
            <IconPlay size={16} color="#000" />
            <Text style={styles.nextCardPlayBtnText}>Play Next</Text>
          </PressableScale>
        </Animated.View>
      )}

      {/* CINEMATIC GRADIENT & PLAYER CONTROL DECK */}
      <Animated.View 
        style={[styles.controlsDeck, { opacity: uiOpacity }]} 
        pointerEvents={showUI ? 'auto' : 'none'}
      >
        {/* TOP GRADIENT BAR */}
        <View style={styles.topControlBar}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Defs>
              <LinearGradient id="topGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.9" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#topGradient)" />
          </Svg>

          <PressableScale style={styles.topBarBackButton} onPress={handleExitPlayer}>
            <IconBackArrow size={26} />
          </PressableScale>

          <View style={styles.topBarTitleBox}>
            <Text style={styles.topAnimeTitle} numberOfLines={1}>{animeTitle}</Text>
            <Text style={styles.topEpisodeSubtitle}>
              {tmdbMeta ? `Season ${tmdbMeta.seasonNumber} • Episode ${tmdbMeta.episodeNumber}` : `Episode ${episodeNum}`}
            </Text>
          </View>
        </View>

        {/* CENTER TRANSPORT CONTROLS */}
        <View style={styles.centerControlDeck} pointerEvents="box-none">
          <PressableScale style={styles.circleActionButton} onPress={() => handleSeekDelta(-10)}>
            <IconReplay10 size={30} />
          </PressableScale>

          <PressableScale style={styles.circlePlayPauseButton} onPress={togglePlayPause}>
            {status.isPlaying ? <IconPause size={38} /> : <IconPlay size={38} />}
          </PressableScale>

          <PressableScale style={styles.circleActionButton} onPress={() => handleSeekDelta(10)}>
            <IconForward10 size={30} />
          </PressableScale>
        </View>

        {/* BOTTOM TIMELINE & DRAWER TRIGGERS */}
        <View style={styles.bottomControlBar}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Defs>
              <LinearGradient id="botGradient" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.96" />
                <Stop offset="0.75" stopColor="#000000" stopOpacity="0.6" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#botGradient)" />
          </Svg>

          {/* SCRUBBING TIMELINE */}
          <View style={styles.timelineRow}>
            <Text style={styles.timestampText}>
              {formatTimestamp(isScrubbing ? scrubPosition : status.positionMillis)}
            </Text>
            <Slider
              style={styles.timelineSlider}
              minimumValue={0}
              maximumValue={status.durationMillis || 100}
              value={isScrubbing ? scrubPosition : (status.positionMillis || 0)}
              minimumTrackTintColor={BRAND_RED}
              maximumTrackTintColor="rgba(255,255,255,0.25)"
              thumbTintColor={BRAND_RED}
              onSlidingStart={handleSlidingStart}
              onValueChange={handleSliderValueChange}
              onSlidingComplete={handleSlidingComplete}
            />
            <Text style={styles.timestampText}>
              {formatTimestamp(status.durationMillis)}
            </Text>
          </View>

          {/* ACTION BUTTONS ROW */}
          <View style={styles.bottomActionButtonsRow}>
            <View style={styles.leftActionCluster}>
              <PressableScale style={styles.iconHitBox} onPress={() => openDrawer('subtitles')}>
                <IconSubtitles size={22} color={selectedSubTrackIndex >= 0 ? BRAND_RED : "#FFF"} />
              </PressableScale>
            </View>

            <View style={styles.rightActionCluster}>
              {introRegion.end > 0 && (
                <PressableScale 
                  style={styles.miniInlineSkipBtn} 
                  onPress={() => videoRef.current?.setPositionAsync(introRegion.end * 1000)}
                >
                  <Text style={styles.miniInlineSkipText}>Skip Intro</Text>
                </PressableScale>
              )}

              {hasNextEpisode && (
                <PressableScale style={styles.iconHitBox} onPress={handleNextEpisode}>
                  <IconNextEp size={22} />
                </PressableScale>
              )}

              <PressableScale style={styles.iconHitBox} onPress={() => openDrawer('main')}>
                <IconSettings size={22} />
              </PressableScale>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* =========================================================================
          NETFLIX-STYLE RIGHT SLIDING DRAWER PANELS
         ========================================================================= */}
      {activeDrawer !== null && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <View style={styles.drawerBackdrop} />
          </TouchableWithoutFeedback>

          <Animated.View 
            style={[
              styles.drawerContainer, 
              { width: panelWidth, transform: [{ translateX: drawerAnim }] }
            ]}
          >
            {/* MAIN SETTINGS PANEL */}
            {activeDrawer === 'main' && (
              <ScrollView style={styles.drawerScroll} bounces={false}>
                <Text style={styles.drawerHeader}>Settings</Text>

                <TouchableOpacity style={styles.drawerRow} onPress={() => setActiveDrawer('quality')}>
                  <Text style={styles.drawerRowTitle}>Quality</Text>
                  <Text style={styles.drawerRowValue}>Auto ›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerRow} onPress={() => setActiveDrawer('audio')}>
                  <Text style={styles.drawerRowTitle}>Audio</Text>
                  <Text style={styles.drawerRowValue}>{targetType === 'dub' ? 'English' : 'Japanese'} ›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerRow} onPress={() => setActiveDrawer('subtitles')}>
                  <Text style={styles.drawerRowTitle}>Subtitles</Text>
                  <Text style={styles.drawerRowValue}>
                    {selectedSubTrackIndex >= 0 ? subtitleTracks[selectedSubTrackIndex]?.label || 'On' : 'Off'} ›
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.drawerRow} onPress={() => setActiveDrawer('subtitle_style')}>
                  <Text style={styles.drawerRowTitle}>Subtitle Style</Text>
                  <Text style={styles.drawerRowValue}>Customize ›</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.drawerRow} 
                  onPress={() => {
                    const nextSpeed = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
                    setPlaybackSpeed(nextSpeed);
                    videoRef.current?.setRateAsync(nextSpeed, true);
                  }}
                >
                  <Text style={styles.drawerRowTitle}>Playback Speed</Text>
                  <Text style={styles.drawerRowValue}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.drawerRow} 
                  onPress={() => setResizeMode(resizeMode === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN)}
                >
                  <Text style={styles.drawerRowTitle}>Aspect Ratio</Text>
                  <Text style={styles.drawerRowValue}>{resizeMode === ResizeMode.CONTAIN ? 'Fit' : 'Fill'}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* QUALITY PANEL */}
            {activeDrawer === 'quality' && (
              <ScrollView style={styles.drawerScroll} bounces={false}>
                <TouchableOpacity style={styles.drawerBackNav} onPress={() => setActiveDrawer('main')}>
                  <Text style={styles.drawerBackNavText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.drawerHeader}>Quality</Text>

                <TouchableOpacity style={styles.drawerSelectableRow} onPress={closeDrawer}>
                  <Text style={[styles.drawerSelectableText, { color: BRAND_RED }]}>Auto (HLS Stream)</Text>
                  <IconCheck size={18} />
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* AUDIO PANEL */}
            {activeDrawer === 'audio' && (
              <ScrollView style={styles.drawerScroll} bounces={false}>
                <TouchableOpacity style={styles.drawerBackNav} onPress={() => setActiveDrawer('main')}>
                  <Text style={styles.drawerBackNavText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.drawerHeader}>Audio</Text>

                <TouchableOpacity style={styles.drawerSelectableRow} onPress={closeDrawer}>
                  <Text style={[styles.drawerSelectableText, { color: BRAND_RED }]}>
                    {targetType === 'dub' ? 'English (Stream Default)' : 'Japanese (Original)'}
                  </Text>
                  <IconCheck size={18} />
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* SUBTITLES PANEL */}
            {activeDrawer === 'subtitles' && (
              <ScrollView style={styles.drawerScroll} bounces={false}>
                <TouchableOpacity style={styles.drawerBackNav} onPress={() => setActiveDrawer('main')}>
                  <Text style={styles.drawerBackNavText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.drawerHeader}>Subtitles</Text>

                <TouchableOpacity 
                  style={styles.drawerSelectableRow} 
                  onPress={() => { setSelectedSubTrackIndex(-1); closeDrawer(); }}
                >
                  <Text style={[styles.drawerSelectableText, selectedSubTrackIndex === -1 && { color: BRAND_RED }]}>
                    Off
                  </Text>
                  {selectedSubTrackIndex === -1 && <IconCheck size={18} />}
                </TouchableOpacity>

                {subtitleTracks.map((item, idx) => (
                  <TouchableOpacity 
                    key={idx} 
                    style={styles.drawerSelectableRow} 
                    onPress={() => { setSelectedSubTrackIndex(idx); closeDrawer(); }}
                  >
                    <Text style={[styles.drawerSelectableText, selectedSubTrackIndex === idx && { color: BRAND_RED }]}>
                      {item.label || `Track ${idx + 1}`}
                    </Text>
                    {selectedSubTrackIndex === idx && <IconCheck size={18} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* SUBTITLE STYLES PANEL */}
            {activeDrawer === 'subtitle_style' && (
              <ScrollView style={styles.drawerScroll} bounces={false}>
                <TouchableOpacity style={styles.drawerBackNav} onPress={() => setActiveDrawer('main')}>
                  <Text style={styles.drawerBackNavText}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.drawerHeader}>Subtitle Styles</Text>

                <Text style={styles.drawerSectionLabel}>Text Color</Text>
                <View style={styles.colorPaletteRow}>
                  {['#FFFFFF', '#F47521', '#FACC15', '#4ADE80'].map(hex => (
                    <TouchableOpacity 
                      key={hex} 
                      onPress={() => setSubColor(hex)} 
                      style={[styles.colorBubble, { backgroundColor: hex }, subColor === hex && styles.colorBubbleActive]} 
                    />
                  ))}
                </View>

                <Text style={styles.drawerSectionLabel}>Font Size</Text>
                <View style={styles.pillSelectionRow}>
                  {[14, 16, 20, 24].map(px => (
                    <TouchableOpacity 
                      key={px} 
                      onPress={() => setSubSize(px)} 
                      style={[styles.pillButton, subSize === px && styles.pillButtonActive]}
                    >
                      <Text style={[styles.pillButtonText, subSize === px && { color: BRAND_RED }]}>{px}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.drawerSectionLabel}>Position Offset</Text>
                <View style={styles.pillSelectionRow}>
                  {[20, 35, 60].map(h => (
                    <TouchableOpacity 
                      key={h} 
                      onPress={() => setSubElevation(h)} 
                      style={[styles.pillButton, subElevation === h && styles.pillButtonActive]}
                    >
                      <Text style={[styles.pillButtonText, subElevation === h && { color: BRAND_RED }]}>{h}px</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.drawerSectionLabel}>Background Opacity</Text>
                <View style={styles.pillSelectionRow}>
                  {[0.0, 0.45, 0.75].map(op => (
                    <TouchableOpacity 
                      key={op} 
                      onPress={() => setSubBgOpacity(op)} 
                      style={[styles.pillButton, subBgOpacity === op && styles.pillButtonActive]}
                    >
                      <Text style={[styles.pillButtonText, subBgOpacity === op && { color: BRAND_RED }]}>
                        {op === 0.0 ? 'None' : `${Math.round(op * 100)}%`}
                      </Text>
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

// =========================================================================
// STYLES
// =========================================================================
const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#000000' },
  blackBackgroundCenter: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingStreamText: { color: '#888888', marginTop: 14, fontSize: 13, letterSpacing: 0.5 },
  bufferingContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 4 },

  // Toast Notifications
  toastContainer: { 
    position: 'absolute', 
    top: 36, 
    alignSelf: 'center', 
    backgroundColor: 'rgba(0,0,0,0.82)', 
    paddingHorizontal: 18, 
    paddingVertical: 7, 
    borderRadius: 20, 
    zIndex: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  toastText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Subtitles
  subtitleContainer: { position: 'absolute', width: '100%', alignItems: 'center', zIndex: 9, paddingHorizontal: 40 },
  subtitleText: { 
    fontWeight: '900', 
    textAlign: 'center', 
    textShadowColor: '#000000', 
    textShadowOffset: { width: 1, height: 1 }, 
    textShadowRadius: 4, 
    paddingHorizontal: 10, 
    paddingVertical: 3, 
    borderRadius: 4 
  },

  // Seeking Bubbles
  seekIndicatorContainer: { 
    position: 'absolute', 
    top: '40%', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.72)', 
    padding: 20, 
    borderRadius: 50,
    zIndex: 15
  },
  seekLeftPos: { left: '16%' },
  seekRightPos: { right: '16%' },
  seekIndicatorText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 6 },

  // Netflix Metadata Banner
  netflixMetaOverlay: {
    position: 'absolute',
    top: 72,
    left: 28,
    width: 380,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 16,
    zIndex: 8
  },
  metaContentBox: { zIndex: 2 },
  metaHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  certBadge: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  certBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  genreTags: { color: '#CCCCCC', fontSize: 11, fontWeight: '600' },
  metaEpisodeTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginVertical: 4 },
  metaOverviewText: { color: '#BBBBBB', fontSize: 11, lineHeight: 15 },

  // Skip Intro Floating Button
  skipIntroContainer: { position: 'absolute', bottom: 110, right: 34, zIndex: 30 },
  skipIntroButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFFFFF', 
    paddingHorizontal: 16, 
    paddingVertical: 9, 
    borderRadius: 6, 
    gap: 6 
  },
  skipIntroText: { color: '#000000', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },

  // Next Episode Card
  nextCardContainer: {
    position: 'absolute',
    bottom: 95,
    right: 30,
    backgroundColor: 'rgba(18,18,18,0.95)',
    borderRadius: 10,
    padding: 16,
    width: 220,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 30
  },
  nextCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nextCardSubtitle: { color: '#888888', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  nextCardDismiss: { color: '#AAAAAA', fontSize: 13, fontWeight: '700' },
  nextCardTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 12 },
  nextCardPlayBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#FFFFFF', 
    paddingVertical: 8, 
    borderRadius: 5, 
    gap: 6 
  },
  nextCardPlayBtnText: { color: '#000000', fontSize: 12, fontWeight: '800' },

  // Controls Deck Layout
  controlsDeck: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  topControlBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 26, paddingTop: 20, paddingBottom: 28, width: '100%' },
  topBarBackButton: { marginRight: 18 },
  topBarTitleBox: { flex: 1 },
  topAnimeTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  topEpisodeSubtitle: { color: '#AAAAAA', fontSize: 12, fontWeight: '600', marginTop: 2 },

  // Transport Center Controls
  centerControlDeck: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 48 },
  circlePlayPauseButton: { 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    backgroundColor: 'rgba(0,0,0,0.55)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 1.5, 
    borderColor: 'rgba(255,255,255,0.2)' 
  },
  circleActionButton: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: 'rgba(0,0,0,0.4)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },

  // Bottom Controls
  bottomControlBar: { width: '100%', paddingHorizontal: 28, paddingBottom: 22, paddingTop: 30 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  timestampText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timelineSlider: { flex: 1, marginHorizontal: 10, height: 38 },
  bottomActionButtonsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  leftActionCluster: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  rightActionCluster: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  iconHitBox: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },

  miniInlineSkipBtn: { backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  miniInlineSkipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  // Drawer Side Panel System
  drawerBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  drawerContainer: { 
    position: 'absolute', 
    right: 0, 
    top: 0, 
    bottom: 0, 
    backgroundColor: 'rgba(16,16,16,0.96)', 
    borderTopLeftRadius: 16, 
    borderBottomLeftRadius: 16, 
    borderLeftWidth: 1, 
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 40 
  },
  drawerScroll: { padding: 22 },
  drawerHeader: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 16 },
  drawerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.06)' 
  },
  drawerRowTitle: { color: '#DDDDDD', fontSize: 14, fontWeight: '600' },
  drawerRowValue: { color: BRAND_RED, fontSize: 13, fontWeight: '700' },

  drawerBackNav: { marginBottom: 14 },
  drawerBackNavText: { color: BRAND_RED, fontSize: 14, fontWeight: '800' },
  drawerSelectableRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 13, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(255,255,255,0.05)' 
  },
  drawerSelectableText: { color: '#DDDDDD', fontSize: 14, fontWeight: '600' },

  drawerSectionLabel: { color: '#777777', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  colorPaletteRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  colorBubble: { width: 26, height: 26, borderRadius: 13 },
  colorBubbleActive: { borderWidth: 2.5, borderColor: '#FFFFFF' },
  pillSelectionRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  pillButton: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 5 },
  pillButtonActive: { borderColor: BRAND_RED, borderWidth: 1 },
  pillButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  // Error Card System
  errorHeader: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  errorSub: { color: '#888888', fontSize: 12, textAlign: 'center', marginBottom: 24, maxWidth: 380 },
  errorButtonsRow: { flexDirection: 'row', gap: 14 },
  errorActionButton: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 6 },
  errorActionText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 }
});
