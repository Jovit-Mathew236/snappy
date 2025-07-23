function getOS() {
  if (typeof window === "undefined") {
    return "Unknown";
  }
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const macosPlatforms = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"];
  const windowsPlatforms = ["Win32", "Win64", "Windows", "WinCE"];
  const iosPlatforms = ["iPhone", "iPad", "iPod"];

  if (macosPlatforms.includes(platform) || /Mac OS X/.test(userAgent)) {
    return "mac";
  }
  if (iosPlatforms.includes(platform)) {
    return "ios";
  }
  if (windowsPlatforms.includes(platform)) {
    return "windows";
  }
  if (/Android/.test(userAgent)) {
    return "android";
  }
  if (/Linux/.test(userAgent)) {
    return "linux";
  }
  return "Unknown";
}

export { getOS };