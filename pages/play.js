import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator, FlatList, Modal 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import ProxyImage from '../components/ProxyImage';

import Player from './play/player';

const { width, height } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const BRAND_ACCENT = '#FF3366';
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// --- Unique UI Icons ---
const IconPlay = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>);
const IconPlus = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><Path d="M12 5v14M5 12h14" /></Svg>);
const IconCheck = ({ size = 22, color = BRAND_ACCENT }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><Path d="M20 6L9 17l-5-5" /></Svg>);
const IconShare = ({ size = 20, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></Svg>);
const IconChevronDown = ({ size = 18, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><Path d="M6 9l6 6 6-6" /></Svg>);

export default function Play({ anime, user, onBack, navigation }) {
  const currentAnime = anime || {
    id: 'solo-leveling', title: 'Solo Leveling',
    coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iqITmI6.png',
    backdrop: 'https://image.tmdb.org/t/p/original/vIgyYkXkg6NC2whRbYjBD7eb3Er.jpg',
    description: "In a world of gifted hunters, Sung Jinwoo struggles as the weakest.",
    genres: ['Action', 'Fantasy'], score: 85, rating: 'U/A 16+', status: 'RELEASING', format: 'TV'
  };

  const animeDocId = String(currentAnime.id);

  // UI State
  const [descExpanded, setDescExpanded] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  
  // Progress State
  const [userProgressMap, setUserProgressMap] = useState({});
  const [latestWatched, setLatestWatched] = useState(null);

  // TMDB Metadata
  const [titleLogo, setTitleLogo] = useState(null);
  const [isUpcoming, setIsUpcoming] = useState(currentAnime.status?.toUpperCase() === 'UPCOMING');

  // Episodes & Segments
  const [vercelAnimeId, setVercelAnimeId] = useState(currentAnime.id);
  const [providerEpisodes, setProviderEpisodes] = useState([]); 
  const [episodesLoading, setEpisodesLoading] = useState(true);
  
  // Segmentation Logic (1-50, 51-100)
  const [chunks, setChunks] = useState([]);
  const [selectedChunk, setSelectedChunk] = useState(null);
  const [showChunkModal, setShowChunkModal] = useState(false);

  const isMovie = currentAnime.format === 'MOVIE' || providerEpisodes.length === 1;

  // Player State
  const [loadingEpisode, setLoadingEpisode] = useState(null);
  const [activePlayback, setActivePlayback] = useState(null);

  // 1. Firebase Listeners
  useEffect(() => {
    if (!user || !currentAnime?.id) return;
    
    const libRef = firestore().collection('users').doc(user.uid).collection('library').doc(animeDocId);
    const libUnsub = libRef.onSnapshot(doc => setInLibrary(doc?.exists || false), () => {});
    
    const progRef = firestore().collection('users').doc(user.uid).collection('progress').where('animeId', '==', animeDocId);
    const progUnsub = progRef.onSnapshot(snapshot => {
      if (snapshot && !snapshot.empty) {
        const pMap = {};
        let latest = null;
        snapshot.forEach(doc => {
          const data = doc.data();
          pMap[data.slug] = data;
          if (!latest || data.timestamp > latest.timestamp) latest = data;
        });
        setUserProgressMap(pMap);
        setLatestWatched(latest);
      }
    }, () => {});
    
    return () => { libUnsub(); progUnsub(); };
  }, [user, currentAnime?.id]);

  const toggleLibrary = async () => {
    if (!user || !currentAnime?.id) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(animeDocId);
    if (inLibrary) await ref.delete().catch(() => {});
    else await ref.set({ id: animeDocId, title: currentAnime.title, img: currentAnime.coverImage || currentAnime.backdrop, addedAt: firestore.FieldValue.serverTimestamp() }).catch(() => {});
  };

  // 2. Fetch TMDB Light Logo
  useEffect(() => {
    let isMounted = true;
    const loadTMDBLogo = async () => {
      try {
        const cleanTitle = currentAnime.title.replace(/\(Dub\)|\(Sub\)/gi, '').trim();
        const searchType = currentAnime.format === 'MOVIE' ? 'movie' : 'tv';
        const tmdbRes = await fetchWithTimeout(`https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
        const tmdbJson = await tmdbRes.json();
        const show = tmdbJson?.results?.[0];
        
        if (show && isMounted) {
          const detailRes = await fetchWithTimeout(`https://api.themoviedb.org/3/${searchType}/${show.id}/images?api_key=${TMDB_API_KEY}`);
          const detailJson = await detailRes.json();
          const logos = detailJson?.logos || [];
          let bestLogo = logos.find(l => l.iso_639_1 === 'en') || logos.find(l => l.iso_639_1 === 'ja') || logos[0];
          if (bestLogo) setTitleLogo(`https://image.tmdb.org/t/p/w500${bestLogo.file_path}`);
        }
      } catch (_) {}
    };
    loadTMDBLogo();
    return () => { isMounted = false; };
  }, [currentAnime.title, currentAnime.format]);

  // 3. Fetch Flat Episodes from Provider
  useEffect(() => {
    let isMounted = true;
    const fetchProviderData = async () => {
      setEpisodesLoading(true);
      if (isUpcoming) {
        if (isMounted) setEpisodesLoading(false);
        return;
      }
      try {
        let targetId = currentAnime.id;
        const searchRes = await fetchWithTimeout(`${VERCEL_API_BASE}/api/search?keyword=${encodeURIComponent(currentAnime.title)}`);
        const searchJson = await searchRes.json();
        const matches = searchJson?.data || [];
        if (matches.length > 0) {
          const exact = matches.find(m => (m.title || '').toLowerCase() === currentAnime.title.toLowerCase()) || matches[0];
          targetId = exact.id;
        }
        if (isMounted) setVercelAnimeId(targetId);

        const res = await fetchWithTimeout(`${VERCEL_API_BASE}/api/episodes/${encodeURIComponent(targetId)}`);
        const json = await res.json();
        const list = json?.data || [];
        
        if (isMounted && Array.isArray(list)) {
          const mappedList = list.map((ep, idx) => ({
            id: String(ep.id || idx + 1),
            slug: String(ep.slug || ep.id || ep.num),
            num: ep.num || (idx + 1),
            title: ep.title || `Episode ${ep.num || idx + 1}`,
            desc: ep.description || ep.desc || 'No summary available for this episode.',
            still: ep.image || ep.thumbnail || currentAnime.backdrop || currentAnime.coverImage,
            isFiller: ep.isFiller || false,
            duration: ep.duration ? `${ep.duration}m` : '24m'
          }));
          setProviderEpisodes(mappedList);
        }
      } catch (err) {} 
      finally {
        if (isMounted) setEpisodesLoading(false);
      }
    };
    fetchProviderData();
    return () => { isMounted = false; };
  }, [currentAnime.id, currentAnime.title, isUpcoming]);

  // 4. Segmentation Logic (Auto-Detect Chunks & Active Progress)
  useEffect(() => {
    if (providerEpisodes.length === 0) return;
    
    const CHUNK_SIZE = 50;
    const totalEps = providerEpisodes.length;
    const generatedChunks = [];

    for (let i = 0; i < totalEps; i += CHUNK_SIZE) {
      generatedChunks.push({
        label: `Episodes ${i + 1} - ${Math.min(i + CHUNK_SIZE, totalEps)}`,
        start: i + 1,
        end: i + CHUNK_SIZE
      });
    }
    
    setChunks(generatedChunks);

    // Smart default selection based on latest watched episode
    if (generatedChunks.length > 0) {
      if (latestWatched && latestWatched.lastWatchedEp) {
        const epNum = parseInt(latestWatched.lastWatchedEp, 10);
        const targetChunk = generatedChunks.find(c => epNum >= c.start && epNum <= c.end);
        setSelectedChunk(targetChunk || generatedChunks[0]);
      } else {
        setSelectedChunk(generatedChunks[0]);
      }
    }
  }, [providerEpisodes, latestWatched]);

  // Display specific episodes based on selected chunk
  const displayEpisodes = selectedChunk 
    ? providerEpisodes.filter(ep => ep.num >= selectedChunk.start && ep.num <= selectedChunk.end)
    : [];

  // 5. Playback Handlers
  const handlePlayEpisode = async (episodeItem) => {
    try {
      setLoadingEpisode(episodeItem.num);
      const safeId = encodeURIComponent(vercelAnimeId || currentAnime.id);
      const safeEp = encodeURIComponent(String(episodeItem.slug));

      const streamUrl = `${VERCEL_API_BASE}/api/stream?id=${safeId}&ep=${safeEp}&server=hd-1&type=sub`;
      const res = await fetchWithTimeout(streamUrl, {}, 10000);
      const json = await res.json();

      let streamManifest = json?.data || json?.results;
      if (!streamManifest?.m3u8 && !streamManifest?.streamingLink) {
        alert('Streaming source not found.');
        return;
      }

      const playbackPayload = {
        streamUrl: streamManifest.m3u8 || streamManifest.streamingLink,
        referer: streamManifest.referer || "https://vidwish.live/",
        subtitles: streamManifest.subtitles || [],
        animeTitle: currentAnime.title,
        episodeNum: episodeItem.num,
        episodeTitle: episodeItem.title,
        animeId: animeDocId,
        slug: episodeItem.slug,
        userUid: user?.uid,
        targetType: 'sub'
      };

      if (navigation?.navigate) navigation.navigate('Player', playbackPayload);
      else setActivePlayback(playbackPayload);

    } catch (e) {
      alert(`Failed to play: ${e.message}`);
    } finally {
      setLoadingEpisode(null);
    }
  };

  // Resolve target episode for main "Play" button
  const mainPlayTarget = () => {
    if (providerEpisodes.length === 0) return null;
    if (latestWatched) {
      return providerEpisodes.find(e => e.slug === latestWatched.slug) || providerEpisodes[0];
    }
    return providerEpisodes[0];
  };

  const targetEp = mainPlayTarget();
  let resumePct = 0;
  if (targetEp && latestWatched && latestWatched.duration > 0 && latestWatched.slug === targetEp.slug) {
    resumePct = Math.min((latestWatched.progress / latestWatched.duration) * 100, 100);
  }

  // --- RENDERS ---
  const renderHeader = () => (
    <View style={styles.heroContainer}>
      <View style={styles.backdropWrapper}>
        <ProxyImage source={{ uri: currentAnime.backdrop || currentAnime.coverImage }} style={styles.backdropImage} resizeMode="cover" />
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#050505" stopOpacity="0.0" />
              <Stop offset="0.5" stopColor="#050505" stopOpacity="0.6" />
              <Stop offset="1" stopColor="#050505" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#heroGradient)" />
        </Svg>
      </View>

      <View style={styles.heroContent}>
        <View style={styles.logoContainer}>
          {titleLogo ? (
            <ProxyImage source={{ uri: titleLogo }} style={styles.titleLogo} resizeMode="contain" />
          ) : (
            <Text style={styles.titleText}>{currentAnime.title}</Text>
          )}
        </View>

        <View style={styles.metaGlassPill}>
          <Text style={styles.metaScore}>{currentAnime.score ? `${currentAnime.score}% Match` : 'New'}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaYear}>{new Date().getFullYear()}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaRating}>{currentAnime.rating || '16+'}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.metaHD}>HD</Text>
        </View>

        {/* Primary Play/Resume Action */}
        <TouchableOpacity 
          style={[styles.primaryPlayBtn, (providerEpisodes.length === 0 || isUpcoming) && { opacity: 0.5 }]} 
          activeOpacity={0.8}
          onPress={() => targetEp && handlePlayEpisode(targetEp)}
          disabled={providerEpisodes.length === 0 || isUpcoming}
        >
          {resumePct > 0 && !latestWatched?.finishedEp && (
            <View style={[styles.btnProgressFill, { width: `${resumePct}%` }]} />
          )}
          <View style={styles.btnInnerContent}>
            <IconPlay size={22} color="#FFF" />
            <Text style={styles.primaryPlayText}>
              {isUpcoming ? 'Coming Soon' : (resumePct > 0 ? (isMovie ? 'Resume Movie' : `Resume Ep ${targetEp?.num || ''}`) : (isMovie ? 'Play Movie' : 'Start Watching'))}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLibrary} activeOpacity={0.7}>
            <View style={styles.actionIconBg}>
              {inLibrary ? <IconCheck color={BRAND_ACCENT}/> : <IconPlus color="#FFF"/>}
            </View>
            <Text style={styles.actionText}>Watchlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => Share.share({ message: `Watch ${currentAnime.title} on Kameko!` })} activeOpacity={0.7}>
            <View style={styles.actionIconBg}>
              <IconShare color="#FFF" />
            </View>
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.synopsisContainer}>
          <Text style={styles.synopsisText} numberOfLines={descExpanded ? undefined : 4}>{currentAnime.description}</Text>
          {currentAnime.description?.length > 150 && (
            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} activeOpacity={0.7} style={styles.seeMoreBtn}>
              <Text style={styles.seeMoreText}>{descExpanded ? 'Show Less' : 'Read More'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Show Chunk Dropdown ONLY if it's a series (not a movie) and has more than 1 chunk */}
        {!isMovie && chunks.length > 1 && (
          <TouchableOpacity style={styles.chunkSelectorBtn} onPress={() => setShowChunkModal(true)}>
            <Text style={styles.chunkSelectorText}>{selectedChunk?.label || 'Episodes'}</Text>
            <IconChevronDown size={18} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Hide Top Phone Notification Bar Completely */}
      <StatusBar hidden={true} />

      <View style={styles.topNav}>
        <TouchableOpacity style={styles.navBackBtn} onPress={onBack || (() => navigation?.goBack?.())}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
        </TouchableOpacity>
      </View>

      <FlatList
        data={isMovie ? [] : displayEpisodes}
        keyExtractor={(item) => `${item.id}-${item.num}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          !isMovie && (
            <View style={styles.emptyState}>
              {episodesLoading ? (
                <ActivityIndicator size="large" color={BRAND_ACCENT} />
              ) : (
                <Text style={styles.emptyStateText}>Episodes will appear here.</Text>
              )}
            </View>
          )
        )}
        renderItem={({ item }) => {
          if (isMovie) return null; // Safety catch

          const isLoadingThis = loadingEpisode === item.num;
          const pData = userProgressMap[item.slug];
          const isFinished = pData?.finishedEp;
          const pct = pData && pData.duration > 0 ? Math.min((pData.progress / pData.duration) * 100, 100) : 0;

          return (
            <TouchableOpacity 
              style={[styles.epCard, isFinished && { opacity: 0.45 }]} 
              activeOpacity={0.7} 
              onPress={() => handlePlayEpisode(item)}
            >
              <View style={styles.epCardInner}>
                <View style={styles.epImageWrapper}>
                  <ProxyImage source={{ uri: item.still }} style={styles.epThumbnail} resizeMode="cover" />
                  <View style={styles.epPlayOverlay}>
                    {isLoadingThis ? <ActivityIndicator size="small" color="#FFF" /> : <IconPlay size={20} color="#FFF" />}
                  </View>
                  {pct > 0 && !isFinished && (
                    <View style={styles.epProgressBarBg}>
                      <View style={[styles.epProgressBarFill, { width: `${pct}%` }]} />
                    </View>
                  )}
                </View>
                
                <View style={styles.epMeta}>
                  <Text style={styles.epTitle} numberOfLines={1}>{item.num}. {item.title}</Text>
                  
                  <View style={styles.epBadgesRow}>
                    <Text style={styles.epDuration}>{item.duration}</Text>
                    <View style={styles.metaDot} />
                    {item.isFiller && <View style={styles.fillerBadge}><Text style={styles.fillerText}>FILLER</Text></View>}
                    <View style={styles.subDubBadge}><Text style={styles.subDubText}>SUB</Text></View>
                  </View>
                  
                  <Text style={styles.epDesc} numberOfLines={2}>{item.desc}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
      />

      {/* Segment Selector Modal */}
      <Modal visible={showChunkModal} transparent={true} animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.modalBackdropClose} onPress={() => setShowChunkModal(false)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Select Episodes</Text>
            <FlatList 
              data={chunks}
              keyExtractor={(c) => c.label}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={[styles.modalItem, selectedChunk?.label === item.label && styles.modalItemActive]}
                  onPress={() => { setSelectedChunk(item); setShowChunkModal(false); }}
                >
                  <Text style={[styles.modalItemText, selectedChunk?.label === item.label && styles.modalItemTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Fallback Screen Player Overlay */}
      {activePlayback && (
        <View style={styles.playerFullscreenContainer}>
          <Player route={{ params: activePlayback }} navigation={{ goBack: () => setActivePlayback(null) }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  playerFullscreenContainer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: '#000' },
  topNav: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: 30, paddingHorizontal: 20 },
  navBackBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(10px)' },
  heroContainer: { width: '100%', paddingBottom: 10 },
  backdropWrapper: { width: '100%', height: height * 0.60, position: 'absolute', top: 0, left: 0 },
  backdropImage: { width: '100%', height: '100%' },
  heroContent: { paddingTop: height * 0.38, paddingHorizontal: 20 },
  logoContainer: { width: '100%', marginBottom: 16, alignItems: 'center' },
  titleLogo: { width: '85%', height: 100 },
  titleText: { color: '#FFF', fontSize: 34, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowOffset: {width: 0, height: 4}, textShadowRadius: 10 },
  metaGlassPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 24 },
  metaScore: { color: '#4ADE80', fontSize: 12, fontWeight: '800' },
  metaYear: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  metaRating: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600' },
  metaHD: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 10 },
  primaryPlayBtn: { width: '100%', height: 56, backgroundColor: 'rgba(255,51,102,0.15)', borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: BRAND_ACCENT, marginBottom: 24 },
  btnProgressFill: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: 'rgba(255,51,102,0.4)' },
  btnInnerContent: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryPlayText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 45, marginBottom: 30 },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionIconBg: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  actionText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700' },
  synopsisContainer: { marginBottom: 30 },
  synopsisText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 22, fontWeight: '400' },
  seeMoreBtn: { marginTop: 6 },
  seeMoreText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  chunkSelectorBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, marginBottom: 20 },
  chunkSelectorText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  listPadding: { paddingBottom: 80 },
  epCard: { paddingHorizontal: 20, marginBottom: 20 },
  epCardInner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  epImageWrapper: { width: 130, height: 80, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1A1A' },
  epThumbnail: { width: '100%', height: '100%' },
  epPlayOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  epProgressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.5)' },
  epProgressBarFill: { height: '100%', backgroundColor: BRAND_ACCENT },
  epMeta: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  epTitle: { color: '#FFF', fontSize: 15, fontWeight: '800', marginBottom: 4, letterSpacing: 0.2 },
  epBadgesRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  epDuration: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  fillerBadge: { backgroundColor: 'rgba(255,204,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,204,0,0.4)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 6 },
  fillerText: { color: '#FFD700', fontSize: 9, fontWeight: '900' },
  subDubBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  subDubText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '800' },
  epDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 },
  emptyState: { paddingVertical: 50, alignItems: 'center' },
  emptyStateText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalBackdropClose: { ...StyleSheet.absoluteFillObject },
  modalContent: { width: '85%', maxHeight: '70%', backgroundColor: '#121212', borderRadius: 24, paddingVertical: 20, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { color: '#FFF', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 15 },
  modalItem: { paddingVertical: 16, alignItems: 'center', borderRadius: 12, marginHorizontal: 10 },
  modalItemActive: { backgroundColor: 'rgba(255,51,102,0.15)' },
  modalItemText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
  modalItemTextActive: { color: BRAND_ACCENT, fontWeight: '900' }
});
