/* 收銀機主程式：商品、訂單、掃碼收款流程、交易紀錄 */
const $=s=>document.querySelector(s);
const fmt=n=>Number(n).toLocaleString("zh-TW"),p2=n=>String(n).padStart(2,"0");
let ITEMS=[];
let manage=false;
const saveItems=()=>{fetch("/api/products",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(ITEMS.map(x=>({name:x[0],price:x[1]})))}).then(r=>{if(!r.ok)throw 0}).catch(()=>note("商品儲存失敗，請確認伺服器是否運作。",true))};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let mode="items",typed="",cart=ITEMS.map(()=>0),busy=false,stream=null,txs=[],ac=null,lastB=null;
function due(){return mode==="items"?cart.reduce((a,c,i)=>a+c*ITEMS[i][1],0):Number(typed)||0}
const clock=()=>$("#clock").textContent=new Date().toLocaleString("zh-TW",{hour12:false,month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});
clock();setInterval(clock,1000);
function note(t,err){const n=$("#note");n.textContent=t;n.className="stat"+(err?" err":"")}

// 商品與鍵盤
function drawItems(){
  const L=ITEMS.map((x,i)=>`<button class="it${cart[i]?" on":""}${manage?" mg":""}" data-i="${i}" type="button"><em>${manage?"✕":cart[i]}</em><b>${esc(x[0])}</b><span class="num">NT$ ${x[1]}</span></button>`).join("");
  const emp=ITEMS.length?"":`<p class="emp">還沒有商品。在下面新增商品，或切到「輸入金額」直接輸入。</p>`;
  const act=ITEMS.length?`<button class="clr" id="clr" type="button">清除已選</button><button class="clr" id="mg" type="button">${manage?"完成":"刪除商品"}</button>`:"";
  $("#items").innerHTML=emp+L+`<form class="addf" id="addf"><input class="mi" id="in" placeholder="商品名稱" maxlength="12" aria-label="商品名稱"><input class="mi num" id="ip" type="number" inputmode="numeric" min="1" max="99999" placeholder="價格" aria-label="價格"><button class="b2" type="submit">新增</button></form>`+act;
  document.querySelectorAll(".it").forEach(b=>b.onclick=()=>{
    if(busy)return;const i=+b.dataset.i;
    if(manage){ITEMS.splice(i,1);cart.splice(i,1);saveItems();if(!ITEMS.length)manage=false}else cart[i]++;
    refresh();
  });
  $("#addf").onsubmit=e=>{
    e.preventDefault();const n=$("#in").value.trim(),p=parseInt($("#ip").value,10);
    if(!n||!(p>0)){note("請輸入商品名稱和價格。",true);return}
    ITEMS.push([n,p]);cart.push(0);saveItems();manage=false;refresh();note("已新增「"+n+"」。");
  };
  if($("#clr")){$("#clr").onclick=()=>{if(busy)return;cart=ITEMS.map(()=>0);refresh()};$("#mg").onclick=()=>{manage=!manage;refresh()}}
}
["1","2","3","4","5","6","7","8","9","清除","0","⌫"].forEach(k=>{
  const b=document.createElement("button");b.type="button";b.textContent=k;if(k==="清除")b.className="sm";
  b.onclick=()=>{if(busy)return;if(k==="清除")typed="";else if(k==="⌫")typed=typed.slice(0,-1);else if(typed.length<6)typed=(typed+k).replace(/^0+/,"");refresh()};
  $("#pad").appendChild(b);
});
function setMode(m){mode=m;$("#t1").setAttribute("aria-selected",m==="items");$("#t2").setAttribute("aria-selected",m==="keys");$("#items").hidden=m!=="items";$("#pad").hidden=m!=="keys";refresh()}
$("#t1").onclick=()=>setMode("items");$("#t2").onclick=()=>setMode("keys");
function refresh(){
  const d=due();$("#amt").textContent=fmt(d);
  if(mode==="items"){drawItems();const s=cart.map((c,i)=>c?`${ITEMS[i][0]} ×${c}`:"").filter(Boolean).join("、");$("#sub").textContent=s||"點選商品加入"}
  else $("#sub").textContent="手動輸入金額";
  $("#photo").disabled=$("#livebtn").disabled=!d;
  drawTicket();
  if(d)note("按下方「LINE Pay 掃碼收款」，拍下顧客的 QR Code。");
}
function drawTicket(){
  const L=[];let q=0;
  if(mode==="items")cart.forEach((c,i)=>{if(c){q+=c;L.push(`<li><span>${esc(ITEMS[i][0])}</span><span class="q num"><button data-m="${i}" type="button" aria-label="減少">−</button>${c}<button data-p="${i}" type="button" aria-label="增加">+</button></span><span class="p num">${fmt(c*ITEMS[i][1])}</span></li>`)}});
  else if(due()){q=1;L.push(`<li><span>手動輸入金額</span><span class="q num">1</span><span class="p num">${fmt(due())}</span></li>`)}
  const t=$("#ticket");t.innerHTML=L.join("")||`<li class="blank">尚無品項</li>`;
  t.querySelectorAll("[data-m]").forEach(b=>b.onclick=()=>{if(busy)return;cart[+b.dataset.m]--;refresh()});
  t.querySelectorAll("[data-p]").forEach(b=>b.onclick=()=>{if(busy)return;cart[+b.dataset.p]++;refresh()});
  $("#qty").textContent=q;$("#ono").textContent="#"+String(txs.length+1).padStart(4,"0");
}
function resetAll(){cart=ITEMS.map(()=>0);typed="";closeSheet();refresh();note("請選擇商品或輸入金額。")}

