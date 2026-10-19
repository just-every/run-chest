import { card, esc, field, form, stamp } from '../ui-shared'
import type { CostSettings } from './costs'

const rateField = (label: string, name: string, value?: number) => `<label class="field"><span class="field-label">${esc(label)}</span><input name="${esc(name)}" type="number" min="0" step="any" value="${value === undefined ? '' : esc(value)}" required></label>`

export function costCard(settings: CostSettings, editable = true): string {
 const r = settings.rates
 const configured = r ? `<p>Provider: <strong>${esc(r.provider)}</strong></p><ul><li>Storage: USD ${esc(r.storageUsdPerGbMonth)} per GB-month</li><li>Egress: USD ${esc(r.egressUsdPerGb)} per GB</li></ul><p>Quote or rate source: ${esc(r.quote)}</p><p>Recorded by ${esc(r.updatedBy)} · ${stamp(r.updatedAt)}</p>` : '<p>No provider rates have been recorded. Costs remain unknown until rates are supplied.</p>'
 const fields = field('Provider', 'provider', r?.provider ?? '') + field('Quote or rate source and date', 'quote', r?.quote ?? '')
  + rateField('Storage (USD per decimal GB-month)', 'storageUsdPerGbMonth', r?.storageUsdPerGbMonth)
  + rateField('Egress (USD per decimal GB)', 'egressUsdPerGb', r?.egressUsdPerGb)
  + '<label class="check"><input type="checkbox" name="confirm" value="true" required>I confirm these provider rates and their source for estimates.</label>'
 return card('Provider cost estimates', `<p>${esc(settings.notice)}</p>${configured}<p>Organization service-settings permission is required to save rates.</p>${editable ? form('/administration/costs', fields, 'Save estimate rates', '/app/administration/costs') : '<p>Your reporting role can read these rates.</p>'}`)
}
