import { Folder } from '../../shell/Icon'

/** Section 1: a folder holding the MIT License, the rest of the text as grey lines. */
export function FreeDrawing() {
  return (
    <Folder className="folder-free">
      <p className="sheet-title">MIT License</p>
      <p className="mono sheet-mono">Permission is hereby granted, free of charge</p>
      <span className="lines" aria-hidden="true"><i /><i /><i /><b /><i /><i /><i /><b /><i /><i /><i /><i /></span>
    </Folder>
  )
}
