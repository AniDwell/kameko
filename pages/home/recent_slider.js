import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, FlatList, 
  TouchableOpacity, Animated 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path } from 'react-native-svg';
import ProxyImage from '../../components/ProxyImage';

const BRAND_RED = '#E50914';

const BookmarkIcon = ({ filled }) => (
  <Svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? BRAND_RED : "none"} stroke={filled ? BRAND_RED : "#FFFFFF"} strokeWidth="2.5">
    <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </Svg>
);

const RecentSkeleton = () => {
  const shimmer = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 800, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headerRow}><Text style={styles.sectionTitle}>Newest Releases</Text></View>
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, gap: 15 }}>
        {[1, 2, 3, 4].map((_, i) => (
          <Animated.View key={i} style={[styles.skeletonCard, { opacity: shimmer }]} />
        ))}
      </View>
    </View>
  );
};

export default function RecentSlider({ user, onSelectAnime }) {
  const [animeList, setAnimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [librarySet, setLibrarySet] = useState(new Set());

  useEffect(() => {
    if (!user) return;
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('library')
      .onSnapshot((snap) => {
        const currentLib = new Set();
        snap.forEach((doc) => currentLib.add(doc.id));
        setLibrarySet(currentLib);
      });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const fetchRecentReleases = async () => {
      try {
        const baseUrl = 'https://anikoto-api-lyart.vercel.app';
        const rawRes = await fetch(`${baseUrl}/api/latest-episodes`);
        const response = await rawRes.json();
        
        const recentEpisodes = response.data || response.results || [];
        const topRecent = recentEpisodes.slice(0, 20);

        const enrichedAnime = await Promise.all(topRecent.map(async (slide) => {
          const cleanTitle = (slide.title || '').replace(/\(Dub\)|\(Sub\)|Episode \d+/gi, '').trim();
          let finalImage = slide.image || slide.poster;
          let finalStatus = 'RELEASING';
          let streamId = String(slide.id);

          try {
            const vercelRes = await fetch(`${baseUrl}/api/search?keyword=${encodeURIComponent(cleanTitle)}`);
            if (!vercelRes.ok) return null;
            const vercelData = await vercelRes.json();
            const apiResults = vercelData.data || vercelData.results || vercelData || [];
            
            const exactMatch = apiResults.find(r => (r.title || '').toLowerCase() === cleanTitle.toLowerCase()) || apiResults[0];
            if (!exactMatch) return null;
            
            streamId = exactMatch.id;

            const query = `query ($search: String) { 
              Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { 
                coverImage { extraLarge } 
                status
              } 
            }`;
            const aniRes = await fetch('https://graphql.anilist.co', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query, variables: { search: cleanTitle } })
            });
            const aniData = await aniRes.json();
            
            if (aniData?.data?.Media) {
              if (aniData.data.Media.coverImage?.extraLarge) finalImage = aniData.data.Media.coverImage.extraLarge;
              if (aniData.data.Media.status) finalStatus = aniData.data.Media.status;
            }
          } catch(e) {
            return null;
          }

          return {
            id: streamId,
            title: cleanTitle,
            image: finalImage,
            episode: slide.episodeNumber || slide.episode || null,
            sub: slide.tvInfo?.sub || slide.sub || '?',
            dub: slide.tvInfo?.dub || slide.dub || 0,
            status: finalStatus
          };
        }));

        setAnimeList(enrichedAnime.filter(item => item !== null));
      } catch (error) {
        console.error("Recent Slider fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentReleases();
  }, []);

  const handleNavigateToPlay = (anime) => {
    if (onSelectAnime) {
      onSelectAnime({ 
        id: anime.id,
        title: anime.title,
        coverImage: anime.image,
        backdrop: anime.image,
        description: "Latest episode released.",
        genres: ['Anime'],
        status: anime.status,
        score: 'N/A',
        rating: 'U/A 13+'
      });
    }
  };

  const toggleLibrary = async (anime) => {
    if (!user) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(anime.id);
    if (librarySet.has(anime.id)) await ref.delete();
    else await ref.set({ id: anime.id, title: anime.title, img: anime.image, addedAt: firestore.FieldValue.serverTimestamp() });
  };

  if (loading) return <RecentSkeleton />;
  if (animeList.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headerRow}><Text style={styles.sectionTitle}>Newest Releases</Text></View>
      <FlatList
        data={animeList}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        snapToInterval={155} 
        decelerationRate="fast"
        renderItem={({ item }) => {
          const isAdded = librarySet.has(item.id);
          return (
            <TouchableOpacity style={styles.cardContainer} activeOpacity={0.85} onPress={() => handleNavigateToPlay(item)}>
              <View style={styles.imageWrapper}>
                <ProxyImage source={{ uri: item.image }} style={styles.coverImage} resizeMode="cover" />
                
                <View style={styles.badgeContainer}>
                  {item.episode && <View style={styles.epBadge}><Text style={styles.epBadgeText}>EP {item.episode}</Text></View>}
                  <View style={styles.ccBadge}><Text style={styles.ccBadgeText}>CC {item.sub}</Text></View>
                </View>

                <TouchableOpacity 
                  style={[styles.saveBtn, isAdded && styles.saveBtnActive]}
                  onPress={() => toggleLibrary(item)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <BookmarkIcon filled={isAdded} />
                </TouchableOpacity>
              </View>
              <Text style={styles.animeTitle} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 15, marginBottom: 25 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', borderLeftWidth: 3, borderLeftColor: BRAND_RED, paddingLeft: 8 },
  listPadding: { paddingHorizontal: 20 },
  cardContainer: { width: 140, marginRight: 15 },
  imageWrapper: { width: 140, height: 210, borderRadius: 8, overflow: 'hidden', backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  coverImage: { width: '100%', height: '100%' },
  badgeContainer: { position: 'absolute', top: 8, left: 8, alignItems: 'flex-start', gap: 4 },
  epBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3 },
  epBadgeText: { color: '#000000', fontSize: 10, fontWeight: '900' },
  ccBadge: { backgroundColor: 'rgba(229,9,20,0.9)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  ccBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  saveBtn: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.65)', width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  saveBtnActive: { backgroundColor: 'rgba(0,0,0,0.85)', borderColor: BRAND_RED },
  animeTitle: { color: '#E0E0E0', fontSize: 13, fontWeight: '700', marginTop: 8 },
  skeletonCard: { width: 140, height: 210, backgroundColor: '#2A2A2A', borderRadius: 8 }
});
