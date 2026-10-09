import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';

const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

export default function AudioSheet({ 
  activeMenu, 
  setActiveMenu, 
  animeId, 
  episodeNum, 
  currentTargetType, 
  onSelectAudioType 
}) {
  const [availableTypes, setAvailableTypes] = useState(['sub', 'dub']);
  const [loading, setLoading] = useState(false);

  // Fetch servers dynamically to detect available types (sub, dub, raw)
  useEffect(() => {
    let isMounted = true;
    if (activeMenu !== 'audio' || !animeId) return;

    const fetchAudioFormats = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${VERCEL_API_BASE}/api/servers?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}`);
        const json = await res.json();
        
        if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
          const types = [...new Set(json.data.map(s => s.type?.toLowerCase()).filter(Boolean))];
          if (isMounted && types.length > 0) {
            setAvailableTypes(types);
          }
        }
      } catch (_) {
        // Fallback to default sub/dub
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAudioFormats();
    return () => { isMounted = false; };
  }, [activeMenu, animeId, episodeNum]);

  if (activeMenu !== 'audio') return null;

  const getAudioLabel = (type) => {
    switch (type.toLowerCase()) {
      case 'sub':
        return 'Japanese (Sub)';
      case 'dub':
        return 'English (Dub)';
      case 'raw':
        return 'Raw (Japanese No Subs)';
      default:
        return type.toUpperCase();
    }
  };

  const getChannelTag = (type) => {
    return type.toLowerCase() === 'dub' ? 'Stereo 2.0 • EN' : 'Stereo 2.0 • JA';
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={() => setActiveMenu(null)} 
      />
      
      <View style={styles.sheetSurface}>
        <View style={styles.headerRow}>
          <Text style={styles.sheetHeaderTitle}>Audio & Language</Text>
          {loading && <ActivityIndicator size="small" color={BRAND_RED} />}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContainer}>
          {availableTypes.map((type) => {
            const isSelected = (currentTargetType || 'sub').toLowerCase() === type.toLowerCase();
            return (
              <TouchableOpacity 
                key={type}
                style={[
                  styles.sheetItem, 
                  isSelected ? styles.sheetItemActive : styles.sheetItemInactive
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (!isSelected && onSelectAudioType) {
                    onSelectAudioType(type);
                  }
                  setActiveMenu(null);
                }}
              >
                <View style={styles.itemTextContainer}>
                  <Text style={[styles.mainLabel, isSelected ? styles.textActive : styles.textInactive]}>
                    {getAudioLabel(type)}
                  </Text>
                  <Text style={[styles.channelTag, isSelected ? styles.tagActive : styles.tagInactive]}>
                    {getChannelTag(type)}
                  </Text>
                </View>

                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.6)', 
    zIndex: 50 
  },
  sheetSurface: { 
    position: 'absolute', 
    bottom: 0, 
    alignSelf: 'center', 
    width: '100%', 
    maxWidth: 600, 
    backgroundColor: '#121212', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 24, 
    maxHeight: '85%', 
    zIndex: 60, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.1)' 
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetHeaderTitle: { 
    color: '#FFF', 
    fontSize: 20, 
    fontWeight: 'bold' 
  },
  listContainer: {
    paddingBottom: 20,
    gap: 8,
  },
  sheetItem: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, 
    borderRadius: 8, 
    borderWidth: 1, 
  },
  sheetItemActive: { 
    backgroundColor: BRAND_RED, 
    borderColor: BRAND_RED 
  },
  sheetItemInactive: { 
    backgroundColor: '#1E1E1E', 
    borderColor: 'transparent' 
  },
  itemTextContainer: {
    flexDirection: 'column',
    gap: 4,
  },
  mainLabel: { 
    fontSize: 16, 
    fontWeight: '700' 
  },
  channelTag: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  textActive: { 
    color: '#FFFFFF' 
  },
  textInactive: { 
    color: 'rgba(255,255,255,0.7)' 
  },
  tagActive: { 
    color: 'rgba(255,255,255,0.9)' 
  },
  tagInactive: { 
    color: 'rgba(255,255,255,0.4)' 
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: BRAND_RED,
    fontSize: 14,
    fontWeight: '900',
  }
});
