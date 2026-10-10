import sharp from "sharp";
import { MAX_MANAGED_BYTES } from "../assets/source";
import { AcquisitionFailure, type ImageProvider, type ImageRequest, type ExecutionContext, type ImageResult } from "./contracts";

const supported = ["gpt-image-1.5","gpt-image-2","gpt-image-2-2026-04-21","gpt-image-2.5-sunburst","gpt-image-2.5-flare","gpt-image-2.5-sunburst-2026-09-08","gpt-image-2.5-flare-2026-09-08"];
// No secret-bearing configuration is serialized. Tests inject transport; core
// sees only ImageResult or finite AcquisitionFailure, never provider responses.
export function openAIImageProvider(config: {key?:string;model?:string;timeoutMs?:number;transport?:typeof fetch} = {}): ImageProvider {
  const key=config.key ?? process.env.OPENAI_API_KEY;
  const model=config.model ?? process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1.5";
  const timeout=config.timeoutMs ?? 180000;
  const assertConfigured=()=> {
    if(!key?.trim()) throw new AcquisitionFailure("credentials-absent");
    if(!supported.includes(model) || !Number.isSafeInteger(timeout) || timeout<1 || timeout>240000) throw new AcquisitionFailure("invalid-request");
  };
  return {id:"openai",model,assertConfigured,async generateImage(request:ImageRequest,context:ExecutionContext):Promise<ImageResult> {
    assertConfigured();
    if(request.size!=="1536x1024" || request.quality!=="medium" || !request.prompt || request.prompt.length>4000) throw new AcquisitionFailure("invalid-request");
    let requestId:string|null=null;
    try {
      const response=await (config.transport??fetch)("https://api.openai.com/v1/images/generations", {
        method:"POST",redirect:"error",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","X-Client-Request-Id":context.attemptId},
        body:JSON.stringify({model,prompt:request.prompt,n:1,size:request.size,quality:request.quality,output_format:"png",background:"opaque",moderation:"auto"}),
        signal: context.signal ? AbortSignal.any([context.signal,AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
      });
      const header=response.headers.get("x-request-id");
      requestId=header && /^[a-zA-Z0-9_-]{1,160}$/.test(header) ? header : null;
      if(!response.body) throw new AcquisitionFailure("invalid-response",requestId);
      const reader=response.body.getReader(); const chunks:Uint8Array[]=[];let length=0;
      for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>MAX_MANAGED_BYTES*1.4+100000){await reader.cancel();throw new AcquisitionFailure("invalid-response",requestId);}chunks.push(part.value);}
      let body:Record<string,unknown>;try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new AcquisitionFailure("invalid-response",requestId);}
      if(!response.ok){
        const code=(body.error as {code?:unknown})?.code;
        throw new AcquisitionFailure(code==="moderation_blocked"||code==="content_policy_violation"?"refusal":response.status===429?"rate-limit":response.status>=500?"transient":"invalid-request",requestId);
      }
      const data=body.data as {b64_json?:unknown}[];
      if(!Array.isArray(data)||data.length!==1||typeof data[0]?.b64_json!=="string"||!data[0].b64_json||!/^[A-Za-z0-9+/]+={0,2}$/.test(data[0].b64_json)) throw new AcquisitionFailure("invalid-response",requestId);
      const bytes=Buffer.from(data[0].b64_json,"base64");
      if(!bytes.length||bytes.length>MAX_MANAGED_BYTES) throw new AcquisitionFailure("invalid-response",requestId);
      const info=await sharp(bytes,{limitInputPixels:40_000_000}).metadata().catch(()=>{throw new AcquisitionFailure("invalid-response",requestId);});
      if(info.format!=="png"||info.width!==1536||info.height!==1024||(info.pages??1)!==1) throw new AcquisitionFailure("invalid-response",requestId);
      const usage:Record<string,number>={};const raw=body.usage as Record<string,unknown>|undefined;
      for(const name of ["input_tokens","output_tokens","total_tokens"]) if(Number.isSafeInteger(raw?.[name])&&Number(raw?.[name])>=0)usage[name]=Number(raw?.[name]);
      const detail=raw?.input_tokens_details as Record<string,unknown>|undefined;
      for(const name of ["text_tokens","image_tokens"]) if(Number.isSafeInteger(detail?.[name])&&Number(detail?.[name])>=0)usage[`input_${name}`]=Number(detail?.[name]);
      return {provider:"openai",model,requestId,bytes,width:info.width,height:info.height,mimeType:"image/png",usage,actualMicros:null,policy:"passed",generatedAt:new Date().toISOString()};
    } catch(error){if(error instanceof AcquisitionFailure)throw error;
      // A dropped connection cannot prove that the provider did not execute.
      throw new AcquisitionFailure("timeout-uncertain",requestId);
    }
  }};
}
