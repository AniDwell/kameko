import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { ResizeMode } from 'expo-av';
import Svg, { Path } from 'react-native-svg';

const IconScaleFit = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF">
    <Path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/>
  </Svg>
);

const IconScaleCrop = ({ size = 24 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFF">
    <Path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/>
  </Svg>
);

export default function AspectRatioButton({ resizeMode, setResizeMode }) {
  const cycleMode = () => {
    if (resizeMode === ResizeMode.CONTAIN) {
      setResizeMode(ResizeMode.COVER);
    } else if (resizeMode === ResizeMode.COVER) {
      setResizeMode(ResizeMode.STRETCH);
    } else {
      setResizeMode(ResizeMode.CONTAIN);
    }
  };

  return (
    <TouchableOpacity onPress={cycleMode} style={styles.iconBtn}>
      {resizeMode === ResizeMode.CONTAIN ? <IconScaleFit /> : <IconScaleCrop />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconBtn: { padding: 0, opacity: 0.9 },
});
