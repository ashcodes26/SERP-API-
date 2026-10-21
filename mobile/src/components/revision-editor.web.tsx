import { useRef } from 'react';
import { design as d, sans } from '@/constants/design';
import { highlightedRevision } from '@/utils/resume-workspace';

export default function RevisionEditor({ value, onChange, highlights, disabled = false, variant }: { value: string; onChange: (value: string) => void; highlights: string[]; disabled?: boolean; variant?: 'resume' }) {
  const backdrop = useRef<HTMLDivElement>(null);
  const typography = { fontFamily: variant === 'resume' ? 'CareerPlanInter400, Inter, system-ui, sans-serif' : sans, fontSize: variant === 'resume' ? 14 : 16, lineHeight: variant === 'resume' ? '22px' : '24px', letterSpacing: 'normal', tabSize: 8 };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
    <label htmlFor="revised-resume-editor" style={{ color: d.body, fontSize: 12 }}>Revised resume editor</label>
    <div style={{ position: 'relative', width: '100%', height: variant === 'resume' ? 580 : 360, minHeight: 180, minWidth: 'min(240px, 100%)', maxWidth: '100%', maxHeight: 1200, resize: 'both', overflow: 'hidden', boxSizing: 'border-box', border: `1px solid ${d.strongBorder}`, borderRadius: variant === 'resume' ? 4 : 6, background: d.elevated }}>
      <div ref={backdrop} aria-hidden="true" style={{ ...typography, position: 'absolute', inset: '0 0 16px', padding: 12, boxSizing: 'border-box', color: d.body, whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflow: 'hidden', scrollbarGutter: 'stable', pointerEvents: 'none' }}>
        {highlightedRevision(value, highlights).map((part, index) => part.highlight ? <mark key={index} style={{ backgroundColor: d.replacement, color: d.canvas, padding: 0 }}>{part.text}</mark> : <span key={index}>{part.text}</span>)}{'\u200b'}
      </div>
      <textarea id="revised-resume-editor" aria-describedby="revision-editor-hint" value={value} disabled={disabled} maxLength={20000} spellCheck={false}
        onChange={event => onChange(event.target.value)}
        onScroll={event => { if (backdrop.current) { backdrop.current.scrollTop = event.currentTarget.scrollTop; backdrop.current.scrollLeft = event.currentTarget.scrollLeft; } }}
        style={{ ...typography, position: 'absolute', inset: 0, margin: 0, width: '100%', height: 'calc(100% - 16px)', padding: 12, boxSizing: 'border-box', border: 0, borderRadius: 6, background: 'transparent', color: 'transparent', caretColor: d.body, resize: 'none', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', overflow: 'auto', scrollbarGutter: 'stable', outlineOffset: -2 }} />
    </div>
    <span id="revision-editor-hint" style={{ color: d.muted, fontSize: 12, lineHeight: '20px' }}>Replaced passages are highlighted in yellow. Drag the bottom-right corner to resize.</span>
  </div>;
}
