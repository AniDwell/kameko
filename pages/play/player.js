import React, { 
  useState, 
  useEffect, 
  useRef, 
  useMemo, 
  useCallback 
} from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Dimensions, 
  ActivityIndicator, 
  StatusBar, 
  BackHandler,
  TouchableWithoutFeedback, 
  PanResponder,
  ScrollView,
  useWindowDimensions
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path, Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

// --- CONSTANTS & CONFIGURATION ---
const BRAND_RED = '#E50914';
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';
const DEFAULT_OUTRO_DURATION_SEC = 45;

// --- IN-MEMORY GLOBAL CACHE ---
const tmdbCache = {
  seriesQueries: new Map(),
  seasonMaps: new Map(),
  episodeData: new Map()
};
const subtitleCache = new Map();

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
  const startsWithBonus = norm1.startsWith(norm2) || norm2.startsWith(norm1) ? 0.2 : 0;
  return Math.min(1.0, jaccard + startsWithBonus);
};

// --- TIMESTAMP UTILITIES ---
const parseVttTimestamp = (ts = '') => {
  if (!ts) return 0;
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':');
  let seconds = 0;
  if (parts.length === 3) {
    seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return Math.round(seconds * 1000);
};

const formatTime = (millis) => {
  if (isNaN(millis) || millis < 0) return "00:00";
  const totalSecs = Math.floor(millis / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSecs % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
};

// --- HIGH-PERFORMANCE SVG ICONS ---
const IconPlay = ({ size = 32, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);
const IconPause = ({ size = 32, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </Svg>
);
const IconReplay10 = ({ size = 28, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M12 4V1L8 5l4 4V6a6 6 0 11-6 6H4a8 8 0 108-8z" />
  </Svg>
);
const IconForward10 = ({ size = 28, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M12 4V1l4 4-4 4V6a6 6 0 106 6h2a8 8 0 11-8-8z" />
  </Svg>
);
const IconSettings = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
  </Svg>
);
const IconSubs = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Rect x="3" y="5" width="18" height="14" rx="2" ry="2" />
    <Path d="M7 15h3m4 0h3M7 9h10" />
  </Svg>
);
const IconSkipNext = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M5 4l10 8-10 8V4z" />
    <Path d="M19 5v14" />
  </Svg>
);
const IconBack = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <Path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);
const IconCheck = ({ size = 16, color = BRAND_RED }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3">
    <Path d="M20 6L9 17l-5-5" />
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

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const responsivePanelWidth = useMemo(() => Math.min(windowWidth * 0.78, 380), [windowWidth]);

  const videoRef = useRef(null);

  // --- ANIMATED CONTROLLERS ---
  const uiOpacity = useRef(new Animated.Value(1)).current;
  const infoOverlayOpacity = useRef(new Animated.Value(0)).current;
  const skipIntroAnim = useRef(new Animated.Value(0)).current;
  const skipOutroAnim = useRef(new Animated.Value(0)).current;
  const nextCardAnim = useRef(new Animated.Value(0)).current;
  const panelTranslateX = useRef(new Animated.Value(450)).current;
  const panelBackdropOpacity = useRef(new Animated.Value(0)).current;
  const doubleTapLeftAnim = useRef(new Animated.Value(0)).current;
  const doubleTapRightAnim = useRef(new Animated.Value(0)).current;

  // --- PLAYBACK STATES ---
  const [status, setStatus] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isBufferingDebounced, setIsBufferingDebounced] = useState(false);

  // --- STREAM & SERVER RESOLUTION ---
  const [streamData, setStreamData] = useState(null);
  const [loadingStream, setLoadingStream] = useState(true);
  const [fatalError, setFatalError] = useState(null);
  const [activeServerName, setActiveServerName] = useState('hd-1');

  // --- SEASONS & EPISODE TRANSITION STATES ---
  const [hasNextEp, setHasNextEp] = useState(false);
  const [nextEpData, setNextEpData] = useState(null);
  const [introRegion, setIntroRegion] = useState({ start: 0, end: 0 });
  const [outroRegion, setOutroRegion] = useState({ start: 0, end: 0 });
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [showNextCard, setShowNextCard] = useState(false);
  const [isNextCardDismissed, setIsNextCardDismissed] = useState(false);

  // --- TMDB METADATA ---
  const [tmdbMeta, setTmdbMeta] = useState(null);

  // --- SIDE PANELS (NETFLIX ARCHITECTURE) ---
  // Active Panel: null | 'main' | 'quality' | 'audio' | 'subtitles' | 'subtitle_styling'
  const [activePanel, setActivePanel] = useState(null);

  // --- SUBTITLE ENGINE STATE ---
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [availableSubTracks, setAvailableSubTracks] = useState([]);
  const [selectedSubTrackUrl, setSelectedSubTrackUrl] = useState(null);
  const [parsedCues, setParsedCues] = useState([]);
  const [currentActiveSub, setCurrentActiveSub] = useState('');
  const [subStyle, setSubStyle] = useState({
    color: '#FFFFFF',
    size: 16,
    bgOpacity: 0.45,
    elevation: 35
  });

  // --- DOUBLE TAP & TIMELINE SCRUBBING ---
  const [accumulatedSeek, setAccumulatedSeek] = useState({ direction: null, seconds: 0 });
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [sliderPreviewMillis, setSliderPreviewMillis] = useState(0);

  // --- SWIPE GESTURES ---
  const [brightnessLevel, setBrightnessLevel] = useState(0); // 0 (clear) to 0.85 (dimmed)
  const [volumeLevel, setVolumeLevel] = useState(1.0); // 0.0 to 2.0
  const [gestureNotice, setGestureNotice] = useState(null);

  // --- TIMERS & REFERENCES ---
  const hideControlsTimer = useRef(null);
  const metadataTimer = useRef(null);
  const doubleTapResetTimer = useRef(null);
  const gestureNoticeTimer = useRef(null);
  const lastTapTimestamp = useRef(0);
  const lastActiveCueIndex = useRef(-1);

  // =========================================================================
  // 1. ISOLATED NEXT EPISODE NAVIGATION HOOK
  // =========================================================================
  const handleNextEpisode = useCallback(() => {
    const nextEpNum = parseInt(episodeNum, 10) + 1;
    
    // Smooth reset of current playback state
    if (videoRef.current) {
      videoRef.current.pauseAsync().catch(() => {});
    }

    // Standard Stack Replacement / Push for Seamless Episode Changing
    if (navigation?.replace) {
      navigation.replace('Player', {
        animeId: animeId,
        animeTitle: animeTitle,
        episodeNum: nextEpNum,
        episodeTitle: nextEpData?.title || `Episode ${nextEpNum}`,
        userUid: userUid,
        targetType: targetType
      });
    } else if (navigation?.navigate) {
      navigation.navigate('Player', {
        animeId: animeId,
        animeTitle: animeTitle,
        episodeNum: nextEpNum,
        episodeTitle: nextEpData?.title || `Episode ${nextEpNum}`,
        userUid: userUid,
        targetType: targetType
      });
    }
  }, [navigation, episodeNum, animeId, animeTitle, nextEpData, userUid, targetType]);

  // =========================================================================
  // 2. ORIENTATION & HARDWARE BACK QUEUE
  // =========================================================================
  const closeSidePanel = useCallback(() => {
    Animated.parallel([
      Animated.timing(panelTranslateX, {
        toValue: 450,
        duration: 250,
        useNativeDriver: true
      }),
      Animated.timing(panelBackdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      })
    ]).start(() => {
      setActivePanel(null);
      resetControlsTimeout();
    });
  }, [panelTranslateX, panelBackdropOpacity]);

  const openSidePanel = useCallback((panelName) => {
    setActivePanel(panelName);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);

    Animated.parallel([
      Animated.timing(panelTranslateX, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true
      }),
      Animated.timing(panelBackdropOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true
      })
    ]).start();
  }, [panelTranslateX, panelBackdropOpacity]);

  useEffect(() => {
    async function lockScreen() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (_) {}
      StatusBar.setHidden(true);
    }
    lockScreen();

    const handleHardwareBack = () => {
      if (activePanel) {
        if (activePanel !== 'main') {
          setActivePanel('main');
        } else {
          closeSidePanel();
        }
        return true;
      }
      if (showUI) {
        hideControlsImmediate();
        return true;
      }
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false);
      navigation.goBack();
      return true;
    };

    const backSubscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);

    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
      StatusBar.setHidden(false);
      backSubscription.remove();
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      if (metadataTimer.current) clearTimeout(metadataTimer.current);
      if (doubleTapResetTimer.current) clearTimeout(doubleTapResetTimer.current);
      if (gestureNoticeTimer.current) clearTimeout(gestureNoticeTimer.current);
    };
  }, [activePanel, showUI, navigation, closeSidePanel]);

  // =========================================================================
  // 3. TMDB SEARCH, NORMALIZED SCORING & ANILIST-TO-SEASON MAPPING
  // =========================================================================
  const showMetadataOverlay = useCallback(() => {
    if (metadataTimer.current) clearTimeout(metadataTimer.current);
    Animated.timing(infoOverlayOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true
    }).start();

    metadataTimer.current = setTimeout(() => {
      Animated.timing(infoOverlayOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true
      }).start();
    }, 6000);
  }, [infoOverlayOpacity]);

  useEffect(() => {
    let isDisposed = false;

    const resolveTMDBMetadata = async () => {
      try {
        const queryNorm = cleanTitle(animeTitle);
        let seriesInfo = tmdbCache.seriesQueries.get(queryNorm);

        if (!seriesInfo) {
          const searchEndpoint = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(animeTitle)}&include_adult=false`;
          const sRes = await fetch(searchEndpoint);
          const sJson = await sRes.json();
          const results = sJson?.results || [];

          if (results.length === 0) return;

          let bestEntry = null;
          let highestScore = -1;

          for (const item of results) {
            const scorePrimary = calculateSimilarity(animeTitle, item.name || '');
            const scoreOriginal = calculateSimilarity(animeTitle, item.original_name || '');
            const combined = Math.max(scorePrimary, scoreOriginal);
            if (combined > highestScore) {
              highestScore = combined;
              bestEntry = item;
            }
          }

          if (!bestEntry || highestScore < 0.25) return;

          const detailEndpoint = `https://api.themoviedb.org/3/tv/${bestEntry.id}?api_key=${TMDB_API_KEY}&append_to_response=content_ratings,alternative_titles`;
          const dRes = await fetch(detailEndpoint);
          seriesInfo = await dRes.json();
          tmdbCache.seriesQueries.set(queryNorm, seriesInfo);
        }

        if (isDisposed || !seriesInfo?.id) return;

        // Compile normalized season distribution map
        let seasonDistribution = tmdbCache.seasonMaps.get(seriesInfo.id);
        if (!seasonDistribution) {
          const validSeasons = (seriesInfo.seasons || [])
            .filter(s => s.season_number > 0)
            .sort((a, b) => a.season_number - b.season_number);

          let totalAccumulated = 0;
          seasonDistribution = validSeasons.map(s => {
            const entry = {
              seasonNumber: s.season_number,
              episodeCount: s.episode_count || 0,
              priorTotal: totalAccumulated
            };
            totalAccumulated += (s.episode_count || 0);
            return entry;
          });
          tmdbCache.seasonMaps.set(seriesInfo.id, seasonDistribution);
        }

        const targetGlobalEp = parseInt(episodeNum, 10) || 1;
        let mappedSeason = 1;
        let mappedEpisode = targetGlobalEp;
        let mapFound = false;

        for (const s of seasonDistribution) {
          if (targetGlobalEp > s.priorTotal && targetGlobalEp <= (s.priorTotal + s.episodeCount)) {
            mappedSeason = s.seasonNumber;
            mappedEpisode = targetGlobalEp - s.priorTotal;
            mapFound = true;
            break;
          }
        }

        // Handle continuation franchises where TMDB separates sequel seasons into discrete shows
        if (!mapFound && seasonDistribution.length > 0) {
          const lastEntry = seasonDistribution[seasonDistribution.length - 1];
          mappedSeason = lastEntry.seasonNumber;
          mappedEpisode = Math.max(1, targetGlobalEp - lastEntry.priorTotal);
        }

        // Fetch episode-level metadata
        const epKey = `tmdb_episode_${seriesInfo.id}_${mappedSeason}_${mappedEpisode}`;
        let epMetadata = tmdbCache.episodeData.get(epKey);

        if (!epMetadata) {
          const epUrl = `https://api.themoviedb.org/3/tv/${seriesInfo.id}/season/${mappedSeason}/episode/${mappedEpisode}?api_key=${TMDB_API_KEY}`;
          const epRes = await fetch(epUrl);
          if (epRes.ok) {
            epMetadata = await epRes.json();
            tmdbCache.episodeData.set(epKey, epMetadata);
          }
        }

        if (isDisposed) return;

        // Content certification extraction
        const ratings = seriesInfo.content_ratings?.results || [];
        const inCert = ratings.find(r => r.iso_3166_1 === 'IN')?.rating;
        const usCert = ratings.find(r => r.iso_3166_1 === 'US')?.rating;
        const fallbackCert = ratings[0]?.rating || null;
        const finalCert = inCert || usCert || fallbackCert;

        const genresLabel = (seriesInfo.genres || []).map(g => g.name).slice(0, 3).join(' • ');

        setTmdbMeta({
          season: mappedSeason,
          episode: mappedEpisode,
          title: epMetadata?.name || episodeTitle || `Episode ${targetGlobalEp}`,
          overview: epMetadata?.overview || seriesInfo.overview || '',
          stillPath: epMetadata?.still_path ? `https://image.tmdb.org/t/p/w500${epMetadata.still_path}` : null,
          certification: finalCert,
          genres: genresLabel
        });
        showMetadataOverlay();
      } catch (_) {}
    };

    resolveTMDBMetadata();
    return () => { isDisposed = true; };
  }, [animeTitle, episodeNum, episodeTitle, showMetadataOverlay]);

  // =========================================================================
  // 4. STREAM RESOLUTION & EPISODE VERIFICATION
  // =========================================================================
  useEffect(() => {
    let isDisposed = false;

    const initStreamPipeline = async () => {
      setLoadingStream(true);
      setFatalError(null);

      // Verify availability of the next episode
      try {
        const epListRes = await fetch(`${VERCEL_API_BASE}/api/episodes/${encodeURIComponent(animeId)}`);
        const epListJson = await epListRes.json();
        const eps = epListJson?.data || epListJson?.episodes || [];
        const nextTarget = parseInt(episodeNum, 10) + 1;
        const found = eps.find(e => parseInt(e.num || e.episode_no || e.number, 10) === nextTarget);
        if (found) {
          setHasNextEp(true);
          setNextEpData(found);
        } else {
          setHasNextEp(false);
          setNextEpData(null);
        }
      } catch (_) {
        setHasNextEp(false);
      }

      // Discover and resolve optimal stream server
      let candidateServers = ['hd-1', 'hd-2', 'vidstream-2'];
      try {
        const srvRes = await fetch(`${VERCEL_API_BASE}/api/servers?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}`);
        const srvJson = await srvRes.json();
        if (srvJson?.success && Array.isArray(srvJson?.data)) {
          const filtered = srvJson.data.filter(s => s.type === targetType).map(s => s.serverName);
          if (filtered.length > 0) candidateServers = filtered;
        }
      } catch (_) {}

      let resolvedPayload = null;
      let connectedServer = candidateServers[0];

      for (const srv of candidateServers) {
        try {
          const endpoint = `${VERCEL_API_BASE}/api/stream?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}&server=${srv}&type=${targetType}`;
          const res = await fetch(endpoint);
          const json = await res.json();
          if (json?.success && json?.data?.m3u8) {
            resolvedPayload = json.data;
            connectedServer = srv;
            break;
          }
        } catch (_) {}
      }

      if (isDisposed) return;

      if (!resolvedPayload) {
        setFatalError(`Unable to play episode ${episodeNum}. All streaming servers are currently unresponsive.`);
        setLoadingStream(false);
        return;
      }

      // Setup Outro/Intro bounds
      if (resolvedPayload.intro) {
        setIntroRegion({ start: resolvedPayload.intro.start || 0, end: resolvedPayload.intro.end || 0 });
      }
      if (resolvedPayload.outro) {
        setOutroRegion({ start: resolvedPayload.outro.start || 0, end: resolvedPayload.outro.end || 0 });
      }

      // Subtitle Track Pipeline
      if (Array.isArray(resolvedPayload.subtitles) && resolvedPayload.subtitles.length > 0) {
        setAvailableSubTracks(resolvedPayload.subtitles);
        const def = resolvedPayload.subtitles.find(s => s.default) || resolvedPayload.subtitles[0];
        setSelectedSubTrackUrl(def.file);
      } else {
        setAvailableSubTracks([]);
        setSelectedSubTrackUrl(null);
      }

      setActiveServerName(connectedServer);
      setStreamData(resolvedPayload);
      setLoadingStream(false);
    };

    initStreamPipeline();
    return () => { isDisposed = true; };
  }, [animeId, episodeNum, targetType]);

  // =========================================================================
  // 5. HIGH-PERFORMANCE VTT SUBTITLE PARSER & CACHE
  // =========================================================================
  useEffect(() => {
    if (!selectedSubTrackUrl) {
      setParsedCues([]);
      setCurrentActiveSub('');
      return;
    }

    let isDisposed = false;

    const loadAndParseVtt = async () => {
      setCurrentActiveSub('');
      lastActiveCueIndex.current = -1;

      if (subtitleCache.has(selectedSubTrackUrl)) {
        setParsedCues(subtitleCache.get(selectedSubTrackUrl));
        return;
      }

      try {
        const response = await fetch(selectedSubTrackUrl);
        if (!response.ok) return;
        const vttData = await response.text();

        const cues = [];
        const rawBlocks = vttData.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n\n');

        for (const block of rawBlocks) {
          const lines = block.trim().split('\n');
          const timeIndex = lines.findIndex(l => l.includes('-->'));
          if (timeIndex === -1) continue;

          const timeLine = lines[timeIndex];
          const [startRaw, endRawAndOpts] = timeLine.split('-->');
          if (!startRaw || !endRawAndOpts) continue;

          const startMs = parseVttTimestamp(startRaw);
          const endMs = parseVttTimestamp(endRawAndOpts.trim().split(' ')[0]);

          const textLines = lines.slice(timeIndex + 1);
          const cleanText = textLines
            .join('\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();

          if (cleanText && endMs > startMs) {
            cues.push({ startMs, endMs, text: cleanText });
          }
        }

        cues.sort((a, b) => a.startMs - b.startMs);
        subtitleCache.set(selectedSubTrackUrl, cues);

        if (!isDisposed) {
          setParsedCues(cues);
        }
      } catch (_) {}
    };

    loadAndParseVtt();
    return () => { isDisposed = true; };
  }, [selectedSubTrackUrl]);

  // =========================================================================
  // 6. EXACT PLAYBACK LOOP (TIMELINE, CUE MATCHING, TIMEOUTS)
  // =========================================================================
  const onPlaybackStatusUpdate = useCallback((playbackStatus) => {
    setStatus(playbackStatus);

    if (playbackStatus.isLoaded) {
      if (!isReady) setIsReady(true);

      // Debounce buffering spinner to prevent flicker
      if (playbackStatus.isBuffering && !isBufferingDebounced) {
        setIsBufferingDebounced(true);
      } else if (!playbackStatus.isBuffering && isBufferingDebounced) {
        setIsBufferingDebounced(false);
      }

      const currentMs = playbackStatus.positionMillis || 0;
      const durationMs = playbackStatus.durationMillis || 1;
      const currentSec = Math.floor(currentMs / 1000);
      const durationSec = Math.floor(durationMs / 1000);

      // --- BINARY SEARCH SUBTITLE MATCHER ---
      if (subtitlesEnabled && parsedCues.length > 0) {
        let low = 0;
        let high = parsedCues.length - 1;
        let matchedIndex = -1;

        while (low <= high) {
          const mid = (low + high) >> 1;
          const cue = parsedCues[mid];
          if (currentMs >= cue.startMs && currentMs <= cue.endMs) {
            matchedIndex = mid;
            break;
          } else if (currentMs < cue.startMs) {
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }

        if (matchedIndex !== -1) {
          if (lastActiveCueIndex.current !== matchedIndex) {
            lastActiveCueIndex.current = matchedIndex;
            setCurrentActiveSub(parsedCues[matchedIndex].text);
          }
        } else if (currentActiveSub !== '') {
          lastActiveCueIndex.current = -1;
          setCurrentActiveSub('');
        }
      } else if (currentActiveSub !== '') {
        setCurrentActiveSub('');
      }

      // --- SKIP INTRO REGION CHECK ---
      if (introRegion.end > 0 && currentSec >= introRegion.start && currentSec < introRegion.end) {
        if (!showSkipIntro) {
          setShowSkipIntro(true);
          Animated.timing(skipIntroAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        }
      } else if (showSkipIntro) {
        setShowSkipIntro(false);
        Animated.timing(skipIntroAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      }

      // --- OUTRO & NEXT EPISODE CARD LOGIC ---
      const effectiveOutroStart = outroRegion.start > 0 ? outroRegion.start : Math.max(0, durationSec - DEFAULT_OUTRO_DURATION_SEC);
      if (durationSec > 60 && currentSec >= effectiveOutroStart) {
        if (!showSkipOutro) {
          setShowSkipOutro(true);
          Animated.timing(skipOutroAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        }
        if (hasNextEp && !showNextCard && !isNextCardDismissed) {
          setShowNextCard(true);
          Animated.timing(nextCardAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        }
      } else {
        if (showSkipOutro) {
          setShowSkipOutro(false);
          Animated.timing(skipOutroAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        }
        if (showNextCard) {
          setShowNextCard(false);
          Animated.timing(nextCardAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        }
      }

      // --- FIRESTORE PROGRESS (THROTTLED TO EVERY 10 SECONDS) ---
      if (userUid && animeId && playbackStatus.isPlaying && currentSec > 0 && currentSec % 10 === 0) {
        const isFinished = currentSec > (durationSec * 0.85);
        firestore().collection('users').doc(userUid).collection('progress').doc(String(animeId)).set({
          animeId: String(animeId),
          lastWatchedEp: episodeNum,
          progress: currentSec,
          duration: durationSec,
          finishedEp: isFinished,
          timestamp: Date.now()
        }, { merge: true }).catch(() => {});
      }
    }
  }, [
    isReady,
    isBufferingDebounced,
    subtitlesEnabled,
    parsedCues,
    currentActiveSub,
    introRegion,
    outroRegion,
    showSkipIntro,
    showSkipOutro,
    hasNextEp,
    showNextCard,
    isNextCardDismissed,
    userUid,
    animeId,
    episodeNum,
    skipIntroAnim,
    skipOutroAnim,
    nextCardAnim
  ]);

  // =========================================================================
  // 7. CONTROLS AUTO-HIDE & FADE ENGINE
  // =========================================================================
  const resetControlsTimeout = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (!status.isPlaying || activePanel || isDraggingSlider) return;

    hideControlsTimer.current = setTimeout(() => {
      hideControlsImmediate();
    }, 4500);
  }, [status.isPlaying, activePanel, isDraggingSlider]);

  const showControlsAnimated = useCallback(() => {
    setShowUI(true);
    Animated.timing(uiOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true
    }).start();
    resetControlsTimeout();
  }, [uiOpacity, resetControlsTimeout]);

  const hideControlsImmediate = useCallback(() => {
    if (activePanel) return;
    Animated.timing(uiOpacity, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true
    }).start(() => setShowUI(false));
  }, [activePanel, uiOpacity]);

  const toggleControls = useCallback(() => {
    if (activePanel) {
      closeSidePanel();
      return;
    }
    if (showUI) {
      hideControlsImmediate();
    } else {
      showControlsAnimated();
    }
  }, [activePanel, showUI, closeSidePanel, hideControlsImmediate, showControlsAnimated]);

  useEffect(() => {
    if (!status.isPlaying) {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      setShowUI(true);
      Animated.timing(uiOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      resetControlsTimeout();
    }
  }, [status.isPlaying, resetControlsTimeout, uiOpacity]);

  // =========================================================================
  // 8. ACCUMULATIVE DOUBLE TAP SEEKING ENGINE
  // =========================================================================
  const executeSeekDelta = useCallback((deltaSec) => {
    if (!videoRef.current || !status.isLoaded) return;
    const currentMs = status.positionMillis || 0;
    const durationMs = status.durationMillis || 1;
    const targetMs = Math.max(0, Math.min(durationMs, currentMs + deltaSec * 1000));
    videoRef.current.setPositionAsync(targetMs);
  }, [status.isLoaded, status.positionMillis, status.durationMillis]);

  const handleSeekDoubleTap = useCallback((direction) => {
    const isRight = direction === 'right';
    const delta = isRight ? 10 : -10;

    setAccumulatedSeek(prev => {
      const nextSec = prev.direction === direction ? prev.seconds + 10 : 10;
      return { direction, seconds: nextSec };
    });

    executeSeekDelta(delta);

    const animTarget = isRight ? doubleTapRightAnim : doubleTapLeftAnim;
    animTarget.setValue(0);
    Animated.sequence([
      Animated.spring(animTarget, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(animTarget, { toValue: 0, duration: 250, useNativeDriver: true })
    ]).start();

    if (doubleTapResetTimer.current) clearTimeout(doubleTapResetTimer.current);
    doubleTapResetTimer.current = setTimeout(() => {
      setAccumulatedSeek({ direction: null, seconds: 0 });
    }, 700);
  }, [executeSeekDelta, doubleTapRightAnim, doubleTapLeftAnim]);

  const onOverlayTap = useCallback((evt) => {
    const now = Date.now();
    const tapInterval = now - lastTapTimestamp.current;
    lastTapTimestamp.current = now;

    if (tapInterval < 300) {
      const touchX = evt.nativeEvent.locationX;
      if (touchX > windowWidth / 2) {
        handleSeekDoubleTap('right');
      } else {
        handleSeekDoubleTap('left');
      }
    } else {
      toggleControls();
    }
  }, [windowWidth, handleSeekDoubleTap, toggleControls]);

  // =========================================================================
  // 9. SWIPE GESTURES (LEFT = BRIGHTNESS, RIGHT = VOLUME)
  // =========================================================================
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 15,
    onPanResponderMove: (_, gestureState) => {
      const { moveX, dy } = gestureState;
      const isLeftSide = moveX < windowWidth / 2;

      if (gestureNoticeTimer.current) clearTimeout(gestureNoticeTimer.current);

      if (isLeftSide) {
        setBrightnessLevel(prev => {
          let updated = prev + (dy * 0.002);
          updated = Math.max(0, Math.min(updated, 0.85));
          setGestureNotice(`Brightness: ${Math.round((1 - updated) * 100)}%`);
          return updated;
        });
      } else {
        setVolumeLevel(prev => {
          let updated = prev - (dy * 0.004);
          updated = Math.max(0, Math.min(updated, 2.0));
          if (videoRef.current) {
            videoRef.current.setVolumeAsync(Math.min(updated, 1.0)).catch(() => {});
          }
          setGestureNotice(`Volume: ${Math.round(updated * 100)}%`);
          return updated;
        });
      }
    },
    onPanResponderRelease: () => {
      gestureNoticeTimer.current = setTimeout(() => setGestureNotice(null), 1000);
    }
  }), [windowWidth]);

  // =========================================================================
  // 10. RESPONSIVE SUBTITLE ELEVATION CALCULATION
  // =========================================================================
  const calculatedSubtitleBottom = useMemo(() => {
    let base = subStyle.elevation;
    if (showUI) base += 75;
    if (showSkipIntro || showSkipOutro || showNextCard) base += 45;
    return base;
  }, [subStyle.elevation, showUI, showSkipIntro, showSkipOutro, showNextCard]);

  // =========================================================================
  // 11. PLAYBACK DISPATCHERS
  // =========================================================================
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (status.isPlaying) {
      videoRef.current.pauseAsync().catch(() => {});
    } else {
      videoRef.current.playAsync().catch(() => {});
    }
    resetControlsTimeout();
  }, [status.isPlaying, resetControlsTimeout]);

  const onSliderValueChange = useCallback((val) => {
    setIsDraggingSlider(true);
    setSliderPreviewMillis(val);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
  }, []);

  const onSliderSlidingComplete = useCallback(async (val) => {
    setIsDraggingSlider(false);
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(val);
    }
    resetControlsTimeout();
  }, [resetControlsTimeout]);

  // =========================================================================
  // 12. RENDER PIPELINE
  // =========================================================================
  if (loadingStream) {
    return (
      <View style={styles.cinematicLoadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.cinematicLoadingText}>Loading Episode {episodeNum}...</Text>
      </View>
    );
  }

  if (fatalError || !streamData) {
    return (
      <View style={styles.errorSurfaceContainer}>
        <Text style={styles.errorPrimaryText}>Unable to play this episode</Text>
        <Text style={styles.errorSecondaryText}>{fatalError || "Connection error."}</Text>
        <View style={styles.errorActionsRow}>
          <TouchableOpacity 
            style={styles.errorPillBtn} 
            onPress={() => {
              setLoadingStream(true);
              setStreamData(null);
            }}
          >
            <Text style={styles.errorPillBtnText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.errorPillBtn, { backgroundColor: '#333' }]} 
            onPress={handleClosePlayer}
          >
            <Text style={styles.errorPillBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rootPlayerContainer}>
      {/* NATIVE EXPO AV VIDEO ENGINE */}
      <Video
        ref={videoRef}
        style={styles.fullVideoPlane}
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

      {/* HARDWARE BRIGHTNESS DIMMER */}
      <View 
        style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${brightnessLevel})` }]} 
        pointerEvents="none" 
      />

      {/* HIGH-PERFORMANCE VTT SUBTITLES */}
      {subtitlesEnabled && currentActiveSub !== '' && (
        <View 
          style={[styles.subtitleWrapper, { bottom: calculatedSubtitleBottom }]} 
          pointerEvents="none"
        >
          <Text style={[
            styles.subtitleTypography, 
            { 
              color: subStyle.color, 
              fontSize: subStyle.size,
              backgroundColor: `rgba(0,0,0,${subStyle.bgOpacity})`
            }
          ]}>
            {currentActiveSub}
          </Text>
        </View>
      )}

      {/* WHITE BUFFERING INDICATOR */}
      {isBufferingDebounced && (
        <View style={styles.centeredBufferPlane} pointerEvents="none">
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* SWIPE TOAST FEEDBACK */}
      {gestureNotice && (
        <View style={styles.gestureNoticeBadge} pointerEvents="none">
          <Text style={styles.gestureNoticeText}>{gestureNotice}</Text>
        </View>
      )}

      {/* DOUBLE TAP ANIMATION BADGES */}
      <Animated.View 
        style={[
          styles.doubleTapBadge, 
          { left: '15%', opacity: doubleTapLeftAnim, transform: [{ scale: doubleTapLeftAnim }] }
        ]} 
        pointerEvents="none"
      >
        <IconReplay10 size={36} color="#FFF" />
        <Text style={styles.doubleTapBadgeText}>
          {accumulatedSeek.direction === 'left' ? `-${accumulatedSeek.seconds}s` : '-10s'}
        </Text>
      </Animated.View>

      <Animated.View 
        style={[
          styles.doubleTapBadge, 
          { right: '15%', opacity: doubleTapRightAnim, transform: [{ scale: doubleTapRightAnim }] }
        ]} 
        pointerEvents="none"
      >
        <IconForward10 size={36} color="#FFF" />
        <Text style={styles.doubleTapBadgeText}>
          {accumulatedSeek.direction === 'right' ? `+${accumulatedSeek.seconds}s` : '+10s'}
        </Text>
      </Animated.View>

      {/* TOUCH & PAN SENSING SURFACE */}
      <View {...panResponder.panHandlers} style={[StyleSheet.absoluteFillObject, { zIndex: 5 }]}>
        <TouchableWithoutFeedback onPress={onOverlayTap}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      </View>

      {/* NETFLIX METADATA OVERLAY */}
      {tmdbMeta && (
        <Animated.View 
          style={[styles.netflixMetaVignette, { opacity: infoOverlayOpacity }]} 
          pointerEvents="none"
        >
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="metaVignetteGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.88" />
                <Stop offset="0.55" stopColor="#000000" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#metaVignetteGrad)" />
          </Svg>
          <View style={styles.metaTextCluster}>
            <View style={styles.metaBadgeRow}>
              {tmdbMeta.certification && (
                <View style={styles.certPill}>
                  <Text style={styles.certPillText}>{tmdbMeta.certification}</Text>
                </View>
              )}
              {tmdbMeta.genres ? <Text style={styles.genreBulletText}>{tmdbMeta.genres}</Text> : null}
            </View>
            <Text style={styles.metaTitleText} numberOfLines={1}>
              S{tmdbMeta.season} E{tmdbMeta.episode} — {tmdbMeta.title}
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
      {showSkipIntro && (
        <Animated.View style={[
          styles.introSkipContainer, 
          { opacity: skipIntroAnim, transform: [{ translateY: skipIntroAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }
        ]}>
          <TouchableOpacity 
            style={styles.introSkipButton}
            activeOpacity={0.85}
            onPress={() => {
              if (videoRef.current) {
                videoRef.current.setPositionAsync(introRegion.end * 1000);
              }
              setShowSkipIntro(false);
            }}
          >
            <Text style={styles.introSkipButtonText}>Skip Intro</Text>
            <IconForward10 size={16} color="#000" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* SKIP OUTRO BUTTON */}
      {showSkipOutro && (
        <Animated.View style={[
          styles.outroSkipContainer, 
          { opacity: skipOutroAnim, transform: [{ translateY: skipOutroAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }
        ]}>
          <TouchableOpacity 
            style={styles.outroSkipButton}
            activeOpacity={0.85}
            onPress={() => {
              if (videoRef.current && status.durationMillis) {
                videoRef.current.setPositionAsync(status.durationMillis - 1000);
              }
            }}
          >
            <Text style={styles.outroSkipButtonText}>Skip Outro</Text>
            <IconSkipNext size={16} color="#FFF" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* NEXT EPISODE CARD */}
      {showNextCard && hasNextEp && (
        <Animated.View style={[
          styles.nextEpisodeCard, 
          { opacity: nextCardAnim, transform: [{ translateY: nextCardAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }
        ]}>
          <View style={styles.nextEpHeaderRow}>
            <Text style={styles.nextEpSubTitle}>NEXT EPISODE</Text>
            <TouchableOpacity onPress={() => setIsNextCardDismissed(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.nextEpCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.nextEpNameText} numberOfLines={1}>
            Episode {parseInt(episodeNum, 10) + 1} {nextEpData?.title ? `• ${nextEpData.title}` : ''}
          </Text>
          <TouchableOpacity 
            style={styles.nextEpPlayAction}
            activeOpacity={0.85}
            onPress={handleNextEpisode}
          >
            <IconPlay size={16} color="#000" />
            <Text style={styles.nextEpPlayActionText}>Play Next</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* FULL CONTROLS SYSTEM */}
      <Animated.View style={[styles.controlsOverlay, { opacity: uiOpacity }]} pointerEvents={showUI ? 'auto' : 'none'}>
        
        {/* TOP CINEMATIC VIGNETTE & CONTROLS */}
        <View style={styles.topVignette}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Defs>
              <LinearGradient id="topVig" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.95" />
                <Stop offset="0.6" stopColor="#000000" stopOpacity="0.45" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#topVig)" />
          </Svg>

          <View style={styles.topBarContent}>
            <TouchableOpacity 
              onPress={handleClosePlayer} 
              style={styles.iconHitTarget} 
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <IconBack size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.headerTitleBox}>
              <Text style={styles.headerAnimeTitle} numberOfLines={1}>{animeTitle}</Text>
              <Text style={styles.headerEpisodeSubtitle} numberOfLines={1}>
                {tmdbMeta 
                  ? `S${tmdbMeta.season} E${tmdbMeta.episode} • ${tmdbMeta.title}` 
                  : `Episode ${episodeNum} ${episodeTitle ? `• ${episodeTitle}` : ''}`}
              </Text>
            </View>
          </View>
        </View>

        {/* CENTER INTERACTIVE CLUSTER */}
        <View style={styles.centerCluster} pointerEvents="box-none">
          <TouchableOpacity 
            onPress={() => executeSeekDelta(-10)} 
            style={styles.centerIconButton}
            activeOpacity={0.75}
          >
            <IconReplay10 size={30} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={togglePlayPause} 
            style={styles.centerPlayButton}
            activeOpacity={0.85}
          >
            {status.isPlaying ? <IconPause size={36} color="#FFF" /> : <IconPlay size={36} color="#FFF" />}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => executeSeekDelta(10)} 
            style={styles.centerIconButton}
            activeOpacity={0.75}
          >
            <IconForward10 size={30} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* BOTTOM CINEMATIC VIGNETTE & CONTROLS */}
        <View style={styles.bottomVignette}>
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Defs>
              <LinearGradient id="botVig" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity="0.98" />
                <Stop offset="0.6" stopColor="#000000" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#botVig)" />
          </Svg>

          <View style={styles.bottomBarContent}>
            {/* PROGRESS SLIDER ROW */}
            <View style={styles.sliderFlexRow}>
              <Text style={styles.timeLabel}>
                {formatTime(isDraggingSlider ? sliderPreviewMillis : (status.positionMillis || 0))}
              </Text>
              <Slider
                style={styles.nativeSlider}
                minimumValue={0}
                maximumValue={status.durationMillis || 100}
                value={isDraggingSlider ? sliderPreviewMillis : (status.positionMillis || 0)}
                minimumTrackTintColor={BRAND_RED}
                maximumTrackTintColor="rgba(255,255,255,0.22)"
                thumbTintColor={BRAND_RED}
                onValueChange={onSliderValueChange}
                onSlidingComplete={onSliderSlidingComplete}
              />
              <Text style={styles.timeLabel}>{formatTime(status.durationMillis || 0)}</Text>
            </View>

            {/* ACTION BUTTONS ROW */}
            <View style={styles.bottomActionsRow}>
              <View style={styles.bottomLeftActions}>
                <TouchableOpacity 
                  style={styles.actionIconHit}
                  onPress={() => openSidePanel('subtitles')}
                >
                  <IconSubs size={22} color={subtitlesEnabled ? "#FFF" : "#777"} />
                  {subtitlesEnabled && <View style={styles.activeDotBadge} />}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionIconHit}
                  onPress={() => openSidePanel('audio')}
                >
                  <Text style={styles.pillTextButton}>{targetType.toUpperCase()}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.bottomRightActions}>
                {hasNextEp && (
                  <TouchableOpacity 
                    style={styles.actionIconHit} 
                    onPress={handleNextEpisode}
                  >
                    <IconSkipNext size={22} color="#FFF" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity 
                  style={styles.actionIconHit} 
                  onPress={() => openSidePanel('main')}
                >
                  <IconSettings size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

      </Animated.View>

      {/* NETFLIX-STYLE SLIDING RIGHT DRAWER */}
      {activePanel && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Animated.View style={[styles.panelScrimLayer, { opacity: panelBackdropOpacity }]}>
            <TouchableWithoutFeedback onPress={closeSidePanel}>
              <View style={StyleSheet.absoluteFillObject} />
            </TouchableWithoutFeedback>
          </Animated.View>

          <Animated.View style={[
            styles.panelDrawerSurface, 
            { width: responsivePanelWidth, transform: [{ translateX: panelTranslateX }] }
          ]}>
            
            {/* PANEL: MAIN SETTINGS */}
            {activePanel === 'main' && (
              <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.panelHeadline}>Settings</Text>

                <TouchableOpacity style={styles.panelRowEntry} onPress={() => setActivePanel('quality')}>
                  <Text style={styles.panelRowLabel}>Video Quality</Text>
                  <Text style={styles.panelRowValue}>Auto (HLS) ›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.panelRowEntry} onPress={() => setActivePanel('audio')}>
                  <Text style={styles.panelRowLabel}>Audio Channel</Text>
                  <Text style={styles.panelRowValue}>{targetType.toUpperCase()} ({activeServerName}) ›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.panelRowEntry} onPress={() => setActivePanel('subtitles')}>
                  <Text style={styles.panelRowLabel}>Subtitles</Text>
                  <Text style={styles.panelRowValue}>
                    {subtitlesEnabled ? (availableSubTracks.find(s => s.file === selectedSubTrackUrl)?.label || 'On') : 'Off'} ›
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.panelRowEntry} onPress={() => setActivePanel('subtitle_styling')}>
                  <Text style={styles.panelRowLabel}>Subtitle Styling</Text>
                  <Text style={styles.panelRowValue}>Customize ›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.panelRowEntry} onPress={() => {
                  const nextSpeed = playbackSpeed === 1.0 ? 1.25 : playbackSpeed === 1.25 ? 1.5 : playbackSpeed === 1.5 ? 2.0 : 1.0;
                  setPlaybackSpeed(nextSpeed);
                  if (videoRef.current) videoRef.current.setRateAsync(nextSpeed, true);
                }}>
                  <Text style={styles.panelRowLabel}>Playback Speed</Text>
                  <Text style={styles.panelRowValue}>{playbackSpeed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.panelRowEntry} onPress={() => {
                  setResizeMode(prev => prev === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN);
                }}>
                  <Text style={styles.panelRowLabel}>Aspect Ratio</Text>
                  <Text style={styles.panelRowValue}>{resizeMode === ResizeMode.CONTAIN ? 'Fit Screen' : 'Fill Screen'}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* PANEL: VIDEO QUALITY */}
            {activePanel === 'quality' && (
              <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.panelNavBack} onPress={() => setActivePanel('main')}>
                  <Text style={styles.panelNavBackText}>‹ Settings</Text>
                </TouchableOpacity>
                <Text style={styles.panelHeadline}>Quality</Text>
                <View style={styles.panelOptionSelected}>
                  <Text style={[styles.panelOptionText, { color: BRAND_RED }]}>Auto (HLS Stream Adaptation)</Text>
                  <IconCheck size={18} color={BRAND_RED} />
                </View>
                <Text style={styles.panelHelperNote}>
                  ExoPlayer dynamically optimizes resolution based on connection bandwidth.
                </Text>
              </ScrollView>
            )}

            {/* PANEL: AUDIO STREAM */}
            {activePanel === 'audio' && (
              <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.panelNavBack} onPress={() => setActivePanel('main')}>
                  <Text style={styles.panelNavBackText}>‹ Settings</Text>
                </TouchableOpacity>
                <Text style={styles.panelHeadline}>Audio & Format</Text>
                <View style={styles.panelOptionSelected}>
                  <Text style={[styles.panelOptionText, { color: BRAND_RED }]}>
                    {targetType === 'dub' ? 'English Audio (Dub)' : 'Original Japanese (Sub)'}
                  </Text>
                  <IconCheck size={18} color={BRAND_RED} />
                </View>
                <Text style={styles.panelHelperNote}>
                  Active Server: {activeServerName.toUpperCase()}
                </Text>
              </ScrollView>
            )}

            {/* PANEL: SUBTITLES SELECTION */}
            {activePanel === 'subtitles' && (
              <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.panelNavBack} onPress={() => setActivePanel('main')}>
                  <Text style={styles.panelNavBackText}>‹ Settings</Text>
                </TouchableOpacity>
                <Text style={styles.panelHeadline}>Subtitles</Text>

                <TouchableOpacity 
                  style={[styles.panelOptionRow, !subtitlesEnabled && styles.panelOptionActiveBorder]}
                  onPress={() => {
                    setSubtitlesEnabled(false);
                    closeSidePanel();
                  }}
                >
                  <Text style={[styles.panelOptionText, !subtitlesEnabled && { color: BRAND_RED }]}>Off</Text>
                  {!subtitlesEnabled && <IconCheck size={18} color={BRAND_RED} />}
                </TouchableOpacity>

                {availableSubTracks.map((trk, idx) => {
                  const isSelected = subtitlesEnabled && selectedSubTrackUrl === trk.file;
                  return (
                    <TouchableOpacity 
                      key={`${trk.file}-${idx}`}
                      style={[styles.panelOptionRow, isSelected && styles.panelOptionActiveBorder]}
                      onPress={() => {
                        setSubtitlesEnabled(true);
                        setSelectedSubTrackUrl(trk.file);
                        closeSidePanel();
                      }}
                    >
                      <Text style={[styles.panelOptionText, isSelected && { color: BRAND_RED }]}>
                        {trk.label || `Track ${idx + 1}`}
                      </Text>
                      {isSelected && <IconCheck size={18} color={BRAND_RED} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* PANEL: SUBTITLE STYLING */}
            {activePanel === 'subtitle_styling' && (
              <ScrollView style={styles.panelScroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.panelNavBack} onPress={() => setActivePanel('main')}>
                  <Text style={styles.panelNavBackText}>‹ Settings</Text>
                </TouchableOpacity>
                <Text style={styles.panelHeadline}>Subtitle Appearance</Text>

                <Text style={styles.styleSectionTag}>Color</Text>
                <View style={styles.styleColorsRow}>
                  {['#FFFFFF', '#F47521', '#FACC15', '#4ADE80', '#60A5FA'].map(hex => (
                    <TouchableOpacity 
                      key={hex}
                      style={[styles.colorBubble, { backgroundColor: hex }, subStyle.color === hex && styles.colorBubbleActive]}
                      onPress={() => setSubStyle(prev => ({ ...prev, color: hex }))}
                    />
                  ))}
                </View>

                <Text style={styles.styleSectionTag}>Font Size</Text>
                <View style={styles.stylePillsRow}>
                  {[14, 16, 20, 24].map(sz => (
                    <TouchableOpacity 
                      key={sz}
                      style={[styles.stylePill, subStyle.size === sz && styles.stylePillActive]}
                      onPress={() => setSubStyle(prev => ({ ...prev, size: sz }))}
                    >
                      <Text style={[styles.stylePillLabel, subStyle.size === sz && { color: BRAND_RED }]}>{sz}px</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.styleSectionTag}>Background Opacity</Text>
                <View style={styles.stylePillsRow}>
                  {[0, 0.45, 0.75].map(op => (
                    <TouchableOpacity 
                      key={op}
                      style={[styles.stylePill, subStyle.bgOpacity === op && styles.stylePillActive]}
                      onPress={() => setSubStyle(prev => ({ ...prev, bgOpacity: op }))}
                    >
                      <Text style={[styles.stylePillLabel, subStyle.bgOpacity === op && { color: BRAND_RED }]}>
                        {op === 0 ? 'None' : `${Math.round(op * 100)}%`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.styleSectionTag}>Vertical Height</Text>
                <View style={styles.stylePillsRow}>
                  {[25, 45, 75].map(elev => (
                    <TouchableOpacity 
                      key={elev}
                      style={[styles.stylePill, subStyle.elevation === elev && styles.stylePillActive]}
                      onPress={() => setSubStyle(prev => ({ ...prev, elevation: elev }))}
                    >
                      <Text style={[styles.stylePillLabel, subStyle.elevation === elev && { color: BRAND_RED }]}>
                        {elev === 25 ? 'Low' : elev === 45 ? 'Normal' : 'High'}
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

const styles = StyleSheet.create({
  rootPlayerContainer: { flex: 1, backgroundColor: '#000000' },
  fullVideoPlane: { ...StyleSheet.absoluteFillObject },

  // Status & Loading Screens
  cinematicLoadingContainer: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  cinematicLoadingText: { color: '#AAAAAA', fontSize: 13, marginTop: 14, letterSpacing: 0.5 },
  centeredBufferPlane: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 4 },

  errorSurfaceContainer: { flex: 1, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  errorPrimaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  errorSecondaryText: { color: '#888888', fontSize: 12, textAlign: 'center', marginBottom: 24, lineHeight: 18 },
  errorActionsRow: { flexDirection: 'row', gap: 14 },
  errorPillBtn: { backgroundColor: BRAND_RED, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 6 },
  errorPillBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },

  // Gestures & Double Tap
  gestureNoticeBadge: { position: 'absolute', top: 38, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, zIndex: 20 },
  gestureNoticeText: { color: '#FFFFFF', fontSize: 13, fontWeight: 'bold' },
  doubleTapBadge: { position: 'absolute', top: '44%', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 18, borderRadius: 45, zIndex: 8 },
  doubleTapBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', marginTop: 4 },

  // Subtitles
  subtitleWrapper: { position: 'absolute', width: '100%', alignItems: 'center', paddingHorizontal: 40, zIndex: 6 },
  subtitleTypography: { fontWeight: '800', textAlign: 'center', textShadowColor: '#000', textShadowOffset: { width: 1.5, height: 1.5 }, textShadowRadius: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, lineHeight: 22 },

  // Netflix Information Overlay
  netflixMetaVignette: { position: 'absolute', top: 50, left: 30, width: '45%', borderRadius: 8, overflow: 'hidden', padding: 14, zIndex: 7 },
  metaTextCluster: { zIndex: 2 },
  metaBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  certPill: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1 },
  certPillText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  genreBulletText: { color: '#CCCCCC', fontSize: 10, fontWeight: '600' },
  metaTitleText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', marginVertical: 4 },
  metaOverviewText: { color: '#AAAAAA', fontSize: 10, lineHeight: 15 },

  // Skip Buttons
  introSkipContainer: { position: 'absolute', bottom: 100, right: 30, zIndex: 25 },
  introSkipButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 4, gap: 6 },
  introSkipButtonText: { color: '#000000', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },

  outroSkipContainer: { position: 'absolute', bottom: 100, right: 30, zIndex: 25 },
  outroSkipButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,30,30,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 4, gap: 6 },
  outroSkipButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },

  // Next Episode Card
  nextEpisodeCard: { position: 'absolute', bottom: 95, right: 30, width: 230, backgroundColor: 'rgba(18,18,18,0.96)', borderRadius: 6, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', zIndex: 25 },
  nextEpHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  nextEpSubTitle: { color: '#888888', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  nextEpCloseText: { color: '#AAAAAA', fontSize: 12, fontWeight: 'bold' },
  nextEpNameText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold', marginBottom: 10 },
  nextEpPlayAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 6, borderRadius: 4, gap: 6 },
  nextEpPlayActionText: { color: '#000000', fontSize: 11, fontWeight: '900' },

  // Controls Layer
  controlsOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between' },
  topVignette: { width: '100%', height: 110, justifyContent: 'flex-start' },
  topBarContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingTop: 20 },
  iconHitTarget: { padding: 6, marginRight: 16 },
  headerTitleBox: { flex: 1 },
  headerAnimeTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  headerEpisodeSubtitle: { color: '#AAAAAA', fontSize: 11, fontWeight: '600', marginTop: 2 },

  centerCluster: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 45 },
  centerPlayButton: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  centerIconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },

  bottomVignette: { width: '100%', height: 120, justifyContent: 'flex-end' },
  bottomBarContent: { paddingHorizontal: 28, paddingBottom: 16 },
  sliderFlexRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  nativeSlider: { flex: 1, marginHorizontal: 8, height: 35 },
  timeLabel: { color: '#CCCCCC', fontSize: 11, fontVariant: ['tabular-nums'], width: 44, textAlign: 'center' },

  bottomActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomLeftActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  bottomRightActions: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  actionIconHit: { padding: 6, position: 'relative' },
  activeDotBadge: { position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND_RED },
  pillTextButton: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },

  // Sliding Side Drawer Styles
  panelScrimLayer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 30 },
  panelDrawerSurface: { position: 'absolute', top: 0, bottom: 0, right: 0, backgroundColor: 'rgba(14,14,14,0.98)', borderTopLeftRadius: 12, borderBottomLeftRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', zIndex: 31, paddingHorizontal: 22, paddingTop: 25 },
  panelScroll: { flex: 1 },
  panelHeadline: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  panelNavBack: { marginBottom: 12 },
  panelNavBackText: { color: BRAND_RED, fontSize: 13, fontWeight: 'bold' },
  panelRowEntry: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  panelRowLabel: { color: '#E0E0E0', fontSize: 13, fontWeight: '600' },
  panelRowValue: { color: '#888888', fontSize: 12, fontWeight: 'bold' },

  panelOptionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  panelOptionActiveBorder: { borderLeftWidth: 3, borderLeftColor: BRAND_RED, paddingLeft: 8 },
  panelOptionSelected: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  panelOptionText: { color: '#DDDDDD', fontSize: 13, fontWeight: '600' },
  panelHelperNote: { color: '#666666', fontSize: 10, marginTop: 10, lineHeight: 14 },

  styleSectionTag: { color: '#777777', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 14, marginBottom: 8 },
  styleColorsRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  colorBubble: { width: 26, height: 26, borderRadius: 13 },
  colorBubbleActive: { borderWidth: 2, borderColor: '#FFFFFF' },
  stylePillsRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  stylePill: { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  stylePillActive: { borderWidth: 1, borderColor: BRAND_RED },
  stylePillLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }
});
