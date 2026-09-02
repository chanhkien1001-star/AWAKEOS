const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const repoRoot = path.resolve(__dirname, '../..');

/**
 * The engine lives in this monorepo under `packages/`. Metro needs to be told to
 * watch it and to resolve its dependencies from the app's own node_modules.
 */
const config = {
  watchFolders: [
    path.resolve(repoRoot, 'packages/core'),
    path.resolve(repoRoot, 'packages/app'),
  ],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // resolve .ts/.tsx from the engine packages
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
