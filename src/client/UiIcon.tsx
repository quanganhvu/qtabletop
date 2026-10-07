// Small interface icons drawn as engraved line art, in keeping with the
// medieval theme. They draw in `currentColor`, so they take the button's color.

const PATHS = {
  // A church bell ringing
  bell: '<path d="M12 3a1.2 1.2 0 0 1 1.2 1.2v.7c2.9.7 5 3.3 5 6.3v3.9l1.8 2.4H4l1.8-2.4v-3.9c0-3 2.1-5.6 5-6.3v-.7A1.2 1.2 0 0 1 12 3z" fill="currentColor" fill-opacity=".18"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M20.3 6.5c1 1.1 1.6 2.6 1.6 4.2M3.7 6.5c-1 1.1-1.6 2.6-1.6 4.2"/>',
  // The same bell, silenced
  bellOff: '<path d="M12 3a1.2 1.2 0 0 1 1.2 1.2v.7c2.9.7 5 3.3 5 6.3v3.9l1.8 2.4H4l1.8-2.4v-3.9c0-3 2.1-5.6 5-6.3v-.7A1.2 1.2 0 0 1 12 3z" fill="currentColor" fill-opacity=".18"/><path d="M10 19a2 2 0 0 0 4 0"/><path d="M3 3l18 18"/>',
  // An open tome with a ribbon bookmark
  book: '<path d="M2.5 5.5c3.5-1.5 7-1 9.5 1 2.5-2 6-2.5 9.5-1v13c-3.5-1.5-7-1-9.5 1-2.5-2-6-2.5-9.5-1z"/><path d="M12 6.5v13"/><path d="M5 9c1.8-.4 3.6-.2 5 .5M5 12c1.8-.4 3.6-.2 5 .5M14 9.5c1.4-.7 3.2-.9 5-.5"/><path d="M16 5v6l1.2-1 1.2 1V4.6"/>',
  // A scroll with curled ends
  scroll: '<path d="M6 4h12a2 2 0 0 1 2 2v1h-3"/><path d="M6 4a2 2 0 0 0-2 2v1h3"/><path d="M7 5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1H11v1a2 2 0 0 1-4 0"/><path d="M10 9h6M10 12h6M10 15h4"/>',
  // Crossed swords
  swords: '<path d="M4 4l11 11M15 15l2.5-1M15 15l-1 2.5M17 17l3.5 3.5"/><path d="M20 4L9 15M9 15l-2.5-1M9 15l1 2.5M7 17l-3.5 3.5"/><path d="M4 4h2.5M4 4v2.5M20 4h-2.5M20 4v2.5"/>',
  // An arched doorway with a way out
  door: '<path d="M3.5 21V10a5 5 0 0 1 10 0v11"/><path d="M2 21h13"/><path d="M8.5 8v13"/><circle cx="11" cy="14" r=".6" fill="currentColor"/><path d="M15.5 12.5H22M19 9.5l3 3-3 3"/>',
  // A knight's helm (bots)
  helm: '<path d="M5.5 20.5V11a6.5 6.5 0 0 1 13 0v9.5z"/><path d="M5.5 13.5h13"/><path d="M8 13.5v2.5M10.6 13.5v2.5M13.4 13.5v2.5M16 13.5v2.5"/><path d="M12 4.5V2.5M10 2.5h4"/>',
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
