import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator, FlatList, Modal, Alert, Linking 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Polygon } from 'react-native-svg';
import ProxyImage from '../components/ProxyImage';

import Player from './play/player';

const { width, height } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const BRAND_ACCENT = '#38BDF8'; // Sleek premium blue for interactions
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

// --- Clean Premium Icons ---
const IconPlay = ({ size = 20, color = "#000" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill={color}><Path d="M8 5v14l11-7z" /></Svg>);
const IconPlus = ({ size = 22, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><Path d="M12 5v14M5 12h14" /></Svg>);
const IconCheck = ({ size = 22, color = BRAND_ACCENT }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"><Path d="M20 6L9 17l-5-5" /></Svg>);
const IconShare = ({ size = 20, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" /></Svg>);
const IconTrailer = ({ size = 20, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><Polygon points="5 3 19 12 5 21 5 3" strokeLinejoin="round"/></Svg>);
const IconChevronDown = ({ size = 18, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><Path d="M6 9l6 6 6-6" /></Svg>);
const IconDownload = ({ size = 20, color = "#FFF" }) => (<Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></Svg>);

export default function Play({ anime, user, onBack, navigation }) {
  const currentAnime = anime || {
    id: 'solo-leveling', title: 'Solo Leveling',
    coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iqITmI6.png',
    backdrop: 'https://image.tmdb.org/t/p/original/vIgyYkXkg6NC2whRbYjBD7eb3Er.jpg',
    description: "In a world of gifted hunters, Sung Jinwoo struggles as the weakest.",
    genres: ['Action', 'Fantasy'], score: 85, rating: 'U/A 16+', status: 'RELEASING', format: 'TV'
  };

  const animeDocId = String(currentAnime.id);

  // Core State
  const [descExpanded, setDescExpanded] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  
  const [userProgressMap, setUserProgressMap] = useState({});
  const [latestWatched, setLatestWatched] = useState(null);

  // TMDB Metadata
  const [titleLogo, setTitleLogo] = useState(null);
  const [tmdbSynopsis, setTmdbSynopsis] = useState(currentAnime.description);
  const [trailerUrl, setTrailerUrl] = useState(null);
  const [isUpcoming, setIsUpcoming] = useState(currentAnime.status?.toUpperCase() === 'UPCOMING');

  // Episodes & Segments
  const [vercelAnimeId, setVercelAnimeId] = useState(currentAnime.id);
  const [providerEpisodes, setProviderEpisodes] = useState([]); 
  const [episodesLoading, setEpisodesLoading] = useState(true);
  
  const [chunks, setChunks] = useState([]);
  const [selectedChunk, setSelectedChunk] = useState(null);
  const [showChunkModal, setShowChunkModal] = useState(false);

  const isMovie = currentAnime.format === 'MOVIE' || providerEpisodes.length === 1;

  // Player State
  const [loadingEpisode, setLoadingEpisode] = useState(null);
  const [activePlayback, setActivePlayback] = useState(null);

  // Download State
  const [downloadModal, setDownloadModal] = useState({ visible: false, ep: null });
  const [downloadType, setDownloadType] = useState('sub');
  const [isFetchingLinks, setIsFetchingLinks] = useState(false);
  const [downloadQualities, setDownloadQualities] = useState([]);

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
          pMap[data.slug] = data;
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
    if (inLibrary) await ref.delete().catch(() => {});
    else await ref.set({ id: animeDocId, title: currentAnime.title, img: currentAnime.coverImage || currentAnime.backdrop, addedAt: firestore.FieldValue.serverTimestamp() }).catch(() => {});
  };

  // 2. Fetch TMDB Data (Synopsis, Trailer, Logo)
  useEffect(() => {
    let isMounted = true;
    const loadTMDBData = async () => {
      try {
        const cleanTitle = currentAnime.title.replace(/\(Dub\)|\(Sub\)/gi, '').trim();
        const searchType = currentAnime.format === 'MOVIE' ? 'movie' : 'tv';
        const tmdbRes = await fetchWithTimeout(`https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
        const tmdbJson = await tmdbRes.json();
        const show = tmdbJson?.results?.[0];
        
        if (show && isMounted) {
          const detailRes = await fetchWithTimeout(`https://api.themoviedb.org/3/${searchType}/${show.id}?api_key=${TMDB_API_KEY}&append_to_response=images,videos`);
          const detailJson = await detailRes.json();
          
          if (detailJson?.overview) setTmdbSynopsis(detailJson.overview);

          const logos = detailJson?.images?.logos || [];
          let bestLogo = logos.find(l => l.iso_639_1 === 'en') || logos.find(l => l.iso_639_1 === 'ja') || logos[0];
          if (bestLogo) setTitleLogo(`https://image.tmdb.org/t/p/w500${bestLogo.file_path}`);

          const vids = detailJson?.videos?.results || [];
          const trailer = vids.find(v => v.type === 'Trailer' && v.site === 'YouTube');
          if (trailer) setTrailerUrl(`https://www.youtube.com/watch?v=${trailer.key}`);
        }
      } catch (_) {}
    };
    loadTMDBData();
    return () => { isMounted = false; };
  }, [currentAnime.title, currentAnime.format]);

  // 3. Fetch Provider Episodes
  useEffect(() => {
    let isMounted = true;
    const fetchProviderData = async () => {
      setEpisodesLoading(true);
      if (isUpcoming) {
        if (isMounted) setEpisodesLoading(false);
        return;
      }
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
          const mappedList = list.map((ep, idx) => ({
            id: String(ep.id || idx + 1),
            slug: String(ep.slug || ep.id || ep.num),
            num: ep.num || (idx + 1),
            title: ep.title || `Episode ${ep.num || idx + 1}`,
            isFiller: ep.isFiller || false,
            isSub: ep.isSub ?? true,
            isDub: ep.isDub ?? false,
          }));
          setProviderEpisodes(mappedList);
        }
      } catch (err) {} 
      finally {
        if (isMounted) setEpisodesLoading(false);
      }
    };
    fetchProviderData();
    return () => { isMounted = false; };
  }, [currentAnime.id, currentAnime.title, isUpcoming]);

  // 4. Smart Segmentation
  useEffect(() => {
    if (providerEpisodes.length === 0) return;
    const CHUNK_SIZE = 50;
    const totalEps = providerEpisodes.length;
    const generatedChunks = [];

    for (let i = 0; i < totalEps; i += CHUNK_SIZE) {
      generatedChunks.push({
        label: `Episodes ${i + 1} - ${Math.min(i + CHUNK_SIZE, totalEps)}`,
        start: i + 1,
        end: i + CHUNK_SIZE
      });
    }
    setChunks(generatedChunks);

    if (generatedChunks.length > 0) {
      if (latestWatched && latestWatched.lastWatchedEp) {
        const epNum = parseInt(latestWatched.lastWatchedEp, 10);
        const targetChunk = generatedChunks.find(c => epNum >= c.start && epNum <= c.end);
        setSelectedChunk(targetChunk || generatedChunks[0]);
      } else {
        setSelectedChunk(generatedChunks[0]);
      }
    }
  }, [providerEpisodes, latestWatched]);

  const displayEpisodes = selectedChunk 
    ? providerEpisodes.filter(ep => ep.num >= selectedChunk.start && ep.num <= selectedChunk.end)
    : [];

  // 5. Playback Handlers
  const handlePlayEpisode = async (episodeItem) => {
    try {
      setLoadingEpisode(episodeItem.num);
      const safeId = encodeURIComponent(vercelAnimeId || currentAnime.id);
      const safeEp = encodeURIComponent(String(episodeItem.slug));

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
        episodeNum: episodeItem.num,
        episodeTitle: episodeItem.title,
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

  // 6. Download Handlers
  const handleOpenDownload = (ep) => {
    setDownloadQualities([]);
    setDownloadModal({ visible: true, ep });
  };

  const fetchDownloadLinks = async () => {
    if (!downloadModal.ep) return;
    setIsFetchingLinks(true);
    try {
      const safeId = encodeURIComponent(vercelAnimeId || currentAnime.id);
      const safeEp = encodeURIComponent(String(downloadModal.ep.slug));
      const res = await fetchWithTimeout(`${VERCEL_API_BASE}/api/stream?id=${safeId}&ep=${safeEp}&server=hd-1&type=${downloadType}`);
      const json = await res.json();
      
      let manifest = json?.data || json?.results;
      const masterUrl = manifest?.m3u8 || manifest?.streamingLink;
      
      if (!masterUrl) {
        alert('No downloadable streams found for this format.');
        setIsFetchingLinks(false);
        return;
      }

      try {
        const m3Res = await fetchWithTimeout(masterUrl, { headers: { "Referer": manifest.referer || "https://vidwish.live/" }});
        const m3Text = await m3Res.text();
        const lines = m3Text.split('\n');
        let qualities = [{ label: 'Auto (HLS)', uri: masterUrl }];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('RESOLUTION=')) {
            const resMatch = lines[i].match(/RESOLUTION=\d+x(\d+)/);
            if (resMatch && lines[i + 1]) {
              let streamUri = lines[i + 1].trim();
              if (!streamUri.startsWith('http')) {
                const basePath = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
                streamUri = basePath + streamUri;
              }
              qualities.push({ label: `${resMatch[1]}p`, uri: streamUri });
            }
          }
        }
        
        // Remove duplicates
        const unique = [];
        const seen = new Set();
        for (const q of qualities) { 
          if (!seen.has(q.label)) { seen.add(q.label); unique.push(q); } 
        }
        setDownloadQualities(unique);

      } catch (_) {
        setDownloadQualities([{ label: 'Master Source', uri: masterUrl }]);
      }
    } catch (err) {
      alert('Failed to retrieve download links.');
    } finally {
      setIsFetchingLinks(false);
    }
  };

  const saveDownloadToDB = async (qualityItem) => {
    if (!user || !downloadModal.ep) return;
    try {
      const epId = `${animeDocId}_${downloadModal.ep.num}`;
      await firestore().collection('users').doc(user.uid).collection('downloads').doc(epId).set({
        animeId: animeDocId,
        animeTitle: currentAnime.title,
        episodeNum: downloadModal.ep.num,
        episodeTitle: downloadModal.ep.title,
        episodeSlug: downloadModal.ep.slug,
        videoUrl: qualityItem.uri,
        quality: qualityItem.label,
        type: downloadType,
        backdrop: currentAnime.backdrop || currentAnime.coverImage,
        timestamp: Date.now()
      });
      setDownloadModal({ visible: false, ep: null });
      Alert.alert("Added to Downloads", `Episode ${downloadModal.ep.num} added to your offline queue.`);
    } catch (err) {
      Alert.alert("Error", "Could not add to downloads.");
    }
  };

  // Determine Main Button Target
  const targetEp = (() => {
    if (providerEpisodes.length === 0) return null;
    if (latestWatched) return providerEpisodes.find(e => e.slug === latestWatched.slug) || providerEpisodes[0];
    return providerEpisodes[0];
  })();
  
  let resumePct = 0;
  if (targetEp && latestWatched && latestWatched.duration > 0 && latestWatched.slug === targetEp.slug) {
    resumePct = Math.min((latestWatched.progress / latestWatched.duration) * 100, 100);
  }

  // --- RENDERS ---
  const renderHeader = () => (
    <View style={styles.heroContentContainer}>
      <View style={styles.logoBox}>
        {titleLogo ? (
          <ProxyImage source={{ uri: titleLogo }} style={styles.titleLogo} resizeMode="contain" />
        ) : (
          <Text style={styles.titleText}>{currentAnime.title}</Text>
        )}
      </View>

      <View style={styles.metaGlassPill}>
        <Text style={styles.metaScore}>{currentAnime.score ? `${currentAnime.score}% Match` : 'New'}</Text>
        <View style={styles.metaDot} />
        <Text style={styles.metaYear}>{new Date().getFullYear()}</Text>
        <View style={styles.metaDot} />
        <Text style={styles.metaRating}>{currentAnime.rating || '16+'}</Text>
      </View>

      <TouchableOpacity 
        style={[styles.primaryPlayBtn, (providerEpisodes.length === 0 || isUpcoming) && { opacity: 0.5 }]} 
        activeOpacity={0.85}
        onPress={() => targetEp && handlePlayEpisode(targetEp)}
        disabled={providerEpisodes.length === 0 || isUpcoming}
      >
        {resumePct > 0 && !latestWatched?.finishedEp && (
          <View style={[styles.btnProgressFill, { width: `${resumePct}%` }]} />
        )}
        <View style={styles.btnInnerContent}>
          <IconPlay size={20} color="#050505" />
          <Text style={styles.primaryPlayText}>
            {isUpcoming ? 'Not Yet Released' : (resumePct > 0 ? (isMovie ? 'Resume Movie' : `Resume Episode ${targetEp?.num || ''}`) : (isMovie ? 'Play Movie' : 'Start Watching'))}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.actionsGrid}>
        <TouchableOpacity style={styles.actionBtn} onPress={toggleLibrary} activeOpacity={0.7}>
          <View style={styles.actionIconBg}>
            {inLibrary ? <IconCheck color="#111"/> : <IconPlus color="#FFF"/>}
          </View>
          <Text style={styles.actionText}>Watchlist</Text>
        </TouchableOpacity>
        
        {trailerUrl && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(trailerUrl)} activeOpacity={0.7}>
            <View style={styles.actionIconBg}><IconTrailer color="#FFF" /></View>
            <Text style={styles.actionText}>Trailer</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionBtn} onPress={() => Share.share({ message: `Watch ${currentAnime.title} on Kameko!` })} activeOpacity={0.7}>
          <View style={styles.actionIconBg}><IconShare color="#FFF" /></View>
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.synopsisContainer}>
        <Text style={styles.synopsisText} numberOfLines={descExpanded ? undefined : 4}>{tmdbSynopsis}</Text>
        {tmdbSynopsis?.length > 180 && (
          <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} activeOpacity={0.7} style={styles.seeMoreBtn}>
            <Text style={styles.seeMoreText}>{descExpanded ? 'Collapse Synopsis' : 'Read Full Synopsis'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!isMovie && chunks.length > 1 && (
        <View style={styles.chunkRow}>
          <Text style={styles.chunkSectionTitle}>Episodes</Text>
          <TouchableOpacity style={styles.chunkSelectorBtn} onPress={() => setShowChunkModal(true)}>
            <Text style={styles.chunkSelectorText}>{selectedChunk?.label}</Text>
            <IconChevronDown size={16} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* FULLSCREEN EDGE-TO-EDGE BACKDROP */}
      <View style={styles.absoluteBackdrop}>
        <ProxyImage source={{ uri: currentAnime.backdrop || currentAnime.coverImage }} style={styles.backdropImage} resizeMode="cover" />
        <View style={styles.backdropFadeOverlay} />
      </View>

      <View style={styles.topNav}>
        <TouchableOpacity style={styles.navBackBtn} onPress={onBack || (() => navigation?.goBack?.())}>
          <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5"><Path d="M15 18l-6-6 6-6" /></Svg>
        </TouchableOpacity>
      </View>

      <FlatList
        data={isMovie ? [] : displayEpisodes}
        keyExtractor={(item) => `${item.id}-${item.num}`}
        ListHeaderComponent={<>
          <View style={{ height: height * 0.4 }} />
          {renderHeader()}
        </>}
        ListEmptyComponent={() => (
          !isMovie && (
            <View style={styles.emptyState}>
              {episodesLoading ? (
                <ActivityIndicator size="large" color="#FFF" />
              ) : (
                <Text style={styles.emptyStateText}>No episodes available.</Text>
              )}
            </View>
          )
        )}
        renderItem={({ item }) => {
          if (isMovie) return null;
          const isLoadingThis = loadingEpisode === item.num;
          const pData = userProgressMap[item.slug];
          const pct = pData && pData.duration > 0 ? Math.min((pData.progress / pData.duration) * 100, 100) : 0;

          return (
            <View style={styles.epRowContainer}>
              <TouchableOpacity 
                style={styles.epRowCard} 
                activeOpacity={0.8} 
                onPress={() => handlePlayEpisode(item)}
              >
                <View style={styles.epNumBox}>
                  {isLoadingThis ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.epNumText}>{item.num}</Text>}
                </View>
                
                <View style={styles.epContent}>
                  <Text style={styles.epRowTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.epBadgesRow}>
                    {item.isFiller && <View style={styles.tagBadgeFiller}><Text style={styles.tagTextFiller}>FILLER</Text></View>}
                    {item.isSub && <View style={styles.tagBadge}><Text style={styles.tagText}>SUB</Text></View>}
                    {item.isDub && <View style={styles.tagBadge}><Text style={styles.tagText}>DUB</Text></View>}
                  </View>
                </View>

                {pct > 0 && !pData?.finishedEp && (
                  <View style={styles.epRowProgressBg}>
                    <View style={[styles.epRowProgressFill, { width: `${pct}%` }]} />
                  </View>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.epDownloadBtn} onPress={() => handleOpenDownload(item)}>
                <IconDownload />
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
      />

      {/* Segment Selector Modal */}
      <Modal visible={showChunkModal} transparent={true} animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.modalBackdropClose} onPress={() => setShowChunkModal(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalHeader}>Select Episodes</Text>
            <FlatList 
              data={chunks}
              keyExtractor={(c) => c.label}
              renderItem={({item}) => (
                <TouchableOpacity 
                  style={[styles.modalListItem, selectedChunk?.label === item.label && styles.modalListItemActive]}
                  onPress={() => { setSelectedChunk(item); setShowChunkModal(false); }}
                >
                  <Text style={[styles.modalListText, selectedChunk?.label === item.label && styles.modalListTextActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Download Configuration Modal */}
      <Modal visible={downloadModal.visible} transparent={true} animationType="slide">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.modalBackdropClose} onPress={() => setDownloadModal({visible: false, ep: null})} />
          <View style={styles.downloadSheet}>
            <Text style={styles.dlHeader}>Download Episode {downloadModal.ep?.num}</Text>
            
            {/* Format Selection */}
            {downloadQualities.length === 0 && !isFetchingLinks && (
              <View style={styles.dlFormatRow}>
                <TouchableOpacity 
                  style={[styles.dlFormatBtn, downloadType === 'sub' && styles.dlFormatBtnActive]}
                  onPress={() => setDownloadType('sub')}
                >
                  <Text style={[styles.dlFormatText, downloadType === 'sub' && styles.dlFormatTextActive]}>Subtitled</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.dlFormatBtn, downloadType === 'dub' && styles.dlFormatBtnActive]}
                  onPress={() => setDownloadType('dub')}
                >
                  <Text style={[styles.dlFormatText, downloadType === 'dub' && styles.dlFormatTextActive]}>English Dub</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Fetch Links Button */}
            {downloadQualities.length === 0 ? (
              <TouchableOpacity style={styles.dlActionBtn} onPress={fetchDownloadLinks} disabled={isFetchingLinks}>
                {isFetchingLinks ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.dlActionText}>Get Links</Text>}
              </TouchableOpacity>
            ) : (
              // Quality Selection List
              <View style={styles.dlQualitiesContainer}>
                <Text style={styles.dlSubHeader}>Select Resolution</Text>
                <FlatList
                  data={downloadQualities}
                  keyExtractor={q => q.label}
                  renderItem={({item}) => (
                    <TouchableOpacity style={styles.dlQualityBtn} onPress={() => saveDownloadToDB(item)}>
                      <Text style={styles.dlQualityText}>{item.label}</Text>
                      <IconDownload size={18} color="#FFF" />
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Fallback Screen Player Overlay */}
      {activePlayback && (
        <View style={styles.playerFullscreenContainer}>
          <Player route={{ params: activePlayback }} navigation={{ goBack: () => setActivePlayback(null) }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },
  playerFullscreenContainer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: '#000' },
  
  // Edge-to-Edge Backdrop
  absoluteBackdrop: { ...StyleSheet.absoluteFillObject, height: height * 0.7, zIndex: 0 },
  backdropImage: { width: '100%', height: '100%' },
  backdropFadeOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,5,0.4)' },
  
  topNav: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, paddingTop: 40, paddingHorizontal: 20 },
  navBackBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  
  // Premium Content Sheet Over Backdrop
  heroContentContainer: { backgroundColor: '#0A0A0A', borderTopLeftRadius: 36, borderTopRightRadius: 36, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -15 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 15 },
  logoBox: { width: '100%', alignItems: 'center', marginBottom: 20 },
  titleLogo: { width: '85%', height: 110 },
  titleText: { color: '#FFF', fontSize: 32, fontWeight: '900', textAlign: 'center' },
  
  metaGlassPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 26 },
  metaScore: { color: '#4ADE80', fontSize: 13, fontWeight: '800' },
  metaYear: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  metaRating: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  metaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 12 },
  
  primaryPlayBtn: { width: '100%', height: 58, backgroundColor: '#FFF', borderRadius: 16, overflow: 'hidden', marginBottom: 28 },
  btnProgressFill: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.15)' },
  btnInnerContent: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryPlayText: { color: '#050505', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  
  actionsGrid: { flexDirection: 'row', justifyContent: 'center', gap: 40, marginBottom: 32 },
  actionBtn: { alignItems: 'center', gap: 8 },
  actionIconBg: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  actionText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  
  synopsisContainer: { marginBottom: 35 },
  synopsisText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, lineHeight: 24, fontWeight: '400' },
  seeMoreBtn: { marginTop: 8 },
  seeMoreText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  
  chunkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 4 },
  chunkSectionTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  chunkSelectorBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, gap: 8 },
  chunkSelectorText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  
  // Sleek Long Rectangle Episode Buttons
  listPadding: { paddingBottom: 80, backgroundColor: '#0A0A0A' },
  epRowContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  epRowCard: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#141414', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, overflow: 'hidden' },
  epNumBox: { width: 36, alignItems: 'flex-start' },
  epNumText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '800' },
  epContent: { flex: 1 },
  epRowTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  epBadgesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '800' },
  tagBadgeFiller: { backgroundColor: 'rgba(255,153,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,153,0,0.3)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagTextFiller: { color: '#FF9900', fontSize: 9, fontWeight: '900' },
  
  epRowProgressBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  epRowProgressFill: { height: '100%', backgroundColor: '#FFF' },
  
  epDownloadBtn: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginLeft: 6 },

  emptyState: { paddingVertical: 50, alignItems: 'center', backgroundColor: '#0A0A0A' },
  emptyStateText: { color: 'rgba(255,255,255,0.4)', fontSize: 15 },
  
  // Modals
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'center' },
  modalBackdropClose: { ...StyleSheet.absoluteFillObject },
  modalSheet: { width: '100%', backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingVertical: 24, paddingHorizontal: 20 },
  modalHeader: { color: '#FFF', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  modalListItem: { paddingVertical: 18, alignItems: 'center', borderRadius: 12 },
  modalListItemActive: { backgroundColor: 'rgba(255,255,255,0.1)' },
  modalListText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, fontWeight: '700' },
  modalListTextActive: { color: '#FFF', fontWeight: '900' },
  
  downloadSheet: { width: '100%', backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingVertical: 30, paddingHorizontal: 24 },
  dlHeader: { color: '#FFF', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 24 },
  dlFormatRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  dlFormatBtn: { flex: 1, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  dlFormatBtnActive: { borderColor: '#FFF', backgroundColor: 'rgba(255,255,255,0.15)' },
  dlFormatText: { color: 'rgba(255,255,255,0.5)', fontSize: 15, fontWeight: '700' },
  dlFormatTextActive: { color: '#FFF', fontWeight: '900' },
  dlActionBtn: { width: '100%', height: 56, backgroundColor: '#FFF', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  dlActionText: { color: '#000', fontSize: 16, fontWeight: '800' },
  dlQualitiesContainer: { width: '100%', maxHeight: height * 0.5 },
  dlSubHeader: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase' },
  dlQualityBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, marginBottom: 10 },
  dlQualityText: { color: '#FFF', fontSize: 16, fontWeight: '800' }
});
