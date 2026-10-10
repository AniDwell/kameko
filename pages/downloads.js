
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Dimensions, TouchableOpacity, 
  FlatList, StatusBar, ActivityIndicator, Alert 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import * as FileSystem from 'expo-file-system';
import Svg, { Path } from 'react-native-svg';

import ProxyImage from '../components/ProxyImage';

const { width } = Dimensions.get('window');
const BRAND_RED = '#E50914';
const BRAND_ACCENT = '#38BDF8';
const VAULT_DIR = FileSystem.documentDirectory + 'kameko_vault/';

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
const IconCancel = ({ size = 18, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <Path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);
const IconChevronDown = ({ size = 18, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

export default function Downloads({ user, navigation, onBack }) {
  const [activeDownload, setActiveDownload] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [downloadedSeries, setDownloadedSeries] = useState([]);
  const [expandedSeriesId, setExpandedSeriesId] = useState(null);
  const [seriesEpisodes, setSeriesEpisodes] = useState([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const isDownloadingRef = useRef(false);
  const downloadResumableRef = useRef(null);

  // 1. Ensure Vault Directory Exists
  useEffect(() => {
    const initVault = async () => {
      const dirInfo = await FileSystem.getInfoAsync(VAULT_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
      }
    };
    initVault();
  }, []);

  // 2. Listen for Pending Downloads Queue & Completed Series
  useEffect(() => {
    if (!user) return;

    const unsub = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('downloads')
      .onSnapshot(async (snapshot) => {
        if (!snapshot || snapshot.empty) {
          setDownloadedSeries([]);
          return;
        }

        const seriesList = [];
        let nextTask = null;

        for (const doc of snapshot.docs) {
          const sData = doc.data();
          seriesList.push({ id: doc.id, ...sData });

          // Find pending/in-progress episodes
          if (!isDownloadingRef.current && !nextTask) {
            const epsSnap = await doc.ref.collection('episodes').get();
            for (const epDoc of epsSnap.docs) {
              const epData = epDoc.data();
              if (epData.status === 'downloading' || epData.status === 'pending') {
                nextTask = {
                  ...epData,
                  seriesId: doc.id,
                  seriesTitle: sData.seriesTitle,
                  posterUrl: sData.posterUrl,
                  epDocId: epDoc.id
                };
                break;
              }
            }
          }
        }

        setDownloadedSeries(seriesList);

        if (nextTask && !isDownloadingRef.current) {
          runDownloadPipeline(nextTask);
        }
      });

    return () => unsub();
  }, [user]);

  // 3. Expo FileSystem Download Pipeline
  const runDownloadPipeline = async (ep) => {
    isDownloadingRef.current = true;
    setActiveDownload(ep);
    setDownloadProgress(0);

    const fileName = `${ep.seriesId}_ep${ep.episodeNum}_${Date.now()}.mp4`;
    const targetUri = VAULT_DIR + fileName;

    const epRef = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('downloads')
      .doc(ep.seriesId)
      .collection('episodes')
      .doc(ep.epDocId);

    await epRef.set({ status: 'downloading', targetFileName: fileName }, { merge: true });

    // Initialize Expo Downloader
    const downloadResumable = FileSystem.createDownloadResumable(
      ep.videoUrl,
      targetUri,
      {},
      (progressData) => {
        const percent = Math.round((progressData.totalBytesWritten / progressData.totalBytesExpectedToWrite) * 100);
        setDownloadProgress(percent);
      }
    );
    downloadResumableRef.current = downloadResumable;

    try {
      const result = await downloadResumable.downloadAsync();
      
      if (result && result.status === 200) {
        // Mark episode completed
        await epRef.set({
          status: 'completed',
          localUri: result.uri,
          fileName: fileName,
          downloadedAt: Date.now()
        }, { merge: true });

        // Update User Taste Profile
        await firestore()
          .collection('users')
          .doc(user.uid)
          .collection('taste')
          .doc(ep.seriesId)
          .set({
            animeId: ep.seriesId,
            title: ep.seriesTitle,
            posterUrl: ep.posterUrl || '',
            lastDownloadedQuality: ep.chosenQuality || 'Auto',
            addedAt: firestore.FieldValue.serverTimestamp()
          }, { merge: true });

        if (expandedSeriesId === ep.seriesId) {
          loadSeriesEpisodes(ep.seriesId);
        }
      } else {
        throw new Error('Server rejected download');
      }
    } catch (err) {
      // Check if it was canceled intentionally
      if (err.message.includes('Canceled')) {
        await epRef.delete();
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      } else {
        await epRef.set({ status: 'failed', errorMessage: err.message }, { merge: true });
        Alert.alert('Download Failed', `Could not finish downloading Episode ${ep.episodeNum}.`);
      }
    } finally {
      isDownloadingRef.current = false;
      setActiveDownload(null);
      setDownloadProgress(0);
      downloadResumableRef.current = null;
    }
  };

  const cancelActiveDownload = async () => {
    if (downloadResumableRef.current) {
      try {
        await downloadResumableRef.current.cancelAsync();
      } catch (e) {
        console.log('Cancel error:', e);
      }
    }
  };

  // 4. Series & Episode Interactions
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
        .where('status', '==', 'completed')
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
      'Delete Episode',
      `Delete Episode ${ep.episodeNum} from storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            try {
              if (ep.localUri) {
                await FileSystem.deleteAsync(ep.localUri, { idempotent: true });
              }
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
              Alert.alert('Error', 'Could not delete the file.');
            }
          }
        }
      ]
    );
  };

  const playOfflineVideo = (ep) => {
    navigation.navigate('Player', {
      activeUrl: ep.localUri,
      animeTitle: ep.seriesTitle || 'Offline Video',
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
          <>
            {activeDownload && (
              <View style={styles.activeDownloadSection}>
                <Text style={styles.sectionHeader}>DOWNLOADING NOW</Text>
                <View style={styles.activeCard}>
                  <ProxyImage 
                    source={{ uri: activeDownload.posterUrl }} 
                    style={styles.activePoster} 
                    resizeMode="cover" 
                  />

                  <View style={styles.activeDetails}>
                    <Text style={styles.activeSeriesTitle} numberOfLines={1}>
                      {activeDownload.seriesTitle}
                    </Text>
                    <Text style={styles.activeEpTitle} numberOfLines={1}>
                      Episode {activeDownload.episodeNum} • {activeDownload.episodeTitle}
                    </Text>

                    <View style={styles.statsRow}>
                      <Text style={styles.statsPercentage}>{downloadProgress}%</Text>
                      <Text style={styles.statsMeta}>
                        {activeDownload.chosenQuality || 'Auto'} • {activeDownload.type?.toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
                    </View>

                    <TouchableOpacity 
                      style={styles.cancelDownloadBtn} 
                      onPress={cancelActiveDownload}
                      activeOpacity={0.7}
                    >
                      <IconCancel />
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <Text style={styles.sectionHeader}>DOWNLOADED SERIES</Text>
          </>
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
                <Text style={styles.seriesSubtitle}>Tap to view offline episodes</Text>
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
                  <Text style={styles.emptyDrawerText}>No finished downloads in this series.</Text>
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
        ListEmptyComponent={!activeDownload && (
          <View style={styles.emptyScreenContainer}>
            <Text style={styles.emptyScreenText}>No offline downloads available.</Text>
          </View>
        )}
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
  activeDownloadSection: { marginBottom: 20 },
  activeCard: { flexDirection: 'row', backgroundColor: '#111111', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  activePoster: { width: 80, height: 110, borderRadius: 8, backgroundColor: '#1A1A1A' },
  activeDetails: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  activeSeriesTitle: { color: '#FFF', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  activeEpTitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  statsPercentage: { color: BRAND_ACCENT, fontSize: 12, fontWeight: '900' },
  statsMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' },
  progressBarTrack: { width: '100%', height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  progressBarFill: { height: '100%', backgroundColor: BRAND_ACCENT },
  cancelDownloadBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(239,68,68,0.2)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, gap: 4 },
  cancelBtnText: { color: '#EF4444', fontSize: 11, fontWeight: '800' },
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
