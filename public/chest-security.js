// WebAuthn uses the browser's platform authenticator / FIDO2 key. No private key leaves it.
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function api(action,response){const r=await fetch('/api/security',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,response})}),v=await r.json();if(!r.ok)throw Error(v.error||'Verification failed');return v}
for(const button of document.querySelectorAll('[data-webauthn]'))button.addEventListener('click',async()=>{
 const enroll=button.dataset.webauthn==='enroll',status=document.querySelector(enroll?'[data-webauthn-enroll-status]':'[data-webauthn-status]');button.disabled=true;
 try{
  status.textContent='Follow your browser’s authenticator prompt.';
  const options=await api(enroll?'webauthn-start':'webauthn-options');options.challenge=decode(options.challenge);
  for(const list of ['allowCredentials','excludeCredentials'])if(options[list])options[list]=options[list].map(c=>({...c,id:decode(c.id)}));
  if(options.user)options.user.id=decode(options.user.id);
  const credential=await navigator.credentials[enroll?'create':'get']({publicKey:options});if(!credential)throw Error('No authenticator response');
  const r=credential.response,response={id:credential.id,rawId:encode(credential.rawId),type:credential.type,clientExtensionResults:credential.getClientExtensionResults(),authenticatorAttachment:credential.authenticatorAttachment,response:{clientDataJSON:encode(r.clientDataJSON),...(enroll?{attestationObject:encode(r.attestationObject),transports:r.getTransports?.()||[]}:{authenticatorData:encode(r.authenticatorData),signature:encode(r.signature),userHandle:r.userHandle?encode(r.userHandle):null})}};
  const result=await api(enroll?'webauthn-enroll':'webauthn-verify',response);
  if(result.codes){status.textContent='Save these recovery codes privately. Each works once.';const pre=document.createElement('pre');pre.textContent=result.codes.join('\n');status.append(pre);const a=document.createElement('a');a.href='/security';a.className='btn';a.textContent='I saved my codes';status.append(a)}else location.assign('/app/files');
 }catch(error){status.textContent=error.name==='NotAllowedError'?'The authenticator prompt was canceled or timed out. Try again when ready.':error.message}finally{button.disabled=false}
});
