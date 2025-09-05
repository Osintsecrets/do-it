# Design Playground

## What’s new in v1.1

- **Multi-select** with Shift-click and move/resize multiple at once.  
- **Undo/Redo** (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z).  
- **Alignment tools** (align left/right/top/bottom + center).  
- **Artboard presets** plus manual W/H and background color control.  
- **More elements**: Rectangle, Circle, Divider.  
- **Color pickers** for text and backgrounds; `alt` text for images.  
- **Export Options** with PNG scale.  
- **Share Link** (URL hash) — copy a link that restores the design when opened.  
- **Small a11y improvements** (labels, alt, rel attributes).

A mini-Canva style, drag-drop web UI builder. Static, no backend.

**Features**
- Drag elements onto the artboard
- Move/resize with snap-to-grid + guides
- Edit properties (text, styles, image/link)
- Layers panel (select, duplicate, delete, z-order)
- Export PNG / JSON / HTML+CSS
- Auto-save to LocalStorage; Import JSON

**Local dev**
Open `index.html` directly, or run a static server.

**Deploy (GitHub Pages)**
- Enable Pages (Actions or branch).
- If using Actions, workflow is included at `.github/workflows/deploy.yml`.
