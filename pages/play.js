import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator, Modal, FlatList 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

// --- CUSTOM SVG ICONS ---
const IconPlay = ({ size = 20, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>
);
const IconPlus = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M12 5v14M5 12h14" /></Svg>
);
const IconCheck = ({ size = 24, color = BRAND_RED }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><Path d="M20 6L9 17l-5-5" /></Svg>
);
const IconShare = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></Svg>
);
const IconDownload = ({ size = 20, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>
);
const IconChevronDown = ({ size = 16, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M6 9l6 6 6-6" /></Svg>
);
const IconClock = ({ size = 18, color = BRAND_RED }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2" />
  </Svg>
);

// --- TICKING COUNTDOWN COMPONENT ---
const CountdownFooter = ({ targetAirDate, nextEpNumber }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    if (!targetAirDate) return;
    const targetTime = new Date(targetAirDate).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, mins, secs });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetAirDate]);

  return (
    <View style={styles.countdownContainer}>
      <View style={styles.countdownHeader}>
        <IconClock />
        <Text style={styles.countdownTitle}>NEXT EPISODE #{nextEpNumber} AIRING SOON</Text>
      </View>
      <View style={styles.timerRow}>
        <View style={styles.timeBox}><Text style={styles.timeNumber}>{String(timeLeft.days).padStart(2, '0')}</Text><Text style={styles.timeLabel}>DAYS</Text></View>
        <Text style={styles.timeColon}>:</Text>
        <View style={styles.timeBox}><Text style={styles.timeNumber}>{String(timeLeft.hours).padStart(2, '0')}</Text><Text style={styles.timeLabel}>HRS</Text></View>
        <Text style={styles.timeColon}>:</Text>
        <View style={styles.timeBox}><Text style={styles.timeNumber}>{String(timeLeft.mins).padStart(2, '0')}</Text><Text style={styles.timeLabel}>MINS</Text></View>
        <Text style={styles.timeColon}>:</Text>
        <View style={styles.timeBox}><Text style={styles.timeNumber}>{String(timeLeft.secs).padStart(2, '0')}</Text><Text style={styles.timeLabel}>SECS</Text></View>
      </View>
    </View>
  );
};

