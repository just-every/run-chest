// Isolated provider edge: no application bindings, Node access or live network.
export default {async fetch(request,{fixture}) {
 const url=new URL(request.url);
 if(url.origin!=='https://scanner.example.invalid'||url.pathname!=='/scan'||request.method!=='POST')return new Response('Unknown provider edge',{status:502});
 if(!fixture?.token||request.headers.get('authorization')!==`Bearer ${fixture.token}`)return new Response('Processor authentication refused',{status:401});
 const bytes=await request.arrayBuffer(),checksum=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(request.headers.get('x-content-sha256')!==checksum||Number(request.headers.get('content-length'))!==bytes.byteLength)return new Response('Invalid native scanner payload',{status:422});
 const source=new TextDecoder().decode(bytes),infected=source.includes('CHEST-QUARANTINE-FIXTURE');
 return Response.json({checksum,size:bytes.byteLength,state:infected?'infected':'clean',sensitive:false,reason:infected?'Native quarantine fixture':'No threat detected',engine:'Conformance processor'});
}};
