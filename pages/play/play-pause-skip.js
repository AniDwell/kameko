import React, { useRef, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  Animated, Dimensions, TouchableWithoutFeedback 
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// --- SVG ICONS MATCHING WEB PLAYER ---
const IconPlay = ({ size = 64 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
    <Path d="M8 5v14l11-7z" />
  </Svg>
);

const IconPause = ({ size = 64 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
    <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </Svg>
);

const IconBackward = ({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
    <Path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
  </Svg>
);

const IconForward = ({ size = 40 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF">
    <Path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z" />
  </Svg>
);

export default function PlayPauseSkip({
  status,
  videoRef,
  resetHideTimer,
  isLocked,
  uiOpacity,
  showUI,
  setShowUI,
  activeMenu,
  setActiveMenu,
  panHandlers = {}
}) {
  const [skipDirection, setSkipDirection] = useState(null);

  // Animation values for web-matching skip effects
  const leftAnim = useRef(new Animated.Value(0)).current;
  const rightAnim = useRef(new Animated.Value(0)).current;
  const rotateLeft = useRef(new Animated.Value(0)).current;
  const rotateRight = useRef(new Animated.Value(0)).current;

  const lastTapRef = useRef(0);
  const singleTapTimer = useRef(null);

  const togglePlayPause = () => {
    if (!videoRef?.current) return;
    if (status.isPlaying) {
      videoRef.current.pauseAsync();
    } else {
      videoRef.current.playAsync();
    }
    resetHideTimer();
  };

  const seekBy = async (seconds) => {
    if (!videoRef?.current || !status.isLoaded) return;
    const currentMs = status.positionMillis || 0;
    const durationMs = status.durationMillis || 0;
    const targetMs = Math.max(0, Math.min(durationMs, currentMs + seconds * 1000));
    await videoRef.current.setPositionAsync(targetMs);
    resetHideTimer();
  };

  const triggerLeftAnimation = () => {
    setSkipDirection('left');
    leftAnim.setValue(0);
    rotateLeft.setValue(0);

    Animated.parallel([
      Animated.timing(leftAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(rotateLeft, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => setSkipDirection(null));
  };

  const triggerRightAnimation = () => {
    setSkipDirection('right');
    rightAnim.setValue(0);
    rotateRight.setValue(0);

    Animated.parallel([
      Animated.timing(rightAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(rotateRight, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => setSkipDirection(null));
  };

  const handleTouch = (evt) => {
    if (activeMenu) {
      if (setActiveMenu) setActiveMenu(null);
      return;
    }

    const now = Date.now();
    const tapDelay = now - lastTapRef.current;
    lastTapRef.current = now;

    const touchX = evt.nativeEvent.locationX;
    const width = Dimensions.get('window').width || SCREEN_WIDTH;
    const leftThreshold = width * 0.35;
    const rightThreshold = width * 0.65;

    if (tapDelay < 300) {
      // Cancel pending single-tap toggle
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }

      if (isLocked) return;

      if (touchX < leftThreshold) {
        // Double-tap left zone -> -10s
        seekBy(-10);
        triggerLeftAnimation();
      } else if (touchX > rightThreshold) {
        // Double-tap right zone -> +10s
        seekBy(10);
        triggerRightAnimation();
      } else {
        // Double-tap center zone -> Toggle Play/Pause
        togglePlayPause();
      }
    } else {
      // Single-tap: Toggle UI overlay with a brief debounce
      singleTapTimer.current = setTimeout(() => {
        if (showUI) {
          Animated.timing(uiOpacity, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start(() => setShowUI(false));
        } else {
          resetHideTimer();
        }
      }, 280);
    }
  };

  // Rotation interpolations
  const spinBwd = rotateLeft.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  const spinFwd = rotateRight.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {/* FULLSCREEN TOUCH GESTURE LAYER */}
      <View {...panHandlers} style={StyleSheet.absoluteFillObject}>
        <TouchableWithoutFeedback onPress={handleTouch}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
      </View>

      {/* WEB-MATCHING SKIP ANIMATIONS */}
      {skipDirection === 'left' && !isLocked && (
        <View style={styles.skipLeftZone} pointerEvents="none">
          <Animated.View style={{ transform: [{ rotate: spinBwd }] }}>
            <IconBackward size={44} />
          </Animated.View>
          <Animated.Text
            style={[
              styles.floatText,
              {
                opacity: leftAnim.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: leftAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, -35],
                    }),
                  },
                ],
              },
            ]}
          >
            -10s
          </Animated.Text>
        </View>
      )}

      {skipDirection === 'right' && !isLocked && (
        <View style={styles.skipRightZone} pointerEvents="none">
          <Animated.View style={{ transform: [{ rotate: spinFwd }] }}>
            <IconForward size={44} />
          </Animated.View>
          <Animated.Text
            style={[
              styles.floatText,
              {
                opacity: rightAnim.interpolate({
                  inputRange: [0, 0.2, 0.8, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: rightAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 35],
                    }),
                  },
                ],
              },
            ]}
          >
            +10s
          </Animated.Text>
        </View>
      )}

      {/* CENTER PLAY/PAUSE/SKIP CONTROLS (WHEN UI IS ACTIVE) */}
      {!isLocked && (
        <Animated.View
          style={[styles.centerControls, { opacity: uiOpacity }]}
          pointerEvents={showUI ? 'box-none' : 'none'}
        >
          {/* Skip Back Button */}
          <TouchableOpacity
            style={styles.skipBtn}
            activeOpacity={0.75}
            onPress={() => {
              seekBy(-10);
              triggerLeftAnimation();
            }}
          >
            <IconBackward size={38} />
          </TouchableOpacity>

          {/* Center Play/Pause Button */}
          <TouchableOpacity
            style={styles.playPauseBtn}
            activeOpacity={0.85}
            onPress={togglePlayPause}
          >
            {status.isPlaying ? <IconPause size={56} /> : <IconPlay size={56} />}
          </TouchableOpacity>

          {/* Skip Forward Button */}
          <TouchableOpacity
            style={styles.skipBtn}
            activeOpacity={0.75}
            onPress={() => {
              seekBy(10);
              triggerRightAnimation();
            }}
          >
            <IconForward size={38} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerControls: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 48,
    zIndex: 15,
  },
  playPauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipLeftZone: {
    position: 'absolute',
    left: '18%',
    top: '42%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  skipRightZone: {
    position: 'absolute',
    right: '18%',
    top: '42%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 25,
  },
  floatText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