// 提示音
function unlock(){try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.resume()}catch(e){}}
function beep(ok){
  if(navigator.vibrate)navigator.vibrate(ok?60:[80,60,80]);
  if(!ac)return;try{const o=ac.createOscillator(),g=ac.createGain();o.type=ok?"sine":"square";o.frequency.value=ok?880:190;g.gain.value=.14;o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+(ok?.18:.34))}catch(e){}
}
function sheet(cls,html){$("#host").innerHTML=`<div class="sheet ${cls}" role="alertdialog" aria-live="assertive">${html}</div>`}
function closeSheet(){$("#host").innerHTML="";busy=false}

// 拍照掃描
$("#photo").onclick=()=>{unlock();$("#file").click()};
$("#file").onchange=async e=>{
  const f=e.target.files[0];if(!f||!due()){e.target.value="";return}
  busy=true;sheet("wait",`<div class="spin"></div><div class="t">辨識中…</div><p id="pg" style="margin:0;color:var(--mute)">正在讀取照片裡的 QR Code</p>`);
  let why="";
  try{lastB=await toBitmap(f)}catch(err){why=(err&&(err.message||err.name))||"未知錯誤"}
  e.target.value="";
  if(why||!lastB){readFail("讀取失敗（"+why+"）");return}
  let text=null;
  try{text=await decodeAll(lastB)}catch(err){text=null;lastErr=(err&&err.message)||String(err)}
  if(text){onPayload(text);return}
  try{unreadable()}catch(err){readFail("顯示失敗（"+((err&&err.message)||"")+"）")}
};
function readFail(why){
  sheet("bad",`<div class="t">無法讀取照片</div><p>${esc(why)}。若是 iPhone，可到「設定 → 相機 → 格式」改成「最相容」後再拍。</p><button class="sb" id="again" type="button">再拍一次</button><button class="sb line" id="man2" type="button">手動輸入顧客付款金額</button><button class="sb line" id="cx" type="button">返回</button>`);
  beep(false);$("#again").onclick=()=>{closeSheet();$("#file").click()};$("#cx").onclick=closeSheet;
  $("#man2").onclick=()=>{$("#man2").outerHTML=`<input class="mi num" id="mi" type="number" inputmode="numeric" placeholder="例如 170" aria-label="顧客付款金額"><button class="sb" id="mok" type="button">確認</button>`;$("#mi").focus();$("#mok").onclick=()=>{const v=parseInt($("#mi").value,10);if(v>0)onPayload("LINE "+v)}};
}
let lastErr="";
function dbgInfo(){return "引擎："+(typeof jsQR==="function"?"jsQR 正常":"jsQR 缺少")+(window.ZXing?"、ZXing 正常":"、ZXing 缺少")+(lastB?`；照片 ${lastB.width}×${lastB.height}`:"")+(lastErr?`；錯誤：${lastErr}`:"")}
function unreadable(){
  const b=lastB,s=Math.min(1,900/Math.max(b.width,b.height)),c=document.createElement("canvas");
  c.width=Math.round(b.width*s);c.height=Math.round(b.height*s);c.getContext("2d").drawImage(b,0,0,c.width,c.height);
  sheet("bad",`<div class="t">沒偵測到 QR Code</div><p>點一下照片裡 QR Code 的位置，我會放大那一區再讀。</p><img id="pv" alt="剛拍的照片" src="${c.toDataURL("image/jpeg",.8)}"><p id="pm" style="margin:0 0 6px;font-size:12px;opacity:.85">${dbgInfo()}</p><button class="sb" id="again" type="button">重新拍照</button><button class="sb line" id="man" type="button">手動輸入顧客付款金額</button><button class="sb line" id="cx" type="button">返回</button>`);
  beep(false);
  $("#again").onclick=()=>{closeSheet();$("#file").click()};
  $("#cx").onclick=closeSheet;
  $("#man").onclick=()=>{$("#man").outerHTML=`<input class="mi num" id="mi" type="number" inputmode="numeric" placeholder="例如 170" aria-label="顧客付款金額"><button class="sb" id="mok" type="button">確認</button>`;$("#mi").focus();$("#mok").onclick=()=>{const v=parseInt($("#mi").value,10);if(v>0)onPayload("LINE "+v)}};
  $("#pv").onclick=async ev=>{
    const r=ev.target.getBoundingClientRect(),X=(ev.clientX-r.left)/r.width*b.width,Y=(ev.clientY-r.top)/r.height*b.height,m=Math.max(b.width,b.height);
    $("#pm").textContent="放大辨識中…";await wait();
    for(const h of [.08,.14,.22,.34]){
      const t=rect(b,X-m*h,Y-m*h,m*h*2,m*h*2,1000,true);
      if(t){onPayload(t);return}
      await wait();
    }
    $("#pm").textContent="這裡還是讀不到。請靠近一點、對焦後重拍，或改用手動輸入。";
  };
}

