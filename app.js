// الحروف
const latin_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const arabic_letters = ["ا","أ","إ","آ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز",
  "س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ؤ","ي","ى","ئ","ة"];

// الوضع الليلي
document.getElementById("toggleTheme").onclick = () => document.body.classList.toggle("dark");

// تغيير لون الثيم
document.getElementById("themeColor").onchange = (e) => {
  let color = e.target.value;
  document.querySelectorAll("button").forEach(b=>b.style.background=color);
  document.querySelector("thead").style.background=color;
};

// توليد أرقام عشوائية
function generateKeystream(n, dist, params, seed){
  let arr=[]; Math.seedrandom(seed);
  for(let i=0;i<n;i++){
    let val=0;
    switch(dist){
      case "Uniform": val=Math.floor(Math.random()*(params.b-params.a+1)+params.a); break;
      case "Normal": val=Math.round(randomNormal(params.mean,params.sd)); break;
      case "Poisson": val=randomPoisson(params.lambda); break;
      case "NegBin": val=randomNegBin(params.size,params.prob); break;
    }
    arr.push(val);
  }
  return arr;
}

// Normal - Box-Muller
function randomNormal(mean=0, sd=1){
  let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random();
  return mean+sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

// Poisson - Knuth
function randomPoisson(lambda){
  let L=Math.exp(-lambda),p=1,k=0; do{k++;p*=Math.random();}while(p>L); return k-1;
}

// Negative Binomial
function randomNegBin(r,p){
  let count=0; for(let i=0;i<r;i++){ let x=0; while(Math.random()>p)x++; count+=x; } return count;
}

// تحويل حرف لكود
function charToCode(char){
  if(/[A-Za-z]/.test(char)) return {alpha:"latin", base:latin_letters.length, code:latin_letters.indexOf(char.toUpperCase())};
  else if(arabic_letters.includes(char)) return {alpha:"arabic", base:arabic_letters.length, code:arabic_letters.indexOf(char)};
  return {alpha:"other", base:null, code:null};
}

// كود لحرف
function codeToChar(codeObj){
  if(codeObj.alpha=="latin") return latin_letters[codeObj.code];
  if(codeObj.alpha=="arabic") return arabic_letters[codeObj.code];
  return codeObj.char||"";
}

// تحديث الجداول
function updateTable(id, chars, codes, keys, cipher=false){
  let table=document.getElementById(id); table.innerHTML="";
  let header=document.createElement("thead");
  header.innerHTML=`<tr><th>الحرف</th><th>الكود</th><th>المفتاح المستخدم</th><th>${cipher?"الحرف المشفر":"الحرف المفكك"}</th></tr>`;
  table.appendChild(header);
  let body=document.createElement("tbody");
  for(let i=0;i<chars.length;i++){
    let tr=document.createElement("tr");
    tr.innerHTML=`<td>${chars[i].char}</td><td>${codes[i]}</td><td>${keys[i]!==null?keys[i]:"-"}</td><td>${cipher?chars[i].cipherChar||chars[i].char:chars[i].char}</td>`;
    body.appendChild(tr);
  }
  table.appendChild(body);
}

// تشفير
function encryptText(text, dist, params, seed){
  let chars=Array.from(text).map(c=>({char:c,...charToCode(c)}));
  let used_idx=chars.map((v,i)=>v.alpha!="other"?i:null).filter(v=>v!=null);
  let ks=generateKeystream(used_idx.length, dist, params, seed);
  let cipher=[]; let keyUsed=[]; let j=0;
  for(let i=0;i<chars.length;i++){
    if(chars[i].alpha=="other"){ cipher.push(chars[i].char); keyUsed.push(null); continue; }
    let base=chars[i].base; let k=((ks[j]%base)+base)%base;
    keyUsed.push(k);
    let newCode=((chars[i].code+k)%base);
    chars[i].cipherChar=codeToChar({alpha:chars[i].alpha, code:newCode});
    cipher.push(chars[i].cipherChar);
    j++;
  }
  return {ciphertext:cipher.join(""), keyUsed:keyUsed, chars};
}

// فك التشفير
function decryptText(text, dist, params, seed){
  let chars=Array.from(text).map(c=>({char:c,...charToCode(c)}));
  let used_idx=chars.map((v,i)=>v.alpha!="other"?i:null).filter(v=>v!=null);
  let ks=generateKeystream(used_idx.length, dist, params, seed);
  let plain=[]; let j=0;
  for(let i=0;i<chars.length;i++){
    if(chars[i].alpha=="other"){ plain.push(chars[i].char); continue; }
    let base=chars[i].base; let k=((ks[j]%base)+base)%base;
    let newCode=((chars[i].code-k+base)%base);
    chars[i].plainChar=codeToChar({alpha:chars[i].alpha, code:newCode});
    plain.push(chars[i].plainChar);
    j++;
  }
  return {plaintext:plain.join(""), chars};
}

// الرسم البياني
let chart=null;
function updateChart(keys){
  let ctx=document.getElementById("dist_chart").getContext("2d");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{type:"bar",data:{labels:keys.map((v,i)=>i+1),datasets:[{label:"Key Value",data:keys,backgroundColor:keys.map(v=>"rgba(64,79,104,"+((v+1)/Math.max(...keys))+")")}]}});
}

// أحداث الأزرار
document.getElementById("encrypt_btn").onclick=()=>{
  let text=document.getElementById("plaintext").value;
  let dist=document.getElementById("dist").value;
  let seed=parseInt(document.getElementById("seed").value);
  let params={a:0,b:25,mean:0,sd:2,lambda:2,size:2,prob:0.5};
  let res=encryptText(text, dist, params, seed);
  document.getElementById("cipher_out").textContent=res.ciphertext;
  updateTable("enc_table", res.chars, res.chars.map(c=>c.code), res.keyUsed, true);
  updateChart(res.keyUsed.map(v=>v!==null?v:0));
};

document.getElementById("decrypt_btn").onclick=()=>{
  let text=document.getElementById("cipher_out").textContent;
  let dist=document.getElementById("dist").value;
  let seed=parseInt(document.getElementById("seed").value);
  let params={a:0,b:25,mean:0,sd:2,lambda:2,size:2,prob:0.5};
  let res=decryptText(text, dist, params, seed);
  document.getElementById("plain_out").textContent=res.plaintext;
  updateTable("dec_table", res.chars, res.chars.map(c=>c.code), [], false);
};