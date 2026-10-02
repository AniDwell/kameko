import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Animated, 
  Dimensions, ActivityIndicator, StatusBar, BackHandler
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { FontAwesome5 } from '@expo/vector-icons';
import Slider from '@react-native-community/slider'; // Ensure this is installed: npx expo install @react-native-community/slider

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BRAND_RED = '#E50914';

export default function Player({ route, navigation }) {
  // Destructure params passed from Play.js
  const { streamUrl, animeTitle, episodeNum, episodeTitle } = route?.params || {
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', // Fallback HLS stream
    animeTitle: 'Solo Leveling',
    episodeNum: 1,
    episodeTitle: "I'm Used to It"
  };

  const videoRef = useRef(null);
  const uiOpacity = useRef(new Animated.Value(1)).current;
  
  const [status, setStatus] = useState({});
  const [isReady, setIsReady] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [resizeMode, setResizeMode] = useState(ResizeMode.CONTAIN);
  
  const hideUITimeout = useRef(null);

  // 1. Force Landscape on Mount, Restore Portrait on Unmount
  useEffect(() => {
    async function lockScreen() {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      StatusBar.setHidden(true);
    }
    lockScreen();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleClosePlayer);

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
      StatusBar.setHidden(false);
      backHandler.remove();
    };
  }, []);

  const handleClosePlayer = async () => {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    navigation.goBack();
    return true;
  };

  // 2. UI Auto-Hide Logic
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

  // 3. Player Controls
  const togglePlayPause = () => {
    if (!videoRef.current) return;
    status.isPlaying ? videoRef.current.pauseAsync() : videoRef.current.playAsync();
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
  };

  const toggleResizeMode = () => {
    setResizeMode(prev => prev === ResizeMode.CONTAIN ? ResizeMode.COVER : ResizeMode.CONTAIN);
    resetHideTimer();
  };

  // 4. Time Formatter
  const formatTime = (millis) => {
    if (isNaN(millis)) return "00:00";
    const totalSecs = Math.floor(millis / 1000);
    const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const s = (totalSecs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={1} 
      onPress={resetHideTimer}
    >
      
      {/* NATIVE VIDEO ENGINE (EXPO AV) */}
      <Video
        ref={videoRef}
        style={styles.videoPlayer}
        source={{ uri: streamUrl }}
        useNativeControls={false}
        resizeMode={resizeMode}
        onPlaybackStatusUpdate={status => {
          setStatus(status);
          if (status.isLoaded && !isReady) setIsReady(true);
        }}
        shouldPlay
      />

      {/* LOADING SPINNER */}
      {(!isReady || status.isBuffering) && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={BRAND_RED} />
        </View>
      )}

      {/* UI OVERLAY LAYER */}
      <Animated.View 
        style={[styles.uiLayer, { opacity: uiOpacity }]} 
        pointerEvents={showUI ? 'auto' : 'none'}
      >
        
        {/* TOP BAR: Title & Back Button */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClosePlayer} style={styles.backBtn} hitSlop={{top:20, bottom:20, left:20, right:20}}>
            <FontAwesome5 name="arrow-left" size={20} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.animeTitle}>{animeTitle}</Text>
            <Text style={styles.episodeTitle}>EP {episodeNum}: {episodeTitle}</Text>
          </View>
        </View>

        {/* CENTER CONTROLS: Double Tap to Seek */}
        <View style={styles.centerControls}>
          <TouchableOpacity onPress={seekBackward} style={styles.seekZone} activeOpacity={0.6}>
            <View style={styles.seekIconWrap}>
              <FontAwesome5 name="backward" size={24} color="#FFF" />
              <Text style={styles.seekText}>10s</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={togglePlayPause} style={styles.playPauseBtn} activeOpacity={0.8}>
            <FontAwesome5 name={status.isPlaying ? "pause" : "play"} size={32} color="#FFF" style={!status.isPlaying && {marginLeft: 5}} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={seekForward} style={styles.seekZone} activeOpacity={0.6}>
            <View style={styles.seekIconWrap}>
              <FontAwesome5 name="forward" size={24} color="#FFF" />
              <Text style={styles.seekText}>10s</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* BOTTOM BAR: Progress & Actions */}
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
            />
            
            <Text style={styles.timeText}>{formatTime(status.durationMillis || 0)}</Text>
          </View>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn}>
              <FontAwesome5 name="closed-captioning" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <FontAwesome5 name="cog" size={20} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={toggleResizeMode}>
              <FontAwesome5 name={resizeMode === ResizeMode.CONTAIN ? "expand" : "compress"} size={18} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoPlayer: { ...StyleSheet.absoluteFillObject },
  
  loaderContainer: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  
  uiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.4)' },
  
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 25, paddingTop: 40, width: '100%', backgroundColor: 'rgba(0,0,0,0.5)' },
  backBtn: { marginRight: 20 },
  animeTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  episodeTitle: { color: '#AAA', fontSize: 12, fontWeight: '600', marginTop: 2 },
  
  centerControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  seekZone: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center' },
  seekIconWrap: { alignItems: 'center', opacity: 0.8 },
  seekText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginTop: 8 },
  
  playPauseBtn: { width: 75, height: 75, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', marginHorizontal: 60, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  
  bottomBar: { width: '100%', paddingHorizontal: 30, paddingBottom: 35, paddingTop: 20, backgroundColor: 'rgba(0,0,0,0.6)' },
  progressBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  timeText: { color: '#FFF', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  slider: { flex: 1, marginHorizontal: 15, height: 40 },
  
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 25 },
  actionBtn: { padding: 5 }
});
