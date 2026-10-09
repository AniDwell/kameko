import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ScrollView, ActivityIndicator, Dimensions 
} from 'react-native';

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
  const [availableTypes, setAvailableTypes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (activeMenu !== 'audio' || !animeId) return;

    const fetchAudioFormats = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${VERCEL_API_BASE}/api/servers?id=${encodeURIComponent(animeId)}&ep=${encodeURIComponent(episodeNum)}`
        );
        const json = await res.json();
        
        if (json?.success && Array.isArray(json?.data) && json.data.length > 0) {
          // Extract only the types actually provided by the backend API
          const typesFromApi = [
            ...new Set(
              json.data
                .map(s => s.type?.toLowerCase())
                .filter(t => t === 'sub' || t === 'dub' || t === 'raw')
            )
          ];
          
          if (isMounted) {
            setAvailableTypes(typesFromApi.length > 0 ? typesFromApi : [currentTargetType || 'sub']);
          }
        } else if (isMounted) {
          setAvailableTypes([currentTargetType || 'sub']);
        }
      } catch (_) {
        if (isMounted) {
          setAvailableTypes([currentTargetType || 'sub']);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAudioFormats();
    return () => { isMounted = false; };
  }, [activeMenu, animeId, episodeNum, currentTargetType]);

  if (activeMenu !== 'audio') return null;

  const getAudioLabel = (type) => {
    switch (type.toLowerCase()) {
      case 'sub':
        return 'Japanese (Sub)';
      case 'dub':
        return 'English (Dub)';
      case 'raw':
        return 'Raw Audio';
      default:
        return type.toUpperCase();
    }
  };

  const getChannelTag = (type) => {
    return type.toLowerCase() === 'dub' ? 'Stereo • EN' : 'Stereo • JA';
  };

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Backdrop */}
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={() => setActiveMenu(null)} 
      />
      
      {/* Compact Bottom Sheet */}
      <View style={styles.sheetSurface}>
        <View style={styles.headerRow}>
          <Text style={styles.sheetHeaderTitle}>Audio & Language</Text>
          {loading && <ActivityIndicator size="small" color={BRAND_RED} />}
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.listContainer}
        >
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
    backgroundColor: 'rgba(0,0,0,0.65)', 
    zIndex: 50 
  },
  sheetSurface: { 
    position: 'absolute', 
    bottom: 0, 
    alignSelf: 'center', 
    width: '92%', 
    maxWidth: 420, 
    backgroundColor: '#121212', 
    borderTopLeftRadius: 18, 
    borderTopRightRadius: 18, 
    paddingHorizontal: 18, 
    paddingTop: 16,
    paddingBottom: 22,
    minHeight: 140,
    maxHeight: '75%', 
    zIndex: 60, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.06)',
    borderRightColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetHeaderTitle: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: '700',
    letterSpacing: 0.3
  },
  listContainer: {
    gap: 8,
    paddingVertical: 2
  },
  sheetItem: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12, 
    paddingHorizontal: 14,
    borderRadius: 8, 
    borderWidth: 1, 
  },
  sheetItemActive: { 
    backgroundColor: BRAND_RED, 
    borderColor: BRAND_RED 
  },
  sheetItemInactive: { 
    backgroundColor: '#1A1A1A', 
    borderColor: 'rgba(255,255,255,0.05)' 
  },
  itemTextContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  mainLabel: { 
    fontSize: 14, 
    fontWeight: '700' 
  },
  channelTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  textActive: { 
    color: '#FFFFFF' 
  },
  textInactive: { 
    color: 'rgba(255,255,255,0.75)' 
  },
  tagActive: { 
    color: 'rgba(255,255,255,0.9)' 
  },
  tagInactive: { 
    color: 'rgba(255,255,255,0.4)' 
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    color: BRAND_RED,
    fontSize: 12,
    fontWeight: '900',
  }
});
