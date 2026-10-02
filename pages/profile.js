import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, Modal, 
  TextInput, ActivityIndicator, Animated, Easing, BackHandler 
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Svg, { Path } from 'react-native-svg';

const BRAND_RED = '#E50914';

const AVATARS = {
  'pfp1.jpg': require('../assets/pfp1.jpg'),
  'pfp2.jpg': require('../assets/pfp2.jpg'),
  'pfp3.jpg': require('../assets/pfp3.jpg'),
  'pfp4.jpg': require('../assets/pfp4.jpg'),
  'pfp5.jpg': require('../assets/pfp5.jpg'),
  'pfp6.jpg': require('../assets/pfp6.jpg'),
};

// --- CUSTOM SVG ICONS ---
const IconPlus = ({ size = 42, color = "#888888" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);

const IconEdit = ({ size = 26, color = "#FFFFFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

// --- MARQUEE TEXT FOR LONG PROFILE NAMES ---
const MarqueeName = ({ name }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const isLong = name.length > 9;

  useEffect(() => {
    if (isLong) {
      Animated.loop(
        Animated.sequence([
          Animated.delay(1200),
          Animated.timing(scrollX, { 
            toValue: -55, 
            duration: 3500, 
            easing: Easing.linear, 
            useNativeDriver: true 
          }),
          Animated.delay(1000),
          Animated.timing(scrollX, { 
            toValue: 0, 
            duration: 3500, 
            easing: Easing.linear, 
            useNativeDriver: true 
          })
        ])
      ).start();
    }
  }, [isLong, name]);

  if (!isLong) {
    return <Text style={styles.profileName} numberOfLines={1}>{name}</Text>;
  }

  return (
    <View style={styles.marqueeContainer}>
      <Animated.Text style={[styles.profileName, { transform: [{ translateX: scrollX }] }]} numberOfLines={1}>
        {name}
      </Animated.Text>
    </View>
  );
};

// --- ANIMATED PROFILE CARD ---
const AnimatedProfileCard = ({ profile, index, onPress, manageMode, isAddButton }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current; 
  const opacityAnim = useRef(new Animated.Value(0)).current; 
  const pressScale = useRef(new Animated.Value(1)).current; 

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, delay: index * 80, useNativeDriver: true })
    ]).start();
  }, []);

  const handlePressIn = () => Animated.spring(pressScale, { toValue: 0.94, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(pressScale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <TouchableOpacity 
      activeOpacity={0.88} 
      onPressIn={handlePressIn} 
      onPressOut={handlePressOut} 
      onPress={() => onPress(profile)}
      style={styles.profileItem}
    >
      <Animated.View style={[{ opacity: opacityAnim, transform: [{ scale: scaleAnim }, { scale: pressScale }] }]}>
        <View style={styles.avatarWrapper}>
          {isAddButton ? (
            <View style={styles.addAvatar}>
              <IconPlus />
            </View>
          ) : (
            <Image source={AVATARS[profile.avatar]} style={styles.avatar} resizeMode="cover" />
          )}

          {manageMode && !isAddButton && (
            <View style={styles.editOverlay}>
              <IconEdit />
            </View>
          )}
        </View>
        <MarqueeName name={isAddButton ? 'Add Profile' : profile.name} />
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- CUSTOM CSS-STYLE ALERT MODAL ---
const CustomAlert = ({ visible, title, message, onConfirm, onCancel, isDestructive }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 45, useNativeDriver: true })
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none">
      <View style={styles.alertOverlay}>
        <Animated.View style={[styles.alertBox, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.alertTitle}>{title}</Text>
          <Text style={styles.alertMessage}>{message}</Text>
          <View style={styles.alertActions}>
            {onCancel && (
              <TouchableOpacity style={styles.alertBtnCancel} onPress={onCancel} activeOpacity={0.7}>
                <Text style={styles.alertBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.alertBtnConfirm, isDestructive && { backgroundColor: BRAND_RED }]} 
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.alertBtnTextConfirm}>{isDestructive ? 'Delete' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default function Profiles({ user, onSelectProfile, onHardwareBack }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manageMode, setManageMode] = useState(false);
  
  // Profile Editor Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [tempAvatar, setTempAvatar] = useState('pfp1.jpg');

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({ 
    visible: false, 
    title: '', 
    message: '', 
    onConfirm: null, 
    onCancel: null, 
    isDestructive: false 
  });

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(-16)).current;

  // --- HARDWARE BACK BUTTON HANDLER ---
  useEffect(() => {
    const backAction = () => {
      // 1. If an alert or modal is currently visible, close it first
      if (modalVisible) {
        setModalVisible(false);
        return true;
      }
      if (alertConfig.visible) {
        setAlertConfig(prev => ({ ...prev, visible: false }));
        return true;
      }

      // 2. If user accessed this screen from home.js (previousProfile exists), return back to home.js
      if (onHardwareBack) {
        onHardwareBack();
        return true;
      }

      // 3. MANDATORY INITIAL LAUNCH:
      // onHardwareBack is null/undefined. The user MUST select a profile to enter home.js.
      // Returning true blocks the Android back key from popping or skipping to home.js.
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [onHardwareBack, modalVisible, alertConfig.visible]);

  // --- FIRESTORE SUBSCRIPTION ---
  useEffect(() => {
    if (!user) return;
    const subscriber = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('profiles')
      .onSnapshot(querySnapshot => {
        const fetchedProfiles = [];
        querySnapshot?.forEach(doc => fetchedProfiles.push({ id: doc.id, ...doc.data() }));
        
        setProfiles(fetchedProfiles);
        setLoading(false);

        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 550, useNativeDriver: true }),
          Animated.timing(titleTranslateY, { toValue: 0, duration: 550, easing: Easing.out(Easing.exp), useNativeDriver: true })
        ]).start();

        if (fetchedProfiles.length === 0 && !loading) {
          openCreateModal();
        }
      }, error => {
        console.error("Profiles fetch error:", error);
        setLoading(false);
      });

    return () => subscriber();
  }, [user, loading]);

  const showAlert = (title, message, onConfirm, onCancel = null, isDestructive = false) => {
    setAlertConfig({ 
      visible: true, 
      title, 
      message, 
      onConfirm: () => { 
        setAlertConfig(prev => ({ ...prev, visible: false })); 
        if (onConfirm) onConfirm(); 
      }, 
      onCancel: onCancel ? () => { 
        setAlertConfig(prev => ({ ...prev, visible: false })); 
        onCancel(); 
      } : null, 
      isDestructive 
    });
  };

  const openCreateModal = () => { 
    setEditId(null); 
    setTempName(''); 
    setTempAvatar('pfp1.jpg'); 
    setModalVisible(true); 
  };

  const openEditModal = (profile) => { 
    setEditId(profile.id); 
    setTempName(profile.name); 
    setTempAvatar(profile.avatar); 
    setModalVisible(true); 
  };

  const saveProfile = async () => {
    if (tempName.trim() === '') {
      return showAlert('Required', 'Please enter a profile name.', () => {});
    }
    
    // Instantly close popup for seamless UX
    setModalVisible(false);

    try {
      const profileRef = firestore().collection('users').doc(user.uid).collection('profiles');
      if (editId) {
        await profileRef.doc(editId).update({ name: tempName.trim(), avatar: tempAvatar });
      } else {
        await profileRef.add({ 
          name: tempName.trim(), 
          avatar: tempAvatar, 
          createdAt: firestore.FieldValue.serverTimestamp() 
        });
      }
    } catch (error) { 
      showAlert('Error', error.message, () => {}); 
    }
  };

  const deleteProfile = (id) => {
    showAlert(
      'Delete Profile', 
      'Are you sure you want to remove this profile? All personalized watch progress will be cleared.',
      async () => {
        setModalVisible(false);
        try {
          await firestore().collection('users').doc(user.uid).collection('profiles').doc(id).delete();
        } catch (e) {
          showAlert('Error', 'Failed to remove profile.', () => {});
        }
      },
      () => {}, 
      true
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND_RED} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      
      {/* Kameko Red Top Header Logo */}
      <View style={styles.logoHeader}>
        <Text style={styles.logoText}>KAMEKO</Text>
      </View>

      <Animated.Text style={[styles.headerTitle, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}>
        Who's watching?
      </Animated.Text>

      <View style={styles.grid}>
        {profiles.map((profile, index) => (
          <AnimatedProfileCard 
            key={profile.id} 
            profile={profile} 
            index={index} 
            manageMode={manageMode} 
            onPress={(p) => manageMode ? openEditModal(p) : onSelectProfile(p)} 
          />
        ))}

        {profiles.length < 5 && (
          <AnimatedProfileCard 
            key="add-btn" 
            isAddButton={true} 
            index={profiles.length} 
            onPress={openCreateModal} 
          />
        )}
      </View>

      {profiles.length > 0 && (
        <Animated.View style={{ opacity: titleOpacity }}>
          <TouchableOpacity 
            style={[styles.manageBtn, manageMode && styles.manageBtnActive]} 
            onPress={() => setManageMode(!manageMode)} 
            activeOpacity={0.7}
          >
            <Text style={[styles.manageBtnText, manageMode && styles.manageBtnTextActive]}>
              {manageMode ? 'Done' : 'Manage Profiles'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* MODAL: ADD / EDIT PROFILE */}
      <Modal visible={modalVisible} animationType="fade" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{editId ? 'Edit Profile' : 'Add Profile'}</Text>
            
            <View style={styles.avatarList}>
              {Object.keys(AVATARS).map((imgKey) => (
                <TouchableOpacity key={imgKey} onPress={() => setTempAvatar(imgKey)} activeOpacity={0.8}>
                  <Image source={AVATARS[imgKey]} style={[styles.smallAvatar, tempAvatar === imgKey && styles.selectedAvatar]} />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput 
              style={styles.input} 
              placeholder="Profile Name" 
              placeholderTextColor="#666666" 
              value={tempName} 
              onChangeText={setTempName} 
              maxLength={24} 
              selectionColor={BRAND_RED}
            />

            <View style={styles.modalActions}>
              {editId && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProfile(editId)} activeOpacity={0.7}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PURE NATIVE CSS-STYLE ALERT COMPONENT */}
      <CustomAlert {...alertConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  
  logoHeader: { position: 'absolute', top: 52, width: '100%', alignItems: 'center' },
  logoText: { color: BRAND_RED, fontSize: 26, fontWeight: '900', letterSpacing: 2 },

  headerTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 35, letterSpacing: 0.4 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, paddingHorizontal: 20 },
  profileItem: { alignItems: 'center', marginHorizontal: 8, marginBottom: 18, width: 104 },
  
  avatarWrapper: { 
    width: 104, 
    height: 104, 
    borderRadius: 10, 
    overflow: 'hidden', 
    backgroundColor: '#161616', 
    elevation: 8, 
    shadowColor: '#000000', 
    shadowOpacity: 0.5, 
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  avatar: { width: '100%', height: '100%' },
  addAvatar: { width: '100%', height: '100%', borderWidth: 1.5, borderColor: '#333333', justifyContent: 'center', alignItems: 'center', backgroundColor: '#111111' },
  
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center' },
  
  marqueeContainer: { width: 104, overflow: 'hidden', marginTop: 10 },
  profileName: { color: '#B3B3B3', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  
  manageBtn: { 
    marginTop: 38, 
    paddingVertical: 10, 
    paddingHorizontal: 22, 
    borderWidth: 1, 
    borderColor: '#444444', 
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.4)'
  },
  manageBtnActive: { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.1)' },
  manageBtnText: { color: '#888888', fontSize: 14, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 'bold' },
  manageBtnTextActive: { color: '#FFFFFF' },

  // Editor Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '88%', backgroundColor: '#141414', borderRadius: 14, padding: 22, borderWidth: 1, borderColor: '#262626', elevation: 20 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 20, textAlign: 'center', letterSpacing: 0.5 },
  avatarList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 22 },
  smallAvatar: { width: 60, height: 60, borderRadius: 8, opacity: 0.35 },
  selectedAvatar: { opacity: 1, borderWidth: 2, borderColor: '#FFFFFF' },
  input: { 
    backgroundColor: '#0A0A0A', 
    color: '#FFFFFF', 
    height: 52, 
    borderRadius: 6, 
    paddingHorizontal: 14, 
    marginBottom: 22, 
    fontSize: 15, 
    borderWidth: 1, 
    borderColor: '#2C2C2C' 
  },
  modalActions: { flexDirection: 'row', alignItems: 'center' },
  cancelBtn: { padding: 10, marginRight: 8 },
  cancelBtnText: { color: '#AAAAAA', fontSize: 15, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 22, borderRadius: 4 },
  saveBtnText: { color: '#000000', fontSize: 15, fontWeight: 'bold' },
  deleteBtn: { padding: 10 },
  deleteBtnText: { color: BRAND_RED, fontSize: 15, fontWeight: 'bold' },

  // Custom Alert
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  alertBox: { width: '82%', backgroundColor: '#1C1C1C', borderRadius: 12, padding: 22, borderWidth: 1, borderColor: '#303030', elevation: 15 },
  alertTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  alertMessage: { color: '#AAAAAA', fontSize: 13, lineHeight: 19, marginBottom: 22 },
  alertActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  alertBtnCancel: { paddingVertical: 9, paddingHorizontal: 14 },
  alertBtnTextCancel: { color: '#AAAAAA', fontSize: 14, fontWeight: 'bold' },
  alertBtnConfirm: { backgroundColor: '#FFFFFF', paddingVertical: 9, paddingHorizontal: 18, borderRadius: 4 },
  alertBtnTextConfirm: { color: '#000000', fontSize: 14, fontWeight: 'bold' }
});
