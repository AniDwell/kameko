import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, TouchableOpacity, 
  FlatList, StatusBar, ActivityIndicator, Alert 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path } from 'react-native-svg';

import ProxyImage from '../components/ProxyImage';

const { width } = Dimensions.get('window');
const BRAND_RED = '#E50914';

// --- SVGs ---
const IconBack = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5">
    <Path d="M15 18l-6-6 6-6" />
  </Svg>
);
const IconPlay = ({ size = 16, color = "#000" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M8 5v14l11-7z" />
  </Svg>
);
const IconTrash = ({ size = 18, color = "#EF4444" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </Svg>
);
const IconChevronDown = ({ size = 18, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

export default function Downloads({ user, navigation, onBack }) {
  const [downloadedSeries, setDownloadedSeries] = useState([]);
  const [expandedSeriesId, setExpandedSeriesId] = useState(null);
  const [seriesEpisodes, setSeriesEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // 1. Listen for Completed Series (UI Only)
  useEffect(() => {
    if (!user) return;

    const unsub = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('downloads')
      .onSnapshot((snapshot) => {
        if (!snapshot || snapshot.empty) {
          setDownloadedSeries([]);
          return;
        }

        const seriesList = [];
        for (const doc of snapshot.docs) {
          seriesList.push({ id: doc.id, ...doc.data() });
        }
        setDownloadedSeries(seriesList);
      });

    return () => unsub();
  }, [user]);

  // 2. Series & Episode Interactions
  const loadSeriesEpisodes = async (seriesId) => {
    if (expandedSeriesId === seriesId) {
      setExpandedSeriesId(null);
      setSeriesEpisodes([]);
      return;
    }

    setExpandedSeriesId(seriesId);
    setLoadingEpisodes(true);

    try {
      const snap = await firestore()
        .collection('users')
        .doc(user.uid)
        .collection('downloads')
        .doc(seriesId)
        .collection('episodes')
        .get();

      const eps = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      eps.sort((a, b) => a.episodeNum - b.episodeNum);
      setSeriesEpisodes(eps);
    } catch (e) {
      setSeriesEpisodes([]);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const deleteDownloadedEpisode = async (seriesId, ep) => {
    Alert.alert(
      'Remove Episode',
      `Remove Episode ${ep.episodeNum} from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // Delete from Firestore only
              await firestore()
                .collection('users')
                .doc(user.uid)
                .collection('downloads')
                .doc(seriesId)
                .collection('episodes')
                .doc(ep.id)
                .delete();

              setSeriesEpisodes(prev => prev.filter(item => item.id !== ep.id));
            } catch (err) {
              Alert.alert('Error', 'Could not remove the entry.');
            }
          }
        }
      ]
    );
  };

  const playOfflineVideo = (ep) => {
    navigation.navigate('Player', {
      activeUrl: ep.videoUrl || '', // Fallback to online URL since files aren't stored
      animeTitle: ep.seriesTitle || 'Video',
      episodeNum: ep.episodeNum,
      episodeTitle: ep.episodeTitle,
      animeId: ep.seriesId,
      slug: ep.episodeSlug,
      userUid: user?.uid,
      targetType: ep.type || 'sub'
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn} 
          onPress={onBack || (() => navigation?.goBack?.())}
        >
          <IconBack />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloads</Text>
      </View>

      <FlatList
        data={downloadedSeries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPadding}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          downloadedSeries.length > 0 ? (
            <Text style={styles.sectionHeader}>SAVED SERIES</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.seriesContainer}>
            <TouchableOpacity 
              style={styles.seriesCard} 
              activeOpacity={0.8}
              onPress={() => loadSeriesEpisodes(item.id)}
            >
              <ProxyImage 
                source={{ uri: item.posterUrl }} 
                style={styles.seriesPoster} 
                resizeMode="cover" 
              />
              <View style={styles.seriesInfo}>
                <Text style={styles.seriesTitle} numberOfLines={1}>{item.seriesTitle}</Text>
                <Text style={styles.seriesSubtitle}>Tap to view saved episodes</Text>
              </View>
              <View style={[
                styles.arrowIcon, 
                expandedSeriesId === item.id && styles.arrowIconRotated
              ]}>
                <IconChevronDown color="rgba(255,255,255,0.6)" />
              </View>
            </TouchableOpacity>

            {expandedSeriesId === item.id && (
              <View style={styles.episodesDrawer}>
                {loadingEpisodes ? (
                  <ActivityIndicator size="small" color={BRAND_RED} style={{ padding: 16 }} />
                ) : seriesEpisodes.length === 0 ? (
                  <Text style={styles.emptyDrawerText}>No saved episodes in this series.</Text>
                ) : (
                  seriesEpisodes.map((ep) => (
                    <View key={ep.id} style={styles.episodeRow}>
                      <View style={styles.epLeftGroup}>
                        <Text style={styles.epBulletNumber}>•{ep.episodeNum}</Text>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.epTitle} numberOfLines={1}>
                            {ep.episodeTitle || `Episode ${ep.episodeNum}`}
                          </Text>
                          <Text style={styles.epMetaPills}>
                            {ep.chosenQuality || '1080p'} • {ep.type?.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.epActionRow}>
                        <TouchableOpacity 
                          style={styles.epPlayBtn} 
                          onPress={() => playOfflineVideo(ep)}
                          activeOpacity={0.8}
                        >
                          <IconPlay color="#000" size={12} />
                          <Text style={styles.epPlayText}>Play</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={styles.epTrashBtn} 
                          onPress={() => deleteDownloadedEpisode(item.id, ep)}
                          activeOpacity={0.7}
                        >
                          <IconTrash />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyScreenContainer}>
            <Text style={styles.emptyScreenText}>No saved downloads available.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 36, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  listPadding: { paddingHorizontal: 16, paddingBottom: 60, paddingTop: 16 },
  sectionHeader: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginTop: 8 },
  seriesContainer: { marginBottom: 10 },
  seriesCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0D0D', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  seriesPoster: { width: 48, height: 68, borderRadius: 6, backgroundColor: '#1E1E1E' },
  seriesInfo: { flex: 1, marginLeft: 12 },
  seriesTitle: { color: '#FFF', fontSize: 15, fontWeight: '800', marginBottom: 4 },
  seriesSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500' },
  arrowIcon: { padding: 8 },
  arrowIconRotated: { transform: [{ rotate: '180deg' }] },
  episodesDrawer: { backgroundColor: '#080808', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.06)' },
  emptyDrawerText: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center', marginVertical: 10 },
  episodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  epLeftGroup: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  epBulletNumber: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '800', width: 28 },
  epTitle: { color: '#FFF', fontSize: 13, fontWeight: '700', marginBottom: 2 },
  epMetaPills: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700' },
  epActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  epPlayBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  epPlayText: { color: '#000', fontSize: 11, fontWeight: '800' },
  epTrashBtn: { padding: 6, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 4 },
  emptyScreenContainer: { paddingVertical: 60, alignItems: 'center' },
  emptyScreenText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600' }
});
