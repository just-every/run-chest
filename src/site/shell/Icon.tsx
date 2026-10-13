import { folderTab, icons } from '../../ui/icons'

/** One of Chest's line icons (src/ui/icons.ts), decorative. */
export function Icon({ name, className = 'icon' }: { name: keyof typeof icons; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: icons[name] }} />
}

/** A manila folder: the back panel with its index tab, the paper stack behind, and a white sheet holding `children`. */
export function Folder({ children, className = '', tab }: { children: React.ReactNode; className?: string; tab?: React.ReactNode }) {
  return (
    <div className={`folder ${className}`.trim()}>
      <span className="folder-back" aria-hidden="true" />
      <span className="folder-tab" aria-hidden="true" dangerouslySetInnerHTML={{ __html: folderTab }} />
      {tab}
      <div className="folder-sheet">{children}</div>
    </div>
  )
}
