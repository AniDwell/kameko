import React, { useState, useEffect } from 'react';
import { 
  View, Text, Image, StyleSheet, FlatList, 
  TouchableOpacity, ActivityIndicator 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

const BRAND_RED = '#E50914';

export default function RecentSlider({ user }) {
  const [animeList, setAnimeList] = useState([]);
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

  // 2. Fetch Latest Episodes & Enrich with AniList
  useEffect(() => {
    const fetchRecentReleases = async () => {
      try {
        const baseUrl = 'https://anikoto-api-lyart.vercel.app';
        const rawRes = await fetch(`${baseUrl}/api/latest-episodes`);
        const response = await rawRes.json();
        
        const recentEpisodes = response.data || response.results || [];
        const topRecent = recentEpisodes.slice(0, 15);

        const enrichedAnime = await Promise.all(topRecent.map(async (slide) => {
          const cleanTitle = (slide.title || '').replace(/\(Dub\)|\(Sub\)|Episode \d+/gi, '').trim();
          let finalImage = slide.image || slide.poster;
          let finalStatus = 'RELEASING';
          
          try {
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
              if (aniData.data.Media.coverImage?.extraLarge) {
                finalImage = aniData.data.Media.coverImage.extraLarge;
              }
              if (aniData.data.Media.status) {
                finalStatus = aniData.data.Media.status;
              }
            }
          } catch(e) {
            console.log("AniList fetch error for:", cleanTitle);
          }

          return {
            id: String(slide.id),
            title: cleanTitle,
            image: finalImage,
            episode: slide.episodeNumber || slide.episode || null,
            sub: slide.tvInfo?.sub || slide.sub || '?',
            dub: slide.tvInfo?.dub || slide.dub || 0,
            status: finalStatus
          };
        }));

        setAnimeList(enrichedAnime);
      } catch (error) {
        console.error("Recent Slider fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentReleases();
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

  const renderCard = ({ item }) => {
    const isAdded = librarySet.has(item.id);

    return (
      <TouchableOpacity 
        style={styles.cardContainer} 
        activeOpacity={0.8}
        onPress={() => console.log('Navigate to info page:', item.id)}
      >
        <View style={styles.imageWrapper}>
          <Image source={{ uri: item.image }} style={styles.coverImage} resizeMode="cover" />
          
          {/* Top Left Badges */}
          <View style={styles.badgeContainer}>
            {item.episode && (
              <View style={styles.epBadge}>
                <Text style={styles.epBadgeText}>EP {item.episode}</Text>
              </View>
            )}
            <View style={styles.ccBadge}>
              <Text style={styles.ccBadgeText}>CC {item.sub}</Text>
            </View>
            {item.dub > 0 && (
              <View style={styles.dubBadge}>
                <Text style={styles.dubBadgeText}>🎤 {item.dub}</Text>
              </View>
            )}
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

  if (animeList.length === 0) return null;

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Newest Releases</Text>
      </View>

      <FlatList
        data={animeList}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.listPadding}
        snapToInterval={155} // Snaps smoothly to card width + margin
        decelerationRate="fast"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionContainer: { marginTop: 15, marginBottom: 25 },
  loadingContainer: { height: 200, justifyContent: 'center', alignItems: 'center' },
  
  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginBottom: 12 
  },
  sectionTitle: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: 'bold',
    borderLeftWidth: 3,
    borderLeftColor: BRAND_RED,
    paddingLeft: 8
  },
  
  listPadding: { paddingHorizontal: 20 },
  
  cardContainer: { 
    width: 140, 
    marginRight: 15 
  },
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
  badgeContainer: { 
    position: 'absolute', 
    top: 8, 
    left: 8, 
    alignItems: 'flex-start',
    gap: 4
  },
  epBadge: { backgroundColor: '#FFFFFF', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 3 },
  epBadgeText: { color: '#000000', fontSize: 10, fontWeight: '900' },
  ccBadge: { backgroundColor: 'rgba(229,9,20,0.9)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  ccBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },
  dubBadge: { backgroundColor: 'rgba(128,0,128,0.9)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  dubBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' },

  // Library Save Button
  saveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  saveBtnActive: { backgroundColor: 'rgba(0,0,0,0.85)' },
  saveBtnIcon: { color: '#FFFFFF', fontSize: 18, fontWeight: '300', marginTop: -2 },
  saveIconActive: { color: BRAND_RED, fontWeight: 'bold' },

  // Title
  animeTitle: { 
    color: '#E0E0E0', 
    fontSize: 13, 
    fontWeight: '700', 
    marginTop: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2
  }
});
