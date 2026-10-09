import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const BRAND_RED = '#E50914';

const IconLock = ({ size = 24, locked = false }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={locked ? BRAND_RED : "#FFFFFF"}>
    {locked ? (
      <Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
    ) : (
      <Path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h2c0-1.66 1.34-3 3-3s3 1.34 3 3v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z" />
    )}
  </Svg>
);

export default function LockButton({ 
  isLocked, 
  setIsLocked, 
  uiOpacity, 
  setShowUI, 
  hideUITimeout 
}) {
  const toggleLock = () => {
    const nextState = !isLocked;
    setIsLocked(nextState);

    if (nextState) {
      if (hideUITimeout?.current) {
        clearTimeout(hideUITimeout.current);
      }
      Animated.timing(uiOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        if (setShowUI) setShowUI(false);
      });
    } else {
      if (setShowUI) setShowUI(true);
      Animated.timing(uiOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <TouchableOpacity 
      onPress={toggleLock} 
      style={styles.iconBtn}
      activeOpacity={0.7}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <IconLock locked={isLocked} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    padding: 0,
    opacity: 0.9,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
