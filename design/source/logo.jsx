/* PraevIA Wordmark + Mark — reusable React components.
   Concept: "praevia" (latin: previous, that which precedes) — the macron on
   the 'e' (ē) signals precedence + the 'IA' caps embedded as the name's tail
   reveals "IA" (artificial intelligence in Spanish) as native to the word.
   The mark is a watcher's iris / pretest aperture — a circle approaching
   from the left, observing before. */

const PraevIAMark = ({ size = 32, color = 'currentColor', strokeWidth = 1.4 }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    {/* outer aperture */}
    <circle cx="16" cy="16" r="12.5" fill="none" stroke={color} strokeWidth={strokeWidth} opacity="0.35"/>
    {/* iris ring */}
    <circle cx="16" cy="16" r="7.5" fill="none" stroke={color} strokeWidth={strokeWidth}/>
    {/* pupil — offset left = "looks before / anticipates" */}
    <circle cx="13" cy="16" r="2.4" fill={color}/>
    {/* macron — the precedence mark */}
    <line x1="6" y1="4.5" x2="14" y2="4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="square"/>
  </svg>
);

const PraevIAWordmark = ({ size = 22, color = 'currentColor' }) => {
  // size = ascender height in px → derive a viewBox-ish layout
  const h = size * 1.6;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'baseline', gap: size * 0.5,
        fontFamily: "'Newsreader', serif",
        fontSize: size * 1.55,
        fontWeight: 500,
        letterSpacing: '-0.02em',
        color,
        lineHeight: 1,
      }}
    >
      <PraevIAMark size={h * 0.78} color={color}/>
      <span style={{ display: 'inline-flex', alignItems: 'baseline' }}>
        <span style={{ fontStyle: 'normal' }}>prae</span>
        <span style={{ position: 'relative', display: 'inline-block' }}>
          v
        </span>
        <span style={{ fontStyle: 'italic', fontWeight: 400, opacity: 0.95 }}>i</span>
        <span style={{
          fontFamily: "'Geist', sans-serif",
          fontWeight: 600,
          fontSize: size * 1.05,
          letterSpacing: '0.02em',
          marginLeft: 1,
          alignSelf: 'baseline',
        }}>A</span>
      </span>
    </span>
  );
};

const PraevIALockup = ({ size = 22, color = 'currentColor', product = 'NeuroImpact Analyzer' }) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, color }}>
    <PraevIAWordmark size={size} color={color}/>
    {product && (
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: size * 0.46,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        opacity: 0.55,
        marginLeft: size * 1.7,
      }}>
        {product}
      </div>
    )}
  </div>
);

window.PraevIAMark = PraevIAMark;
window.PraevIAWordmark = PraevIAWordmark;
window.PraevIALockup = PraevIALockup;
