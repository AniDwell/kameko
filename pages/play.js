import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator, ScrollView, Modal
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

  // --- DEBUG MODAL STATE ---
  const [debugJson, setDebugJson] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  // Sync Firebase
  useEffect(() => {
    if (!user || !currentAnime?.id) return;
    const animeDocId = String(currentAnime.id);
    const libRef = firestore().collection('users').doc(user.uid).collection('library').doc(animeDocId);
    const libUnsub = libRef.onSnapshot(doc => setInLibrary(doc?.exists || false), () => {});
    const progRef = firestore().collection('users').doc(user.uid).collection('progress').doc(animeDocId);
    const progUnsub = progRef.onSnapshot(doc => { if (doc?.exists) setUserProgress(doc.data()); }, () => {});
    return () => { libUnsub(); progUnsub(); };
  }, [user, currentAnime?.id]);

  // Fetch Episodes
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

  // Handle Play -> OPENS DEBUG MODAL INSTEAD OF PLAYER
  const handlePlayEpisode = async (episodeItem) => {
    try {
      setLoadingEpisode(episodeItem.epNumber);

      const safeId = encodeURIComponent(vercelAnimeId || currentAnime.id);
      const safeEp = encodeURIComponent(String(episodeItem.epNumber));

      const streamUrl = `${VERCEL_API_BASE}/api/stream?id=${safeId}&ep=${safeEp}&server=hd-1&type=sub`;
      
      const res = await fetchWithTimeout(streamUrl, {}, 10000);
      const json = await res.json();

      // SHOWING JSON RESPONSE ON SCREEN FOR DEBUGGING
      setDebugJson({
        REQUEST_URL: streamUrl,
        RESPONSE: json
      });

    } catch (e) {
      setDebugJson({ ERROR: e.message });
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
          <Text style={styles.titleText}>{currentAnime.title}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.playButton, (episodes.length === 0 || isUpcoming) && { opacity: 0.5 }]} 
          activeOpacity={0.85}
          onPress={() => episodes.length > 0 && handlePlayEpisode(episodes[0])}
          disabled={episodes.length === 0 || isUpcoming}
        >
          <Text style={styles.playButtonText}>Debug Stream Response</Text>
          <IconPlay size={18} color="#000" />
        </TouchableOpacity>

        <View style={styles.tabHeader}>
          <TouchableOpacity style={[styles.tabBtn, styles.tabBtnActive]} activeOpacity={1}>
            <Text style={[styles.tabText, styles.tabTextActive]}>Episodes {episodes.length > 0 ? `(${episodes.length})` : ''}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.navBackBtn} onPress={onBack || (() => navigation?.goBack())}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
        </TouchableOpacity>
      </View>

      <Animated.FlatList
        data={episodes}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        ListHeaderComponent={renderHeader}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.epCard} activeOpacity={0.8} onPress={() => handlePlayEpisode(item)}>
            <View style={styles.epTopRow}>
              <View style={styles.epImageWrapper}>
                <ProxyImage source={{ uri: item.still }} style={styles.epThumbnail} resizeMode="cover" />
                <View style={styles.epPlayOverlay}>
                  {loadingEpisode === item.epNumber ? <ActivityIndicator size="small" color="#FFF" /> : <IconPlay size={16} color="#FFF" />}
                </View>
              </View>
              <View style={styles.epMeta}>
                <Text style={styles.epTitle} numberOfLines={1}>{item.epNumber}. {item.title}</Text>
                <Text style={styles.epDuration}>{item.duration}</Text>
              </View>
            </View>
            <Text style={styles.epDesc} numberOfLines={2}>{item.desc}</Text>
          </TouchableOpacity>
        )}
      />

      {/* --- DEBUG MODAL WINDOW --- */}
      <Modal visible={debugJson !== null} transparent={true} animationType="slide">
        <View style={styles.debugModalContainer}>
          <View style={styles.debugModalHeader}>
            <Text style={styles.debugModalTitle}>API JSON Response</Text>
            <TouchableOpacity onPress={() => setDebugJson(null)} style={styles.debugCloseBtn}>
              <Text style={styles.debugCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.debugScroll} showsVerticalScrollIndicator={true}>
            <Text style={styles.debugJsonText}>{JSON.stringify(debugJson, null, 2)}</Text>
          </ScrollView>
        </View>
      </Modal>

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
  titleText: { color: '#FFF', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  playButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: BRAND_RED, paddingVertical: 14, borderRadius: 6, marginBottom: 25 },
  playButtonText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  tabHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', marginBottom: 15 },
  tabBtn: { paddingVertical: 12, paddingHorizontal: 15 },
  tabBtnActive: { borderBottomWidth: 3, borderBottomColor: BRAND_RED },
  tabText: { color: '#777', fontSize: 15, fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },
  epCard: { paddingHorizontal: 20, marginBottom: 18 },
  epTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  epImageWrapper: { width: 130, height: 75, borderRadius: 4, overflow: 'hidden', backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  epThumbnail: { width: '100%', height: '100%', position: 'absolute' },
  epPlayOverlay: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  epMeta: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  epTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
  epDuration: { color: '#888', fontSize: 12 },
  epDesc: { color: '#999', fontSize: 12, lineHeight: 17 },

  // DEBUG MODAL STYLES
  debugModalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  debugModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 15, marginBottom: 15 },
  debugModalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  debugCloseBtn: { backgroundColor: BRAND_RED, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 6 },
  debugCloseText: { color: '#FFF', fontWeight: 'bold' },
  debugScroll: { flex: 1, backgroundColor: '#111', borderRadius: 8, padding: 15 },
  debugJsonText: { color: '#4ADE80', fontFamily: 'monospace', fontSize: 12 }
});
