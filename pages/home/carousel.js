import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, ActivityIndicator, Share
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');
const HEIGHT = 450; // Hero carousel height
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';

export default function Carousel({ user }) {
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [librarySet, setLibrarySet] = useState(new Set());

  // Animations
  const fadeAnims = useRef([]).current;
  const scaleAnims = useRef([]).current;

  // 1. Live Sync with Firebase Library
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

  // 2. Fetch AniList Trending + TMDB Logos & Backdrops
  useEffect(() => {
    const fetchCarouselData = async () => {
      try {
        const aniQuery = `
          query { 
            Page(page: 1, perPage: 7) { 
              media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { 
                id
                title { romaji english }
                description
                averageScore
                coverImage { extraLarge }
                bannerImage
              } 
            } 
          }
        `;

        const aniRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: aniQuery })
        });
        const aniData = await aniRes.json();
        const aniListMedia = aniData?.data?.Page?.media || [];

        const enrichedSlides = await Promise.all(aniListMedia.map(async (anime) => {
          const title = anime.title.english || anime.title.romaji;
          let backdrop = anime.bannerImage || anime.coverImage?.extraLarge;
          let logo = null;

          // TMDB Lookup for Art & Backdrop
          try {
            const tmdbSearch = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
            const tmdbData = await tmdbSearch.json();
            const tmdbMatch = tmdbData.results?.[0];

            if (tmdbMatch) {
              backdrop = tmdbMatch.backdrop_path 
                ? `https://image.tmdb.org/t/p/original${tmdbMatch.backdrop_path}` 
                : backdrop;
              
              const imagesRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbMatch.id}/images?api_key=${TMDB_API_KEY}`);
              const imagesData = await imagesRes.json();
              const engLogo = imagesData.logos?.find(l => l.iso_639_1 === 'en' || l.iso_639_1 === 'ja');
              
              if (engLogo) {
                logo = `https://image.tmdb.org/t/p/w500${engLogo.file_path}`;
              }
            }
          } catch (e) {
            console.log('TMDB Fetch Error for', title);
          }

          return {
            id: String(anime.id),
            title,
            description: anime.description?.replace(/<[^>]*>?/gm, '').trim() || 'No description available.',
            score: anime.averageScore,
            backdrop,
            logo
          };
        }));

        // Initialize animations for each slide
        enrichedSlides.forEach((_, i) => {
          fadeAnims[i] = new Animated.Value(i === 0 ? 1 : 0);
          scaleAnims[i] = new Animated.Value(i === 0 ? 1.05 : 1);
        });

        setSlides(enrichedSlides);
        setLoading(false);
      } catch (err) {
        console.error('Carousel Fetch Error:', err);
        setLoading(false);
      }
    };

    fetchCarouselData();
  }, []);

  // 3. Auto-Rotate Logic & Transitions
  useEffect(() => {
    if (slides.length === 0) return;

    const interval = setInterval(() => {
      let nextIndex = (currentIndex + 1) % slides.length;
      transitionSlide(currentIndex, nextIndex);
      setCurrentIndex(nextIndex);
    }, 6000);

    return () => clearInterval(interval);
  }, [currentIndex, slides]);

  const transitionSlide = (oldIdx, newIdx) => {
    scaleAnims[newIdx].setValue(1); // Reset zoom
    
    Animated.parallel([
      Animated.timing(fadeAnims[oldIdx], { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.timing(fadeAnims[newIdx], { toValue: 1, duration: 800, useNativeDriver: true }),
      // Ken Burns zoom effect
      Animated.timing(scaleAnims[newIdx], { toValue: 1.05, duration: 6000, useNativeDriver: true })
    ]).start();
  };

  const handleManualDotPress = (idx) => {
    if (idx === currentIndex) return;
    transitionSlide(currentIndex, idx);
    setCurrentIndex(idx);
  };

  // 4. Firebase Library Toggle Action
  const toggleLibrary = async (anime) => {
    if (!user) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(anime.id);
    
    if (librarySet.has(anime.id)) {
      await ref.delete();
    } else {
      await ref.set({
        title: anime.title,
        img: anime.backdrop,
        addedAt: firestore.FieldValue.serverTimestamp()
      });
    }
  };

  const handleShare = async (title) => {
    try {
      await Share.share({ message: `Check out ${title} on Kameko!` });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#E50914" />
      </View>
    );
  }

  if (slides.length === 0) return null;

  return (
    <View style={styles.container}>
      {slides.map((slide, i) => (
        <Animated.View 
          key={slide.id} 
          style={[styles.slideWrapper, { opacity: fadeAnims[i], zIndex: currentIndex === i ? 2 : 1 }]}
        >
          {/* Animated Background Image */}
          <Animated.Image 
            source={{ uri: slide.backdrop }} 
            style={[styles.backdrop, { transform: [{ scale: scaleAnims[i] }] }]} 
            resizeMode="cover"
          />

          {/* Pure Black to Transparent SVG Gradient */}
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="grad" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity="1" />
                <Stop offset="0.4" stopColor="#000000" stopOpacity="0.8" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#grad)" />
          </Svg>

          {/* UI Content Layer */}
          <View style={styles.uiContainer}>
            <View style={styles.badgeRow}>
              <Text style={styles.trendingBadge}>#{i + 1} TRENDING</Text>
              {slide.score && <Text style={styles.scoreBadge}>★ {slide.score}%</Text>}
            </View>

            {/* TMDB Title Art (Logo) with Soft Shadow */}
            {slide.logo ? (
              <View style={styles.logoShadowWrapper}>
                <Image source={{ uri: slide.logo }} style={styles.titleLogo} resizeMode="contain" />
              </View>
            ) : (
              <Text style={styles.titleText}>{slide.title}</Text>
            )}

            <Text style={styles.descriptionText} numberOfLines={3}>{slide.description}</Text>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.playButton}>
                <Text style={styles.playButtonText}>▶ Watch</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.libButton, librarySet.has(slide.id) && styles.libButtonActive]}
                onPress={() => toggleLibrary(slide)}
              >
                <Text style={[styles.libButtonText, librarySet.has(slide.id) && styles.libTextActive]}>
                  {librarySet.has(slide.id) ? '✓ Added' : '+ Library'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shareIcon} onPress={() => handleShare(slide.title)}>
                <Text style={styles.shareIconText}>➦</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      ))}

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {slides.map((_, i) => (
          <TouchableOpacity 
            key={i} 
            onPress={() => handleManualDotPress(i)}
            style={[styles.dot, currentIndex === i && styles.dotActive]} 
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width, height: HEIGHT, backgroundColor: '#000000', overflow: 'hidden' },
  loaderContainer: { width, height: HEIGHT, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  slideWrapper: { ...StyleSheet.absoluteFillObject },
  backdrop: { width: '100%', height: '100%' },
  uiContainer: { position: 'absolute', bottom: 35, left: 20, right: 20, zIndex: 10 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  trendingBadge: { color: '#F47521', fontSize: 10, fontWeight: '900', letterSpacing: 2, backgroundColor: 'rgba(244,117,33,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(244,117,33,0.3)' },
  scoreBadge: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginLeft: 10 },
  
  // Title Art (Logo) Styles
  logoShadowWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8, // For Android shadow
    marginBottom: 12,
  },
  titleLogo: { width: 220, height: 80, alignSelf: 'flex-start' },
  titleText: { color: '#ffffff', fontSize: 32, fontWeight: '900', marginBottom: 10, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  
  descriptionText: { color: '#cccccc', fontSize: 12, lineHeight: 18, marginBottom: 20, width: '90%', fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playButton: { backgroundColor: '#F47521', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 6, shadowColor: '#F47521', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  playButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  libButton: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  libButtonActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  libButtonText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  libTextActive: { color: '#000000' },
  shareIcon: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  shareIconText: { color: '#fff', fontSize: 16 },
  
  paginationContainer: { position: 'absolute', right: 20, top: '50%', transform: [{ translateY: -50 }], alignItems: 'center', gap: 8, zIndex: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { height: 24, backgroundColor: '#F47521' }
});
