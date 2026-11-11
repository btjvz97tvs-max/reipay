// 必要になったときだけ、外部ファイル（public/vendor/ の中）を読み込む。

const loadingScripts = new Map();

export function loadScript(src) {
  if (!loadingScripts.has(src)) {
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.addEventListener('load', () => resolve());
      script.addEventListener('error', () => {
        loadingScripts.delete(src);
        reject(new Error('読み取り用のファイルを読み込めませんでした'));
      });
      document.head.append(script);
    });
    loadingScripts.set(src, promise);
  }
  return loadingScripts.get(src);
}
