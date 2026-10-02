import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, Image, StyleSheet, Dimensions, 
  TouchableOpacity, Animated
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import ProxyImage from '../../components/ProxyImage';
import ShareSheet from '../../components/ShareSheet'; // NEW SHARE MODULE

const { width } = Dimensions.get('window');
const HEIGHT = 520;
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const BRAND_RED = '#E50914';

// [SKELETON CODE OMITTED FOR BREVITY - Keep your existing CarouselSkeletonLayout and LogoWithSkeleton]

export default function Carousel({ user }) {
  const navigation = useNavigation();
  const [slides, setSlides] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const [librarySet, setLibrarySet] = useState(new Set());
  
  // Custom Share Sheet State
  const [shareData, setShareData] = useState({ visible: false, title: '', id: '' });

  const fadeAnims = useRef([]).current;
  const scaleAnims = useRef([]).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // 1. Navigation Loading Bar
  useEffect(() => {
    if (isNavigating) {
      progressAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
          Animated.timing(progressAnim, { toValue: 0, duration: 0, useNativeDriver: false }),
        ])
      ).start();
    } else {
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
    }
  }, [isNavigating]);

  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // 2. Fetch Data (Your existing AniList/TMDB logic)
  useEffect(() => {
    // Keep your exact existing fetchCarouselData logic here...
    // ...
  }, []);

  // 3. Auto-Rotation
  useEffect(() => {
    // Keep your exact existing auto-rotate logic here...
    // ...
  }, [currentIndex, slides]);

  const handleNavigateToPlay = (animeData) => {
    setIsNavigating(true); 
    setTimeout(() => {
      navigation.navigate('Play', { 
        anime: {
          id: animeData.id, title: animeData.title, coverImage: animeData.coverImage, backdrop: animeData.backdrop,
          description: animeData.description, genres: animeData.genres, status: animeData.status,
          score: animeData.score || 'N/A', rating: animeData.contentRating
        } 
      });
      setIsNavigating(false); 
    }, 500); 
  };

  const toggleLibrary = async (anime) => {
    if (!user) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(anime.id);
    if (librarySet.has(anime.id)) await ref.delete();
    else await ref.set({ id: anime.id, title: anime.title, img: anime.coverImage || anime.backdrop, addedAt: firestore.FieldValue.serverTimestamp() });
  };

  // Open the custom Share Modal
  const openShareSheet = (anime) => {
    setShareData({ visible: true, title: anime.title, id: anime.id });
  };

  if (loading) {
    return <CarouselSkeletonLayout />;
  }

  if (slides.length === 0) return null;

  return (
    <View style={styles.container}>
      
      {/* Dynamic Red Loading Bar for Navigation */}
      {isNavigating && (
        <View style={styles.progressBarBg}>
          <Animated.View style={[styles.progressBarFill, { width: progressBarWidth }]} />
        </View>
      )}

      {/* CUSTOM SHARE SHEET MODAL */}
      <ShareSheet 
        visible={shareData.visible} 
        animeTitle={shareData.title} 
        animeId={shareData.id}
        onClose={() => setShareData({ ...shareData, visible: false })} 
      />

      <View style={StyleSheet.absoluteFillObject}>
        {slides.map((slide, i) => (
          <Animated.View key={slide.id} style={[styles.slideWrapper, { opacity: fadeAnims[i], zIndex: currentIndex === i ? 2 : 1 }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1A1A' }]} />
            <ProxyImage 
              isAnimated={true}
              source={{ uri: slide.backdrop }} 
              style={[styles.backdrop, { transform: [{ scale: scaleAnims[i] }] }]} 
              resizeMode="cover"
              fadeDuration={0} 
            />
          </Animated.View>
        ))}
      </View>

      <Svg height="100%" width="100%" style={styles.permanentGradient} pointerEvents="none">
        <Defs>
          <LinearGradient id="heroGradient" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#000000" stopOpacity="1" />
            <Stop offset="0.32" stopColor="#000000" stopOpacity="0.9" />
            <Stop offset="0.65" stopColor="#000000" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.08" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#heroGradient)" />
      </Svg>

      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => handleNavigateToPlay(slides[currentIndex])} />

      {slides.map((slide, i) => (
        <Animated.View 
          key={`ui-${slide.id}`} 
          pointerEvents={currentIndex === i ? 'box-none' : 'none'}
          style={[styles.uiContainer, { opacity: fadeAnims[i], zIndex: currentIndex === i ? 10 : 0 }]}
        >
          {/* ... [Keep Title/Meta Code] ... */}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.playButton} activeOpacity={0.8} onPress={() => handleNavigateToPlay(slide)}>
              <Text style={styles.playButtonText}>▶ Play</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.libButton, librarySet.has(slide.id) && styles.libButtonActive]} onPress={() => toggleLibrary(slide)} activeOpacity={0.8}>
              <Text style={[styles.libButtonText, librarySet.has(slide.id) && styles.libTextActive]}>
                {librarySet.has(slide.id) ? '✓ In My List' : '+ My List'}
              </Text>
            </TouchableOpacity>

            {/* TRIGGERS NEW CUSTOM SHARE SHEET */}
            <TouchableOpacity style={styles.iconButton} onPress={() => openShareSheet(slide)} activeOpacity={0.8}>
              <Text style={styles.iconButtonText}>➦</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ))}

      <View style={styles.paginationContainer}>
        {/* ... [Keep Pagination Code] ... */}
      </View>
    </View>
  );
}

// [Keep existing styles]
