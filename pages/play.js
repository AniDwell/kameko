import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator, Linking, FlatList, Modal
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Polygon } from 'react-native-svg';
import ProxyImage from '../components/ProxyImage';

// Direct import of Player to prevent navigation dependency failures
import Player from './play/player';

const { width, height } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const TMDB_API_KEY = 'f39f02a34ded84924626dd5ec7de1f29';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

// --- SVG Icons ---
const IconPlay = ({ size = 20, color = "#000" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>);
const IconPlus = ({ size = 26, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M12 5v14M5 12h14" /></Svg>);
const IconCheck = ({ size = 26, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><Path d="M20 6L9 17l-5-5" /></Svg>);
const IconShare = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></Svg>);
const IconTrailer = ({ size = 24, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Polygon points="5 3 19 12 5 21 5 3" strokeLinejoin="round"/></Svg>);
const IconChevronDown = ({ size = 18, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M6 9l6 6 6-6" /></Svg>);

export default function Play({ anime, user, onBack, navigation }) {
  const currentAnime = anime || {
    id: 'solo-leveling', title: 'Solo Leveling',
    coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iqITmI6.png',
    backdrop: 'https://image.tmdb.org/t/p/original/vIgyYkXkg6NC2whRbYjBD7eb3Er.jpg',
    description: "In a world of gifted hunters, Sung Jinwoo struggles as the weakest.",
    genres: ['Action', 'Fantasy'], score: 85, rating: 'U/A 16+', status: 'RELEASING'
  };

  const animeDocId = String(currentAnime.id);

  // Core State
  const [activeTab, setActiveTab] = useState('episodes'); 
  const [descExpanded, setDescExpanded] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  
  // Progress State
  const [userProgressMap, setUserProgressMap] = useState({});
  const [latestWatched, setLatestWatched] = useState(null);

  // TMDB & Metadata
  const [tmdbId, setTmdbId] = useState(null);
  const [titleLogo, setTitleLogo] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState(null);
  const [alternates, setAlternates] = useState([]);
  const [isUpcoming, setIsUpcoming] = useState(currentAnime.status?.toUpperCase() === 'UPCOMING');

  // Seasons & Provider Episodes
  const [vercelAnimeId, setVercelAnimeId] = useState(currentAnime.id);
  const [providerEpisodes, setProviderEpisodes] = useState([]); // Raw Vercel Episodes
  const [seasons, setSeasons] = useState([]); // TMDB Seasons array
  const [selectedSeason, setSelectedSeason] = useState(null);
  
  // Displayed Mapped Episodes
  const [displayEpisodes, setDisplayEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [showSeasonModal, setShowSeasonModal] = useState(false);

  // Player State
  const [loadingEpisode, setLoadingEpisode] = useState(null);
  const [activePlayback, setActivePlayback] = useState(null);

  // 1. Firebase Listeners
  useEffect(() => {
    if (!user || !currentAnime?.id) return;
    
    const libRef = firestore().collection('users').doc(user.uid).collection('library').doc(animeDocId);
    const libUnsub = libRef.onSnapshot(doc => setInLibrary(doc?.exists || false), () => {});
    
    const progRef = firestore().collection('users').doc(user.uid).collection('progress').where('animeId', '==', animeDocId);
    const progUnsub = progRef.onSnapshot(snapshot => {
      if (snapshot && !snapshot.empty) {
        const pMap = {};
        let latest = null;
        snapshot.forEach(doc => {
          const data = doc.data();
          pMap[data.slug] = data; // Map progress by API slug
          if (!latest || data.timestamp > latest.timestamp) latest = data;
        });
        setUserProgressMap(pMap);
        setLatestWatched(latest);
      }
    }, () => {});
    
    return () => { libUnsub(); progUnsub(); };
  }, [user, currentAnime?.id]);

  const toggleLibrary = async () => {
    if (!user || !currentAnime?.id) return;
    const ref = firestore().collection('users').doc(user.uid).collection('library').doc(animeDocId);
    if (inLibrary) {
      await ref.delete().catch(() => {});
    } else {
      await ref.set({ id: animeDocId, title: currentAnime.title, img: currentAnime.coverImage || currentAnime.backdrop, addedAt: firestore.FieldValue.serverTimestamp() }).catch(() => {});
    }
  };

  // 2. Fetch TMDB Metadata, Logos, Trailer, and Season Definitions
  useEffect(() => {
    let isMounted = true;
    const loadTMDB = async () => {
      try {
        const cleanTitle = currentAnime.title.replace(/\(Dub\)|\(Sub\)/gi, '').trim();
        const tmdbRes = await fetchWithTimeout(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
        const tmdbJson = await tmdbRes.json();
        const show = tmdbJson?.results?.[0];
        
        if (show && isMounted) {
          setTmdbId(show.id);

          const detailRes = await fetchWithTimeout(`https://api.themoviedb.org/3/tv/${show.id}?api_key=${TMDB_API_KEY}&append_to_response=images,videos`);
          const detailJson = await detailRes.json();

          // Prioritize high-contrast English/Japanese logos
          const logos = detailJson?.images?.logos || [];
          let bestLogo = logos.find(l => l.iso_639_1 === 'en') || logos.find(l => l.iso_639_1 === 'ja') || logos[0];
          if (bestLogo) setTitleLogo(`https://image.tmdb.org/t/p/w500${bestLogo.file_path}`);

          const vids = detailJson?.videos?.results || [];
          const trailer = vids.find(v => v.type === 'Trailer' && v.site === 'YouTube');
          if (trailer) setTrailerUrl(`https://www.youtube.com/watch?v=${trailer.key}`);

          // Extract valid seasons (Ignore Season 0/Specials unless strictly needed)
          if (detailJson?.seasons) {
            const validSeasons = detailJson.seasons.filter(s => s.season_number > 0);
            if (validSeasons.length > 0) {
              setSeasons(validSeasons);
              setSelectedSeason(validSeasons[0]);
            }
          }
        }
      } catch (_) {}
    };

    const loadAnilistAlternates = async () => {
      try {
        const aniQuery = `query ($search: String) { Media (search: $search, type: ANIME) { status relations { edges { relationType node { id title { romaji english } coverImage { extraLarge large } format seasonYear averageScore } } } } }`;
        const aRes = await fetchWithTimeout('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: aniQuery, variables: { search: currentAnime.title } }) });
        const aJson = await aRes.json();
        const media = aJson?.data?.Media;
        
        if (media?.status === 'NOT_YET_RELEASED' && isMounted) setIsUpcoming(true);

        const edges = media?.relations?.edges || [];
        if (isMounted) {
          setAlternates(edges.map((edge) => ({
            id: String(edge.node.id),
            title: edge.node.title?.english || edge.node.title?.romaji || 'Untitled',
            coverImage: edge.node.coverImage?.extraLarge || edge.node.coverImage?.large,
            relationType: edge.relationType || 'RELATED',
            format: edge.node.format || 'TV',
            score: edge.node.averageScore ? `★ ${edge.node.averageScore}%` : 'N/A',
            year: edge.node.seasonYear || 'N/A'
          })));
        }
      } catch (_) {}
    };

    loadTMDB();
    loadAnilistAlternates();
    return () => { isMounted = false; };
  }, [currentAnime.title]);

  // 3. Fetch Provider Data (One-Time Execution per Anime)
  useEffect(() => {
    let isMounted = true;
    const fetchProviderData = async () => {
      if (isUpcoming) return;
      try {
        let targetId = currentAnime.id;
        const searchRes = await fetchWithTimeout(`${VERCEL_API_BASE}/api/search?keyword=${encodeURIComponent(currentAnime.title)}`);
        const searchJson = await searchRes.json();
        const matches = searchJson?.data || [];
        if (matches.length > 0) {
          const exact = matches.find(m => (m.title || '').toLowerCase() === currentAnime.title.toLowerCase()) || matches[0];
          targetId = exact.id;
        }
        if (isMounted) setVercelAnimeId(targetId);

        const res = await fetchWithTimeout(`${VERCEL_API_BASE}/api/episodes/${encodeURIComponent(targetId)}`);
        const json = await res.json();
        const list = json?.data || [];
        
        if (isMounted && Array.isArray(list)) {
          setProviderEpisodes(list);
        }
      } catch (err) {}
    };
    fetchProviderData();
    return () => { isMounted = false; };
  }, [currentAnime.id, currentAnime.title, isUpcoming]);

  // 4. Algorithm: Map TMDB Season Metadata to Provider Episodes
  useEffect(() => {
    let isMounted = true;
    const mapEpisodesToSeason = async () => {
      setEpisodesLoading(true);
      if (isUpcoming || providerEpisodes.length === 0) {
        if (isMounted) setEpisodesLoading(false);
        return;
      }

      // If no TMDB data matched, fallback to raw provider list
      if (!tmdbId || !selectedSeason) {
        const rawMapped = providerEpisodes.map((ep, idx) => ({
          ...ep,
          displayNum: ep.num || (idx + 1),
          displayTitle: ep.title || `Episode ${ep.num}`,
          displayDesc: 'No synopsis available.',
          displayImage: currentAnime.backdrop || currentAnime.coverImage
        }));
        if (isMounted) {
          setDisplayEpisodes(rawMapped);
          setEpisodesLoading(false);
        }
        return;
      }

      // Calculate absolute episode offset for continuous numbering
      let absoluteOffset = 0;
      for (const s of seasons) {
        if (s.season_number < selectedSeason.season_number) {
          absoluteOffset += s.episode_count;
        }
      }

      try {
        // Fetch specific season details from TMDB
        const seasonRes = await fetchWithTimeout(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${selectedSeason.season_number}?api_key=${TMDB_API_KEY}`);
        const seasonJson = await seasonRes.json();
        const tmdbEps = seasonJson?.episodes || [];

        const mappedEpisodes = [];

        // Map each TMDB episode to a provider episode
        tmdbEps.forEach((tmdbEp) => {
          const relativeNum = tmdbEp.episode_number;
          const absoluteNum = absoluteOffset + relativeNum;

          // DUAL-INDEX MATCH: Match continuous APIs (Naruto) or Season-reset APIs (AoT)
          const matchedProviderEp = providerEpisodes.find(e => e.num === absoluteNum) 
                                 || providerEpisodes.find(e => e.num === relativeNum);

          if (matchedProviderEp) {
            mappedEpisodes.push({
              // Preserve exact provider stream identifiers
              id: matchedProviderEp.id,
              slug: matchedProviderEp.slug || matchedProviderEp.id || absoluteNum,
              providerNum: matchedProviderEp.num,
              isFiller: matchedProviderEp.isFiller || false,
              isSub: matchedProviderEp.isSub || true,
              isDub: matchedProviderEp.isDub || false,
              
              // Map rich TMDB display data
              displayNum: relativeNum,
              displayTitle: tmdbEp.name || `Episode ${relativeNum}`,
              displayDesc: tmdbEp.overview || 'No synopsis available.',
              displayImage: tmdbEp.still_path ? `https://image.tmdb.org/t/p/w500${tmdbEp.still_path}` : (currentAnime.backdrop || currentAnime.coverImage),
              duration: tmdbEp.runtime ? `${tmdbEp.runtime}m` : '24m'
            });
          }
        });

        if (isMounted) {
          // If mapping resulted in empty list, fallback to raw list for safety
          setDisplayEpisodes(mappedEpisodes.length > 0 ? mappedEpisodes : providerEpisodes.map(ep => ({
            ...ep, displayNum: ep.num, displayTitle: `Episode ${ep.num}`, displayImage: currentAnime.backdrop, displayDesc: ''
          })));
        }
      } catch (err) {
        // Fallback
      } finally {
        if (isMounted) setEpisodesLoading(false);
      }
    };

    mapEpisodesToSeason();
    return () => { isMounted = false; };
  }, [providerEpisodes, selectedSeason, tmdbId, seasons]);


  // 5. Playback Handlers
  const handlePlayEpisode = async (episodeItem) => {
    try {
      setLoadingEpisode(episodeItem.providerNum);
      const safeId = encodeURIComponent(vercelAnimeId || currentAnime.id);
      
      // Use the verified provider slug/number
      const safeEp = encodeURIComponent(String(episodeItem.slug || episodeItem.providerNum));

      const streamUrl = `${VERCEL_API_BASE}/api/stream?id=${safeId}&ep=${safeEp}&server=hd-1&type=sub`;
      const res = await fetchWithTimeout(streamUrl, {}, 10000);
      const json = await res.json();

      let streamManifest = json?.data || json?.results;

      if (!streamManifest?.m3u8 && !streamManifest?.streamingLink) {
        alert('Streaming source not found.');
        return;
      }

      const playbackPayload = {
        streamUrl: streamManifest.m3u8 || streamManifest.streamingLink,
        referer: streamManifest.referer || "https://vidwish.live/",
        subtitles: streamManifest.subtitles || [],
        animeTitle: currentAnime.title,
        episodeNum: episodeItem.displayNum || episodeItem.providerNum,
        episodeTitle: episodeItem.displayTitle,
        animeId: animeDocId,
        slug: episodeItem.slug,
        userUid: user?.uid,
        targetType: 'sub'
      };

      if (navigation?.navigate) navigation.navigate('Player', playbackPayload);
      else setActivePlayback(playbackPayload);

    } catch (e) {
      alert(`Failed to play: ${e.message}`);
    } finally {
      setLoadingEpisode(null);
    }
  };

  const handleTrailer = () => {
    if (trailerUrl) Linking.openURL(trailerUrl);
  };

  // Resolve target episode for main "Play/Resume" button
  const mainPlayTarget = () => {
    if (displayEpisodes.length === 0) return null;
    if (latestWatched && displayEpisodes.find(e => e.slug === latestWatched.slug)) {
      return displayEpisodes.find(e => e.slug === latestWatched.slug);
    }
    return displayEpisodes[0];
  };

  const targetEp = mainPlayTarget();
  let resumePct = 0;
  if (targetEp && latestWatched && latestWatched.duration > 0 && latestWatched.slug === targetEp.slug) {
    resumePct = Math.min((latestWatched.progress / latestWatched.duration) * 100, 100);
  }

  // --- RENDERS ---
  const renderHeader = () => (
    <View style={styles.heroContainer}>
      <View style={styles.backdropWrapper}>
        <ProxyImage source={{ uri: currentAnime.backdrop || currentAnime.coverImage }} style={styles.backdropImage} resizeMode="cover" />
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="heroGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0.1" />
              <Stop offset="0.6" stopColor="#000000" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#000000" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#heroGradient)" />
        </Svg>
      </View>

      <View style={styles.heroContent}>
        <View style={styles.logoContainer}>
          {titleLogo ? (
            <ProxyImage source={{ uri: titleLogo }} style={styles.titleLogo} resizeMode="contain" />
          ) : (
            <Text style={styles.titleText}>{currentAnime.title}</Text>
          )}
        </View>

        <View style={styles.inlineMetaRow}>
          <Text style={styles.metaScore}>{currentAnime.score ? `${currentAnime.score}% Match` : 'New'}</Text>
          <Text style={styles.metaYear}>{new Date().getFullYear()}</Text>
          <View style={styles.ratingBadge}><Text style={styles.ratingText}>{currentAnime.rating || 'U/A 16+'}</Text></View>
          <Text style={styles.metaHD}>HD</Text>
        </View>

        <View style={styles.mainActionsContainer}>
          <TouchableOpacity 
            style={[styles.netflixPlayBtn, (displayEpisodes.length === 0 || isUpcoming) && { opacity: 0.5 }]} 
            activeOpacity={0.8}
            onPress={() => targetEp && handlePlayEpisode(targetEp)}
            disabled={displayEpisodes.length === 0 || isUpcoming}
          >
            <IconPlay size={24} color="#000" />
            <Text style={styles.netflixPlayText}>
              {isUpcoming ? 'Coming Soon' : (resumePct > 0 ? `Resume Ep ${targetEp?.displayNum || ''}` : 'Play')}
            </Text>
            {resumePct > 0 && !latestWatched?.finishedEp && (
              <View style={styles.btnProgressBarBG}>
                <View style={[styles.btnProgressBarFill, { width: `${resumePct}%` }]} />
              </View>
            )}
          </TouchableOpacity>

          {trailerUrl && (
            <TouchableOpacity style={styles.netflixTrailerBtn} activeOpacity={0.8} onPress={handleTrailer}>
              <IconTrailer size={22} color="#FFF" />
              <Text style={styles.netflixTrailerText}>Trailer</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.synopsisContainer}>
          <Text style={styles.synopsisText} numberOfLines={descExpanded ? undefined : 3}>{currentAnime.description}</Text>
          {currentAnime.description?.length > 120 && (
            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} activeOpacity={0.7} style={styles.seeMoreBtn}>
              <Text style={styles.seeMoreText}>{descExpanded ? 'Less' : 'More'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLibrary} activeOpacity={0.7}>
            {inLibrary ? <IconCheck color="#FFF"/> : <IconPlus color="#FFF"/>}
            <Text style={styles.actionText}>My List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => Share.share({ message: `Watch ${currentAnime.title} on Kameko!` })} activeOpacity={0.7}>
            <IconShare color="#FFF" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabHeader}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'episodes' && styles.tabBtnActive]} onPress={() => setActiveTab('episodes')}>
            <Text style={[styles.tabText, activeTab === 'episodes' && styles.tabTextActive]}>EPISODES</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'alternates' && styles.tabBtnActive]} onPress={() => setActiveTab('alternates')}>
            <Text style={[styles.tabText, activeTab === 'alternates' && styles.tabTextActive]}>MORE LIKE THIS</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'episodes' && seasons.length > 1 && (
          <TouchableOpacity style={styles.seasonSelectorBtn} onPress={() => setShowSeasonModal(true)}>
            <Text style={styles.seasonSelectorText}>{selectedSeason?.name || 'Season 1'}</Text>
            <IconChevronDown size={16} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      <View style={styles.topNav}>
        <TouchableOpacity style={styles.navBackBtn} onPress={onBack || (() => navigation?.goBack?.())}>
          <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'episodes' ? displayEpisodes : alternates}
        keyExtractor={(item, idx) => `${item.id}-${idx}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            {episodesLoading && activeTab === 'episodes' ? (
              <ActivityIndicator size="large" color={BRAND_RED} />
            ) : (
              <Text style={styles.emptyStateText}>
                {activeTab === 'episodes' ? 'No episodes found for this season.' : 'No related media found.'}
              </Text>
            )}
          </View>
        )}
        renderItem={({ item }) => {
          if (activeTab === 'episodes') {
            const isLoadingThis = loadingEpisode === item.providerNum;
            const pData = userProgressMap[item.slug];
            const isFinished = pData?.finishedEp;
            const pct = pData && pData.duration > 0 ? Math.min((pData.progress / pData.duration) * 100, 100) : 0;

            return (
              <TouchableOpacity 
                style={[styles.epCard, isFinished && { opacity: 0.45 }]} 
                activeOpacity={0.7} 
                onPress={() => handlePlayEpisode(item)}
              >
                <View style={styles.epTopRow}>
                  <View style={styles.epImageWrapper}>
                    <ProxyImage source={{ uri: item.displayImage }} style={styles.epThumbnail} resizeMode="cover" />
                    <View style={styles.epPlayOverlay}>
                      {isLoadingThis ? <ActivityIndicator size="small" color="#FFF" /> : <IconPlay size={20} color="#FFF" />}
                    </View>
                    {pct > 0 && !isFinished && (
                      <View style={styles.epProgressBarBg}>
                        <View style={[styles.epProgressBarFill, { width: `${pct}%` }]} />
                      </View>
                    )}
                  </View>
                  <View style={styles.epMeta}>
                    <Text style={styles.epTitle} numberOfLines={1}>{item.displayNum}. {item.displayTitle}</Text>
                    <Text style={styles.epDuration}>{item.duration}</Text>
                    
                    <View style={styles.epBadgesRow}>
                      {item.isFiller && <View style={styles.epBadge}><Text style={styles.epBadgeText}>FILLER</Text></View>}
                      {item.isSub && <View style={styles.epBadge}><Text style={styles.epBadgeText}>SUB</Text></View>}
                      {item.isDub && <View style={styles.epBadge}><Text style={styles.epBadgeText}>DUB</Text></View>}
                    </View>
                  </View>
                </View>
                <Text style={styles.epDesc} numberOfLines={3}>{item.displayDesc}</Text>
              </TouchableOpacity>
            );
          } else {
            return (
              <TouchableOpacity style={styles.altCard} activeOpacity={0.8} onPress={() => { navigation?.push ? navigation.push('Play', { anime: item }) : (onBack && onBack()); }}>
                <ProxyImage source={{ uri: item.coverImage }} style={styles.altThumbnail} resizeMode="cover" />
              </TouchableOpacity>
            );
          }
        }}
        numColumns={activeTab === 'alternates' ? 3 : 1}
        key={activeTab} 
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={showSeasonModal} transparent={true} animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowSeasonModal(false)}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
            <FlatList 
              data={seasons}
              keyExtractor={(s) => String(s.id)}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={styles.modalItem}
                  onPress={() => { setSelectedSeason(item); setShowSeasonModal(false); }}
                >
                  <Text style={[styles.modalItemText, selectedSeason?.id === item.id && { color: '#FFF', fontWeight: 'bold' }]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {activePlayback && (
        <View style={styles.playerFullscreenContainer}>
          <Player route={{ params: activePlayback }} navigation={{ goBack: () => setActivePlayback(null) }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  playerFullscreenContainer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: '#000' },
  topNav: { position: 'absolute', top: 0, left: 0, right: 0, height: 100, zIndex: 100, paddingTop: 45, paddingHorizontal: 16 },
  navBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  heroContainer: { width: '100%' },
  backdropWrapper: { width: '100%', height: height * 0.55, position: 'absolute', top: 0, left: 0 },
  backdropImage: { width: '100%', height: '100%' },
  heroContent: { paddingTop: height * 0.35, paddingHorizontal: 16 },
  logoContainer: { width: '100%', marginBottom: 12 },
  titleLogo: { width: '80%', height: 90, alignSelf: 'flex-start' },
  titleText: { color: '#FFF', fontSize: 36, fontWeight: '900', textShadowColor: '#000', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 8 },
  inlineMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  metaScore: { color: '#46D369', fontSize: 13, fontWeight: 'bold' },
  metaYear: { color: '#BCBCBC', fontSize: 13 },
  ratingBadge: { backgroundColor: '#333', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  ratingText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
  metaHD: { color: '#BCBCBC', fontSize: 11, borderWidth: 1, borderColor: '#666', paddingHorizontal: 4, borderRadius: 3, fontWeight: 'bold' },
  mainActionsContainer: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  netflixPlayBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF', borderRadius: 4, paddingVertical: 10, gap: 8, overflow: 'hidden' },
  netflixPlayText: { color: '#000', fontSize: 16, fontWeight: '800' },
  btnProgressBarBG: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.2)' },
  btnProgressBarFill: { height: '100%', backgroundColor: BRAND_RED },
  netflixTrailerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, paddingVertical: 10, gap: 8 },
  netflixTrailerText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  synopsisContainer: { marginBottom: 20 },
  synopsisText: { color: '#E0E0E0', fontSize: 14, lineHeight: 22 },
  seeMoreBtn: { marginTop: 4 },
  seeMoreText: { color: '#BCBCBC', fontSize: 13, fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', gap: 40, marginBottom: 25 },
  actionBtn: { alignItems: 'center', gap: 6 },
  actionText: { color: '#BCBCBC', fontSize: 11, fontWeight: '600' },
  tabHeader: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10, marginBottom: 15, gap: 20 },
  tabBtn: { paddingVertical: 10 },
  tabBtnActive: { borderTopWidth: 3, borderTopColor: BRAND_RED, marginTop: -13 },
  tabText: { color: '#777', fontSize: 14, fontWeight: 'bold' },
  tabTextActive: { color: '#FFF' },
  seasonSelectorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 15, gap: 10 },
  seasonSelectorText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  listPadding: { paddingBottom: 60, paddingHorizontal: 16 },
  epCard: { marginBottom: 25 },
  epTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  epImageWrapper: { width: 140, height: 80, borderRadius: 4, overflow: 'hidden', backgroundColor: '#1A1A1A' },
  epThumbnail: { width: '100%', height: '100%' },
  epPlayOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  epProgressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  epProgressBarFill: { height: '100%', backgroundColor: BRAND_RED },
  epMeta: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  epTitle: { color: '#FFF', fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  epDuration: { color: '#BCBCBC', fontSize: 13, marginBottom: 6 },
  epBadgesRow: { flexDirection: 'row', gap: 6 },
  epBadge: { backgroundColor: '#333', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  epBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  epDesc: { color: '#BCBCBC', fontSize: 13, lineHeight: 19 },
  altCard: { flex: 1, margin: 4, aspectRatio: 2/3 },
  altThumbnail: { width: '100%', height: '100%', borderRadius: 4, backgroundColor: '#1A1A1A' },
  emptyState: { paddingVertical: 45, alignItems: 'center' },
  emptyStateText: { color: '#777', fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#121212', borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '60%', paddingBottom: 30 },
  modalClose: { alignSelf: 'center', padding: 15 },
  modalCloseText: { color: '#FFF', fontSize: 24 },
  modalItem: { paddingVertical: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#222' },
  modalItemText: { color: '#888', fontSize: 18 }
});
