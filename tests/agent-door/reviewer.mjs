export default async function ({request,origin,email,owner,mail}) {
 const response=await request(new URL('/api/chest/people',origin).href,{method:'POST',headers:{Origin:origin,Cookie:owner.cookie,'Content-Type':'application/json'},body:JSON.stringify({action:'invite',email,name:email.startsWith('outside')?'Outside reviewer':'Records colleague'})});
 if(!response.ok){const body=await response.json();throw Error('Native invitation failed')}await response.body.cancel();
 const messages=await mail.read();const message=messages.findLast(m=>m.text?.includes('/auth/confirm?'));
 const match=message?.text.match(/https?:\/\/[^\s<>]+\/auth\/confirm\?[^\s<>]+/);
 if(!match)throw Error('Native invitation mail unavailable');
 const token=new URL(match[0]).searchParams.get('token');
 return request(new URL('/auth/confirm',origin).href,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({token})});
}
