import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import ProxyImage from '../components/ProxyImage';

const { width, height } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
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

const IconPlay = ({ size = 18, color = "#000" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>);
const IconPlus = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M12 5v14M5 12h14" /></Svg>);
const IconCheck = ({ size = 24, color = BRAND_RED }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><Path d="M20 6L9 17l-5-5" /></Svg>);
const IconShare = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></Svg>);
const IconDownload = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>);

export default function Play({ anime, user, onBack, navigation }) {
  const currentAnime = anime || {
    id: 'solo-leveling',
    title: 'Solo Leveling',
    coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iqITmI6.png',
    backdrop: 'https://image.tmdb.org/t/p/original/vIgyYkXkg6NC2whRbYjBD7eb3Er.jpg',
    description: "In a world of gifted hunters, Sung Jinwoo struggles as the weakest.",
    genres: ['Action', 'Fantasy'],
    score: 85,
    rating: 'U/A 16+',
    status: 'RELEASING'
  };

  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [alternates, setAlternates] = useState([]);
  const [activeTab, setActiveTab] = useState('episodes'); 
  const [vercelAnimeId, setVercelAnimeId] = useState(currentAnime.id);
  
  const [titleLogo, setTitleLogo] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [userProgress, setUserProgress] = useState({ episodeNum: 1 });
  const [loadingEpisode, setLoadingEpisode] = useState(null);
  const [isUpcoming, setIsUpcoming] = useState(currentAnime.status?.toUpperCase() === 'UPCOMING');
  const [inLibrary, setInLibrary] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user || !currentAnime?.id) return;
    const animeDocId = String(currentAnime.id);
    const libRef = firestore().collection('users').doc(user.uid).collection('library').doc(animeDocId);
    const libUnsub = libRef.onSnapshot(doc => setInLibrary(doc?.exists || false), () => {});
    const progRef = firestore().collection('users').doc(user.uid).collection('progress').doc(animeDocId);
    const progUnsub = progRef.onSnapshot(doc => { if (doc?.exists) setUserProgress(doc.data()); }, () => {});
    return () => { libUnsub(); progUnsub(); };
  }, [user, currentAnime?.id]);

  const toggleLibrary = async () => {
    if (!user || !currentAnime?.id) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(String(currentAnime.id));
    if (inLibrary) {
      await ref.delete().catch(() => {});
    } else {
      await ref.set({ id: String(currentAnime.id), title: currentAnime.title, img: currentAnime.coverImage || currentAnime.backdrop, addedAt: firestore.FieldValue.serverTimestamp() }).catch(() => {});
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadEpisodes = async () => {
      setEpisodesLoading(true);
      if (currentAnime.status?.toUpperCase() === 'UPCOMING' || currentAnime.status?.toUpperCase() === 'NOT_YET_RELEASED') {
        if (isMounted) { setIsUpcoming(true); setEpisodes([]); setEpisodesLoading(false); }
        return;
      }
      try {
        let epData = [];
        let targetId = currentAnime.id;
        const searchRes = await fetchWithTimeout(`${VERCEL_API_BASE}/api/search?keyword=${encodeURIComponent(currentAnime.title)}`, {}, 4000);
        const searchJson = await searchRes.json();
        const matches = searchJson?.data || searchJson?.results || [];
        if (matches.length > 0) {
          const exact = matches.find(m => (m.title || '').toLowerCase() === currentAnime.title.toLowerCase()) || matches[0];
          targetId = exact.id;
        }
        if (isMounted) setVercelAnimeId(targetId);

        const res = await fetchWithTimeout(`${VERCEL_API_BASE}/api/episodes/${encodeURIComponent(targetId)}`, {}, 4000);
        const json = await res.json();
        const list = json?.data || json?.episodes || json?.results || [];
        if (Array.isArray(list)) epData = list;

        if (isMounted) {
          const formatted = epData.map((ep, idx) => {
            const epNum = ep.num ?? ep.episode_no ?? ep.number ?? ep.episode ?? (idx + 1);
            return {
              id: String(ep.id || idx + 1),
              slug: String(ep.slug || ep.id || epNum),
              epNumber: epNum,
              title: ep.title || `Episode ${epNum}`,
              desc: ep.description || ep.desc || 'No summary available.',
              still: ep.image || ep.still || ep.thumbnail || currentAnime.backdrop || currentAnime.coverImage,
              duration: ep.duration ? `${ep.duration}m` : '24m'
            };
          });
          setEpisodes(formatted);
          setIsUpcoming(formatted.length === 0 && currentAnime.status?.toUpperCase().includes('UPCOMING'));
        }
      } catch (err) {
        if (isMounted) setEpisodes([]);
      } finally {
        if (isMounted) setEpisodesLoading(false);
      }
    };
    loadEpisodes();
    return () => { isMounted = false; };
  }, [currentAnime.id, currentAnime.title]);

  useEffect(() => {
    let isMounted = true;
    const loadMeta = async () => {
      try {
        const cleanTitle = currentAnime.title.replace(/\(Dub\)|\(Sub\)/gi, '').trim();
        const tmdbRes = await fetchWithTimeout(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`, {}, 4000);
        const tmdbJson = await tmdbRes.json();
        const show = tmdbJson?.results?.[0];
        if (show && isMounted) {
          const imgRes = await fetchWithTimeout(`https://api.themoviedb.org/3/tv/${show.id}/images?api_key=${TMDB_API_KEY}`, {}, 4000);
          const imgJson = await imgRes.json();
          const logo = imgJson?.logos?.find(l => l.iso_639_1 === 'en' || l.iso_639_1 === 'ja');
          if (logo && isMounted) setTitleLogo(`https://image.tmdb.org/t/p/w500${logo.file_path}`);
        }
      } catch (_) {}

      try {
        const aniQuery = `query ($search: String) { Media (search: $search, type: ANIME) { status relations { edges { relationType node { id title { romaji english } coverImage { extraLarge large } format seasonYear averageScore } } } } }`;
        const aRes = await fetchWithTimeout('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: aniQuery, variables: { search: currentAnime.title } }) }, 4000);
        const aJson = await aRes.json();
        const media = aJson?.data?.Media;
        if (media?.status && isMounted && media.status === 'NOT_YET_RELEASED') setIsUpcoming(true);

        const edges = media?.relations?.edges || [];
        if (isMounted) {
          const altList = edges.map((edge) => ({
            id: String(edge.node.id),
            title: edge.node.title?.english || edge.node.title?.romaji || 'Untitled',
            coverImage: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large,
            relationType: edge.relationType || 'RELATED',
            format: edge.node.format || 'TV',
            score: edge.node.averageScore ? `★ ${edge.node.averageScore}%` : 'N/A',
            year: edge.node.seasonYear || 'N/A'
          }));
          setAlternates(altList);
        }
      } catch (_) {}
    };
    loadMeta();
    return () => { isMounted = false; };
  }, [currentAnime.title]);

  const handlePlayEpisode = async (episodeItem) => {
    try {
      setLoadingEpisode(episodeItem.epNumber);

      const safeId = encodeURIComponent(vercelAnimeId || currentAnime.id);
      const safeEp = encodeURIComponent(String(episodeItem.epNumber));

      const streamUrl = `${VERCEL_API_BASE}/api/stream?id=${safeId}&ep=${safeEp}&server=hd-1&type=sub`;
      const res = await fetchWithTimeout(streamUrl, {}, 10000);
      const json = await res.json();

      let streamManifest = null;
      if (json?.success && json?.data?.m3u8) {
        streamManifest = json.data;
      } else if (json?.success && json?.results?.streamingLink) {
        streamManifest = json.results;
      } else if (json?.data?.streamingLink) {
        streamManifest = json.data;
      }

      if (!streamManifest?.m3u8 && !streamManifest?.streamingLink) {
        alert('Streaming source not found.');
        return;
      }

      const finalStreamUrl = streamManifest.m3u8 || streamManifest.streamingLink;
      const finalReferer = streamManifest.referer || "https://vidwish.live/";
      const finalSubtitles = streamManifest.subtitles || [];

      // Open Player with Full Network Data
      navigation.navigate('Player', {
        streamUrl: finalStreamUrl,
        referer: finalReferer,
        subtitles: finalSubtitles,
        animeTitle: currentAnime.title,
        episodeNum: episodeItem.epNumber,
        episodeTitle: episodeItem.title,
        animeId: currentAnime.id,
        userUid: user?.uid
      });

    } catch (e) {
      console.error('STREAM ERROR:', e);
      alert(`Failed to get stream: ${e.message}`);
    } finally {
      setLoadingEpisode(null);
    }
  };

  const renderHeader = () => (
    <View style={styles.heroContainer}>
      <View style={styles.backdropWrapper}>
        <ProxyImage source={{ uri: currentAnime.coverImage || currentAnime.backdrop }} style={styles.backdropImage} resizeMode="cover" />
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#050505" stopOpacity="0.05" />
              <Stop offset="0.75" stopColor="#050505" stopOpacity="0.95" />
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

        <View style={styles.inlineMetaRow}>
          {isUpcoming ? (
            <View style={styles.upcomingBadge}><Text style={styles.upcomingBadgeText}>UPCOMING</Text></View>
          ) : (
            <View style={styles.newBadge}><Text style={styles.newBadgeText}>New Episode</Text></View>
          )}
          <View style={styles.ratingBadge}><Text style={styles.ratingText}>{currentAnime.rating || 'U/A 16+'}</Text></View>
          <Text style={styles.metaScore}>★ {currentAnime.score || 85}%</Text>
        </View>

        <TouchableOpacity 
          style={[styles.playButton, (episodes.length === 0 || isUpcoming) && { opacity: 0.5 }]} 
          activeOpacity={0.85}
          onPress={() => {
            if (episodes.length > 0) {
              const target = episodes.find(e => e.epNumber === userProgress.episodeNum) || episodes[0];
              handlePlayEpisode(target);
            }
          }}
          disabled={episodes.length === 0 || isUpcoming}
        >
          <Text style={styles.playButtonText}>
            {isUpcoming ? 'Not Yet Released' : (userProgress.episodeNum ? `Resume Episode ${userProgress.episodeNum}` : 'Watch Now')}
          </Text>
          {!isUpcoming && episodes.length > 0 && <IconPlay size={18} color="#000" />}
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLibrary} activeOpacity={0.7}>
            {inLibrary ? <IconCheck /> : <IconPlus />}
            <Text style={styles.actionText}>Watchlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <IconDownload />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => Share.share({ message: `Watch ${currentAnime.title} on Kameko!` })} activeOpacity={0.7}>
            <IconShare />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.synopsisContainer}>
          <Text style={styles.synopsisText} numberOfLines={descExpanded ? undefined : 3}>{currentAnime.description}</Text>
          {currentAnime.description?.length > 120 && (
            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} activeOpacity={0.7} style={styles.seeMoreBtn}>
              <Text style={styles.seeMoreText}>{descExpanded ? 'Less Details' : 'More Details'} <Text style={{fontSize: 10}}>{descExpanded ? '▲' : '▼'}</Text></Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabHeader}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'episodes' && styles.tabBtnActive]} onPress={() => setActiveTab('episodes')} activeOpacity={0.8}>
            <Text style={[styles.tabText, activeTab === 'episodes' && styles.tabTextActive]}>Episodes {episodes.length > 0 ? `(${episodes.length})` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'alternates' && styles.tabBtnActive]} onPress={() => setActiveTab('alternates')} activeOpacity={0.8}>
            <Text style={[styles.tabText, activeTab === 'alternates' && styles.tabTextActive]}>Alternates {alternates.length > 0 ? `(${alternates.length})` : ''}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <View style={styles.topNav}>
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <Defs>
            <LinearGradient id="topNavGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0.85" />
              <Stop offset="0.6" stopColor="#000000" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#topNavGrad)" />
        </Svg>
        <TouchableOpacity style={styles.navBackBtn} onPress={onBack || (() => navigation?.goBack())}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
        </TouchableOpacity>
      </View>

      <Animated.FlatList
        data={activeTab === 'episodes' ? episodes : alternates}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            {episodesLoading && activeTab === 'episodes' ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={BRAND_RED} />
                <Text style={styles.loadingText}>Fetching episodes...</Text>
              </View>
            ) : (
              <Text style={styles.emptyStateText}>
                {activeTab === 'episodes' ? (isUpcoming ? 'This series is upcoming and has not broadcasted episodes yet.' : 'No episodes found for this series.') : 'No related seasons or media indexed.'}
              </Text>
            )}
          </View>
        )}
        renderItem={({ item }) => {
          if (activeTab === 'episodes') {
            const isLoadingThis = loadingEpisode === item.epNumber;
            return (
              <TouchableOpacity style={styles.epCard} activeOpacity={0.8} onPress={() => handlePlayEpisode(item)}>
                <View style={styles.epTopRow}>
                  <View style={styles.epImageWrapper}>
                    <ProxyImage source={{ uri: item.still }} style={styles.epThumbnail} resizeMode="cover" />
                    <View style={styles.epPlayOverlay}>
                      {isLoadingThis ? <ActivityIndicator size="small" color="#FFF" /> : <IconPlay size={16} color="#FFF" />}
                    </View>
                  </View>
                  <View style={styles.epMeta}>
                    <Text style={styles.epTitle} numberOfLines={1}>{item.epNumber}. {item.title}</Text>
                    <Text style={styles.epDuration}>{item.duration}</Text>
                  </View>
                </View>
                <Text style={styles.epDesc} numberOfLines={2}>{item.desc}</Text>
              </TouchableOpacity>
            );
          } else {
            return (
              <TouchableOpacity style={styles.altCard} activeOpacity={0.8} onPress={() => { navigation?.push ? navigation.push('Play', { anime: item }) : (onBack && onBack()); }}>
                <ProxyImage source={{ uri: item.coverImage }} style={styles.altThumbnail} resizeMode="cover" />
                <View style={styles.altMeta}>
                  <View style={styles.altBadge}><Text style={styles.altBadgeText}>{item.relationType}</Text></View>
                  <Text style={styles.altTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.altSub}>{item.format} • {item.year} • {item.score}</Text>
                </View>
              </TouchableOpacity>
            );
          }
        }}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  topNav: { position: 'absolute', top: 0, left: 0, right: 0, height: 110, zIndex: 100, paddingTop: 45, paddingHorizontal: 16 },
  navBackBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, alignSelf: 'flex-start' },
  heroContainer: { width: '100%' },
  backdropWrapper: { width: '100%', height: height * 0.65, position: 'absolute', top: 0, left: 0 },
  backdropImage: { width: '100%', height: '100%' },
  heroContent: { paddingTop: height * 0.40, paddingHorizontal: 20 },
  logoContainer: { width: '100%', alignItems: 'center', marginBottom: 15 },
  titleLogo: { width: width * 0.8, height: 110 },
  titleText: { color: '#FFF', fontSize: 32, fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 8 },
  inlineMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 },
  newBadge: { backgroundColor: BRAND_RED, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  newBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  upcomingBadge: { backgroundColor: '#FF8C00', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  upcomingBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  ratingBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  ratingText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  metaScore: { color: '#CCC', fontSize: 12, fontWeight: 'bold' },
  playButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND_RED, paddingVertical: 14, borderRadius: 6, marginBottom: 25 },
  playButtonText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 40, width: '100%', marginBottom: 25 },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionText: { color: '#AAA', fontSize: 10, fontWeight: '600' },
  synopsisContainer: { marginBottom: 20 },
  synopsisText: { color: '#E0E0E0', fontSize: 13, lineHeight: 20 },
  seeMoreBtn: { marginTop: 6 },
  seeMoreText: { color: BRAND_RED, fontSize: 12, fontWeight: 'bold' },
  tabHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', marginBottom: 15 },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 15 },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: BRAND_RED },
  tabText: { color: '#777', fontSize: 15, fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },
  listPadding: { paddingBottom: 60 },
  epCard: { paddingHorizontal: 20, marginBottom: 18 },
  epTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  epImageWrapper: { width: 130, height: 75, borderRadius: 4, overflow: 'hidden', backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  epThumbnail: { width: '100%', height: '100%', position: 'absolute' },
  epPlayOverlay: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  epMeta: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  epTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
  epDuration: { color: '#888', fontSize: 12 },
  epDesc: { color: '#999', fontSize: 12, lineHeight: 17 },
  altCard: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15, alignItems: 'center' },
  altThumbnail: { width: 80, height: 110, borderRadius: 6, backgroundColor: '#1A1A1A' },
  altMeta: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  altBadge: { backgroundColor: 'rgba(229,9,20,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6, borderWidth: 1, borderColor: 'rgba(229,9,20,0.4)' },
  altBadgeText: { color: BRAND_RED, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  altTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 5 },
  altSub: { color: '#888', fontSize: 12, fontWeight: '600' },
  emptyState: { paddingVertical: 45, alignItems: 'center' },
  emptyStateText: { color: '#777', fontSize: 13, textAlign: 'center', paddingHorizontal: 35 },
  loadingBox: { alignItems: 'center', gap: 10 },
  loadingText: { color: '#888', fontSize: 12 }
});
