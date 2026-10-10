import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, 
  TouchableOpacity, Animated, Share, StatusBar, 
  ActivityIndicator, FlatList, Modal, Alert 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Defs, LinearGradient, Stop, Rect, Path } from 'react-native-svg';
import ProxyImage from '../components/ProxyImage';

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

// UI Icons
const IconBack = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);
const IconPlay = ({ size = 18, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);
const IconPlus = ({ size = 24, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);
const IconCheck = ({ size = 24, color = BRAND_RED }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3">
    <Path d="M20 6L9 17l-5-5" />
  </Svg>
);
const IconShare = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
  </Svg>
);
const IconDownload = ({ size = 22, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </Svg>
);

export default function Play({ anime, user, onBack, navigation }) {
  const currentAnime = anime || {
    id: 'solo-leveling',
    title: 'Solo Leveling',
    coverImage: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx151807-m1gX3iqITmI6.png',
    backdrop: 'https://image.tmdb.org/t/p/original/vIgyYkXkg6NC2whRbYjBD7eb3Er.jpg',
    description: "In a world of gifted hunters, Sung Jinwoo struggles as the weakest.",
    genres: ['Action', 'Fantasy'],
    score: 85,
    rating: 'U/A 13+',
    status: 'RELEASING'
  };

  const animeDocId = String(currentAnime.id);

  const [activeTab, setActiveTab] = useState('episodes'); // 'episodes' | 'alternates'
  const [descExpanded, setDescExpanded] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  const [alternates, setAlternates] = useState([]);

  // Progress Tracking
  const [userProgressMap, setUserProgressMap] = useState({});
  const [latestWatched, setLatestWatched] = useState(null);

  // TMDB Metadata
  const [titleLogo, setTitleLogo] = useState(null);
  const [tmdbSynopsis, setTmdbSynopsis] = useState(currentAnime.description);
  const [isUpcoming, setIsUpcoming] = useState(currentAnime.status?.toUpperCase() === 'UPCOMING');

  // Episodes List
  const [vercelAnimeId, setVercelAnimeId] = useState(currentAnime.id);
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);

  // Player Overlay
  const [loadingEpisode, setLoadingEpisode] = useState(null);
  const [activePlayback, setActivePlayback] = useState(null);

  // Download Sheet & State
  const [downloadModal, setDownloadModal] = useState({ visible: false, ep: null });
  const [downloadType, setDownloadType] = useState('sub');
  const [isFetchingLinks, setIsFetchingLinks] = useState(false);
  const [downloadQualities, setDownloadQualities] = useState([]);

  // 1. Firebase Listeners (Library & Watch Progress)
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
    if (inLibrary) {
      await ref.delete().catch(() => {});
    } else {
      await ref.set({
        id: animeDocId,
        title: currentAnime.title,
        img: currentAnime.coverImage || currentAnime.backdrop,
        addedAt: firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    }
  };

  // 2. Fetch TMDB Data (Light Logo & Synopsis)
  useEffect(() => {
    let isMounted = true;
    const loadTMDB = async () => {
      try {
        const cleanTitle = currentAnime.title.replace(/\(Dub\)|\(Sub\)/gi, '').trim();
        const searchType = currentAnime.format === 'MOVIE' ? 'movie' : 'tv';
        const tmdbRes = await fetchWithTimeout(`https://api.themoviedb.org/3/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`);
        const tmdbJson = await tmdbRes.json();
        const show = tmdbJson?.results?.[0];

        if (show && isMounted) {
          const detailRes = await fetchWithTimeout(`https://api.themoviedb.org/3/${searchType}/${show.id}?api_key=${TMDB_API_KEY}&append_to_response=images`);
          const detailJson = await detailRes.json();
          if (detailJson?.overview) setTmdbSynopsis(detailJson.overview);

          const logos = detailJson?.images?.logos || [];
          let bestLogo = logos.find(l => l.iso_639_1 === 'en') || logos.find(l => l.iso_639_1 === 'ja') || logos[0];
          if (bestLogo) setTitleLogo(`https://image.tmdb.org/t/p/w500${bestLogo.file_path}`);
        }
      } catch (_) {}
    };

    const loadAlternates = async () => {
      try {
        const aniQuery = `query ($search: String) { Media (search: $search, type: ANIME) { status relations { edges { relationType node { id title { romaji english } coverImage { extraLarge large } format seasonYear averageScore } } } } }`;
        const aRes = await fetchWithTimeout('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: aniQuery, variables: { search: currentAnime.title } })
        });
        const aJson = await aRes.json();
        const edges = aJson?.data?.Media?.relations?.edges || [];
        if (isMounted) {
          setAlternates(edges.map(edge => ({
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
    loadAlternates();
    return () => { isMounted = false; };
  }, [currentAnime.title]);

  // 3. Fetch Flat Episodes from API
  useEffect(() => {
    let isMounted = true;
    const fetchEpisodes = async () => {
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
          const formatted = list.map((ep, idx) => ({
            id: String(ep.id || idx + 1),
            slug: String(ep.slug || ep.id || ep.num),
            num: ep.num || (idx + 1),
            title: ep.title || `Episode ${ep.num || idx + 1}`,
            isFiller: ep.isFiller || false,
            isSub: ep.isSub ?? true,
            isDub: ep.isDub ?? false,
          }));
          setEpisodes(formatted);
        }
      } catch (err) {
        if (isMounted) setEpisodes([]);
      } finally {
        if (isMounted) setEpisodesLoading(false);
      }
    };

    fetchEpisodes();
    return () => { isMounted = false; };
  }, [currentAnime.id, currentAnime.title, isUpcoming]);

  // 4. Playback Navigation Handler
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

  // 5. Download Management (Subcollection inside downloads/{animeId}/episodes)
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
        alert('No streams found for this format.');
        setIsFetchingLinks(false);
        return;
      }

      try {
        const m3Res = await fetchWithTimeout(masterUrl, { headers: { "Referer": manifest.referer || "https://vidwish.live/" } });
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
        const unique = [];
        const seen = new Set();
        for (const q of qualities) {
          if (!seen.has(q.label)) { seen.add(q.label); unique.push(q); }
        }
        setDownloadQualities(unique);
      } catch (_) {
        setDownloadQualities([{ label: 'Standard Master', uri: masterUrl }]);
      }
    } catch (err) {
      alert('Could not retrieve download streams.');
    } finally {
      setIsFetchingLinks(false);
    }
  };

  const saveDownloadToDB = async (qualityItem) => {
    if (!user || !downloadModal.ep) return;
    try {
      const seriesRef = firestore().collection('users').doc(user.uid).collection('downloads').doc(animeDocId);

      // Save/merge Series Parent Document
      await seriesRef.set({
        animeId: animeDocId,
        seriesTitle: currentAnime.title,
        posterUrl: currentAnime.coverImage || currentAnime.backdrop,
        updatedAt: firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Save Episode to Subcollection
      await seriesRef.collection('episodes').doc(String(downloadModal.ep.num)).set({
        episodeNum: downloadModal.ep.num,
        episodeTitle: downloadModal.ep.title,
        episodeSlug: downloadModal.ep.slug,
        videoUrl: qualityItem.uri,
        chosenQuality: qualityItem.label,
        type: downloadType,
        posterUrl: currentAnime.coverImage || currentAnime.backdrop,
        timestamp: Date.now()
      });

      setDownloadModal({ visible: false, ep: null });
      Alert.alert("Download Scheduled", `Episode ${downloadModal.ep.num} (${qualityItem.label}) added to downloads.`);
    } catch (err) {
      Alert.alert("Error", "Failed to save episode to downloads.");
    }
  };

  // Determine Resume Target & Percentage
  const targetEp = (() => {
    if (episodes.length === 0) return null;
    if (latestWatched) return episodes.find(e => e.slug === latestWatched.slug) || episodes[0];
    return episodes[0];
  })();

  let resumePct = 0;
  if (targetEp && latestWatched && latestWatched.duration > 0 && latestWatched.slug === targetEp.slug) {
    resumePct = Math.min((latestWatched.progress / latestWatched.duration) * 100, 100);
  }

  // Header Component Matching the Reference UI
  const renderHeader = () => (
    <View style={styles.heroSection}>
      {/* Backdrop Image with Dark Shadow Gradients */}
      <View style={styles.backdropBox}>
        <ProxyImage
          source={{ uri: currentAnime.backdrop || currentAnime.coverImage }}
          style={styles.backdropImg}
          resizeMode="cover"
        />
        <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <LinearGradient id="heroDark" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0.1" />
              <Stop offset="0.65" stopColor="#000000" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#000000" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#heroDark)" />
        </Svg>
      </View>

      {/* Main Metadata & Actions */}
      <View style={styles.heroForeground}>
        {/* Title Logo or Text */}
        <View style={styles.logoRow}>
          {titleLogo ? (
            <ProxyImage source={{ uri: titleLogo }} style={styles.titleLogo} resizeMode="contain" />
          ) : (
            <Text style={styles.fallbackTitleText}>{currentAnime.title}</Text>
          )}
        </View>

        {/* Metadata Badges */}
        <View style={styles.badgesRow}>
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>New Episode</Text>
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingBadgeText}>{currentAnime.rating || 'U/A 13+'}</Text>
          </View>
          <Text style={styles.scoreText}>★ {currentAnime.score || 85}%</Text>
        </View>

        {/* Big Bright Red Resume / Watch Button */}
        <TouchableOpacity
          style={[styles.resumeBtn, (episodes.length === 0 || isUpcoming) && { opacity: 0.5 }]}
          activeOpacity={0.85}
          onPress={() => targetEp && handlePlayEpisode(targetEp)}
          disabled={episodes.length === 0 || isUpcoming}
        >
          <View style={styles.resumeContentRow}>
            <Text style={styles.resumeBtnText}>
              {isUpcoming ? 'Not Yet Released' : (resumePct > 0 ? `Resume Episode ${targetEp?.num || 1}` : `Watch Episode ${targetEp?.num || 1}`)}
            </Text>
            <IconPlay size={18} color="#FFF" />
          </View>
          {resumePct > 0 && !latestWatched?.finishedEp && (
            <View style={styles.resumeProgressUnderline}>
              <View style={[styles.resumeProgressFill, { width: `${resumePct}%` }]} />
            </View>
          )}
        </TouchableOpacity>

        {/* Watchlist / Download / Share Row */}
        <View style={styles.actionsBar}>
          <TouchableOpacity style={styles.actionTab} onPress={toggleLibrary} activeOpacity={0.7}>
            {inLibrary ? <IconCheck /> : <IconPlus />}
            <Text style={styles.actionTabText}>Watchlist</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionTab} onPress={() => targetEp && handleOpenDownload(targetEp)} activeOpacity={0.7}>
            <IconDownload />
            <Text style={styles.actionTabText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionTab} onPress={() => Share.share({ message: `Watch ${currentAnime.title} on Kameko!` })} activeOpacity={0.7}>
            <IconShare />
            <Text style={styles.actionTabText}>Share</Text>
          </TouchableOpacity>
        </View>

        {/* Synopsis Paragraph */}
        <View style={styles.synopsisContainer}>
          <Text style={styles.synopsisBody} numberOfLines={descExpanded ? undefined : 3}>
            {tmdbSynopsis}
          </Text>
          {tmdbSynopsis?.length > 110 && (
            <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)} activeOpacity={0.7} style={styles.moreBtn}>
              <Text style={styles.moreBtnText}>
                {descExpanded ? 'Less Details ▲' : 'More Details ▼'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Episodes / Alternates Tabs */}
        <View style={styles.tabsHeader}>
          <TouchableOpacity
            style={[styles.tabTitleBtn, activeTab === 'episodes' && styles.tabTitleBtnActive]}
            onPress={() => setActiveTab('episodes')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabTitleText, activeTab === 'episodes' && styles.tabTitleTextActive]}>
              Episodes ({episodes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabTitleBtn, activeTab === 'alternates' && styles.tabTitleBtnActive]}
            onPress={() => setActiveTab('alternates')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabTitleText, activeTab === 'alternates' && styles.tabTitleTextActive]}>
              Alternates ({alternates.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.screenContainer}>
      <StatusBar hidden={true} />

      {/* Floating Top Back Button */}
      <View style={styles.topNavFloat}>
        <TouchableOpacity style={styles.navBackCircle} onPress={onBack || (() => navigation?.goBack?.())}>
          <IconBack />
        </TouchableOpacity>
      </View>

      <FlatList
        data={activeTab === 'episodes' ? episodes : alternates}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            {episodesLoading ? (
              <ActivityIndicator size="small" color={BRAND_RED} />
            ) : (
              <Text style={styles.emptyText}>
                {activeTab === 'episodes' ? 'No episodes found.' : 'No related media found.'}
              </Text>
            )}
          </View>
        )}
        renderItem={({ item }) => {
          if (activeTab === 'episodes') {
            const isLoadingThis = loadingEpisode === item.num;
            return (
              <View style={styles.episodeRow}>
                {/* Bullet Number Indicator */}
                <Text style={styles.bulletNumber}>•{item.num}</Text>

                {/* Long Rounded Episode Card */}
                <TouchableOpacity
                  style={styles.episodeCard}
                  activeOpacity={0.8}
                  onPress={() => handlePlayEpisode(item)}
                >
                  <Text style={styles.episodeCardTitle} numberOfLines={1}>{item.title}</Text>

                  <View style={styles.cardRightGroup}>
                    {item.isFiller && (
                      <View style={styles.fillerTag}>
                        <Text style={styles.fillerTagText}>FILLER</Text>
                      </View>
                    )}
                    {isLoadingThis ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <IconPlay size={18} color="#FFF" />
                    )}
                  </View>
                </TouchableOpacity>

                {/* Download Button */}
                <TouchableOpacity
                  style={styles.downloadIconBtn}
                  activeOpacity={0.7}
                  onPress={() => handleOpenDownload(item)}
                >
                  <IconDownload size={22} color="#FFF" />
                </TouchableOpacity>
              </View>
            );
          } else {
            return (
              <TouchableOpacity
                style={styles.altCard}
                activeOpacity={0.8}
                onPress={() => navigation?.push ? navigation.push('Play', { anime: item }) : (onBack && onBack())}
              >
                <ProxyImage source={{ uri: item.coverImage }} style={styles.altThumb} resizeMode="cover" />
                <View style={styles.altMeta}>
                  <View style={styles.altTag}><Text style={styles.altTagText}>{item.relationType}</Text></View>
                  <Text style={styles.altTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.altSub}>{item.format} • {item.year} • {item.score}</Text>
                </View>
              </TouchableOpacity>
            );
          }
        }}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
      />

      {/* Download Quality Modal */}
      <Modal visible={downloadModal.visible} transparent={true} animationType="slide">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setDownloadModal({ visible: false, ep: null })} />
          <View style={styles.downloadSheet}>
            <Text style={styles.dlSheetTitle}>Download Episode {downloadModal.ep?.num}</Text>

            {downloadQualities.length === 0 && !isFetchingLinks && (
              <View style={styles.dlTypeRow}>
                <TouchableOpacity
                  style={[styles.dlTypeBtn, downloadType === 'sub' && styles.dlTypeBtnActive]}
                  onPress={() => setDownloadType('sub')}
                >
                  <Text style={[styles.dlTypeText, downloadType === 'sub' && styles.dlTypeTextActive]}>Subtitled (JA)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dlTypeBtn, downloadType === 'dub' && styles.dlTypeBtnActive]}
                  onPress={() => setDownloadType('dub')}
                >
                  <Text style={[styles.dlTypeText, downloadType === 'dub' && styles.dlTypeTextActive]}>English Dub</Text>
                </TouchableOpacity>
              </View>
            )}

            {downloadQualities.length === 0 ? (
              <TouchableOpacity style={styles.dlFetchBtn} onPress={fetchDownloadLinks} disabled={isFetchingLinks}>
                {isFetchingLinks ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.dlFetchBtnText}>Fetch Available Qualities</Text>}
              </TouchableOpacity>
            ) : (
              <View style={styles.qualitiesWrapper}>
                <Text style={styles.dlChooseTitle}>Select Resolution</Text>
                <FlatList
                  data={downloadQualities}
                  keyExtractor={q => q.label}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.qualityOptionBtn} onPress={() => saveDownloadToDB(item)}>
                      <Text style={styles.qualityOptionText}>{item.label}</Text>
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
  screenContainer: { flex: 1, backgroundColor: '#000000' },
  playerFullscreenContainer: { ...StyleSheet.absoluteFillObject, zIndex: 9999, backgroundColor: '#000' },

  // Floating Back Button
  topNavFloat: { position: 'absolute', top: 38, left: 16, zIndex: 100 },
  navBackCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Hero Section
  heroSection: { width: '100%', marginBottom: 15 },
  backdropBox: { width: '100%', height: height * 0.58, position: 'absolute', top: 0, left: 0 },
  backdropImg: { width: '100%', height: '100%' },
  heroForeground: { paddingTop: height * 0.36, paddingHorizontal: 16 },

  logoRow: { width: '100%', alignItems: 'center', marginBottom: 12 },
  titleLogo: { width: width * 0.8, height: 100 },
  fallbackTitleText: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8
  },

  badgesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18 },
  newBadge: { backgroundColor: BRAND_RED, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  newBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  ratingBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  ratingBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  scoreText: { color: '#CCC', fontSize: 12, fontWeight: '700' },

  // Big Resume Button
  resumeBtn: {
    width: '100%',
    backgroundColor: BRAND_RED,
    borderRadius: 6,
    paddingVertical: 14,
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  resumeContentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  resumeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  resumeProgressUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.2)' },
  resumeProgressFill: { height: '100%', backgroundColor: '#FFFFFF' },

  // Action Tabs (Watchlist, Download, Share)
  actionsBar: { flexDirection: 'row', justifyContent: 'center', gap: 48, marginBottom: 20 },
  actionTab: { alignItems: 'center', gap: 6 },
  actionTabText: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },

  synopsisContainer: { marginBottom: 18 },
  synopsisBody: { color: '#D1D5DB', fontSize: 13, lineHeight: 19 },
  moreBtn: { marginTop: 4 },
  moreBtnText: { color: BRAND_RED, fontSize: 12, fontWeight: '700' },

  // Tabs Header
  tabsHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#222', gap: 24 },
  tabTitleBtn: { paddingVertical: 12 },
  tabTitleBtnActive: { borderBottomWidth: 3, borderBottomColor: BRAND_RED },
  tabTitleText: { color: '#777', fontSize: 15, fontWeight: '700' },
  tabTitleTextActive: { color: '#FFF' },

  // Episode List
  listPadding: { paddingBottom: 60 },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  bulletNumber: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    minWidth: 26,
    marginRight: 6,
  },
  episodeCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  episodeCardTitle: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 },
  cardRightGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fillerTag: { backgroundColor: 'rgba(255,165,0,0.2)', borderWidth: 1, borderColor: '#FFA500', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  fillerTagText: { color: '#FFA500', fontSize: 9, fontWeight: '900' },

  downloadIconBtn: {
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Alternates Card
  altCard: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 14, alignItems: 'center' },
  altThumb: { width: 80, height: 110, borderRadius: 6, backgroundColor: '#1A1A1A' },
  altMeta: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  altTag: { backgroundColor: 'rgba(229,9,20,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6 },
  altTagText: { color: BRAND_RED, fontSize: 9, fontWeight: '900' },
  altTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  altSub: { color: '#888', fontSize: 12 },

  emptyContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { color: '#777', fontSize: 13 },

  // Download Sheet Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  downloadSheet: { backgroundColor: '#141414', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 22, paddingBottom: 36 },
  dlSheetTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 18 },
  dlTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  dlTypeBtn: { flex: 1, paddingVertical: 12, backgroundColor: '#222', borderRadius: 6, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  dlTypeBtnActive: { borderColor: BRAND_RED, backgroundColor: 'rgba(229,9,20,0.15)' },
  dlTypeText: { color: '#AAA', fontSize: 14, fontWeight: '600' },
  dlTypeTextActive: { color: '#FFF', fontWeight: '800' },
  dlFetchBtn: { width: '100%', height: 48, backgroundColor: BRAND_RED, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  dlFetchBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  qualitiesWrapper: { maxHeight: height * 0.4 },
  dlChooseTitle: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 10 },
  qualityOptionBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#222', borderRadius: 6, marginBottom: 8 },
  qualityOptionText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
