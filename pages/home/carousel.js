import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, ActivityIndicator, Share
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');
const HEIGHT = 520; // Expanded height for rich hero layout
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const BRAND_RED = '#E50914';

export default function Carousel({ user }) {
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [librarySet, setLibrarySet] = useState(new Set());

  // Animation values
  const fadeAnims = useRef([]).current;
  const scaleAnims = useRef([]).current;

  // 1. Live Sync with Firestore User Library
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

  // 2. Fetch AniList Trending + TMDB Logos, Ratings & Backdrops
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
                genres
                format
                episodes
                coverImage { extraLarge large }
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
          let contentRating = 'U/A 13+'; // Default anime age rating

          // TMDB Lookup for Official Text Art / Logo and Age Rating
          try {
            const tmdbSearch = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`);
            const tmdbData = await tmdbSearch.json();
            const tmdbMatch = tmdbData.results?.[0];

            if (tmdbMatch) {
              if (tmdbMatch.backdrop_path) {
                backdrop = `https://image.tmdb.org/t/p/original${tmdbMatch.backdrop_path}`;
              }

              // Fetch Logos and Content Ratings concurrently
              const [imagesRes, contentRes] = await Promise.all([
                fetch(`https://api.themoviedb.org/3/tv/${tmdbMatch.id}/images?api_key=${TMDB_API_KEY}`),
                fetch(`https://api.themoviedb.org/3/tv/${tmdbMatch.id}/content_ratings?api_key=${TMDB_API_KEY}`)
              ]);

              const imagesData = await imagesRes.json();
              const contentData = await contentRes.json();

              // Select crisp English/transparent logo
              const engLogo = imagesData.logos?.find(l => l.iso_639_1 === 'en' || l.iso_639_1 === 'ja');
              if (engLogo) {
                logo = `https://image.tmdb.org/t/p/w500${engLogo.file_path}`;
              }

              // Find localized certification
              const inRating = contentData.results?.find(r => r.iso_3166_1 === 'IN' || r.iso_3166_1 === 'US');
              if (inRating?.rating) {
                contentRating = inRating.rating.toUpperCase();
              }
            }
          } catch (e) {
            console.log('TMDB Enrichment error for:', title);
          }

          return {
            id: String(anime.id),
            title,
            description: anime.description?.replace(/<[^>]*>?/gm, '').trim() || 'No synopsis available.',
            score: anime.averageScore,
            genres: anime.genres?.slice(0, 3) || ['Action', 'Anime'],
            format: anime.format || 'TV',
            episodes: anime.episodes,
            coverImage: anime.coverImage?.extraLarge || anime.coverImage?.large,
            backdrop,
            logo,
            contentRating
          };
        }));

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

  // 3. Smooth Auto-Rotation
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
    scaleAnims[newIdx].setValue(1);
    Animated.parallel([
      Animated.timing(fadeAnims[oldIdx], { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.timing(fadeAnims[newIdx], { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(scaleAnims[newIdx], { toValue: 1.05, duration: 6000, useNativeDriver: true })
    ]).start();
  };

  const handleManualDotPress = (idx) => {
    if (idx === currentIndex) return;
    transitionSlide(currentIndex, idx);
    setCurrentIndex(idx);
  };

  // 4. Firestore Library Toggle
  const toggleLibrary = async (anime) => {
    if (!user) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(anime.id);
    
    if (librarySet.has(anime.id)) {
      await ref.delete();
    } else {
      await ref.set({
        id: anime.id,
        title: anime.title,
        img: anime.coverImage || anime.backdrop,
        addedAt: firestore.FieldValue.serverTimestamp()
      });
    }
  };

  const handleShare = async (title) => {
    try {
      await Share.share({ message: `Watch ${title} on Kameko!` });
    } catch (e) {
      console.log('Error sharing:', e);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={BRAND_RED} />
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
          {/* Backdrop with Ken Burns Zoom */}
          <Animated.Image 
            source={{ uri: slide.backdrop }} 
            style={[styles.backdrop, { transform: [{ scale: scaleAnims[i] }] }]} 
            resizeMode="cover"
          />

          {/* Consistent Dark Multi-Stop Gradient (Zero White Seams) */}
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <LinearGradient id="heroGradient" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#000000" stopOpacity="1" />
                <Stop offset="0.35" stopColor="#000000" stopOpacity="0.9" />
                <Stop offset="0.65" stopColor="#000000" stopOpacity="0.5" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.1" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#heroGradient)" />
          </Svg>

          {/* UI CONTENT LAYER */}
          <View style={styles.uiContainer}>
            
            {/* Top Row: Title Art Logo & Anime Cover Thumbnail */}
            <View style={styles.titleAndCoverRow}>
              <View style={styles.logoAndTextColumn}>
                {slide.logo ? (
                  <View style={styles.logoShadowWrapper}>
                    <Image source={{ uri: slide.logo }} style={styles.titleLogo} resizeMode="contain" />
                  </View>
                ) : (
                  <Text style={styles.titleText}>{slide.title}</Text>
                )}

                {/* Badges placed BELOW the Title Art */}
                <View style={styles.metaRow}>
                  <View style={styles.trendingBadge}>
                    <Text style={styles.trendingBadgeText}>TOP #{i + 1}</Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>{slide.contentRating}</Text>
                  </View>
                  {slide.score && (
                    <Text style={styles.scoreText}>★ {slide.score}%</Text>
                  )}
                  {slide.episodes ? (
                    <Text style={styles.metaText}>{slide.episodes} EPS</Text>
                  ) : null}
                </View>

                {/* Genre Pills */}
                <View style={styles.genreRow}>
                  {slide.genres.map((g, idx) => (
                    <View key={idx} style={styles.genrePill}>
                      <Text style={styles.genreText}>{g}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Anime Cover Art Thumbnail */}
              <View style={styles.coverWrapper}>
                <Image source={{ uri: slide.coverImage }} style={styles.coverThumbnail} resizeMode="cover" />
              </View>
            </View>

            {/* Synopsis */}
            <Text style={styles.descriptionText} numberOfLines={3}>
              {slide.description}
            </Text>

            {/* Action Buttons in Kameko Red Theme */}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.playButton} activeOpacity={0.8}>
                <Text style={styles.playButtonText}>▶ Play</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.libButton, librarySet.has(slide.id) && styles.libButtonActive]}
                onPress={() => toggleLibrary(slide)}
                activeOpacity={0.8}
              >
                <Text style={[styles.libButtonText, librarySet.has(slide.id) && styles.libTextActive]}>
                  {librarySet.has(slide.id) ? '✓ In My List' : '+ My List'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.iconButton} onPress={() => handleShare(slide.title)} activeOpacity={0.8}>
                <Text style={styles.iconButtonText}>➦</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      ))}

      {/* Vertical Navigation Bar Indicators */}
      <View style={styles.paginationContainer}>
        {slides.map((_, i) => (
          <TouchableOpacity 
            key={i} 
            onPress={() => handleManualDotPress(i)}
            style={[styles.dot, currentIndex === i && styles.dotActive]} 
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width, height: HEIGHT, backgroundColor: '#000000', overflow: 'hidden' },
  loaderContainer: { width, height: HEIGHT, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  slideWrapper: { ...StyleSheet.absoluteFillObject },
  backdrop: { width: '100%', height: '100%' },
  
  uiContainer: { 
    position: 'absolute', 
    bottom: 25, 
    left: 18, 
    right: 25, 
    zIndex: 10 
  },
  
  titleAndCoverRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    marginBottom: 12 
  },
  logoAndTextColumn: { 
    flex: 1, 
    marginRight: 15 
  },
  
  // TMDB Title Art Logo with Soft Drop Shadow
  logoShadowWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 10,
    marginBottom: 10,
  },
  titleLogo: { 
    width: 210, 
    height: 75, 
    alignSelf: 'flex-start' 
  },
  titleText: { 
    color: '#ffffff', 
    fontSize: 28, 
    fontWeight: '900', 
    marginBottom: 8, 
    textShadowColor: 'rgba(0,0,0,0.9)', 
    textShadowOffset: { width: 0, height: 2 }, 
    textShadowRadius: 6 
  },

  // Cover Thumbnail Art
  coverWrapper: {
    width: 72,
    height: 104,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
    marginBottom: 6
  },
  coverThumbnail: { 
    width: '100%', 
    height: '100%' 
  },

  // Badges below the title art
  metaRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 8 
  },
  trendingBadge: { 
    backgroundColor: BRAND_RED, 
    paddingHorizontal: 7, 
    paddingVertical: 2.5, 
    borderRadius: 4 
  },
  trendingBadgeText: { 
    color: '#FFFFFF', 
    fontSize: 10, 
    fontWeight: '900', 
    letterSpacing: 1 
  },
  ratingBadge: { 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.4)', 
    paddingHorizontal: 6, 
    paddingVertical: 1.5, 
    borderRadius: 4, 
    backgroundColor: 'rgba(0,0,0,0.4)' 
  },
  ratingText: { 
    color: '#E0E0E0', 
    fontSize: 10, 
    fontWeight: '700' 
  },
  scoreText: { 
    color: '#46D369', 
    fontSize: 11, 
    fontWeight: '800' 
  },
  metaText: { 
    color: '#AAAAAA', 
    fontSize: 11, 
    fontWeight: '600' 
  },

  // Genres
  genreRow: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 6, 
    marginBottom: 10 
  },
  genrePill: { 
    backgroundColor: 'rgba(255,255,255,0.1)', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 12, 
    borderWidth: 0.5, 
    borderColor: 'rgba(255,255,255,0.2)' 
  },
  genreText: { 
    color: '#CCCCCC', 
    fontSize: 10, 
    fontWeight: '600' 
  },

  descriptionText: { 
    color: '#CCCCCC', 
    fontSize: 12, 
    lineHeight: 17, 
    marginBottom: 18, 
    fontWeight: '500', 
    textShadowColor: 'rgba(0,0,0,0.9)', 
    textShadowOffset: { width: 0, height: 1 }, 
    textShadowRadius: 3 
  },

  // Red theme buttons
  buttonRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  playButton: { 
    backgroundColor: BRAND_RED, 
    paddingVertical: 10, 
    paddingHorizontal: 26, 
    borderRadius: 6, 
    shadowColor: BRAND_RED, 
    shadowOpacity: 0.45, 
    shadowRadius: 10, 
    shadowOffset: { width: 0, height: 2 } 
  },
  playButtonText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '900', 
    letterSpacing: 0.5 
  },
  libButton: { 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.25)' 
  },
  libButtonActive: { 
    backgroundColor: '#FFFFFF', 
    borderColor: '#FFFFFF' 
  },
  libButtonText: { 
    color: '#FFFFFF', 
    fontSize: 13, 
    fontWeight: 'bold', 
    letterSpacing: 0.5 
  },
  libTextActive: { 
    color: '#000000' 
  },
  iconButton: { 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    padding: 10, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.25)' 
  },
  iconButtonText: { 
    color: '#ffffff', 
    fontSize: 16 
  },

  // Indicators
  paginationContainer: { 
    position: 'absolute', 
    right: 14, 
    top: '45%', 
    transform: [{ translateY: -40 }], 
    alignItems: 'center', 
    gap: 8, 
    zIndex: 20 
  },
  dot: { 
    width: 4, 
    height: 4, 
    borderRadius: 2, 
    backgroundColor: 'rgba(255,255,255,0.3)' 
  },
  dotActive: { 
    height: 20, 
    backgroundColor: BRAND_RED 
  }
});
