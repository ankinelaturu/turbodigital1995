# Drawing and animation

## Draw order

Strokes are queued in a fixed sequence to match the original program’s rhythm:

1. **Labels** — variable names above rails
2. **Rails** — vertical lines top to bottom
3. **Wires** — horizontal connections, split at each rail crossing: segment → jumper arc → segment → …
4. **Jumpers** — semicircular arcs hop over crossed rails (not drawn on top of a full line)
5. **Gates** — AND, OR, NOT symbols
6. **Output** — wire to F and the F label

Each item is one **stroke** with its own duration in milliseconds.

## Pen-style animation

Unlike the original BGI driver (which plotted pixels to VGA memory as fast or slow as the hardware allowed), the browser draws instantly unless we simulate slowness.

The app animates by:

1. Building an ordered list of strokes (`buildDrawQueue`)
2. Drawing strokes one at a time via `requestAnimationFrame`
3. For each stroke, interpolating **progress** from 0 to 1 over `durationMs`
4. Rendering only the partial path up to the current progress

### Line / polyline progress

`partialPolyline(points, progress)` walks the polyline, stopping at the fractional distance along the total path length.

### Arc progress

Arcs interpolate the end angle from `start` to `end` based on progress, so the curve visibly grows — similar to watching `arc()` on a DOS CRT.

### Text

Labels appear only when progress reaches 1 (instant pop-in after the stroke’s time slot).

## Gate symbols (geometry only)

All gates are built from lines, polylines, and arcs — no images or fonts for symbols.

### NOT

- Triangle (polyline): left edge → apex → left edge
- Small circle (full arc) on the output for inversion bubble

### AND

- Vertical line on the left (flat back)
- Semicircle on the right (curved front) — D-shape
- Short horizontals closing top and bottom

### OR

- Curved back (arc)
- Pointed front (polyline: top → tip → bottom)

## CRT visual theme

| Element | Value |
|---------|-------|
| Background | `#050805` |
| Phosphor stroke | `#39ff14` |
| Label text | `#5dff4a` |
| Glow | `shadowBlur` + `rgba(57, 255, 20, 0.35)` |

### Overlay effects (`drawCRTOverlay`)

- **Vignette** — radial gradient darkening edges
- **Scanlines** — faint horizontal lines every 3px

Font: **IBM Plex Mono** for labels and UI.

## Timing

Default durations scale with geometry:

| Stroke type | Typical duration |
|-------------|------------------|
| Label text | 400 ms |
| Rail | 500 ms + 0.8 × rail height |
| Wire | 200 ms + 1.2 × wire length |
| Jumper arc | 220 ms |
| Gate segment | 200–280 ms per primitive |
| Output label | 350 ms |

Longer wires and rails take slightly longer, echoing the old hardware where a long `line()` took more visible time to complete.

## Canvas scaling

The canvas logical size matches `CircuitLayout.width` × `height`. It scales down to fit the container while preserving aspect ratio. A `ResizeObserver` updates scale on window resize.

Rendering uses a transform so all coordinates stay in layout space; clear and overlay use layout dimensions, not device pixels.

## Connection to original BGI behavior

On DOS Turbo C with BGI, a single call like `line(10, 50, 200, 50)` or `arc(...)` could visibly draw because the driver wrote pixels to visible video memory sequentially. No application-level animation loop was required.

This web app **recreates that feel deliberately** through the stroke queue and progressive rendering — the same visual experience, implemented explicitly for modern hardware.
