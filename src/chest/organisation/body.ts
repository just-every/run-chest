import { insist } from '../model'
export async function boundedForm(request:Request,limit:number) {
 insist((request.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'),'form_required',415)
 const reader=request.body?.getReader(),parts:Uint8Array[]=[];let size=0
 if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;insist(size<=limit,'request_too_large',413);parts.push(value)}}finally{void reader.cancel()}
 const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length}
 return new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
