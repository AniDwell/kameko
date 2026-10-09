import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';

const BRAND_RED = '#E50914';

export default function VideoQualitySheet({ activeMenu, setActiveMenu, qualityList, selectedQuality, setSelectedQuality, setActiveUrl, currentAutoRes }) {
  if (activeMenu !== 'quality') return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setActiveMenu(null)} />
      <View style={styles.sheetSurface}>
        <Text style={styles.sheetHeaderTitle}>Video Quality</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity 
            style={[styles.sheetItem, selectedQuality === 'Auto' && styles.sheetItemActive]} 
            onPress={() => { setSelectedQuality('Auto'); setActiveMenu(null); }}
          >
            <Text style={[styles.sheetItemText, selectedQuality === 'Auto' && styles.sheetItemTextActive]}>
              Auto ({currentAutoRes})
            </Text>
          </TouchableOpacity>
          {qualityList.filter(q => q.label !== 'Auto').map((q, i) => (
            <TouchableOpacity 
              key={i} 
              style={[styles.sheetItem, selectedQuality === q.label && styles.sheetItemActive]} 
              onPress={() => { 
                setSelectedQuality(q.label); 
                setActiveUrl(q.uri);
                setActiveMenu(null); 
              }}
            >
              <Text style={[styles.sheetItemText, selectedQuality === q.label && styles.sheetItemTextActive]}>
                {q.label}
              </Text>
            </TouchableOpacity>
          ))}
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
});
