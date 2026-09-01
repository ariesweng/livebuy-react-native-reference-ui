// Single http→https upgrade point for remote product images
// (rb-rn-product-image-https-upgrade, parity with iOS ReferenceUIImageURL / Android
// referenceUiHttpsUpgraded).
//
// Why: some backend product `pic` URLs are cleartext `http://` (e.g. shop P1MUv99J's
// 測試零食). On RN iOS, App Transport Security blocks cleartext just like native iOS, so
// `<Image source={{ uri }}>` never loads the image → the placeholder stays. The Livebuy
// image host serves the same path over TLS (it even 301-redirects http→https), so
// upgrading the scheme client-side makes the image load.
//
// Pure — only the `http` scheme is rewritten; `https`, other schemes, relative paths and
// empties are returned unchanged.

/**
 * If `url` starts with a cleartext `http://` scheme (case-insensitive), return it with an
 * `https://` scheme (host / path / query preserved); otherwise return `url` unchanged.
 */
export function referenceUiHttpsUpgraded(url: string): string {
  return /^http:\/\//i.test(url) ? url.replace(/^http:\/\//i, 'https://') : url;
}
