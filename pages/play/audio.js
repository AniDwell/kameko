import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';

export default function AudioSheet({ activeMenu, setActiveMenu }) {
  if (activeMenu !== 'audio') return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setActiveMenu(null)} />
      <View style={styles.sheetSurface}>
        <Text style={styles.sheetHeaderTitle}>Audio Tracks</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={[styles.sheetItem, styles.sheetItemActive]}>
            <Text style={styles.sheetItemTextActive}>Default Audio (Japanese)</Text>
          </TouchableOpacity>
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
  sheetItemTextActive: { color: '#000', fontWeight: 'bold' },
});
