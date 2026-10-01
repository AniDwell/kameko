import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, TextInput, FlatList, ActivityIndicator, Alert } from 'react-native';
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

export default function Profiles({ user, onSelectProfile }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [manageMode, setManageMode] = useState(false);
  
  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState(null);
  const [tempName, setTempName] = useState('');
  const [tempAvatar, setTempAvatar] = useState('pfp1.jpg');

  useEffect(() => {
    if (!user) return;
    
    // Listen to sub-collection: users/{uid}/profiles
    const subscriber = firestore()
      .collection('users')
      .doc(user.uid)
      .collection('profiles')
      .onSnapshot(querySnapshot => {
        const fetchedProfiles = [];
        querySnapshot.forEach(documentSnapshot => {
          fetchedProfiles.push({
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          });
        });
        
        setProfiles(fetchedProfiles);
        setLoading(false);

        // Auto-open create modal if no profiles exist
        if (fetchedProfiles.length === 0 && !loading) {
          openCreateModal();
        }
      }, error => {
        console.error(error);
        setLoading(false);
      });

    return () => subscriber();
  }, [user]);

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
      Alert.alert('Error', 'Please enter a profile name.');
      return;
    }

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
        }
      }
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#E50914" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Who's watching?</Text>

      <View style={styles.grid}>
        {profiles.map((profile) => (
          <TouchableOpacity 
            key={profile.id} 
            style={styles.profileItem}
            onPress={() => manageMode ? openEditModal(profile) : onSelectProfile(profile)}
          >
            <View>
              <Image source={AVATARS[profile.avatar]} style={styles.avatar} />
              {manageMode && <View style={styles.editOverlay}><Text style={styles.editIcon}>✎</Text></View>}
            </View>
            <Text style={styles.profileName}>{profile.name}</Text>
          </TouchableOpacity>
        ))}

        {profiles.length < 5 && (
          <TouchableOpacity style={styles.profileItem} onPress={openCreateModal}>
            <View style={styles.addAvatar}><Text style={styles.addIcon}>+</Text></View>
            <Text style={styles.profileName}>Add Profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {profiles.length > 0 && (
        <TouchableOpacity style={styles.manageBtn} onPress={() => setManageMode(!manageMode)}>
          <Text style={styles.manageBtnText}>{manageMode ? 'Done' : 'Manage Profiles'}</Text>
        </TouchableOpacity>
      )}

      {/* CREATE / EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalBg}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{editId ? 'Edit Profile' : 'Add Profile'}</Text>
            
            <View style={styles.avatarList}>
              {Object.keys(AVATARS).map((imgKey) => (
                <TouchableOpacity key={imgKey} onPress={() => setTempAvatar(imgKey)}>
                  <Image 
                    source={AVATARS[imgKey]} 
                    style={[styles.smallAvatar, tempAvatar === imgKey && styles.selectedAvatar]} 
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="Profile Name"
              placeholderTextColor="#888"
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
  headerTitle: { color: '#ffffff', fontSize: 24, fontWeight: 'bold', marginBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, paddingHorizontal: 20 },
  profileItem: { alignItems: 'center', marginHorizontal: 10, marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#1a1a1a' },
  addAvatar: { width: 100, height: 100, borderRadius: 8, borderWidth: 1, borderColor: '#555', justifyContent: 'center', alignItems: 'center' },
  addIcon: { color: '#555', fontSize: 40 },
  editOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  editIcon: { color: '#ffffff', fontSize: 24 },
  profileName: { color: '#888', marginTop: 10, fontSize: 16 },
  manageBtn: { marginTop: 40, paddingVertical: 10, paddingHorizontal: 20, borderWidth: 1, borderColor: '#888' },
  manageBtnText: { color: '#888', fontSize: 16, letterSpacing: 2, textTransform: 'uppercase' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: '#1a1a1a', borderRadius: 10, padding: 20 },
  modalTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  avatarList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 20 },
  smallAvatar: { width: 60, height: 60, borderRadius: 8, opacity: 0.5 },
  selectedAvatar: { opacity: 1, borderWidth: 2, borderColor: '#ffffff' },
  input: { backgroundColor: '#333', color: '#fff', height: 50, borderRadius: 5, paddingHorizontal: 15, marginBottom: 20 },
  modalActions: { flexDirection: 'row', alignItems: 'center' },
  cancelBtn: { padding: 10, marginRight: 15 },
  cancelBtnText: { color: '#ffffff', fontSize: 16 },
  saveBtn: { backgroundColor: '#ffffff', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 5 },
  saveBtnText: { color: '#000000', fontSize: 16, fontWeight: 'bold' },
  deleteBtn: { padding: 10 },
  deleteBtnText: { color: '#E50914', fontSize: 16, fontWeight: 'bold' }
});
