import React, { useState, useEffect } from 'react';
import { 
  View, Text, Image, StyleSheet, FlatList, 
  TouchableOpacity, ActivityIndicator 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

const BRAND_RED = '#E50914';

export default function TrendingSlider({ user }) {
  const [trendingList, setTrendingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [librarySet, setLibrarySet] = useState(new Set());

  // 1. Live Sync with Firestore Library
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

  // 2. Fetch Trending Anime directly from AniList
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const query = `
          query { 
            Page(page: 1, perPage: 15) { 
              media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { 
                id
                title { romaji english }
                coverImage { extraLarge }
                episodes
                status
                format
              } 
            } 
          }
        `;

        const response = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        
        const json = await response.json();
        const media = json?.data?.Page?.media || [];

        const formattedAnime = media.map((anime) => ({
          id: String(anime.id),
          title: anime.title.english || anime.title.romaji,
          image: anime.coverImage?.extraLarge,
          episode: anime.episodes || '?',
          status: anime.status,
          format: anime.format
        }));

        setTrendingList(formattedAnime);
      } catch (error) {
        console.error("Trending Slider fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrending();
  }, []);

  // 3. Toggle Library Action
  const toggleLibrary = async (anime) => {
    if (!user) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(anime.id);
    
    if (librarySet.has(anime.id)) {
      await ref.delete();
    } else {
      await ref.set({
        id: anime.id,
        title: anime.title,
        img: anime.image,
        lastKnownEpisode: parseInt(anime.episode) || 0,
        releaseStatus: anime.status,
        addedAt: firestore.FieldValue.serverTimestamp()
      });
    }
  };

  const renderCard = ({ item, index }) => {
    const isAdded = librarySet.has(item.id);

    return (
      <TouchableOpacity 
        style={styles.cardContainer} 
        activeOpacity={0.8}
        onPress={() => console.log('Navigate to info:', item.id)}
      >
        <View style={styles.imageWrapper}>
          <Image source={{ uri: item.image }} style={styles.coverImage} resizeMode="cover" />
          
          {/* Top Left Badges */}
          <View style={styles.badgeContainer}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankBadgeText}>#{index + 1}</Text>
            </View>
            {item.episode !== '?' && (
              <View style={styles.epBadge}>
                <Text style={styles.epBadgeText}>EP {item.episode}</Text>
              </View>
            )}
            <View style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>{item.format === 'TV' ? 'SERIES' : item.format}</Text>
            </View>
          </View>

          {/* Top Right Save Button */}
          <TouchableOpacity 
            style={[styles.saveBtn, isAdded && styles.saveBtnActive]}
            onPress={() => toggleLibrary(item)}
            activeOpacity={0.8}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <Text style={[styles.saveBtnIcon, isAdded && styles.saveIconActive]}>
              {isAdded ? '✓' : '+'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.animeTitle} numberOfLines={1}>{item.title}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={BRAND_RED} />
      </View>
    );
  }

  if (trendingList.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
      </View>

      <FlatList
        data={trendingList}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.listPadding}
        snapToInterval={155} 
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 10, marginBottom: 25 },
  loadingContainer: { height: 200, justifyContent: 'center', alignItems: 'center' },
  
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: 'bold',
    borderLeftWidth: 3,
    borderLeftColor: BRAND_RED,
    paddingLeft: 8
  },
  
  listPadding: { paddingHorizontal: 20 },
  
  cardContainer: { width: 140, marginRight: 15 },
  imageWrapper: { 
    width: 140, 
    height: 210, 
    borderRadius: 8, 
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  coverImage: { width: '100%', height: '100%' },
  
  // Badges
  badgeContainer: { position: 'absolute', top: 8, left: 8, alignItems: 'flex-start', gap: 4 },
  rankBadge: { backgroundColor: BRAND_RED, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, shadowColor: BRAND_RED, shadowOpacity: 0.6, shadowRadius: 4 },
  rankBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  epBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  epBadgeText: { color: '#000000', fontSize: 10, fontWeight: '900' },
  formatBadge: { backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  formatBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },

  // Save Button
  saveBtn: {
    position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)',
    width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)'
  },
  saveBtnActive: { backgroundColor: 'rgba(0,0,0,0.85)' },
  saveBtnIcon: { color: '#FFFFFF', fontSize: 18, fontWeight: '300', marginTop: -2 },
  saveIconActive: { color: BRAND_RED, fontWeight: 'bold' },

  // Title
  animeTitle: { 
    color: '#E0E0E0', fontSize: 13, fontWeight: '700', marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2
  }
});
