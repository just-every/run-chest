const decode=value=>value.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const etag=response=>(response.headers.get('etag')??'').replaceAll('"','');
function metadataHeaders({httpMetadata={},customMetadata={}}={}) {
 const fields={contentType:'content-type',contentLanguage:'content-language',contentDisposition:'content-disposition',contentEncoding:'content-encoding',cacheControl:'cache-control',cacheExpiry:'expires'},headers={};
 for(const [key,name]of Object.entries(fields))if(httpMetadata[key]!==undefined)headers[name]=httpMetadata[key] instanceof Date?httpMetadata[key].toUTCString():httpMetadata[key];
 for(const [key,value]of Object.entries(customMetadata))headers['x-amz-meta-'+key]=value;
 return headers;
}

// Adapt the signed owner object transport to the real archive service's R2 API.
export function objectBinding(client) {
 const send=client.request;
 return {
  async list({prefix='',cursor,limit=1000,include=[]}={}) {
   const xml=await (await send('GET','',{'list-type':'2',prefix,'max-keys':String(limit),...(cursor?{'continuation-token':cursor}:{})})).text();
   const objects=[...xml.matchAll(/<Contents>[\s\S]*?<Key>([^<]*)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)].map(match=>({key:decode(match[1]),size:Number(match[2])}));
   if(include.length)for(const object of objects){
    const head=await send('HEAD',object.key,{},undefined,{'accept-encoding':'identity'});object.etag=etag(head);object.httpMetadata={};object.customMetadata={};
    for(const [field,name]of Object.entries({contentType:'content-type',contentLanguage:'content-language',contentDisposition:'content-disposition',contentEncoding:'content-encoding',cacheControl:'cache-control',cacheExpiry:'expires'})){
     const value=head.headers.get(name);if(value!==null)object.httpMetadata[field]=field==='cacheExpiry'?new Date(value):value;
    }
    for(const [name,value]of head.headers)if(name.startsWith('x-amz-meta-'))object.customMetadata[name.slice(11)]=value;
   }
   const truncated=/<IsTruncated>true<\/IsTruncated>/.test(xml),next=/<NextContinuationToken>([^<]*)/.exec(xml)?.[1];
   if(truncated&&!next)throw Error('Hosted restore received an invalid object cursor.');
   return {objects,truncated,...(next?{cursor:decode(next)}:{})};
  },
  async get(key,{range}={}) {
   const response=await send('GET',key,{},undefined,{'accept-encoding':'identity',...(range?{range:`bytes=${range.offset}-${range.offset+range.length-1}`}:{})});
   return {body:response.body,etag:etag(response),size:Number(response.headers.get('content-length')),arrayBuffer:()=>response.arrayBuffer()};
  },
  async put(key,bytes,metadata){await send('PUT',key,{},bytes,metadataHeaders(metadata));},
  async delete(key){await client.delete(key);},
  async createMultipartUpload(key,metadata) {
   const xml=await (await send('POST',key,{uploads:''},undefined,metadataHeaders(metadata))).text();
   const uploadId=/<UploadId>([^<]*)/.exec(xml)?.[1];
   if(!uploadId)throw Error('Hosted restore could not begin an original upload.');
   const query={uploadId:decode(uploadId)};
   return {
    async uploadPart(partNumber,bytes){const response=await send('PUT',key,{...query,partNumber:String(partNumber)},bytes);const value=etag(response);if(!value)throw Error('Hosted restore original part was not acknowledged.');return {partNumber,etag:value};},
    async complete(parts){const payload='<CompleteMultipartUpload>'+parts.map(part=>`<Part><PartNumber>${part.partNumber}</PartNumber><ETag>${escape(part.etag)}</ETag></Part>`).join('')+'</CompleteMultipartUpload>';const result=await (await send('POST',key,query,payload,{'content-type':'application/xml'})).text();if(!/<CompleteMultipartUploadResult[\s>]/.test(result)||/<Error[\s>]/.test(result))throw Error('Hosted restore original upload did not complete.');},
    async abort(){await send('DELETE',key,query);},
   };
  },
 };
}
