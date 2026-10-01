import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, ActivityIndicator
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const BRAND_RED = '#E50914';

// --- CUSTOM ICONS (Zero external dependencies) ---
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

export default function Play({ route, user, navigation }) {
  // If no route params, use fallback mock data for testing
  const anime = route?.params?.anime || {
    id: '123',
    title: 'Solo Leveling',
    backdrop: 'https://image.tmdb.org/t/p/original/vIgyYkXkg6NC2whRbYjBD7eb3Er.jpg',
    coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iqITmI6.png',
    description: "In a world where hunters with magical powers must battle deadly monsters to protect the human race from certain annihilation, a notoriously weak hunter named Sung Jinwoo finds himself in a seemingly endless struggle for survival.",
    genres: ['Action', 'Fantasy', 'Adventure'],
    status: 'RELEASING',
    score: 85,
    rating: 'U/A 16+'
  };

  const [loading, setLoading] = useState(false); // Set true if fetching episodes
  const [inLibrary, setInLibrary] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState('Season 1');
  const scrollY = useRef(new Animated.Value(0)).current;

  // Mock Episodes Data
  const episodes = [
    { id: 'e1', epNumber: 1, title: "I'm Used to It", duration: "24m", desc: "Jinwoo joins a low-rank dungeon raid. But what was supposed to be a simple mission turns into a nightmare when they discover a hidden double dungeon." },
    { id: 'e2', epNumber: 2, title: "If I Had One More Chance", duration: "24m", desc: "Trapped in the temple, the hunters face the terrifying statues. Jinwoo must solve the God's commandments to save the remaining survivors." },
    { id: 'e3', epNumber: 3, title: "It's Like a Game", duration: "24m", desc: "Jinwoo wakes up in a hospital room, unharmed. He discovers a mysterious screen floating in front of him, offering him a unique quest system." },
    { id: 'e4', epNumber: 4, title: "I've Gotta Get Stronger", duration: "24m", desc: "Entering his first instance dungeon alone, Jinwoo struggles against steel-fanged wolves but quickly learns how to level up his stats." },
  ];

  // 1. Check Library Status
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

  // 2. Animated Top Bar Background (Fades in on scroll)
  const headerBackgroundColor = scrollY.interpolate({
    inputRange: [0, 250],
    outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.95)'],
    extrapolate: 'clamp',
  });

  const renderEpisode = ({ item }) => (
    <View style={styles.epCard}>
      <View style={styles.epTopRow}>
        <View style={styles.epImageWrapper}>
          <Image source={{ uri: anime.backdrop }} style={styles.epThumbnail} blurRadius={2} />
          <View style={styles.epPlayOverlay}><IconPlay size={18} color="#FFF" /></View>
        </View>
        <View style={styles.epMeta}>
          <Text style={styles.epTitle} numberOfLines={1}>{item.epNumber}. {item.title}</Text>
          <Text style={styles.epDuration}>{item.duration}</Text>
        </View>
        <TouchableOpacity style={styles.dlBtn} activeOpacity={0.7}>
          <IconDownload size={22} color="#AAAAAA" />
        </TouchableOpacity>
      </View>
      <Text style={styles.epDesc} numberOfLines={3}>{item.desc}</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.heroContainer}>
      
      {/* BACKGROUND BACKDROP */}
      <View style={styles.backdropWrapper}>
        <Image source={{ uri: anime.backdrop }} style={styles.backdropImage} resizeMode="cover" />
        
        {/* Dark Gradient for Text Readability */}
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

      {/* FOREGROUND HERO CONTENT */}
      <View style={styles.heroContent}>
        
        {/* Cover Image Floating on Backdrop */}
        <View style={styles.coverShadow}>
          <Image source={{ uri: anime.coverImage }} style={styles.coverImage} />
        </View>

        {/* Series Title */}
        <Text style={styles.titleText}>{anime.title}</Text>

        {/* Meta Info (Year, Rating, Seasons) */}
        <View style={styles.metaRow}>
          <Text style={styles.metaScore}>{anime.score}% Match</Text>
          <Text style={styles.metaText}>2024</Text>
          <View style={styles.ratingBadge}><Text style={styles.ratingText}>{anime.rating}</Text></View>
          <Text style={styles.metaText}>1 Season</Text>
        </View>

        {/* Primary Play Button */}
        <TouchableOpacity style={styles.playButton} activeOpacity={0.8}>
          <IconPlay size={22} color="#000" />
          <Text style={styles.playButtonText}>Resume</Text>
        </TouchableOpacity>

        {/* Synopsis */}
        <Text style={styles.synopsisText} numberOfLines={4}>{anime.description}</Text>

        {/* Genre Pills */}
        <View style={styles.genreRow}>
          {anime.genres.map((g, idx) => (
            <React.Fragment key={idx}>
              <Text style={styles.genreText}>{g}</Text>
              {idx < anime.genres.length - 1 && <Text style={styles.genreDot}>•</Text>}
            </React.Fragment>
          ))}
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLibrary} activeOpacity={0.7}>
            {inLibrary ? <IconCheck /> : <IconPlus />}
            <Text style={styles.actionText}>My List</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <IconDownload size={24} color="#FFF" />
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => Share.share({ message: `Watch ${anime.title} on Kameko!` })} activeOpacity={0.7}>
            <IconShare />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Custom Seasons Dropdown Button */}
        <TouchableOpacity style={styles.seasonDropdown} activeOpacity={0.8}>
          <Text style={styles.seasonDropdownText}>{selectedSeason}</Text>
          <IconChevronDown />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* FLOATING TOP NAVIGATION */}
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
  
  // TOP NAV
  topNav: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 90, paddingTop: 40, paddingHorizontal: 15,
    zIndex: 100, flexDirection: 'row', alignItems: 'center'
  },
  navBackBtn: { padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },

  // HERO SECTION
  heroContainer: { width: '100%' },
  backdropWrapper: { width: '100%', height: height * 0.48, position: 'absolute', top: 0, left: 0 },
  backdropImage: { width: '100%', height: '100%', opacity: 0.8 },
  
  heroContent: { 
    paddingTop: height * 0.18, 
    paddingHorizontal: 20, 
    alignItems: 'center' 
  },
  
  coverShadow: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.8, shadowRadius: 15, elevation: 15,
    marginBottom: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  coverImage: { width: 140, height: 210, borderRadius: 10 },

  titleText: { 
    color: '#FFF', fontSize: 32, fontWeight: '900', textAlign: 'center', 
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4, marginBottom: 15 
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  metaScore: { color: '#46D369', fontSize: 13, fontWeight: 'bold' },
  metaText: { color: '#E0E0E0', fontSize: 13, fontWeight: '600' },
  ratingBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  ratingText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },

  playButton: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFF', width: '100%', paddingVertical: 12, borderRadius: 4, marginBottom: 20 
  },
  playButtonText: { color: '#000', fontSize: 16, fontWeight: '900' },

  synopsisText: { color: '#CCCCCC', fontSize: 14, lineHeight: 22, textAlign: 'justify', marginBottom: 15 },
  
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 25 },
  genreText: { color: '#E0E0E0', fontSize: 12, fontWeight: '500' },
  genreDot: { color: '#666', fontSize: 12 },

  actionsRow: { flexDirection: 'row', justifyContent: 'space-evenly', width: '100%', marginBottom: 20 },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionText: { color: '#AAA', fontSize: 12, fontWeight: '600' },

  divider: { width: '100%', height: 1, backgroundColor: '#333', marginBottom: 20 },

  seasonDropdown: { 
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1A1A1A', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 15 
  },
  seasonDropdownText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // EPISODE LIST
  listPadding: { paddingBottom: 50 },
  epCard: { paddingHorizontal: 20, marginBottom: 25 },
  epTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  epImageWrapper: { width: 130, height: 75, borderRadius: 6, overflow: 'hidden', backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  epThumbnail: { width: '100%', height: '100%', position: 'absolute' },
  epPlayOverlay: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  epMeta: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  epTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  epDuration: { color: '#AAAAAA', fontSize: 13 },
  dlBtn: { padding: 10 },
  epDesc: { color: '#AAAAAA', fontSize: 13, lineHeight: 18 }
});
