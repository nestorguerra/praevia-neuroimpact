import { Badge } from "./Badge";

export function TimelinePanel() {
  return (
    <section className="timeline-panel" aria-label="Timeline accionable A/B/C">
      <div className="timeline-head">
        <div className="timeline-legend">
          <Badge tone="amber" dot>Version A</Badge>
          <Badge tone="cyan" dot>Version B</Badge>
          <Badge tone="violet" dot>Version C</Badge>
          <Badge tone="lime" dot>Peak</Badge>
          <Badge tone="coral" dot>Valley</Badge>
        </div>
        <span className="timeline-range">00:00 - 00:30</span>
      </div>
      <svg className="timeline-svg" viewBox="0 0 920 240" role="img" aria-label="Curvas comparativas por timecode">
        <g className="timeline-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <line key={`h-${index}`} x1="0" y1={40 + index * 32} x2="920" y2={40 + index * 32} />
          ))}
          {Array.from({ length: 10 }, (_, index) => (
            <line key={`v-${index}`} x1={index * 102} y1="20" x2={index * 102} y2="216" />
          ))}
        </g>
        <path className="timeline-area-a" d="M0 126 C70 72 110 96 172 82 C242 66 280 126 352 92 C446 46 500 62 570 104 C640 144 702 74 770 106 C842 138 884 88 920 68 L920 240 L0 240 Z" />
        <path className="timeline-a" d="M0 126 C70 72 110 96 172 82 C242 66 280 126 352 92 C446 46 500 62 570 104 C640 144 702 74 770 106 C842 138 884 88 920 68" />
        <path className="timeline-b" d="M0 148 C72 170 122 132 184 146 C248 160 302 134 364 154 C426 174 484 138 548 152 C626 170 674 192 742 154 C810 116 872 134 920 120" />
        <path className="timeline-c" d="M0 174 C58 154 118 188 176 166 C244 142 286 174 352 182 C424 190 482 166 548 176 C620 186 700 150 762 166 C828 184 878 160 920 172" />
        <line className="timeline-playhead" x1="446" y1="20" x2="446" y2="218" />
        <g className="timeline-marker peak">
          <line x1="446" y1="20" x2="446" y2="218" />
          <circle cx="446" cy="46" r="6" />
          <text x="458" y="42">PEAK · 00:14</text>
        </g>
        <g className="timeline-marker valley">
          <line x1="640" y1="20" x2="640" y2="218" />
          <circle cx="640" cy="144" r="6" />
          <text x="650" y="140">VALLEY · 00:22</text>
        </g>
        <g className="timeline-ruler">
          <text x="0" y="232">00:00</text>
          <text x="440" y="232">00:15</text>
          <text x="870" y="232">00:30</text>
        </g>
      </svg>
    </section>
  );
}

