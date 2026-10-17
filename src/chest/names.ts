// rer names a new owner "Owner" until they choose their name at Finish setup or in settings. What other people read
// (an invitation, a file request, a notice email, the audit trail) never names someone by that placeholder: until a
// real name is set, their email address stands for them.
const placeholder = 'Owner'
export const personName = (name: unknown, email: string) => typeof name === 'string' && name.trim() && name.trim() !== placeholder ? name.trim() : email
// "Rosa Diaz (rosa@example.com)", or the bare address when no name is set.
export const personLine = (name: unknown, email: string) => { const named = personName(name, email); return named === email ? email : `${named} (${email})` }
