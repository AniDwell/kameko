import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Keyboard,
  BackHandler
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import ProxyImage from './ProxyImage';

const { width } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';
const COLUMN_COUNT = 3;
const CARD_WIDTH = (width - 40 - (COLUMN_COUNT - 1) * 10) / COLUMN_COUNT;

// --- SVG ICONS ---
const IconSearch = ({ size = 20, color = '#888888' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="11" cy="11" r="8" />
    <Path d="M21 21l-4.35-4.35" />
  </Svg>
);

const IconBack = ({ size = 22, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);

const IconClose = ({ size = 18, color = '#888888' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);

export default function Search({ user, onBack, onSelectAnime }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [popularList, setPopularList] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef(null);

  // 1. Android Hardware Back Button Hook
  useEffect(() => {
    const handleBackPress = () => {
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [onBack]);

  // 2. Load Initial Top Trending / Popular Recommendations
  useEffect(() => {
    let isMounted = true;
    const fetchDefaultSuggestions = async () => {
      try {
        const aniQuery = `
          query { 
            Page(page: 1, perPage: 18) { 
              media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { 
                id 
                title { romaji english } 
                coverImage { extraLarge large } 
                bannerImage
                description
                genres
                averageScore
                status
              } 
            } 
          }
        `;
        const res = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: aniQuery })
        });
        const json = await res.json();
        const media = json?.data?.Page?.media || [];

        if (isMounted) {
          const formatted = media.map((item) => ({
            id: String(item.id),
            title: item.title?.english || item.title?.romaji || 'Untitled',
            image: item.coverImage?.extraLarge || item.coverImage?.large,
            backdrop: item.bannerImage || item.coverImage?.extraLarge,
            description: item.description?.replace(/<[^>]*>?/gm, '') || '',
            genres: item.genres || ['Anime'],
            score: item.averageScore || 'N/A',
            status: item.status || 'RELEASING'
          }));
          setPopularList(formatted);
        }
      } catch (err) {
        console.error('Failed to load search recommendations:', err);
      }
    };

    fetchDefaultSuggestions();
    return () => { isMounted = false; };
  }, []);

  // 3. Debounced Live API Search Execution
  const executeSearch = useCallback(async (searchTerm) => {
    const trimmed = searchTerm.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${VERCEL_API_BASE}/api/search?keyword=${encodeURIComponent(trimmed)}`);
      if (!response.ok) throw new Error('Search network failure');
      
      const json = await response.json();
      const rawData = json?.data || json?.results || json || [];
      const parsedResults = Array.isArray(rawData) ? rawData : [];

      const formatted = parsedResults.map((item) => ({
        id: String(item.id),
        title: item.title || item.name || 'Unknown Anime',
        image: item.poster || item.image || item.coverImage,
        backdrop: item.backdrop || item.image || item.poster,
        description: item.description || 'No description available.',
        genres: item.genres || ['Anime'],
        score: item.score || item.rating || 'N/A',
        status: item.status || 'RELEASED'
      }));

      setResults(formatted);
    } catch (err) {
      console.error('Vercel search error:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTextChange = (text) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!text.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(() => {
      executeSearch(text);
    }, 400);
  };

  const clearInput = () => {
    setQuery('');
    setResults([]);
    setLoading(false);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    Keyboard.dismiss();
  };

  const handleCardPress = (item) => {
    Keyboard.dismiss();
    if (onSelectAnime) {
      onSelectAnime({
        id: item.id,
        title: item.title,
        coverImage: item.image,
        backdrop: item.backdrop || item.image,
        description: item.description,
        genres: item.genres,
        status: item.status,
        score: item.score,
        rating: 'U/A 16+'
      });
    }
  };

  const isSearching = query.trim().length > 0;
  const currentDataset = isSearching ? results : popularList;

  const renderCard = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => handleCardPress(item)}
    >
      <View style={styles.cardImageWrapper}>
        <ProxyImage
          source={{ uri: item.image }}
          style={styles.cardImage}
          resizeMode="cover"
        />
        {item.score !== 'N/A' && (
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreText}>★ {item.score}%</Text>
          </View>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* TOP SEARCH HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <IconBack />
        </TouchableOpacity>

        <View style={styles.searchBar}>
          <IconSearch />
          <TextInput
            style={styles.input}
            placeholder="Search anime, movies, series..."
            placeholderTextColor="#777777"
            value={query}
            onChangeText={handleTextChange}
            autoFocus={true}
            returnKeyType="search"
            selectionColor={BRAND_RED}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clearInput} style={styles.clearBtn} activeOpacity={0.7}>
              <IconClose />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SECTION TITLE / LOADING */}
      <View style={styles.metaRow}>
        <Text style={styles.sectionHeading}>
          {isSearching ? `Results for "${query}"` : 'Top Searches & Trending'}
        </Text>
        {loading && <ActivityIndicator size="small" color={BRAND_RED} />}
      </View>

      {/* SEARCH GRID RESULTS */}
      <FlatList
        data={currentDataset}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        numColumns={COLUMN_COUNT}
        renderItem={renderCard}
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading && isSearching ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Results Found</Text>
              <Text style={styles.emptySubtitle}>Try searching for a different title or romanized name.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 45
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12
  },
  backBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#262626'
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    paddingHorizontal: 10
  },
  clearBtn: {
    padding: 4
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12
  },
  sectionHeading: {
    color: '#AAAAAA',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  gridContainer: {
    paddingHorizontal: 20,
    paddingBottom: 85
  },
  columnWrapper: {
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 16
  },
  card: {
    width: CARD_WIDTH
  },
  cardImageWrapper: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  cardImage: {
    width: '100%',
    height: '100%'
  },
  scoreBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4
  },
  scoreText: {
    color: '#46D369',
    fontSize: 9,
    fontWeight: '800'
  },
  cardTitle: {
    color: '#D4D4D4',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6
  },
  emptySubtitle: {
    color: '#777777',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  }
});
