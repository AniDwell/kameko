
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Image, Modal, 
  TextInput, ActivityIndicator, Animated, Easing, ScrollView 
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
const IconPlus = ({ size = 45, color = "#777" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 5v14M5 12h14" />
  </Svg>
);
const IconEdit = ({ size = 28, color = "#FFF" }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Svg>
);

// --- MARQUEE TEXT FOR LONG NAMES ---
const MarqueeName = ({ name }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const isLong = name.length > 10;

  useEffect(() => {
    if (isLong) {
      Animated.loop(
        Animated.sequence([
          Animated.delay(1500),
          Animated.timing(scrollX, { toValue: -60, duration: 4000, easing: Easing.linear, useNativeDriver: true }),
          Animated.delay(1000),
          Animated.timing(scrollX, { toValue: 0, duration: 4000, easing: Easing.linear, useNativeDriver: true })
        ])
      ).start();
    }
  }, [isLong]);

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
      Animated.timing(opacityAnim, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 40, delay: index * 100, useNativeDriver: true })
    ]).start();
  }, []);

  const handlePressIn = () => Animated.spring(pressScale, { toValue: 0.92, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(pressScale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <TouchableOpacity 
      activeOpacity={0.9} 
      onPressIn={handlePressIn} 
      onPressOut={handlePressOut} 
      onPress={() => onPress(profile)}
      style={styles.profileItem}
    >
      <Animated.View style={[{ opacity: opacityAnim, transform: [{ scale: scaleAnim }, { scale: pressScale }] }]}>
        <View style={styles.avatarWrapper}>
          {isAddButton ? (
            <View style={styles.addAvatar}><IconPlus /></View>
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

// --- CUSTOM STYLED ALERT COMPONENT ---
const CustomAlert = ({ visible, title, message, onConfirm, onCancel, isDestructive }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 40, useNativeDriver: true })
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
              <TouchableOpacity style={styles.alertBtnCancel} onPress={onCancel}>
                <Text style={styles.alertBtnTextCancel}>Cancel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={[styles.alertBtnConfirm, isDestructive && { backgroundColor: BRAND_RED }]} 
              onPress={onConfirm}
            >
              <Text style={styles.alertBtnTextConfirm}>{isDestructive ? 'Delete' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};


export default function Profiles({ user, onSelectProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manageMode, setManageMode] = useState(false);
  
  // Editor Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [tempAvatar, setTempAvatar] = useState('pfp1.jpg');

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '', onConfirm: null, onCancel: null, isDestructive: false });

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (!user) return;
    const subscriber = firestore().collection('users').doc(user.uid).collection('profiles')
      .onSnapshot(querySnapshot => {
        const fetchedProfiles = [];
        querySnapshot.forEach(doc => fetchedProfiles.push({ id: doc.id, ...doc.data() }));
        
        setProfiles(fetchedProfiles);
        setLoading(false);

        Animated.parallel([
          Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(titleTranslateY, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true })
        ]).start();

        if (fetchedProfiles.length === 0 && !loading) {
          openCreateModal();
        }
      }, error => {
        console.error(error);
        setLoading(false);
      });
    return () => subscriber();
  }, [user, loading]);

  const showAlert = (title, message, onConfirm, onCancel = null, isDestructive = false) => {
    setAlertConfig({ visible: true, title, message, onConfirm: () => { setAlertConfig(prev => ({ ...prev, visible: false })); onConfirm(); }, onCancel: onCancel ? () => { setAlertConfig(prev => ({ ...prev, visible: false })); onCancel(); } : null, isDestructive });
  };

  const openCreateModal = () => { setEditId(null); setTempName(''); setTempAvatar('pfp1.jpg'); setModalVisible(true); };
  const openEditModal = (profile) => { setEditId(profile.id); setTempName(profile.name); setTempAvatar(profile.avatar); setModalVisible(true); };

  const saveProfile = async () => {
    if (tempName.trim() === '') return showAlert('Error', 'Please enter a profile name.', () => {});
    
    // Insta-close for fluid UX
    setModalVisible(false);

    try {
      const profileRef = firestore().collection('users').doc(user.uid).collection('profiles');
      if (editId) await profileRef.doc(editId).update({ name: tempName, avatar: tempAvatar });
      else await profileRef.add({ name: tempName, avatar: tempAvatar, createdAt: firestore.FieldValue.serverTimestamp() });
    } catch (error) { 
      showAlert('Error', error.message, () => {}); 
    }
  };

  const deleteProfile = (id) => {
    showAlert(
      'Delete Profile', 
      'Are you sure you want to delete this profile? This action cannot be undone.',
      async () => {
        setModalVisible(false);
        await firestore().collection('users').doc(user.uid).collection('profiles').doc(id).delete();
      },
      () => {}, 
      true // makes it red
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={BRAND_RED} /></View>;

  return (
    <View style={styles.container}>
      
      {/* KAMEKO Logo Top Header */}
      <View style={styles.logoHeader}>
        <Text style={styles.logoText}>KAMEKO</Text>
      </View>

      <Animated.Text style={[styles.headerTitle, { opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }]}>
        Who's watching?
      </Animated.Text>

      <View style={styles.grid}>
        {profiles.map((profile, index) => (
          <AnimatedProfileCard key={profile.id} profile={profile} index={index} manageMode={manageMode} onPress={(p) => manageMode ? openEditModal(p) : onSelectProfile(p)} />
        ))}
        {profiles.length < 5 && (
          <AnimatedProfileCard key="add-btn" isAddButton={true} index={profiles.length} onPress={openCreateModal} />
        )}
      </View>

      {profiles.length > 0 && (
        <Animated.View style={{ opacity: titleOpacity }}>
          <TouchableOpacity style={styles.manageBtn} onPress={() => setManageMode(!manageMode)} activeOpacity={0.7}>
            <Text style={[styles.manageBtnText, manageMode && styles.manageBtnTextActive]}>
              {manageMode ? 'Done' : 'Manage Profiles'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* NATIVE EDITOR MODAL */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
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
              placeholderTextColor="#777" 
              value={tempName} 
              onChangeText={setTempName} 
              maxLength={20} 
            />

            <View style={styles.modalActions}>
              {editId && (
                <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteProfile(editId)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* GLOBAL CUSTOM ALERT MODAL */}
      <CustomAlert {...alertConfig} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  
  logoHeader: { position: 'absolute', top: 50, width: '100%', alignItems: 'center' },
  logoText: { color: BRAND_RED, fontSize: 28, fontWeight: '900', letterSpacing: 2 },

  headerTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginBottom: 40, letterSpacing: 0.5 },
  
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, paddingHorizontal: 20 },
  profileItem: { alignItems: 'center', marginHorizontal: 10, marginBottom: 20, width: 105 },
  
  avatarWrapper: { width: 105, height: 105, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1A1A1A', elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 },
  avatar: { width: '100%', height: '100%' },
  addAvatar: { width: '100%', height: '100%', borderWidth: 2, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
  
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  
  marqueeContainer: { width: 105, overflow: 'hidden', marginTop: 12 },
  profileName: { color: '#AAAAAA', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  
  manageBtn: { marginTop: 45, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: '#555', borderRadius: 4 },
  manageBtnText: { color: '#888', fontSize: 16, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 'bold' },
  manageBtnTextActive: { color: '#FFF', borderColor: '#FFF' },

  // Editor Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: '#161616', borderRadius: 14, padding: 25, borderWidth: 1, borderColor: '#262626', elevation: 20 },
  modalTitle: { color: '#ffffff', fontSize: 22, fontWeight: 'bold', marginBottom: 25, textAlign: 'center' },
  avatarList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 25 },
  smallAvatar: { width: 65, height: 65, borderRadius: 8, opacity: 0.4 },
  selectedAvatar: { opacity: 1, borderWidth: 2, borderColor: '#ffffff' },
  input: { backgroundColor: '#111', color: '#fff', height: 55, borderRadius: 8, paddingHorizontal: 15, marginBottom: 25, fontSize: 16, borderWidth: 1, borderColor: '#333' },
  modalActions: { flexDirection: 'row', alignItems: 'center' },
  cancelBtn: { padding: 12, marginRight: 10 },
  cancelBtnText: { color: '#AAAAAA', fontSize: 16, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#ffffff', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 6 },
  saveBtnText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 12 },
  deleteBtnText: { color: BRAND_RED, fontSize: 16, fontWeight: 'bold' },

  // Custom Alert
  alertOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  alertBox: { width: '80%', backgroundColor: '#1E1E1E', borderRadius: 12, padding: 25, borderWidth: 1, borderColor: '#333', elevation: 15 },
  alertTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  alertMessage: { color: '#AAA', fontSize: 14, lineHeight: 20, marginBottom: 25 },
  alertActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
  alertBtnCancel: { paddingVertical: 10, paddingHorizontal: 15 },
  alertBtnTextCancel: { color: '#AAA', fontSize: 15, fontWeight: 'bold' },
  alertBtnConfirm: { backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 6 },
  alertBtnTextConfirm: { color: '#000', fontSize: 15, fontWeight: 'bold' }
});
