module.exports = function (api) {
  api.cache(true);

  const plugins = ["react-native-reanimated/plugin"];

  // Remove console statements in production builds
  if (process.env.NODE_ENV === "production") {
    plugins.unshift(["transform-remove-console", { exclude: ["error"] }]);
  }

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          jsxImportSource: "nativewind",
          unstable_transformImportMeta: true, // Enable import.meta support for privacycash
        },
      ],
      "nativewind/babel",
    ],
    plugins,
  };
};
