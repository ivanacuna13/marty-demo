// Where is Axel running? Inside a Claude artifact the page gets built-in capabilities (Claude, account storage, downloads)
// but no live camera or microphone, so the app swaps live sensing for uploaded recordings and photos.
export const IS_ARTIFACT = typeof window.claude?.use === 'function';

const memo = {};
export function cap(name) {
  if (!IS_ARTIFACT) return Promise.resolve(null);
  return (memo[name] ||= window.claude.use(name).catch(() => null));
}
