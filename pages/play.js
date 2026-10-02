import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator, Modal, ScrollView 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import ProxyImage from '../components/ProxyImage';

const { width, height } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

// --- CUSTOM SVG ICONS ---
const IconPlay = ({ size = 18, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>
);
const IconPlus = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M12 5v14M5 12h14" /></Svg>
);
const IconCheck = ({ size = 22, color = BRAND_RED }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><Path d="M20 6L9 17l-5-5" /></Svg>
);
const IconShare = ({ size = 20, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></Svg>
);
const IconDownload = ({ size = 18, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>
);
const IconChevronDown = ({ size = 14, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M6 9l6 6 6-6" /></Svg>
);

export default function Play({ anime, user, onBack, navigation }) {
  const currentAnime = anime || {
    id: 'solo-leveling',
    title: 'Solo Leveling',
    backdrop: 'https://image.tmdb.org/t/p/original/vIgyYkXkg6NC2whRbYjBD7eb3Er.jpg',
    coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iqITmI6.png',
    description: "In a world of gifted hunters, Sung Jinwoo struggles as the weakest. After surviving a deadly dungeon, he receives an exclusive quest system.",
    genres: ['Action', 'Fantasy', 'Adventure'],
    score: 85,
    rating: 'U/A 16+'
  };

  const [loading, setLoading] = useState(true);
  const [inLibrary, setInLibrary] = useState(false);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [seasonModalVisible, setSeasonModalVisible] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [latestSeasonCover, setLatestSeasonCover] = useState(currentAnime.backdrop);
  const [titleLogo, setTitleLogo] = useState(null);
  
  // UI States
  const [descExpanded, setDescExpanded] = useState(false);
  const [userProgress, setUserProgress] = useState({ episodeNum: 1, progress: 0 });
  const [loadingEpisode, setLoadingEpisode] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  // 1. Sync Library & Watch Progress from Firestore
  useEffect(() => {
    if (!user) return;
    const libRef = firestore().collection('users').doc(user.uid).collection('library').doc(currentAnime.id);
    const libUnsub = libRef.onSnapshot(doc => setInLibrary(doc.exists));

    const progRef = firestore().collection('users').doc(user.uid).collection('progress').doc(currentAnime.id);
    const progUnsub = progRef.onSnapshot(doc => {
      if (doc.exists) {
        setUserProgress(doc.data());
      }
    });

    return () => {
      libUnsub();
      progUnsub();
    };
  }, [user, currentAnime.id]);

  const toggleLibrary = async () => {
    if (!user) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(currentAnime.id);
    if (inLibrary) {
      await ref.delete();
    } else {
      await ref.set({ 
        id: currentAnime.id, 
        title: currentAnime.title, 
        img: currentAnime.coverImage, 
        addedAt: firestore.FieldValue.serverTimestamp() 
      });
    }
  };

  // 2. AniList + MAL + TMDB Franchise & Season Resolution
  useEffect(() => {
    const resolveFranchiseAndSeasons = async () => {
      try {
        setLoading(true);

        // A. Query AniList for the anime, its synonyms, and relation tree (Sequels/Prequels)
        const aniQuery = `
          query ($search: String) {
            Media (search: $search, type: ANIME) {
              id
              title { romaji english native }
              synonyms
              relations {
                edges {
                  relationType
                  node {
                    id
                    title { romaji english }
                    format
                    seasonYear
                    coverImage { extraLarge }
                  }
                }
              }
            }
          }
        `;

        const aniRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: aniQuery, variables: { search: currentAnime.title } })
        });
        const aniJson = await aniRes.json();
        const media = aniJson?.data?.Media;

        // Collect all related alternative titles for TMDB lookup
        const searchTitles = [currentAnime.title];
        if (media?.title?.english) searchTitles.push(media.title.english);
        if (media?.title?.romaji) searchTitles.push(media.title.romaji);
        media?.synonyms?.forEach(s => searchTitles.push(s));

        // Filter valid TV series relations (Sequels / Prequels)
        const franchiseNodes = [media].filter(Boolean);
        media?.relations?.edges?.forEach(edge => {
          if (['SEQUEL', 'PREQUEL', 'PARENT'].includes(edge.relationType) && edge.node.format === 'TV') {
            franchiseNodes.push(edge.node);
          }
        });

        // B. Search TMDB and match seasons
        const tmdbSearchRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(currentAnime.title)}`);
        const tmdbSearchData = await tmdbSearchRes.json();
        const tmdbShow = tmdbSearchData.results?.[0];

        if (!tmdbShow) {
          // Fallback if TMDB misses
          const defaultSeason = { name: 'Season 1', seasonNumber: 1, vercelId: currentAnime.id };
          setSeasons([defaultSeason]);
          setSelectedSeason(defaultSeason);
          setLoading(false);
          return;
        }

        // Fetch TMDB Logo (Title Art)
        const [imagesRes, showDetailsRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/tv/${tmdbShow.id}/images?api_key=${TMDB_API_KEY}`).catch(() => null),
          fetch(`https://api.themoviedb.org/3/tv/${tmdbShow.id}?api_key=${TMDB_API_KEY}`).catch(() => null)
        ]);

        if (imagesRes && imagesRes.ok) {
          const imgData = await imagesRes.json();
          const engLogo = imgData.logos?.find(l => l.iso_639_1 === 'en' || l.iso_639_1 === 'ja');
          if (engLogo) setTitleLogo(`https://image.tmdb.org/t/p/w500${engLogo.file_path}`);
        }

        let tmdbSeasons = [];
        if (showDetailsRes && showDetailsRes.ok) {
          const showData = await showDetailsRes.json();
          tmdbSeasons = (showData.seasons || []).filter(s => s.season_number > 0);
          if (showData.backdrop_path) {
            setLatestSeasonCover(`https://image.tmdb.org/t/p/original${showData.backdrop_path}`);
          }
        }

        // C. Cross-verify seasons with Vercel API
        const verifiedSeasons = await Promise.all(tmdbSeasons.map(async (s) => {
          const seasonKeyword = s.season_number === 1 ? currentAnime.title : `${currentAnime.title} Season ${s.season_number}`;
          try {
            const vRes = await fetch(`${VERCEL_API_BASE}/api/search?keyword=${encodeURIComponent(seasonKeyword)}`);
            if (!vRes.ok) return null;
            const vData = await vRes.json();
            const results = vData.data || vData.results || vData || [];
            if (results.length === 0) return null;

            return {
              name: s.name || `Season ${s.season_number}`,
              seasonNumber: s.season_number,
              tmdbShowId: tmdbShow.id,
              vercelId: results[0].id,
              poster: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : currentAnime.coverImage
            };
          } catch (e) {
            return null;
          }
        }));

        const cleanSeasons = verifiedSeasons.filter(Boolean);

        if (cleanSeasons.length > 0) {
          setSeasons(cleanSeasons);
          setSelectedSeason(cleanSeasons[0]); // Default to Season 1
        } else {
          const fallback = { name: 'Season 1', seasonNumber: 1, tmdbShowId: tmdbShow.id, vercelId: currentAnime.id };
          setSeasons([fallback]);
          setSelectedSeason(fallback);
        }

      } catch (err) {
        console.error("Franchise resolution error:", err);
      } finally {
        setLoading(false);
      }
    };

    resolveFranchiseAndSeasons();
  }, [currentAnime.title]);

  // 3. Load Episodes for the Active Season
  useEffect(() => {
    if (!selectedSeason) return;

    const loadSeasonEpisodes = async () => {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/tv/${selectedSeason.tmdbShowId}/season/${selectedSeason.seasonNumber}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        const tmdbEps = data.episodes || [];

        const formattedEps = tmdbEps.map(ep => ({
          id: String(ep.id),
          epNumber: ep.episode_number,
          title: ep.name || `Episode ${ep.episode_number}`,
          desc: ep.overview || 'No synopsis available for this episode.',
          still: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : latestSeasonCover,
          duration: ep.runtime ? `${ep.runtime}m` : '24m'
        }));

        setEpisodes(formattedEps);
      } catch (e) {
        console.error("Episode load error:", e);
      }
    };

    loadSeasonEpisodes();
  }, [selectedSeason]);

  // 4. Handle Episode Play (Fetches M3U8 from Vercel API and opens Player)
  const handlePlayEpisode = async (epNum) => {
    try {
      setLoadingEpisode(epNum);
      const res = await fetch(`${VERCEL_API_BASE}/api/stream?id=${selectedSeason?.vercelId || currentAnime.id}&ep=${epNum}&server=hd-1&type=sub`);
      const json = await res.json();
      const streamUrl = json.data?.m3u8 || json.m3u8;

      if (streamUrl) {
        navigation.navigate('Player', {
          streamUrl,
          animeTitle: currentAnime.title,
          episodeNum: epNum,
          episodeTitle: episodes.find(e => e.epNumber === epNum)?.title || `Episode ${epNum}`
        });
      } else {
        alert("Streaming link currently unavailable for this episode.");
      }
    } catch (e) {
      alert("Failed to connect to streaming server.");
    } finally {
      setLoadingEpisode(null);
    }
  };

  const headerBackgroundColor = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.95)'],
    extrapolate: 'clamp',
  });

  const renderHeader = () => (
    <View style={styles.heroContainer}>
      
      {/* BACKGROUND BACKDROP */}
      <View style={styles.backdropWrapper}>
        <ProxyImage source={{ uri: latestSeasonCover }} style={styles.backdropImage} resizeMode="cover" />
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="heroGradient" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#000000" stopOpacity="1" />
              <Stop offset="0.35" stopColor="#000000" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.15" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#heroGradient)" />
        </Svg>
      </View>

      <View style={styles.heroContent}>
        
        {/* SPLIT ROW: Left Cover Image | Right Title Art & Metadata */}
        <View style={styles.splitRow}>
          <View style={styles.coverShadow}>
            <ProxyImage source={{ uri: currentAnime.coverImage }} style={styles.coverImage} />
          </View>

          <View style={styles.rightMetaColumn}>
            {titleLogo ? (
              <ProxyImage source={{ uri: titleLogo }} style={styles.titleLogo} resizeMode="contain" />
            ) : (
              <Text style={styles.titleText} numberOfLines={2}>{currentAnime.title}</Text>
            )}

            <View style={styles.inlineMetaRow}>
              {currentAnime.score ? <Text style={styles.metaScore}>★ {currentAnime.score}%</Text> : null}
              <View style={styles.ratingBadge}><Text style={styles.ratingText}>{currentAnime.rating || 'U/A 13+'}</Text></View>
              <Text style={styles.metaText}>{seasons.length} {seasons.length === 1 ? 'Season' : 'Seasons'}</Text>
            </View>

            {/* PRIMARY PLAY / RESUME BUTTON */}
            <TouchableOpacity 
              style={styles.playButton} 
              activeOpacity={0.8}
              onPress={() => handlePlayEpisode(userProgress.episodeNum || 1)}
            >
              <IconPlay size={18} color="#000" />
              <Text style={styles.playButtonText}>
                {userProgress.episodeNum ? `Resume Ep ${userProgress.episodeNum}` : 'Play Episode 1'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SYNOPSIS WITH 'SEE MORE' TOGGLE */}
        <View style={styles.synopsisContainer}>
          <Text style={styles.synopsisText} numberOfLines={descExpanded ? undefined : 3}>
            {currentAnime.description}
          </Text>
          {currentAnime.description?.length > 120 && (
            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} activeOpacity={0.7}>
              <Text style={styles.seeMoreText}>{descExpanded ? 'See Less' : 'See More'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* GENRE SLIDER PILLS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreScroll}>
          {currentAnime.genres?.map((g, idx) => (
            <View key={idx} style={styles.genrePill}>
              <Text style={styles.genrePillText}>{g}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ACTION BUTTONS (My List, Download, Share) */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLibrary} activeOpacity={0.7}>
            {inLibrary ? <IconCheck /> : <IconPlus />}
            <Text style={styles.actionText}>My List</Text>
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

        <View style={styles.divider} />

        {/* SEASONS DROPDOWN SELECTOR */}
        <TouchableOpacity 
          style={styles.seasonDropdown} 
          activeOpacity={0.8}
          onPress={() => setSeasonModalVisible(true)}
        >
          <Text style={styles.seasonDropdownText}>{selectedSeason?.name || 'Season 1'}</Text>
          <IconChevronDown />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEpisode = ({ item }) => {
    const isCurrentPlaying = userProgress.episodeNum === item.epNumber;
    const isLoadingThis = loadingEpisode === item.epNumber;

    return (
      <TouchableOpacity 
        style={[styles.epCard, isCurrentPlaying && styles.epCardActive]} 
        activeOpacity={0.8}
        onPress={() => handlePlayEpisode(item.epNumber)}
      >
        <View style={styles.epTopRow}>
          <View style={styles.epImageWrapper}>
            <ProxyImage source={{ uri: item.still }} style={styles.epThumbnail} resizeMode="cover" />
            <View style={styles.epPlayOverlay}>
              {isLoadingThis ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <IconPlay size={16} color="#FFF" />
              )}
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
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* FLOATING TOP NAV */}
      <Animated.View style={[styles.topNav, { backgroundColor: headerBackgroundColor }]}>
        <TouchableOpacity style={styles.navBackBtn} onPress={onBack || (() => navigation?.goBack())}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
        </TouchableOpacity>
      </Animated.View>

      {loading ? (
        <View style={styles.loaderCenter}><ActivityIndicator size="large" color={BRAND_RED} /></View>
      ) : (
        <Animated.FlatList
          data={episodes}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={renderEpisode}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          overScrollMode="never"
          bounces={false}
        />
      )}

      {/* SEASONS SELECTOR MODAL */}
      <Modal visible={seasonModalVisible} transparent={true} animationType="slide" onRequestClose={() => setSeasonModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalBar} />
            <Text style={styles.modalHeading}>Select Season</Text>
            {seasons.map((s, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.modalSeasonItem, selectedSeason?.seasonNumber === s.seasonNumber && styles.modalSeasonActive]}
                onPress={() => {
                  setSelectedSeason(s);
                  setSeasonModalVisible(false);
                }}
              >
                <Text style={[styles.modalSeasonText, selectedSeason?.seasonNumber === s.seasonNumber && styles.modalSeasonTextActive]}>
                  {s.name}
                </Text>
                {selectedSeason?.seasonNumber === s.seasonNumber && <IconCheck size={18} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSeasonModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  loaderCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topNav: { position: 'absolute', top: 0, left: 0, right: 0, height: 85, paddingTop: 38, paddingHorizontal: 16, zIndex: 100, flexDirection: 'row', alignItems: 'center' },
  navBackBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  
  heroContainer: { width: '100%' },
  backdropWrapper: { width: '100%', height: height * 0.45, position: 'absolute', top: 0, left: 0 },
  backdropImage: { width: '100%', height: '100%', opacity: 0.8 },
  heroContent: { paddingTop: height * 0.16, paddingHorizontal: 18 },

  // SPLIT ROW
  splitRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  coverShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.8, shadowRadius: 12, elevation: 12, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  coverImage: { width: 110, height: 160, borderRadius: 6 },
  rightMetaColumn: { flex: 1, marginLeft: 15, justifyContent: 'flex-start' },
  titleLogo: { width: 180, height: 60, alignSelf: 'flex-start', marginBottom: 8 },
  titleText: { color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  
  inlineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  metaScore: { color: '#46D369', fontSize: 12, fontWeight: 'bold' },
  metaText: { color: '#CCC', fontSize: 12, fontWeight: '600' },
  ratingBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3 },
  ratingText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  playButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 4 },
  playButtonText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 },

  // SYNOPSIS & SEE MORE
  synopsisContainer: { marginBottom: 12 },
  synopsisText: { color: '#CCCCCC', fontSize: 13, lineHeight: 19 },
  seeMoreText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 4 },

  // GENRES SCROLLER
  genreScroll: { gap: 8, marginBottom: 18 },
  genrePill: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)' },
  genrePillText: { color: '#E0E0E0', fontSize: 11, fontWeight: '600' },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 16 },
  actionBtn: { alignItems: 'center', gap: 4 },
  actionText: { color: '#AAA', fontSize: 11, fontWeight: '600' },

  divider: { width: '100%', height: 1, backgroundColor: '#222', marginBottom: 16 },

  seasonDropdown: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#141414', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  seasonDropdownText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  listPadding: { paddingBottom: 50 },
  epCard: { paddingHorizontal: 18, marginBottom: 18, backgroundColor: 'transparent' },
  epCardActive: { backgroundColor: 'rgba(229,9,20,0.08)', borderRadius: 8, paddingVertical: 8 },
  epTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  epImageWrapper: { width: 120, height: 68, borderRadius: 4, overflow: 'hidden', backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  epThumbnail: { width: '100%', height: '100%', position: 'absolute' },
  epPlayOverlay: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  epMeta: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  epTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  epDuration: { color: '#888', fontSize: 11 },
  epDesc: { color: '#999', fontSize: 12, lineHeight: 16 },

  // MODAL
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#141414', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 35 },
  modalBar: { width: 36, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalHeading: { color: '#FFF', fontSize: 17, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  modalSeasonItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalSeasonActive: { borderBottomColor: BRAND_RED },
  modalSeasonText: { color: '#AAA', fontSize: 15, fontWeight: '600' },
  modalSeasonTextActive: { color: '#FFF', fontWeight: 'bold' },
  modalCloseBtn: { marginTop: 18, backgroundColor: '#222', paddingVertical: 10, borderRadius: 6, alignItems: 'center' },
  modalCloseText: { color: '#FFF', fontSize: 14, fontWeight: 'bold' }
});
