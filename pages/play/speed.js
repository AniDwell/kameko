import React from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView 
} from 'react-native';
import Slider from '@react-native-community/slider';

const BRAND_RED = '#E50914';

export default function SpeedSheet({ 
  activeMenu, 
  setActiveMenu, 
  playbackSpeed, 
  setPlaybackSpeed, 
  videoRef 
}) {
  if (activeMenu !== 'speed') return null;

  const speedPresets = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const handleSpeedChange = (val) => {
    const rounded = Math.round(val * 100) / 100;
    setPlaybackSpeed(rounded);
    if (videoRef?.current) {
      videoRef.current.setRateAsync(rounded, true);
    }
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
          <Text style={styles.ssLabel}>Playback Speed</Text>
          <Text style={styles.ssValText}>{playbackSpeed.toFixed(2)}x</Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={0.25}
          maximumValue={2.0}
          step={0.05}
          value={playbackSpeed}
          minimumTrackTintColor={BRAND_RED}
          maximumTrackTintColor="rgba(255,255,255,0.2)"
          thumbTintColor="#FFF"
          onValueChange={handleSpeedChange}
        />

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.presetsRow}
        >
          {speedPresets.map((s) => {
            const isActive = playbackSpeed === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.pillBtn, isActive && styles.pillBtnActive]}
                onPress={() => handleSpeedChange(s)}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                  {s.toFixed(2)}x
                </Text>
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
    backgroundColor: 'rgba(0,0,0,0.55)', 
    zIndex: 50 
  },
  sheetSurface: { 
    position: 'absolute', 
    bottom: 0, 
    alignSelf: 'center', 
    width: '100%', 
    maxWidth: 580, 
    backgroundColor: '#121212', 
    borderTopLeftRadius: 28, 
    borderTopRightRadius: 28, 
    paddingHorizontal: 28, 
    paddingTop: 24,
    paddingBottom: 28,
    zIndex: 60, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 8 
  },
  ssLabel: { 
    color: '#FFF', 
    fontSize: 18, 
    fontWeight: '700' 
  },
  ssValText: { 
    color: BRAND_RED, 
    fontSize: 18, 
    fontWeight: '800' 
  },
  slider: { 
    width: '100%', 
    height: 36, 
    marginVertical: 12 
  },
  presetsRow: { 
    flexDirection: 'row', 
    gap: 10, 
    paddingVertical: 4 
  },
  pillBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 8, 
    backgroundColor: '#1E1E1E' 
  },
  pillBtnActive: { 
    backgroundColor: BRAND_RED 
  },
  pillText: { 
    color: 'rgba(255,255,255,0.7)', 
    fontSize: 14, 
    fontWeight: '600' 
  },
  pillTextActive: { 
    color: '#FFF', 
    fontWeight: '800' 
  },
});
