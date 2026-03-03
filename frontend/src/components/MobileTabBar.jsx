/**
 * MobileTabBar — fixed two-tab nav bar for mobile (hidden on md+)
 * Heights: h-16 (64px) + env(safe-area-inset-bottom)
 */
export default function MobileTabBar({ activeView, onChange }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-spotify-darkgray border-t border-spotify-gray flex pb-safe">
      <TabButton
        label="Now Playing"
        active={activeView === 'nowplaying'}
        onClick={() => onChange('nowplaying')}
        icon={<NowPlayingIcon active={activeView === 'nowplaying'} />}
      />
      <TabButton
        label="Queue"
        active={activeView === 'queue'}
        onClick={() => onChange('queue')}
        icon={<QueueIcon active={activeView === 'queue'} />}
      />
    </nav>
  )
}

function TabButton({ label, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] transition-colors touch-manipulation ${
        active ? 'text-spotify-green' : 'text-spotify-lightgray hover:text-white'
      }`}
      aria-label={label}
    >
      {icon}
      <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
    </button>
  )
}

function NowPlayingIcon({ active }) {
  return (
    <svg
      className={`w-5 h-5 ${active ? 'text-spotify-green' : ''}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  )
}

function QueueIcon({ active }) {
  return (
    <svg
      className={`w-5 h-5 ${active ? 'text-spotify-green' : ''}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
    </svg>
  )
}
