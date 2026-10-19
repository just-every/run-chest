import { area, card, form } from '../ui-shared'
import type { DomainPolicy } from './domains'

export function domainCard(view: DomainPolicy) {
 const fields = area('Domains allowed to use company sign-in', 'allowedDomains', view.allowedDomains.join('\n'), false)
  + '<p class="quiet">One exact email domain per line, such as example.com. Leave blank to allow all accounts already provisioned in Chest. Subdomains must be listed separately.</p>'
  + area('Domains that must use company sign-in', 'requiredDomains', view.requiredDomains.join('\n'), false)
  + '<p class="quiet">These domains cannot use email sign-in links. List only domains allowed above. Save and test your identity provider first.</p>'
 return card('Sign-in domains', '<p>Choose which work addresses can use company sign-in and which must use it. Saving ends sessions that no longer meet these rules. The owner can still use <span class="mono">rer signin</span> from the installation to repair a bad rule or provider outage.</p>' + form('/organisation/domains', fields, 'Save sign-in domains', '/app/admin'))
}
