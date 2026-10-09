import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

const BRAND_RED = '#E50914';

export default function SubtitleSheet({ activeMenu, setActiveMenu, subtitlesEnabled, setSubtitlesEnabled, subSettings, setSubSettings }) {
  if (activeMenu !== 'subs') return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setActiveMenu(null)} />
      <View style={styles.sheetSurface}>
        <Text style={styles.sheetHeaderTitle}>Subtitles</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.sheetItem, !subtitlesEnabled && styles.sheetItemActive]} 
            onPress={() => { setSubtitlesEnabled(false); setActiveMenu(null); }}
          >
            <Text style={[styles.sheetItemText, !subtitlesEnabled && styles.sheetItemTextActive]}>Off</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.sheetItem, subtitlesEnabled && styles.sheetItemActive]} 
            onPress={() => { setSubtitlesEnabled(true); setActiveMenu(null); }}
          >
            <Text style={[styles.sheetItemText, subtitlesEnabled && styles.sheetItemTextActive]}>English (Default)</Text>
          </TouchableOpacity>

          <Text style={styles.subStyleLabel}>Color</Text>
          <View style={styles.colorPalette}>
            {['#FFFFFF', '#F47521', '#FACC15', '#4ADE80', '#60A5FA', '#EF4444'].map(c => (
              <TouchableOpacity 
                key={c} 
                onPress={() => setSubSettings(prev => ({ ...prev, color: c }))} 
                style={[styles.colorChip, { backgroundColor: c }, subSettings.color === c && styles.colorChipActive]} 
              />
            ))}
          </View>

          <Text style={styles.subStyleLabel}>Size</Text>
          <View style={styles.pillGroup}>
            {[12, 14, 16, 20].map(s => (
              <TouchableOpacity 
                key={s} 
                onPress={() => setSubSettings(prev => ({ ...prev, size: s }))} 
                style={[styles.pillBtn, subSettings.size === s && styles.pillBtnActive]}
              >
                <Text style={[styles.pillText, subSettings.size === s && styles.pillTextActive]}>{s}px</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50 },
  sheetSurface: { position: 'absolute', bottom: 0, alignSelf: 'center', width: '100%', maxWidth: 600, backgroundColor: '#121212', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%', zIndex: 60, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  sheetHeaderTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  sheetItem: { padding: 16, backgroundColor: '#1E1E1E', borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: 'transparent' },
  sheetItemActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  sheetItemText: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '500' },
  sheetItemTextActive: { color: '#000', fontWeight: 'bold' },
  subStyleLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 15, marginBottom: 8 },
  colorPalette: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  colorChip: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorChipActive: { borderColor: '#FFF' },
  pillGroup: { flexDirection: 'row', gap: 10 },
  pillBtn: { backgroundColor: '#1E1E1E', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  pillBtnActive: { backgroundColor: '#FFF', borderColor: '#FFF' },
  pillText: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500' },
  pillTextActive: { color: '#000', fontWeight: 'bold' },
});
