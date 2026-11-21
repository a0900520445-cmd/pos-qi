/* 掃碼辨識：照片分區掃描、二值化、多引擎備援 */
const cv=document.createElement("canvas"),cx=cv.getContext("2d",{willReadFrequently:true});
// 解碼
const wait=()=>new Promise(r=>setTimeout(r,0));
function binarize(d){
  const px=d.data,n=px.length/4,g=new Uint8Array(n),h=new Array(256).fill(0);
  for(let i=0;i<n;i++){g[i]=(px[4*i]*77+px[4*i+1]*150+px[4*i+2]*29)>>8;h[g[i]]++}
  let sum=0;for(let t=0;t<256;t++)sum+=t*h[t];
  let wB=0,sB=0,mx=0,th=127;
  for(let t=0;t<256;t++){wB+=h[t];if(!wB)continue;const wF=n-wB;if(!wF)break;sB+=t*h[t];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>mx){mx=v;th=t}}
  const o=new Uint8ClampedArray(px.length);
  for(let i=0;i<n;i++){const v=g[i]>th?255:0;o[4*i]=o[4*i+1]=o[4*i+2]=v;o[4*i+3]=255}
  return o;
}
function zx(){
  try{
    if(!window.ZXing)return null;
    const src=new ZXing.HTMLCanvasElementLuminanceSource(cv),bm=new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src));
    const h=new Map([[ZXing.DecodeHintType.TRY_HARDER,true],[ZXing.DecodeHintType.POSSIBLE_FORMATS,[ZXing.BarcodeFormat.QR_CODE]]]);
    return new ZXing.MultiFormatReader().decode(bm,h).getText();
  }catch(e){return null}
}
function rect(b,sx,sy,sw,sh,L,deep){
  sx=Math.max(0,sx);sy=Math.max(0,sy);sw=Math.min(sw,b.width-sx);sh=Math.min(sh,b.height-sy);
  if(sw<40||sh<40)return null;
  const s=Math.min(1,L/Math.max(sw,sh));
  cv.width=Math.max(1,Math.round(sw*s));cv.height=Math.max(1,Math.round(sh*s));
  cx.drawImage(b,sx,sy,sw,sh,0,0,cv.width,cv.height);
  const d=cx.getImageData(0,0,cv.width,cv.height);
  let r=jsQR(d.data,d.width,d.height,{inversionAttempts:deep?"attemptBoth":"dontInvert"});
  if(r&&r.data)return r.data;
  if(deep){
    r=jsQR(binarize(d),d.width,d.height,{inversionAttempts:"attemptBoth"});
    if(r&&r.data)return r.data;
    return zx();
  }
  return null;
}
async function toBitmap(f){
  try{return await createImageBitmap(f,{imageOrientation:"from-image"})}catch(e){}
  try{return await createImageBitmap(f)}catch(e){}
  const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>{const w=i.naturalWidth||i.width,h=i.naturalHeight||i.height;if(!w||!h){rej(new Error("圖片尺寸為 0"));return}const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(i,0,0);res(c)};i.onerror=()=>rej(new Error("瀏覽器無法解碼這張圖片"));i.src=src});
  try{return await load(URL.createObjectURL(f))}catch(e){}
  const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("檔案無法讀取"));r.readAsDataURL(f)});
  return await load(url);
}
async function decodeAll(b){
  const W=b.width,H=b.height,m=Math.max(W,H),t0=Date.now();
  if("BarcodeDetector" in window){try{const r=await new BarcodeDetector({formats:["qr_code"]}).detect(b);if(r&&r[0]&&r[0].rawValue)return r[0].rawValue}catch(e){}}
  const jobs=[[0,0,W,H,1000,true],[0,0,W,H,640,true],[W*.2,H*.2,W*.6,H*.6,1000,true],[W*.3,H*.3,W*.4,H*.4,900,true]];
  for(const f of [.4,.25]){
    const T=Math.round(m*f),st=Math.round(T/2);
    for(let y=0;y<H;y+=st)for(let x=0;x<W;x+=st)jobs.push([x,y,T,T,Math.min(1200,T),false]);
  }
  for(let i=0;i<jobs.length;i++){
    const j=jobs[i],r=rect(b,j[0],j[1],j[2],j[3],j[4],j[5]);
    if(r)return r;
    const pg=$("#pg");if(pg)pg.textContent=`已檢查 ${Math.round((i+1)/jobs.length*100)}%`;
    if(Date.now()-t0>30000)break;
    await wait();
  }
  return null;
}

