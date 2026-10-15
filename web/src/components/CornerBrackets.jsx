/**
 * CornerBrackets.jsx
 *
 * The HUD "targeting reticle" corners, as a reusable component instead
 * of copy-pasting the same 4 spans into every panel that wants the
 * treatment. Styled via the global .hud-corner* classes in
 * design/tokens.css (not a CSS module, since this is shared across
 * several component files). The parent element needs its own
 * `position: relative`.
 */
export function CornerBrackets() {
  return (
    <>
      <span className="hud-corner hud-corner-tl" />
      <span className="hud-corner hud-corner-tr" />
      <span className="hud-corner hud-corner-bl" />
      <span className="hud-corner hud-corner-br" />
    </>
  );
}
