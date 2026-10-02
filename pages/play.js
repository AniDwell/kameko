import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator, ScrollView 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Rect, Path } from 'react-native-svg';
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
  const [episodes, setEpisodes] = useState([]);
  const [alternates, setAlternates] = useState([]);
  const [activeTab, setActiveTab] = useState('episodes'); // 'episodes' or 'alternates'
  
  const [titleLogo, setTitleLogo] = useState(null);
  const [backdropImg, setBackdropImg] = useState(currentAnime.backdrop);
  const [descExpanded, setDescExpanded] = useState(false);
  const [userProgress, setUserProgress] = useState({ episodeNum: 1 });
  const [loadingEpisode, setLoadingEpisode] = useState(null);

  const scrollY = useRef(new Animated.Value(0)).current;

  // 1. Sync Library & Progress from Firestore
  useEffect(() => {
    if (!user) return;
    const libRef = firestore().collection('users').doc(user.uid).collection('library').doc(currentAnime.id);
    const libUnsub = libRef.onSnapshot(doc => setInLibrary(doc.exists));

    const progRef = firestore().collection('users').doc(user.uid).collection('progress').doc(currentAnime.id);
    const progUnsub = progRef.onSnapshot(doc => {
      if (doc.exists) setUserProgress(doc.data());
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

  // 2. Fetch Episodes from Vercel API & Alternates from AniList
  useEffect(() => {
    const fetchAnimeDetails = async () => {
      try {
        setLoading(true);

        // A. Fetch Episodes from Vercel API
        const episodesRes = await fetch(`${VERCEL_API_BASE}/api/episodes?id=${currentAnime.id}`);
        const epJson = await episodesRes.json();
        const epsList = epJson.data || epJson.episodes || epJson || [];
        
        const formattedEps = epsList.map((ep, idx) => ({
          id: String(ep.id || idx + 1),
          epNumber: ep.number || ep.episode || idx + 1,
          title: ep.title || `Episode ${ep.number || idx + 1}`,
          desc: ep.description || currentAnime.description,
          still: ep.image || currentAnime.backdrop,
          duration: '24m'
        }));
        setEpisodes(formattedEps);

        // B. Fetch Alternates / Relations from AniList
        const aniQuery = `
          query ($search: String) {
            Media (search: $search, type: ANIME) {
              relations {
                edges {
                  relationType
                  node {
                    id
                    title { romaji english }
                    coverImage { extraLarge }
                    format
                    seasonYear
                    averageScore
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
        const edges = aniJson?.data?.Media?.relations?.edges || [];
        
        const altList = await Promise.all(edges.map(async (edge) => {
          const altTitle = edge.node.title.english || edge.node.title.romaji;
          let matchedVercelId = null;
          
          try {
            const vSearch = await fetch(`${VERCEL_API_BASE}/api/search?keyword=${encodeURIComponent(altTitle)}`);
            const vJson = await vSearch.json();
            const matches = vJson.data || vJson.results || vJson || [];
            if (matches.length > 0) matchedVercelId = matches[0].id;
          } catch(e) {}

          return {
            id: String(edge.node.id),
            vercelId: matchedVercelId || edge.node.id,
            title: altTitle,
            coverImage: edge.node.coverImage?.extraLarge || currentAnime.coverImage,
            relationType: edge.relationType,
            format: edge.node.format || 'TV',
            score: edge.node.averageScore || 'N/A',
            year: edge.node.seasonYear || 'N/A'
          };
        }));

        setAlternates(altList.filter(item => item.vercelId));

        // C. Fetch TMDB Title Logo & Backdrop
        const tmdbSearch = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(currentAnime.title)}`);
        const tmdbJson = await tmdbSearch.json();
        const tmdbShow = tmdbJson.results?.[0];

        if (tmdbShow) {
          if (tmdbShow.backdrop_path) setBackdropImg(`https://image.tmdb.org/t/p/original${tmdbShow.backdrop_path}`);
          const imgRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbShow.id}/images?api_key=${TMDB_API_KEY}`);
          const imgJson = await imgRes.json();
          const logo = imgJson.logos?.find(l => l.iso_639_1 === 'en' || l.iso_639_1 === 'ja');
          if (logo) setTitleLogo(`https://image.tmdb.org/t/p/w500${logo.file_path}`);
        }

      } catch (err) {
        console.error("Play page init error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnimeDetails();
  }, [currentAnime.id, currentAnime.title]);

  // 3. Handle Episode Play (Fetches M3U8 from Vercel API and opens Player)
  const handlePlayEpisode = async (epNum) => {
    try {
      setLoadingEpisode(epNum);
      const res = await fetch(`${VERCEL_API_BASE}/api/stream?id=${currentAnime.id}&ep=${epNum}&server=hd-1&type=sub`);
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
      
      {/* BACKDROP */}
      <View style={styles.backdropWrapper}>
        <ProxyImage source={{ uri: backdropImg }} style={styles.backdropImage} resizeMode="cover" />
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
        
        {/* BIGGER COVER IMAGE & METADATA SPLIT */}
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
            </View>

            {/* PLAY BUTTON */}
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

        {/* SYNOPSIS WITH 'SEE MORE' */}
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

        {/* GENRES */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreScroll}>
          {currentAnime.genres?.map((g, idx) => (
            <View key={idx} style={styles.genrePill}>
              <Text style={styles.genrePillText}>{g}</Text>
            </View>
          ))}
        </ScrollView>

        {/* ACTIONS */}
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

        {/* TABS: EPISODES / ALTERNATES */}
        <View style={styles.tabHeader}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'episodes' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('episodes')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'episodes' && styles.tabTextActive]}>Episodes ({episodes.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'alternates' && styles.tabBtnActive]} 
            onPress={() => setActiveTab('alternates')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, activeTab === 'alternates' && styles.tabTextActive]}>Alternates ({alternates.length})</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      <Animated.View style={[styles.topNav, { backgroundColor: headerBackgroundColor }]}>
        <TouchableOpacity style={styles.navBackBtn} onPress={onBack || (() => navigation?.goBack())}>
          <Svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
        </TouchableOpacity>
      </Animated.View>

      {loading ? (
        <View style={styles.loaderCenter}><ActivityIndicator size="large" color={BRAND_RED} /></View>
      ) : (
        <Animated.FlatList
          data={activeTab === 'episodes' ? episodes : alternates}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => {
            if (activeTab === 'episodes') {
              const isLoadingThis = loadingEpisode === item.epNumber;
              return (
                <TouchableOpacity 
                  style={styles.epCard} 
                  activeOpacity={0.8}
                  onPress={() => handlePlayEpisode(item.epNumber)}
                >
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
              // Alternates List View
              return (
                <TouchableOpacity 
                  style={styles.altCard} 
                  activeOpacity={0.8}
                  onPress={() => {
                    // Switch current view to selected alternate anime
                    navigation.push('Play', { anime: { id: item.vercelId, title: item.title, coverImage: item.coverImage, backdrop: item.coverImage } });
                  }}
                >
                  <ProxyImage source={{ uri: item.coverImage }} style={styles.altThumbnail} resizeMode="cover" />
                  <View style={styles.altMeta}>
                    <View style={styles.altBadge}><Text style={styles.altBadgeText}>{item.relationType}</Text></View>
                    <Text style={styles.altTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.altSub}>{item.format} • {item.year} • ★ {item.score}%</Text>
                  </View>
                </TouchableOpacity>
              );
            }
          }}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          overScrollMode="never"
          bounces={false}
        />
      )}
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

  // BIGGER COVER IMAGE & SPLIT ROW
  splitRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  coverShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.9, shadowRadius: 15, elevation: 15, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  coverImage: { width: 130, height: 185, borderRadius: 8 }, // Enlarged cover art
  rightMetaColumn: { flex: 1, marginLeft: 16, justifyContent: 'flex-start' },
  titleLogo: { width: 180, height: 60, alignSelf: 'flex-start', marginBottom: 8 },
  titleText: { color: '#FFF', fontSize: 22, fontWeight: '900', marginBottom: 8 },
  
  inlineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
  metaScore: { color: '#46D369', fontSize: 13, fontWeight: 'bold' },
  ratingBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  ratingText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  playButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 6 },
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

  // TABS (Episodes / Alternates)
  tabHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', marginBottom: 15 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: BRAND_RED },
  tabText: { color: '#777', fontSize: 14, fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },

  listPadding: { paddingBottom: 50 },
  epCard: { paddingHorizontal: 18, marginBottom: 18 },
  epTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  epImageWrapper: { width: 120, height: 68, borderRadius: 4, overflow: 'hidden', backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  epThumbnail: { width: '100%', height: '100%', position: 'absolute' },
  epPlayOverlay: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  epMeta: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  epTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
  epDuration: { color: '#888', fontSize: 11 },
  epDesc: { color: '#999', fontSize: 12, lineHeight: 16 },

  // ALTERNATES LIST VIEW STYLES
  altCard: { flexDirection: 'row', paddingHorizontal: 18, marginBottom: 15, alignItems: 'center' },
  altThumbnail: { width: 75, height: 105, borderRadius: 6, backgroundColor: '#1A1A1A' },
  altMeta: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  altBadge: { backgroundColor: 'rgba(229,9,20,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6, borderWidth: 1, borderColor: 'rgba(229,9,20,0.4)' },
  altBadgeText: { color: BRAND_RED, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  altTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  altSub: { color: '#888', fontSize: 11, fontWeight: '600' }
});
