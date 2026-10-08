// Small line-art interface icons. They draw in `currentColor`, so they take the button's color.

const PATHS = {
  // A ship's bell
  bell: '<path d="M12 3a1.2 1.2 0 0 1 1.2 1.2v.7c2.9.7 5 3.3 5 6.3v3.9l1.8 2.4H4l1.8-2.4v-3.9c0-3 2.1-5.6 5-6.3v-.7A1.2 1.2 0 0 1 12 3z" fill="currentColor" fill-opacity=".18"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M20.3 6.5c1 1.1 1.6 2.6 1.6 4.2M3.7 6.5c-1 1.1-1.6 2.6-1.6 4.2"/>',
  bellOff: '<path d="M12 3a1.2 1.2 0 0 1 1.2 1.2v.7c2.9.7 5 3.3 5 6.3v3.9l1.8 2.4H4l1.8-2.4v-3.9c0-3 2.1-5.6 5-6.3v-.7A1.2 1.2 0 0 1 12 3z" fill="currentColor" fill-opacity=".18"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M3 3l18 18"/>',
  // An open book
  book: '<path d="M2.5 5.5c3.5-1.5 7-1 9.5 1 2.5-2 6-2.5 9.5-1v13c-3.5-1.5-7-1-9.5 1-2.5-2-6-2.5-9.5-1z"/><path d="M12 6.5v13"/>',
  // A ship's log
  scroll: '<path d="M6 4h12a2 2 0 0 1 2 2v1h-3"/><path d="M6 4a2 2 0 0 0-2 2v1h3"/><path d="M7 5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1H11v1a2 2 0 0 1-4 0"/><path d="M10 9h6M10 12h6M10 15h4"/>',
  // A stop sign: end the game
  stop: '<path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z"/><path d="M9 12h6"/>',
  // A doorway
  door: '<path d="M3.5 21V10a5 5 0 0 1 10 0v11"/><path d="M2 21h13"/><path d="M8.5 8v13"/><path d="M15.5 12.5H22M19 9.5l3 3-3 3"/>',
  // An anchor (bots)
  anchor: '<circle cx="12" cy="5" r="2"/><path d="M12 7v14M8 10h8"/><path d="M4 14c0 4 3.6 7 8 7s8-3 8-7"/><path d="M2.5 15.5L4 14l1.5 1.5M18.5 15.5L20 14l1.5 1.5"/>',
} as const;

export type UiIconName = keyof typeof PATHS;

export function UiIcon({ name, className }: { name: UiIconName; className?: string }) {
  return (
    <svg
      className={`ui-icon ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
