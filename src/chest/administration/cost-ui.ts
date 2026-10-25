import { card, esc, field, form, stamp } from '../ui-shared'
import type { CostSettings } from './costs'

const rateField = (label: string, name: string, value?: number,required=true) => `<label class="field"><span class="field-label">${esc(label)}</span><input name="${esc(name)}" type="number" min="0" step="any" value="${value === undefined ? '' : esc(value)}" ${required?'required':''}></label>`

export function costCard(settings: CostSettings, editable = true): string {
 const r = settings.rates
 const configured = r ? `<p>Provider: <strong>${esc(r.provider)}</strong></p><ul><li>Storage: USD ${esc(r.storageUsdPerGbMonth)} per GB-month</li><li>Egress: USD ${esc(r.egressUsdPerGb)} per GB</li></ul><p>Quote or rate source: ${esc(r.quote)}</p><p>Recorded by ${esc(r.updatedBy)} · ${stamp(r.updatedAt)}</p>${r.aiProvider?`<p>Additional provider: ${esc(r.aiProvider)} · ${esc(r.aiModel)} · USD ${esc(r.aiInputUsdPerMillion)} per million input tokens, USD ${esc(r.aiOutputUsdPerMillion)} per million output tokens, USD ${esc(r.aiRequestUsd)} per request.</p>`:''}` : '<p>No provider rates have been recorded. Costs remain unknown until rates are supplied.</p>'
 const fields = field('Provider', 'provider', r?.provider ?? '') + field('Quote or rate source and date', 'quote', r?.quote ?? '')
  + rateField('Storage (USD per decimal GB-month)', 'storageUsdPerGbMonth', r?.storageUsdPerGbMonth)
  + rateField('Egress (USD per decimal GB)', 'egressUsdPerGb', r?.egressUsdPerGb)
  + '<h3>Optional AI or request quote</h3>'+field('AI or request provider','aiProvider',r?.aiProvider??'','text',false)+field('Model, or request for non-AI calls','aiModel',r?.aiModel??'','text',false)+rateField('USD per million input tokens','aiInputUsdPerMillion',r?.aiInputUsdPerMillion,false)+rateField('USD per million output tokens','aiOutputUsdPerMillion',r?.aiOutputUsdPerMillion,false)+rateField('USD per provider request','aiRequestUsd',r?.aiRequestUsd,false)
  + rateField('USD per million cached input reads','aiCacheReadUsdPerMillion',r?.aiCacheReadUsdPerMillion,false)+rateField('USD per million five minute cache writes','aiCacheWrite5mUsdPerMillion',r?.aiCacheWrite5mUsdPerMillion,false)+rateField('USD per million one hour cache writes','aiCacheWrite1hUsdPerMillion',r?.aiCacheWrite1hUsdPerMillion,false)
  + '<label class="check"><input type="checkbox" name="confirm" value="true" required>I confirm these provider rates and their source for estimates.</label>'
 return card('Provider cost estimates', `<p>${esc(settings.notice)}</p>${configured}<p>Organization service-settings permission is required to save rates.</p>${editable ? form('/administration/costs', fields, 'Save estimate rates', '/app/administration/costs') : '<p>Your reporting role can read these rates.</p>'}`)
}
