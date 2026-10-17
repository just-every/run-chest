import { esc } from '../ui-shared'
// Step-by-step setup for the identity providers people ask for by name, screen by screen, saying which value goes
// where. OpenID Connect for Okta and Google Workspace, SAML for Microsoft Entra ID (its tokens carry no verified-email
// claim, which Chest's OpenID Connect sign-in requires). Automatic user setup (SCIM) for Okta and Entra; Google
// Workspace cannot provision apps outside its own catalogue, so its people are invited by email instead.
export type ChestValues = { callback: string; acs: string; entity: string; base: string }
const v = (value: string) => `<span class="mono">${esc(value)}</span>`
const b = (words: string) => `<strong>${words}</strong>`
const guide = (title: string, intro: string, steps: string[]) => `<details class="disclosure"><summary class="btn btn-outline">${esc(title)}</summary><div class="disclosure-panel"><p>${intro}</p><ol class="intake-steps">${steps.map(s => `<li>${s}</li>`).join('')}</ol></div></details>`
const scimNote = 'Use each person’s email address as their username in the provider: Chest matches people by email.'

export function providerGuides(c: ChestValues) {
 const okta = guide('Okta, step by step', 'You need to be an Okta super admin or app admin. This uses OpenID Connect, then turns on automatic user setup.', [
  `In the Okta Admin Console choose ${b('Applications › Applications')}, then ${b('Create App Integration')}. Pick ${b('OIDC - OpenID Connect')} and ${b('Web Application')}, then ${b('Next')}.`,
  `${b('App integration name')}: Chest. Under ${b('Sign-in redirect URIs')}, remove the example and paste ${v(c.callback)}. Under ${b('Assignments')}, choose who may use Chest. ${b('Save')}.`,
  `On the app’s ${b('General')} tab, copy ${b('Client ID')} and ${b('Client secret')} into Chest’s ${b('Client ID')} and ${b('Client secret')} below. Leave ${b('Client authentication')} as ${b('Client secret')}; in Chest keep ${b('In the request header')}.`,
  `In Chest choose ${b('OpenID Connect')}, type ${b('Okta')} as the button name, and paste your Okta address as ${b('Provider address')}, for example ${v('https://your-company.okta.com')} (the address of your Okta sign-in page, without anything after .com). ${b('Save identity provider')}.`,
  `Automatic user setup: on the app’s ${b('General')} tab, ${b('App Settings › Edit')}, set ${b('Provisioning')} to ${b('SCIM')} and ${b('Save')}. A ${b('Provisioning')} tab appears.`,
  `${b('Provisioning › Integration › Edit')}: ${b('SCIM connector base URL')} ${v(c.base)}; ${b('Unique identifier field for users')} ${v('userName')}; tick ${b('Push New Users')}, ${b('Push Profile Updates')} and ${b('Push Groups')}; ${b('Authentication Mode')} ${b('HTTP Header')}, and paste a token from ${b('Issue SCIM token')} below as the ${b('Bearer')} token. ${b('Test Connector Configuration')}, then ${b('Save')}.`,
  `${b('Provisioning › To App › Edit')}: turn on ${b('Create Users')}, ${b('Update User Attributes')} and ${b('Deactivate Users')}. ${b('Save')}. Then ${b('Assignments › Assign')} people or groups, and ${b('Push Groups')} for groups you want in Chest. ${scimNote}`,
 ])
 const google = guide('Google Workspace, step by step', 'You need a Google Workspace admin who can use the Google Cloud console. Google Workspace cannot add people to Chest automatically, so invite them under People with their Google Workspace email first.', [
  `Open ${b('console.cloud.google.com')} signed in with your Workspace account, and pick or create a project for Chest at the top of the page.`,
  `Choose ${b('Google Auth Platform')} (in older consoles ${b('APIs & Services › OAuth consent screen')}). Fill in the app name (Chest) and a support email. Under ${b('Audience')} choose ${b('Internal')}, so only people in your organisation can use it.`,
  `Choose ${b('Clients › Create client')} (or ${b('APIs & Services › Credentials › Create credentials › OAuth client ID')}). ${b('Application type')}: ${b('Web application')}. Under ${b('Authorized redirect URIs')} choose ${b('Add URI')} and paste ${v(c.callback)}. ${b('Create')}.`,
  `Copy the ${b('Client ID')} and ${b('Client secret')} it shows into Chest below.`,
  `In Chest choose ${b('OpenID Connect')}, type ${b('Google')} as the button name, and set ${b('Provider address')} to ${v('https://accounts.google.com')}. Keep ${b('In the request header')}. ${b('Save identity provider')}.`,
 ])
 const entra = guide('Microsoft Entra ID, step by step', 'Entra ID is the sign-in service behind Microsoft 365. You need to be a Cloud Application Administrator or Application Administrator. This uses SAML, then turns on automatic user setup.', [
  `In the Microsoft Entra admin center choose ${b('Enterprise apps')} (${b('Identity › Applications › Enterprise applications')}), then ${b('New application › Create your own application')}. Name it Chest, pick ${b('Integrate any other application you don’t find in the gallery (Non-gallery)')} and ${b('Create')}.`,
  `${b('Single sign-on › SAML')}. In ${b('Basic SAML Configuration › Edit')}: ${b('Identifier (Entity ID)')} ${v(c.entity)}; ${b('Reply URL (Assertion Consumer Service URL)')} ${v(c.acs)}. ${b('Save')}.`,
  `In ${b('Attributes & Claims › Edit')}, open ${b('Unique User Identifier (Name ID)')} and set ${b('Name identifier format')} to ${b('Persistent')}. Leave the email address claim as Entra sets it.`,
  `In ${b('SAML Certificates › Edit')}, set ${b('Signing Option')} to ${b('Sign SAML response and assertion')} and ${b('Signing Algorithm')} to ${b('SHA-256')}. ${b('Save')}. Then download ${b('Certificate (Base64)')}, open it in a text editor, and paste all of it into Chest’s ${b('Provider certificate')}.`,
  `From the ${b('Set up Chest')} section copy ${b('Login URL')} into Chest’s ${b('Provider sign-in page')} and ${b('Microsoft Entra Identifier')} into ${b('Provider address')}. In Chest choose ${b('SAML 2.0')} and type ${b('Microsoft')} as the button name. ${b('Save identity provider')}.`,
  `${b('Users and groups › Add user/group')}: choose who may use Chest.`,
  `Automatic user setup: ${b('Provisioning')}, set ${b('Provisioning Mode')} to ${b('Automatic')}. ${b('Tenant URL')} ${v(c.base)}; ${b('Secret Token')}: a token from ${b('Issue SCIM token')} below. ${b('Test Connection')}, ${b('Save')}, then set ${b('Provisioning Status')} to ${b('On')}. If people’s sign-in names differ from their email addresses, change the ${b('userName')} mapping under ${b('Mappings')} to ${b('mail')}. ${scimNote}`,
 ])
 return `<h3>Step-by-step for your provider</h3><p>Open the one your company uses. Other providers have the same pieces under similar names.</p>${okta}${google}${entra}`
}
