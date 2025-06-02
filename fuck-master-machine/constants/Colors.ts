const tintColorLight = '#2f95dc';
const tintColorDark = '#44CCFF';
const errorColorLight = '#D32F2F'; // Material 3: Error color for light theme
const errorColorDark = '#EF5350'; // Material 3: Error color for dark theme

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    error: errorColorLight,
    tabIconDefault: '#888',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#fff',
    background: '#333',
    tint: tintColorDark,
    error: errorColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
};
