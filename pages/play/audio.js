import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ScrollView, ActivityIndicator 
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

const BRAND_RED = '#E50914';
const VERCEL_API_BASE = 'https://anikoto-api-lyart.vercel.app';

// Plus icon matching the web player button
const IconPlus = ({ size = 16, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

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

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* Outside Backdrop */}
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={() => setActiveMenu(null)} 
      />

      {/* Web Player-Style Bottom Sheet Modal */}
      <View style={styles.sheetSurface}>
        <View style={styles.headerRow}>
          <Text style={styles.sheetHeaderTitle}>Audio Tracks</Text>
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
                  styles.bsItem,
                  isSelected ? styles.bsItemActive : styles.bsItemInactive
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  if (!isSelected && onSelectAudioType) {
                    onSelectAudioType(type);
                  }
                  setActiveMenu(null);
                }}
              >
                <Text style={[styles.bsItemText, isSelected ? styles.bsItemTextActive : styles.bsItemTextInactive]}>
                  {getAudioLabel(type)}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Add Custom Audio Button Matching Screenshot */}
          <TouchableOpacity 
            style={styles.addCustomBtn}
            activeOpacity={0.7}
            onPress={() => {
              // Custom local audio picker hook placeholder
            }}
          >
            <IconPlus size={16} color="rgba(255,255,255,0.85)" />
            <Text style={styles.addCustomText}>Add Custom Audio</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 50,
  },
  sheetSurface: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 520,
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: 28,
    maxHeight: '80%',
    zIndex: 60,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderLeftColor: 'rgba(255,255,255,0.04)',
    borderRightColor: 'rgba(255,255,255,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.7,
    shadowRadius: 24,
    elevation: 25,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  sheetHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  listContainer: {
    gap: 10,
  },
  // Audio row items
  bsItem: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    justifyContent: 'center',
    borderWidth: 1,
  },
  bsItemActive: {
    backgroundColor: BRAND_RED,
    borderColor: BRAND_RED,
  },
  bsItemInactive: {
    backgroundColor: '#1E1E1E',
    borderColor: 'transparent',
  },
  bsItemText: {
    fontSize: 15,
    fontWeight: '600',
  },
  bsItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bsItemTextInactive: {
    color: 'rgba(255,255,255,0.65)',
  },
  // Bottom "+ Add Custom Audio" button
  addCustomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 4,
    gap: 8,
  },
  addCustomText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
