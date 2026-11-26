// Enforce actual streamed body size even when Content-Length is omitted.
export async function boundedText(request,maxBytes){
 const length=request.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))
  throw Object.assign(Error('Request too large'),{status:413});
 if(!request.body)throw Object.assign(Error('Invalid JSON'),{status:400});
 const reader=request.body.getReader();let bytes=0;const parts=[];
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   bytes+=value.byteLength;
   if(bytes>maxBytes){try{await reader.cancel();}catch{}throw Object.assign(Error('Request too large'),{status:413});}
   parts.push(value);
  }
 }finally{reader.releaseLock();}
 const all=new Uint8Array(bytes);let offset=0;
 for(const part of parts){all.set(part,offset);offset+=part.byteLength;}
 try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(all);}
 catch{throw Object.assign(Error('Invalid UTF-8'),{status:400});}
}
export async function boundedJson(request,maxBytes){
 const text=await boundedText(request,maxBytes);
 try{return JSON.parse(text);}
 catch{throw Object.assign(Error('Invalid JSON'),{status:400});}
}