// 即時相機
$("#livebtn").onclick=async()=>{
  unlock();
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){note("此環境不支援即時相機，請用「掃描付款碼」。",true);return}
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280}},audio:false});
    const v=$("#video");v.srcObject=stream;await v.play();
    $("#lbn").textContent="NT$ "+fmt(due());$("#live").classList.add("on");busy=true;requestAnimationFrame(loop);
  }catch(e){note("即時相機無法開啟（"+e.name+"）。此頁面所在的環境可能封鎖了相機，請改用「掃描付款碼」。",true)}
};
function stopLive(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$("#live").classList.remove("on");busy=false}
$("#lclose").onclick=stopLive;
function loop(){
  if(!stream)return;const v=$("#video");
  if(v.readyState>=2&&v.videoWidth){
    const s=Math.min(1,640/v.videoWidth);cv.width=Math.round(v.videoWidth*s);cv.height=Math.round(v.videoHeight*s);
    cx.drawImage(v,0,0,cv.width,cv.height);
    const d=cx.getImageData(0,0,cv.width,cv.height),r=jsQR(d.data,d.width,d.height,{inversionAttempts:"attemptBoth"});
    if(r&&r.data){stopLive();onPayload(r.data);return}
  }
  requestAnimationFrame(loop);
}

// 金額判斷
function parse(t){const m=String(t).trim().match(/^LINE\s*(\d{1,6})$/i);const n=m?+m[1]:0;return n>0?n:null}
function onPayload(text){
  const paid=parse(text),need=due();
  if(!need){closeSheet();note("請先設定應收金額。",true);return}
  if(!paid){
    sheet("bad",`<div class="t">無效的付款碼</div><p>讀到的內容是「${String(text).replace(/[<>&"]/g,"").slice(0,30)}」。LINE Pay 付款碼格式應為「LINE 金額」，例如 LINE 170。</p><button class="sb" id="again" type="button">重新掃描</button><button class="sb line" id="back" type="button">返回</button>`);
    beep(false);$("#again").onclick=()=>{closeSheet();$("#file").click()};$("#back").onclick=closeSheet;return;
  }
  busy=true;
  sheet("wait",`<div class="spin"></div><div class="t">已讀取 NT$ ${fmt(paid)}</div><p style="margin:0;color:var(--mute)">向 LINE Pay 確認中…</p>`);
  setTimeout(()=>result(need,paid),1200);
}
function result(need,paid){
  const d=new Date(),time=`${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`,id=String(Date.now()).slice(-10),ok=paid===need;
  let title,big,why;
  if(ok){title="收款完成";big=`NT$ ${fmt(need)}`}
  else if(paid<need){title="付款失敗：金額不足";big=`差 NT$ ${fmt(need-paid)}`;why=`顧客的付款碼是 NT$ ${fmt(paid)}，應收 NT$ ${fmt(need)}。請顧客重新出示正確金額的付款碼。`}
  else{title="付款失敗：金額超過";big=`多 NT$ ${fmt(paid-need)}`;why=`顧客的付款碼是 NT$ ${fmt(paid)}，超過應收 NT$ ${fmt(need)}。金額必須剛好相符。`}
  txs.unshift({id,need,paid,time,ok,note:ok?"金額相符":(paid<need?"金額不足":"金額超過")});
  fetch("/api/transactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(txs[0])}).catch(()=>{});
  const rows=`<dl><div><dt>應收</dt><dd class="num">NT$ ${fmt(need)}</dd></div><div><dt>顧客付款碼</dt><dd class="num">NT$ ${fmt(paid)}</dd></div><div><dt>交易編號</dt><dd class="num">${id}</dd></div><div><dt>時間</dt><dd class="num">${time}</dd></div></dl>`;
  if(ok){sheet("ok",`<div class="t">${title}</div><div class="a num">${big}</div>${rows}<button class="sb" id="nx" type="button">收下一筆</button>`);$("#nx").onclick=resetAll}
  else{sheet("bad",`<div class="t">${title}</div><div class="a num">${big}</div><p>${why}</p>${rows}<button class="sb" id="rt" type="button">重新掃描</button><button class="sb line" id="cc" type="button">取消這筆</button>`);
    $("#rt").onclick=()=>{closeSheet();$("#file").click()};$("#cc").onclick=resetAll}
  beep(ok);busy=false;paint();
}
function paint(){
  $("#list").innerHTML=txs.map(t=>`<li><div><span class="${t.ok?"ok":"no"}">${t.ok?"成功":"失敗"}</span>　<span class="num">${t.id}</span><small class="num">${t.time}　${t.note}</small></div><div style="text-align:right"><b class="num">NT$ ${fmt(t.paid)}</b><small class="num">應收 ${fmt(t.need)}</small></div></li>`).join("");
  const s=txs.filter(t=>t.ok);$("#cnt").textContent=`成功 ${s.length} 筆`;$("#sum").textContent="NT$ "+fmt(s.reduce((a,t)=>a+t.need,0));
}

// 測試 QR
function gen(){
  const n=parseInt($("#gamt").value,10),box=$("#qr");box.innerHTML="";
  if(!(n>0&&n<=999999)){box.textContent="請輸入 1 到 999999 的金額";$("#cap").textContent="";return}
  try{const q=qrcode(0,"M");q.addData("LINE "+n);q.make();box.innerHTML=`<img alt="LINE ${n} 的 QR Code" style="width:min(100%,240px);height:auto;image-rendering:pixelated" src="${q.createDataURL(8,16)}">`}catch(e){box.textContent="QR 產生失敗";return}
  $("#cap").textContent="LINE "+n;
}
$("#gbtn").onclick=gen;gen();
[100,170,200].forEach(n=>{const b=document.createElement("button");b.type="button";b.className="chip";b.textContent="模擬掃到 LINE "+n;
  b.onclick=()=>{unlock();if(!due()){note("請先設定應收金額。",true);window.scrollTo({top:0,behavior:"smooth"});return}onPayload("LINE "+n)};$("#chips").appendChild(b)});
(async function init(){
  try{
    const [p,t]=await Promise.all([fetch("/api/products").then(r=>r.json()),fetch("/api/transactions").then(r=>r.json())]);
    ITEMS=p.map(x=>[x.name,x.price]);cart=ITEMS.map(()=>0);txs=t;paint();
  }catch(e){note("無法連線到伺服器，目前資料不會被儲存。",true)}
  refresh();
})();
