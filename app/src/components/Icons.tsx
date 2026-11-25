export default function Icons() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {/* 用 symbol + viewBox，确保 <use> 引用时图标按 24x24 坐标系完整缩放，不被视口裁切 */}
        <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></symbol>
        <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></symbol>
        <symbol id="i-tool" viewBox="0 0 24 24"><path d="M14 6a4 4 0 0 0-5 5L4 16l4 4 5-5a4 4 0 0 0 5-5l-3 3-3-3 2-4z"/></symbol>
        <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h7M8 11h7"/></symbol>
        <symbol id="i-heart" viewBox="0 0 24 24"><path d="M20 8c0 5-8 11-8 11S4 13 4 8a4 4 0 0 1 8-1 4 4 0 0 1 8 1z"/></symbol>
        <symbol id="i-set" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-4l-.3 2.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.1h4l.3-2.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/></symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></symbol>
        <symbol id="i-term" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/></symbol>
        <symbol id="i-code" viewBox="0 0 24 24"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
        <symbol id="i-folder" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></symbol>
        <symbol id="i-palette" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/></symbol>
        <symbol id="i-bell" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10 20a2 2 0 0 0 4 0"/></symbol>
        <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></symbol>
        <symbol id="i-cloudsun" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><path d="M8 2v1.5M2.5 8H4M4.2 4.2l1 1M11.8 4.2l-1 1"/><path d="M17.5 20H9a3.5 3.5 0 0 1-.4-7A5 5 0 0 1 18 12a4 4 0 0 1-.5 8z"/></symbol>
        <symbol id="i-cloud" viewBox="0 0 24 24"><path d="M18 18H7a4 4 0 0 1-.5-8 6 6 0 0 1 11.4 1.2A3.6 3.6 0 0 1 18 18z"/></symbol>
        <symbol id="i-rain" viewBox="0 0 24 24"><path d="M18 15H7a4 4 0 0 1-.5-8 6 6 0 0 1 11.4 1.2A3.6 3.6 0 0 1 18 15z"/><path d="M8 18l-1 3M13 18l-1 3M18 18l-1 3"/></symbol>
        <symbol id="i-snow" viewBox="0 0 24 24"><path d="M18 15H7a4 4 0 0 1-.5-8 6 6 0 0 1 11.4 1.2A3.6 3.6 0 0 1 18 15z"/><path d="M8 19h.01M13 20h.01M18 19h.01M10.5 18l-1 2M15.5 18l-1 2"/></symbol>
        <symbol id="i-fog" viewBox="0 0 24 24"><path d="M18 13H7a4 4 0 0 1-.5-8 6 6 0 0 1 11.4 1.2A3.6 3.6 0 0 1 18 13z"/><path d="M4 17h16M6 20h12"/></symbol>
        <symbol id="i-thunder" viewBox="0 0 24 24"><path d="M18 14H7a4 4 0 0 1-.5-8 6 6 0 0 1 11.4 1.2A3.6 3.6 0 0 1 18 14z"/><path d="M12 14l-3 5h3l-1 3 5-6h-3l1-2z"/></symbol>
        <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
        <symbol id="i-report" viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M8 13h8M8 17h6"/></symbol>
        <symbol id="i-win" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
      </defs>
    </svg>
  )
}

export function Icon({ id, size = 20 }: { id: string; size?: number }) {
  return <svg width={size} height={size}><use href={`#${id}`} /></svg>
}
