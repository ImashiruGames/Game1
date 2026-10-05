/** 日本語: Coreの戻り値を凍結し、画面からのうっかりした変更も防ぐ。
 * English: Freeze outputs so accidental UI writes cannot corrupt a battle. */
export function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
