import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  Modal, 
  TextInput, 
  ActivityIndicator, 
  Alert,
  Animated,
  Easing
} from 'react-native';
import firestore from '@react-native-firebase/firestore';

// Map the string names to the actual local files
const AVATARS = {
  'pfp1.jpg': require('../assets/pfp1.jpg'),
  'pfp2.jpg': require('../assets/pfp2.jpg'),
  'pfp3.jpg': require('../assets/pfp3.jpg'),
  'pfp4.jpg': require('../assets/pfp4.jpg'),
  'pfp5.jpg': require('../assets/pfp5.jpg'),
  'pfp6.jpg': require('../assets/pfp6.jpg'),
};

// --- ANIMATED INDIVIDUAL PROFILE CARD ---
const AnimatedProfileCard = ({ profile, index, onPress, manageMode, isAddButton }) => {
  const scaleAnim = useRef(new Animated.Value(0)).current; // Entrance scale
  const opacityAnim = useRef(new Animated.Value(0)).current; // Entrance opacity
  const pressScale = useRef(new Animated.Value(1)).current; // Tap bounce effect

  useEffect(() => {
    // Staggered entrance animation
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100, // Each profile loads 100ms after the previous one
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        delay: index * 100,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.9, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={() => onPress(profile)}
    >
      <Animated.View style={[styles.profileItem, { opacity: opacityAnim, transform: [{ scale: scaleAnim }, { scale: pressScale }] }]}>
        <View>
          {isAddButton ? (
            <View style={styles.addAvatar}><Text style={styles.addIcon}>+</Text></View>
          ) : (
            <Image source={AVATARS[profile.avatar]} style={styles.avatar} />
          )}
          {manageMode && !isAddButton && <View style={styles.editOverlay}><Text style={styles.editIcon}>✎</Text></View>}
        </View>
        <Text style={styles.profileName}>{isAddButton ? 'Add Profile' : profile.name}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- MAIN PROFILES COMPONENT ---
export default function Profiles({ user, onSelectProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manageMode, setManageMode] = useState(false);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [tempAvatar, setTempAvatar] = useState('pfp1.jpg');

  // Entrance Title Animation
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (!user) return;
    
    const subscriber = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('profiles')
      .onSnapshot(querySnapshot => {
        const fetchedProfiles = [];
        querySnapshot.forEach(documentSnapshot => {
          fetchedProfiles.push({ id: documentSnapshot.id, ...documentSnapshot.data() });
        });
        
        setProfiles(fetchedProfiles);
        setLoading(false);

        // Animate Title when loading finishes
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
    if (tempName.trim() === '') return Alert.alert('Error', 'Please enter a profile name.');
    try {
      const profileRef = firestore().collection('users').doc(user.uid).collection('profiles');
      if (editId) {
        await profileRef.doc(editId).update({ name: tempName, avatar: tempAvatar });
      } else {
        await profileRef.add({ name: tempName, avatar: tempAvatar, createdAt: firestore.FieldValue.serverTimestamp() });
      }
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const deleteProfile = async (id) => {
    Alert.alert('Delete Profile', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          await firestore().collection('users').doc(user.uid).collection('profiles').doc(id).delete();
          setModalVisible(false);
        }}
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#E50914" /></View>;
  }

  return (
    <View style={styles.container}>
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
          <TouchableOpacity style={styles.manageBtn} onPress={() => setManageMode(!manageMode)}>
            <Text style={styles.manageBtnText}>{manageMode ? 'Done' : 'Manage Profiles'}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{editId ? 'Edit Profile' : 'Add Profile'}</Text>
            
            <View style={styles.avatarList}>
              {Object.keys(AVATARS).map((imgKey) => (
                <TouchableOpacity key={imgKey} onPress={() => setTempAvatar(imgKey)}>
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
              maxLength={15}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 40, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, paddingHorizontal: 20 },
  profileItem: { alignItems: 'center', marginHorizontal: 10, marginBottom: 20 },
  avatar: { width: 105, height: 105, borderRadius: 10, backgroundColor: '#1a1a1a' },
  addAvatar: { width: 105, height: 105, borderRadius: 10, borderWidth: 1.5, borderColor: '#444', justifyContent: 'center', alignItems: 'center' },
  addIcon: { color: '#666', fontSize: 45, fontWeight: '300', marginTop: -5 },
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  editIcon: { color: '#ffffff', fontSize: 28 },
  profileName: { color: '#AAAAAA', marginTop: 12, fontSize: 16, fontWeight: '600' },
  manageBtn: { marginTop: 45, paddingVertical: 12, paddingHorizontal: 24, borderWidth: 1, borderColor: '#555', borderRadius: 4 },
  manageBtnText: { color: '#888', fontSize: 16, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 'bold' },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: '#161616', borderRadius: 14, padding: 25, borderWidth: 1, borderColor: '#262626' },
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
  deleteBtnText: { color: '#E50914', fontSize: 16, fontWeight: 'bold' }
});
