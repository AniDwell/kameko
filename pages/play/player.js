import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  Dimensions, ActivityIndicator, StatusBar, BackHandler,
  TouchableWithoutFeedback
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { FontAwesome5 } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BRAND_RED = '#E50914';

// Worker Proxy to bypass ISP and Inject Referer Headers safely
const CUSTOM_PROXY_URL = 'https://icy-wave-30d8.prashant-yash69.workers.dev/proxy?url=';

export default function Player({ route, navigation }) {
  // Receives all precise data from play.js
  const { 
    streamUrl, 
    referer = 'https://vidwish.live/', 
    subtitles = [],
    animeTitle = 'Unknown', 
    episodeNum = 1, 
    episodeTitle = '', 
    animeId = null,
    userUid = null
  } = route?.params || {};

  const videoRef = useRef(null);
  const uiOpacity = useRef(new Animated.Value(1)).current;
  
  const [status, setStatus] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  const [showSkipIndicator, setShowSkipIndicator] = useState(null); 
  
  const hideUITimeout = useRef(null);
  const lastTapRef = useRef(0);

  // 1. Construct Safe Proxied URI
  const proxiedUri = streamUrl 
    ? `${CUSTOM_PROXY_URL}${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(referer)}`
    : null;

  // 2. Hardware Back & Status Bar Handling (Orientation Lock Removed)
  useEffect(() => {
    StatusBar.setHidden(true);
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleClosePlayer);

    return () => {
      StatusBar.setHidden(false);
      backHandler.remove();
    };
  }, []);

  const handleClosePlayer = async () => {
    navigation.goBack();
    return true;
  };

  // 3. Firebase Progress Synchronization
  useEffect(() => {
    if (!userUid || !animeId || !status.isPlaying) return;
    
    const currentSecs = Math.floor((status.positionMillis || 0) / 1000);
    const durationSecs = Math.floor((status.durationMillis || 1) / 1000);
    
    if (currentSecs > 0 && currentSecs % 10 === 0) {
      const isCompleted = currentSecs > (durationSecs * 0.85);
      
      firestore().collection('users').doc(userUid).collection('progress').doc(String(animeId)).set({
        animeId: String(animeId),
        lastWatchedEp: episodeNum,
        progress: currentSecs,
        duration: durationSecs,
        finishedEp: isCompleted,
        timestamp: Date.now()
      }, { merge: true }).catch(err => console.log('Firebase Save Error:', err));
    }
  }, [Math.floor((status.positionMillis || 0) / 10000)]);

  // 4. Auto-Hide Engine
  const resetHideTimer = () => {
    setShowUI(true);
    Animated.timing(uiOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    
    if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
    
    hideUITimeout.current = setTimeout(() => {
      if (status.isPlaying) {
        Animated.timing(uiOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => setShowUI(false));
      }
    }, 4000);
  };

  useEffect(() => {
    if (status.isPlaying) resetHideTimer();
    else {
      if (hideUITimeout.current) clearTimeout(hideUITimeout.current);
      setShowUI(true);
      Animated.timing(uiOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [status.isPlaying]);

  // 5. Gesture Engine (Double Tap to Skip)
  const handleTouchOverlay = (evt) => {
    const now = Date.now();
    const tapDelay = now - lastTapRef.current;
    lastTapRef.current = now;

    if (tapDelay < 300) {
      const touchX = evt.nativeEvent.locationX;
      const screenHalf = Dimensions.get('window').width / 2;
      
      if (touchX > screenHalf) {
        seekForward();
        triggerSkipIndicator('right');
      } else {
        seekBackward();
        triggerSkipIndicator('left');
      }
    } else {
      resetHideTimer();
    }
  };

  const triggerSkipIndicator = (direction) => {
    setShowSkipIndicator(direction);
    setTimeout(() => setShowSkipIndicator(null), 600);
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    status.isPlaying ? videoRef.current.pauseAsync() : videoRef.current.playAsync();
    resetHideTimer();
  };

  const seekBackward = async () => {
    if (!videoRef.current || !status.isLoaded) return;
    const newPos = Math.max(0, status.positionMillis - 10000);
    await videoRef.current.setPositionAsync(newPos);
    resetHideTimer();
  };

  const seekForward = async () => {
    if (!videoRef.current || !status.isLoaded) return;
    const newPos = Math.min(status.durationMillis, status.positionMillis + 10000);
    await videoRef.current.setPositionAsync(newPos);
    resetHideTimer();
  };

  const handleSliderValueChange = async (val) => {
    if (!videoRef.current || !status.isLoaded) return;
    await videoRef.current.setPositionAsync(val);
    resetHideTimer();
  };

  const toggleResizeMode = () => {
    setResizeMode(prev => prev === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN);
    resetHideTimer();
  };

  const formatTime = (millis) => {
    if (isNaN(millis)) return "00:00";
    const totalSecs = Math.floor(millis / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  };

  if (!proxiedUri) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-triangle" size={40} color={BRAND_RED} style={{marginBottom: 15}} />
        <Text style={styles.errorText}>Invalid Stream Data</Text>
        <TouchableOpacity style={styles.errorBtn} onPress={handleClosePlayer}>
          <Text style={styles.errorBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* NATIVE EXPO AV VIDEO ENGINE */}
      <Video
        ref={videoRef}
        style={styles.videoPlayer}
        source={{ uri: proxiedUri }}
        useNativeControls={false}
        resizeMode={resizeMode}
        onPlaybackStatusUpdate={status => {
          setStatus(status);
          if (status.isLoaded && !isReady) setIsReady(true);
        }}
        shouldPlay
      />

      {/* BUFFERING SPINNER */}
      {(!isReady || status.isBuffering) && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={BRAND_RED} />
        </View>
      )}

      {/* INVISIBLE GESTURE LAYER */}
      <TouchableWithoutFeedback onPress={handleTouchOverlay}>
        <View style={StyleSheet.absoluteFillObject} />
      </TouchableWithoutFeedback>

      {/* DOUBLE TAP ANIMATIONS */}
      {showSkipIndicator === 'left' && (
        <View style={styles.skipLeftInd}>
          <FontAwesome5 name="backward" size={30} color="#FFF" />
          <Text style={styles.skipText}>-10s</Text>
        </View>
      )}
      {showSkipIndicator === 'right' && (
        <View style={styles.skipRightInd}>
          <FontAwesome5 name="forward" size={30} color="#FFF" />
          <Text style={styles.skipText}>+10s</Text>
        </View>
      )}

      {/* UI OVERLAY LAYER */}
      <Animated.View 
        style={[styles.uiLayer, { opacity: uiOpacity }]} 
        pointerEvents={showUI ? 'auto' : 'none'}
      >
        
        {/* TOP BAR */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClosePlayer} style={styles.backBtn} hitSlop={{top:20, bottom:20, left:20, right:20}}>
            <FontAwesome5 name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.animeTitle}>{animeTitle}</Text>
            <Text style={styles.episodeTitle}>Episode {episodeNum} {episodeTitle ? `• ${episodeTitle}` : ''}</Text>
          </View>
        </View>

        {/* CENTER PLAY/PAUSE */}
        <View style={styles.centerControls} pointerEvents="box-none">
          <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
            <FontAwesome5 name={status.isPlaying ? "pause" : "play"} size={34} color="#FFF" style={!status.isPlaying && {marginLeft: 6}} />
          </TouchableOpacity>
        </View>

        {/* BOTTOM BAR */}
        <View style={styles.bottomBar}>
          <View style={styles.progressBarRow}>
            <Text style={styles.timeText}>{formatTime(status.positionMillis || 0)}</Text>
            
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={status.durationMillis || 100}
              value={status.positionMillis || 0}
              minimumTrackTintColor={BRAND_RED}
              maximumTrackTintColor="rgba(255,255,255,0.3)"
              thumbTintColor={BRAND_RED}
              onSlidingComplete={handleSliderValueChange}
              onSlidingStart={() => { if (hideUITimeout.current) clearTimeout(hideUITimeout.current); }}
            />
            
            <Text style={styles.timeText}>{formatTime(status.durationMillis || 0)}</Text>
          </View>
          
          <View style={styles.actionRow}>
            {/* Display Subtitle Count Icon if Subtitles are available */}
            {subtitles.length > 0 && (
              <TouchableOpacity style={styles.actionBtn}>
                <Text style={{color: BRAND_RED, fontSize: 10, fontWeight: '900', position: 'absolute', top: -5, right: 0}}>{subtitles.length}</Text>
                <FontAwesome5 name="closed-captioning" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.actionBtn}>
              <FontAwesome5 name="cog" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={toggleResizeMode}>
              <FontAwesome5 name={resizeMode === ResizeMode.CONTAIN ? "expand" : "compress"} size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoPlayer: { ...StyleSheet.absoluteFillObject },
  loaderContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  errorContainer: { flex: 1, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
  errorBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 6 },
  errorBtnText: { color: '#FFF', fontWeight: 'bold' },

  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.35)' },
  
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 25, paddingTop: 40, width: '100%', backgroundColor: 'rgba(0,0,0,0.6)' },
  backBtn: { marginRight: 20 },
  animeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  episodeTitle: { color: '#AAA', fontSize: 12, fontWeight: '600', marginTop: 2 },
  
  centerControls: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  playPauseBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  
  skipLeftInd: { position: 'absolute', left: 80, top: '45%', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 40 },
  skipRightInd: { position: 'absolute', right: 80, top: '45%', alignItems: 'center', zIndex: 5, backgroundColor: 'rgba(0,0,0,0.5)', padding: 15, borderRadius: 40 },
  skipText: { color: '#FFF', fontSize: 14, fontWeight: '900', marginTop: 5 },

  bottomBar: { width: '100%', paddingHorizontal: 30, paddingBottom: 35, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.7)' },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  timeText: { color: '#FFF', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  slider: { flex: 1, marginHorizontal: 15, height: 40 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 25 },
  actionBtn: { padding: 5, position: 'relative' }
});
