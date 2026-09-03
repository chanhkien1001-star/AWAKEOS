import { AppRegistry } from 'react-native';
import { createElement } from 'react';
import { RootBoundary, recordStartupError } from './src/RootBoundary.tsx';
import { name as appName } from './app.json';

// Polyfill Node-shaped crypto / Buffer before anything else — but never let a
// polyfill failure kill the app before we can show it.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('react-native-quick-crypto').install();
} catch (e) {
  recordStartupError(e);
}

let AwakeApp;
try {
  AwakeApp = require('./src/AwakeApp.tsx').AwakeApp;
} catch (e) {
  recordStartupError(e);
  AwakeApp = () => null;
}

function Root() {
  return createElement(RootBoundary, null, createElement(AwakeApp, null));
}

AppRegistry.registerComponent(appName, () => Root);
