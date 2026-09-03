// Minimal entry: a bare RN screen, no polyfills, no native modules.
// The android-apk workflow copies this over index.js when `minimal: true`.
import { AppRegistry } from 'react-native';
import { Diagnostic } from './src/Diagnostic.tsx';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => Diagnostic);