export default function Play({ route, user, navigation }) {
  const anime = route?.params?.anime || {
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
  const [nextRelease, setNextRelease] = useState(null); // { airDate, epNumber }

  const scrollY = useRef(new Animated.Value(0)).current;

  // 1. Live Sync with Firestore Library
  useEffect(() => {
    if (!user) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(anime.id);
    const unsubscribe = ref.onSnapshot(doc => setInLibrary(doc.exists));
    return () => unsubscribe();
  }, [user, anime.id]);

  const toggleLibrary = async () => {
    if (!user) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(anime.id);
    if (inLibrary) {
      await ref.delete();
    } else {
      await ref.set({ id: anime.id, title: anime.title, img: anime.coverImage, addedAt: firestore.FieldValue.serverTimestamp() });
    }
  };

  // 2. TMDB Seasons Discovery & Vercel API Cross-Verification
  useEffect(() => {
    const discoverSeasons = async () => {
      try {
        setLoading(true);

        // Step A: Search TV series on TMDB
        const searchRes = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(anime.title)}`);
        const searchData = await searchRes.json();
        const tmdbShow = searchData.results?.[0];

        if (!tmdbShow) {
          // Fallback if not found on TMDB
          setSeasons([{ name: 'Season 1', seasonNumber: 1, vercelId: anime.id }]);
          setSelectedSeason({ name: 'Season 1', seasonNumber: 1, vercelId: anime.id });
          setLoading(false);
          return;
        }

        // Step B: Get TV Details for all Seasons
        const showRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbShow.id}?api_key=${TMDB_API_KEY}`);
        const showData = await showRes.json();
        const tmdbSeasons = (showData.seasons || []).filter(s => s.season_number > 0);

        // Step C: Verify Each Season Against Your Vercel API
        const verifiedSeasons = await Promise.all(tmdbSeasons.map(async (s) => {
          const searchKeyword = s.season_number === 1 
            ? anime.title 
            : `${anime.title} Season ${s.season_number}`;

          try {
            const vercelRes = await fetch(`${VERCEL_API_BASE}/api/search?keyword=${encodeURIComponent(searchKeyword)}`);
            if (!vercelRes.ok) return null;
            const vercelData = await vercelRes.json();
            const results = vercelData.data || vercelData.results || vercelData || [];
            
            if (results.length === 0) return null;

            return {
              name: s.name || `Season ${s.season_number}`,
              seasonNumber: s.season_number,
              tmdbShowId: tmdbShow.id,
              vercelId: results[0].id // Target stream ID in Vercel API
            };
          } catch (e) {
            return null;
          }
        }));

        const cleanSeasons = verifiedSeasons.filter(s => s !== null);

        if (cleanSeasons.length > 0) {
          setSeasons(cleanSeasons);
          setSelectedSeason(cleanSeasons[0]);
        } else {
          // If sub-seasons don't match naming, use root anime
          const defaultSeason = { name: 'Season 1', seasonNumber: 1, tmdbShowId: tmdbShow.id, vercelId: anime.id };
          setSeasons([defaultSeason]);
          setSelectedSeason(defaultSeason);
        }
      } catch (err) {
        console.error("Season discovery error:", err);
      } finally {
        setLoading(false);
      }
    };

    discoverSeasons();
  }, [anime.title]);

  // 3. Load Episodes & Check for Next Unreleased Episode
  useEffect(() => {
    if (!selectedSeason) return;

    const loadEpisodes = async () => {
      try {
        if (!selectedSeason.tmdbShowId) {
          setEpisodes([
            { id: '1', epNumber: 1, title: 'Episode 1', desc: anime.description, duration: '24m' }
          ]);
          return;
        }

        const seasonRes = await fetch(
          `https://api.themoviedb.org/3/tv/${selectedSeason.tmdbShowId}/season/${selectedSeason.seasonNumber}?api_key=${TMDB_API_KEY}`
        );
        const seasonData = await seasonRes.json();
        const tmdbEpisodes = seasonData.episodes || [];

        const now = new Date().getTime();
        let released = [];
        let upcoming = null;

        tmdbEpisodes.forEach((ep) => {
          const epAirTime = ep.air_date ? new Date(ep.air_date).getTime() : null;

          if (epAirTime && epAirTime > now) {
            if (!upcoming) {
              upcoming = { airDate: ep.air_date, epNumber: ep.episode_number };
            }
          } else {
            released.push({
              id: String(ep.id),
              epNumber: ep.episode_number,
              title: ep.name || `Episode ${ep.episode_number}`,
              desc: ep.overview || 'No episode synopsis available.',
              still: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : anime.backdrop,
              duration: ep.runtime ? `${ep.runtime}m` : '24m'
            });
          }
        });

        setEpisodes(released);
        setNextRelease(upcoming);
      } catch (e) {
        console.error("Episode fetch error:", e);
      }
    };

    loadEpisodes();
  }, [selectedSeason]);

  const headerBackgroundColor = scrollY.interpolate({
    inputRange: [0, 250],
    outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.95)'],
    extrapolate: 'clamp',
  });

  const renderEpisode = ({ item }) => (
    <TouchableOpacity style={styles.epCard} activeOpacity={0.8}>
      <View style={styles.epTopRow}>
        <View style={styles.epImageWrapper}>
          <Image source={{ uri: item.still }} style={styles.epThumbnail} resizeMode="cover" />
          <View style={styles.epPlayOverlay}><IconPlay size={16} color="#FFF" /></View>
        </View>
        <View style={styles.epMeta}>
          <Text style={styles.epTitle} numberOfLines={1}>{item.epNumber}. {item.title}</Text>
          <Text style={styles.epDuration}>{item.duration}</Text>
        </View>
        <TouchableOpacity style={styles.dlBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <IconDownload size={22} color="#888" />
        </TouchableOpacity>
      </View>
      <Text style={styles.epDesc} numberOfLines={3}>{item.desc}</Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.heroContainer}>
      <View style={styles.backdropWrapper}>
        <Image source={{ uri: anime.backdrop }} style={styles.backdropImage} resizeMode="cover" />
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="heroGradient" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#000000" stopOpacity="1" />
              <Stop offset="0.3" stopColor="#000000" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#heroGradient)" />
        </Svg>
      </View>

      <View style={styles.heroContent}>
        <View style={styles.coverShadow}>
          <Image source={{ uri: anime.coverImage }} style={styles.coverImage} />
        </View>

        <Text style={styles.titleText}>{anime.title}</Text>

        <View style={styles.metaRow}>
          {anime.score ? <Text style={styles.metaScore}>{anime.score}% Score</Text> : null}
          <View style={styles.ratingBadge}><Text style={styles.ratingText}>{anime.rating || 'U/A 13+'}</Text></View>
          <Text style={styles.metaText}>{seasons.length} {seasons.length === 1 ? 'Season' : 'Seasons'}</Text>
        </View>

        <TouchableOpacity style={styles.playButton} activeOpacity={0.8}>
          <IconPlay size={20} color="#000" />
          <Text style={styles.playButtonText}>Play Episode 1</Text>
        </TouchableOpacity>

        <Text style={styles.synopsisText} numberOfLines={4}>{anime.description}</Text>

        <View style={styles.genreRow}>
          {anime.genres.map((g, idx) => (
            <React.Fragment key={idx}>
              <Text style={styles.genreText}>{g}</Text>
              {idx < anime.genres.length - 1 && <Text style={styles.genreDot}>•</Text>}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLibrary} activeOpacity={0.7}>
            {inLibrary ? <IconCheck /> : <IconPlus />}
            <Text style={styles.actionText}>My List</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <IconDownload size={22} color="#FFF" />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => Share.share({ message: `Watch ${anime.title} on Kameko!` })} activeOpacity={0.7}>
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
          <Text style={styles.seasonDropdownText}>{selectedSeason?.name || 'Seasons'}</Text>
          <IconChevronDown />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      <Animated.View style={[styles.topNav, { backgroundColor: headerBackgroundColor }]}>
        <TouchableOpacity style={styles.navBackBtn} onPress={() => navigation?.goBack()}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
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
          ListFooterComponent={nextRelease ? <CountdownFooter targetAirDate={nextRelease.airDate} nextEpNumber={nextRelease.epNumber} /> : <View style={{ height: 40 }} />}
          contentContainerStyle={styles.listPadding}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
          scrollEventThrottle={16}
          overScrollMode="never"
          bounces={false}
        />
      )}

      {/* SEASONS SELECTION MODAL */}
      <Modal visible={seasonModalVisible} transparent={true} animationType="slide">
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
                {selectedSeason?.seasonNumber === s.seasonNumber && <IconCheck size={20} />}
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
  topNav: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, paddingTop: 40, paddingHorizontal: 15, zIndex: 100, flexDirection: 'row', alignItems: 'center' },
  navBackBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
  heroContainer: { width: '100%' },
  backdropWrapper: { width: '100%', height: height * 0.48, position: 'absolute', top: 0, left: 0 },
  backdropImage: { width: '100%', height: '100%', opacity: 0.8 },
  heroContent: { paddingTop: height * 0.18, paddingHorizontal: 20, alignItems: 'center' },
  coverShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.8, shadowRadius: 15, elevation: 15, marginBottom: 18, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  coverImage: { width: 135, height: 200, borderRadius: 8 },
  titleText: { color: '#FFF', fontSize: 28, fontWeight: '900', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  metaScore: { color: '#46D369', fontSize: 13, fontWeight: 'bold' },
  metaText: { color: '#E0E0E0', fontSize: 13, fontWeight: '600' },
  ratingBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ratingText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  playButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF', width: '100%', paddingVertical: 12, borderRadius: 6, marginBottom: 18 },
  playButtonText: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  synopsisText: { color: '#CCCCCC', fontSize: 13, lineHeight: 20, textAlign: 'justify', marginBottom: 14 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 22 },
  genreText: { color: '#E0E0E0', fontSize: 12, fontWeight: '500' },
  genreDot: { color: '#666', fontSize: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', marginBottom: 18 },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionText: { color: '#AAA', fontSize: 11, fontWeight: '600' },
  divider: { width: '100%', height: 1, backgroundColor: '#262626', marginBottom: 18 },
  seasonDropdown: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#161616', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  seasonDropdownText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  listPadding: { paddingBottom: 60 },
  epCard: { paddingHorizontal: 20, marginBottom: 20 },
  epTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  epImageWrapper: { width: 125, height: 72, borderRadius: 6, overflow: 'hidden', backgroundColor: '#1A1A1A', justifyContent: 'center', alignItems: 'center' },
  epThumbnail: { width: '100%', height: '100%', position: 'absolute' },
  epPlayOverlay: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.65)', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  epMeta: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  epTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 3 },
  epDuration: { color: '#888', fontSize: 12 },
  dlBtn: { padding: 8 },
  epDesc: { color: '#999', fontSize: 12, lineHeight: 17 },

  // COUNTDOWN FOOTER
  countdownContainer: { marginHorizontal: 20, marginTop: 15, marginBottom: 35, padding: 18, backgroundColor: '#111111', borderRadius: 12, borderWidth: 1, borderColor: '#262626', alignItems: 'center' },
  countdownHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  countdownTitle: { color: BRAND_RED, fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeBox: { alignItems: 'center', minWidth: 46 },
  timeNumber: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  timeLabel: { color: '#777', fontSize: 9, fontWeight: 'bold', marginTop: 2 },
  timeColon: { color: '#555', fontSize: 20, fontWeight: '900', marginBottom: 10 },

  // MODAL STYLES
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#141414', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 40 },
  modalBar: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  modalHeading: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  modalSeasonItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalSeasonActive: { borderBottomColor: BRAND_RED },
  modalSeasonText: { color: '#AAA', fontSize: 16, fontWeight: '600' },
  modalSeasonTextActive: { color: '#FFF', fontWeight: 'bold' },
  modalCloseBtn: { marginTop: 20, backgroundColor: '#222', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalCloseText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' }
});
