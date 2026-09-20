/** 全线性图标集（24×24，1.7 描边，currentColor） */
export const ICONS: Record<string, string> = {
  moon: '<path d="M20.6 13.2A8.6 8.6 0 1 1 10.8 3.4a6.8 6.8 0 0 0 9.8 9.8z"/>',
  run: '<path d="M13.5 2.5 4.5 15h6l-1 6.5 9-12.5h-6z"/>',
  book: '<path d="M2.5 4h5.5a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3h-6.5z"/><path d="M21.5 4H16a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h6.5z"/>',
  dumb: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11M1.5 12h2M20.5 12h2"/>',
  drop: '<path d="M12 2.8s6.2 6.5 6.2 10.9a6.2 6.2 0 0 1-12.4 0C5.8 9.3 12 2.8 12 2.8z"/>',
  wind: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2.5"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2.5"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2.5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11.5 18.5h1"/><path d="M3.5 3.5l17 17"/>',
  pen: '<path d="M17 3.2a2.6 2.6 0 0 1 3.7 3.7L7.6 20 2.5 21.5 4 16.4z"/>',
  target: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  coffee: '<path d="M17 8h1a3.5 3.5 0 1 1 0 7h-1"/><path d="M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z"/><path d="M7 2.5v2M11 2.5v2"/>',
  star: '<path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9z"/>',
  cap: '<rect x="7.5" y="2.5" width="9" height="19" rx="4.5"/><path d="M7.5 12h9"/>',
  chart: '<path d="M5 20v-8M12 20V5M19 20v-5"/><path d="M3 20h18"/>',
  sliders: '<path d="M4 7h10M18.5 7H20M4 12h3M11 12h9M4 17h13M20 17h.5"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18.5" cy="17" r="2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M3 19h18"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M3 19h18"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.1"/><circle cx="15.5" cy="8.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="8.5" cy="15.5" r="1.1"/><circle cx="15.5" cy="15.5" r="1.1"/>',
  fire: '<path d="M12 22c4.4 0 7-2.8 7-6.5 0-2.4-1.2-4.4-2.5-6-.3 1-.9 1.9-1.8 2.4.3-2.7-1-6.4-4-8.9.2 2.6-1 4.6-2.6 6.2C6.6 10.7 5 12.5 5 15.5 5 19.2 7.6 22 12 22z"/>',
  sound: '<path d="M11 5 6.5 8.5H3v7h3.5L11 19z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/>',
  mute: '<path d="M11 5 6.5 8.5H3v7h3.5L11 19z"/><path d="M16 9l5 5M21 9l-5 5"/>',
};

/** 项目可选图标（新建/编辑表单的选择网格） */
export const ICON_KEYS = [
  'moon', 'run', 'book', 'dumb', 'drop', 'wind', 'phone', 'pen',
  'target', 'clock', 'heart', 'music', 'code', 'coffee', 'star', 'cap',
];

/** 旧版 emoji → 线性图标（localStorage 迁移用） */
export const EMOJI_TO_ICON: Record<string, string> = {
  '🌙': 'moon', '😴': 'moon', '🏃': 'run', '📖': 'book', '📚': 'book',
  '💪': 'dumb', '🧘': 'wind', '💧': 'drop', '📝': 'pen', '✍️': 'pen',
  '🚫': 'phone', '⏰': 'clock', '❤️': 'heart', '🎸': 'music', '💻': 'code',
  '🧹': 'coffee', '💰': 'star', '🦷': 'check', '🥗': 'drop', '🚭': 'phone',
  '🎨': 'star', '🧠': 'code', '🎯': 'target', '☕': 'coffee', '🍎': 'drop',
};
