/* global __dirname */
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
if (!config.resolver.sourceExts.includes("cjs")) {
  config.resolver.sourceExts.push("cjs");
}

// Local design previews contain short-lived Chrome folders, not app modules.
// Keep Expo's existing exclusions and leave its generated runtime files visible.
const defaultBlockList = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(defaultBlockList) ? defaultBlockList : defaultBlockList ? [defaultBlockList] : []),
  /[/\\]\.expo[/\\](?:weekly-schedule-review|edit-profile-design-review|weekly-schedule-browser-[^/\\]+)(?:[/\\]|$)/,
];

module.exports = withNativeWind(config, { input: "./global.css" });
