import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Svg, { Path, Circle } from 'react-native-svg';

// Custom SVG Icons
const EyeIcon = ({ visible }) => (
  <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    {visible ? (
      <>
        <Path
          d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
          stroke="#AAAAAA"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="12" cy="12" r="3" stroke="#AAAAAA" strokeWidth="2" />
      </>
    ) : (
      <>
        <Path
          d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
          stroke="#888888"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M1 1l22 22" stroke="#E50914" strokeWidth="2" strokeLinecap="round" />
      </>
    )}
  </Svg>
);

const GoogleIcon = () => (
  <Svg width="20" height="20" viewBox="0 0 48 48">
    <Path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <Path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <Path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <Path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </Svg>
);

export default function Login({ setLoggedInUser }) {
  // Screen modes: 'login' | 'signup' | 'forgot'
  const [mode, setMode] = useState('login');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Top Loading Bar Animation
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    try {
      GoogleSignin.configure({
        scopes: ['email', 'profile'],
      });
    } catch (e) {
      console.log('GoogleSignin configuration check:', e);
    }
  }, []);

  useEffect(() => {
    if (loading) {
      progressAnim.setValue(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: false,
          }),
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      progressAnim.stopAnimation();
      progressAnim.setValue(0);
    }
  }, [loading]);

  const progressBarWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const handleAuth = async () => {
    if (mode === 'forgot') {
      if (!email.trim()) {
        Alert.alert('Error', 'Please enter your account email address.');
        return;
      }
      setLoading(true);
      try {
        await auth().sendPasswordResetEmail(email.trim());
        Alert.alert(
          'Email Sent',
          'Password reset instructions have been dispatched to your email.',
          [{ text: 'OK', onPress: () => setMode('login') }]
        );
      } catch (err) {
        Alert.alert('Reset Failed', err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please provide both email and password.');
      return;
    }

    if (mode === 'signup') {
      if (!username.trim()) {
        Alert.alert('Error', 'Please enter a username.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match. Please re-enter.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const userCredential = await auth().signInWithEmailAndPassword(
          email.trim(),
          password
        );
        setLoggedInUser(userCredential.user);
      } else {
        const userCredential = await auth().createUserWithEmailAndPassword(
          email.trim(),
          password
        );
        await userCredential.user.updateProfile({ displayName: username.trim() });
        setLoggedInUser(auth().currentUser);
      }
    } catch (error) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') msg = 'That email is already registered.';
      if (error.code === 'auth/invalid-email') msg = 'Invalid email address format.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password')
        msg = 'Incorrect email or password combination.';
      Alert.alert('Authentication Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult?.data?.idToken || signInResult?.idToken;

      if (!idToken) {
        throw new Error('Google Sign-In did not return an identity token.');
      }

      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);
      setLoggedInUser(userCredential.user);
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User dismissed the popup
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Another sign-in in flight
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Play Services Error', 'Google Play Services is not available or up to date.');
      } else {
        Alert.alert(
          'Google Sign-In',
          error.message || 'Unable to complete Google authentication.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Animated Loading Bar */}
      {loading && (
        <View style={styles.progressBarBackground}>
          <Animated.View style={[styles.progressBarFill, { width: progressBarWidth }]} />
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Banner */}
        <View style={styles.headerWrapper}>
          <Image
            source={require('../assets/kameko_header.png')}
            style={styles.headerImage}
            resizeMode="contain"
          />
          <Text style={styles.welcomeSubtitle}>Welcome to KAMEKO</Text>
        </View>

        {/* Card Form */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>
            {mode === 'login'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Reset Password'}
          </Text>

          {mode === 'signup' && (
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#777777"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#777777"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {mode !== 'forgot' && (
            <View style={styles.inputWrapperWithIcon}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Password"
                placeholderTextColor="#777777"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <EyeIcon visible={showPassword} />
              </TouchableOpacity>
            </View>
          )}

          {mode === 'signup' && (
            <View style={styles.inputWrapperWithIcon}>
              <TextInput
                style={styles.inputFlex}
                placeholder="Confirm password"
                placeholderTextColor="#777777"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <EyeIcon visible={showConfirmPassword} />
              </TouchableOpacity>
            </View>
          )}

          {mode === 'login' && (
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => setMode('forgot')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleAuth}
            disabled={loading}
          >
            <Text style={styles.primaryBtnText}>
              {mode === 'login'
                ? 'Sign In'
                : mode === 'signup'
                ? 'Create Account'
                : 'Send Recovery Email'}
            </Text>
          </TouchableOpacity>

          {mode !== 'forgot' && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.googleBtn, loading && styles.btnDisabled]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <GoogleIcon />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Mode Switchers */}
          <View style={styles.switchWrapper}>
            {mode === 'login' && (
              <TouchableOpacity onPress={() => setMode('signup')}>
                <Text style={styles.switchPrompt}>
                  New to Kameko?{' '}
                  <Text style={styles.switchAction}>Sign up now</Text>
                </Text>
              </TouchableOpacity>
            )}

            {mode === 'signup' && (
              <TouchableOpacity onPress={() => setMode('login')}>
                <Text style={styles.switchPrompt}>
                  Already have an account?{' '}
                  <Text style={styles.switchAction}>Sign In</Text>
                </Text>
              </TouchableOpacity>
            )}

            {mode === 'forgot' && (
              <TouchableOpacity onPress={() => setMode('login')}>
                <Text style={styles.switchAction}>← Return to Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  progressBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#222222',
    zIndex: 9999,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#E50914',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 36,
  },
  headerWrapper: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerImage: {
    width: 220,
    height: 60,
  },
  welcomeSubtitle: {
    color: '#EEEEEE',
    fontSize: 16,
    letterSpacing: 1.5,
    marginTop: 6,
    fontWeight: '500',
    opacity: 0.9,
  },
  card: {
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 22,
    textAlign: 'center',
  },
  inputWrapper: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: '#1C1C1C',
    color: '#FFFFFF',
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 16,
    fontSize: 15,
  },
  inputWrapperWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1C',
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 14,
    paddingHorizontal: 16,
  },
  inputFlex: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 0,
  },
  iconButton: {
    paddingLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: 18,
  },
  forgotText: {
    color: '#AAAAAA',
    fontSize: 13,
  },
  primaryBtn: {
    backgroundColor: '#E50914',
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  dividerText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  googleBtn: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  googleBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
  switchWrapper: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchPrompt: {
    color: '#888888',
    fontSize: 14,
  },
  switchAction: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
