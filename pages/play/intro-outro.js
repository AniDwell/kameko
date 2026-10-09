import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';

export default function SkipIntroOutro({ status, videoRef, introData, isLocked }) {
  const [showSkip, setShowSkip] = useState(false);
  const opacityAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (!status.isLoaded || !introData || introData.end <= 0 || isLocked) {
      setShowSkip(false);
      return;
    }

    const currentSecs = Math.floor((status.positionMillis || 0) / 1000);
    const shouldShow = currentSecs >= introData.start && currentSecs < introData.end;

    if (shouldShow && !showSkip) {
      setShowSkip(true);
      Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (!shouldShow && showSkip) {
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowSkip(false));
    }
  }, [status.positionMillis, introData, isLocked]);

  if (!showSkip) return null;

  return (
    <Animated.View style={[styles.skipRectContainer, { opacity: opacityAnim }]} pointerEvents="box-none">
      <TouchableOpacity 
        onPress={() => videoRef.current?.setPositionAsync(introData.end * 1000)}
        style={styles.skipRectBtn}
        activeOpacity={0.8}
      >
        <Text style={styles.skipRectText}>Skip Intro</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skipRectContainer: {
    position: 'absolute',
    right: 24,
    bottom: 85,
    zIndex: 45,
  },
  skipRectBtn: {
    backgroundColor: 'rgba(20, 20, 20, 0.85)',
    borderColor: 'rgba(255,255,255,0.4)',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  skipRectText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
