export function getAppBaseUrl(): string {
  const url = process.env.APP_BASE_URL;
  if (!url) {
    throw new Error("APP_BASE_URL is not set");
  }
  return url;
}
