import type { Audience } from '@/lib/contracts';
import { audienceLabels } from '@/lib/action-catalog';
export function AudienceSelector({ value, onChange }: { value: Audience; onChange: (audience: Audience) => void }) {
  return <fieldset className="audience-selector"><legend>Panduan untuk</legend><div className="audience-options">{(['general', 'sensitive', 'outdoor'] as const).map(audience => <label key={audience}><input type="radio" name="action-audience" value={audience} checked={value === audience} onChange={() => onChange(audience)}/><span>{audienceLabels[audience]}</span></label>)}</div><p className="field-help">Pilihan ini tidak disimpan sebagai profil kesehatan.</p></fieldset>;
}
