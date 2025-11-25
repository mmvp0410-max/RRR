// الحروف
const latin_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const arabic_letters = ["ا","أ","إ","آ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز",
                        "س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن",
                        "ه","و","ؤ","ي","ى","ئ","ة"];

// وضع ليلي
document.getElementById("toggleTheme").onclick = () => {
  document.body.classList.toggle("dark");
};

// توليد أرقام عشوائية حسب التوزيع
function generateKeystream(n, dist, params, seed){
  let arr = [];
  Math.seedrandom(seed);
  for(let i=0;i<n;i++){
    let val=0;
    switch(dist){
      case "Uniform":
        val = Math.floor(Math.random()*(params.b-params.a+1)+params.a);
        break;
      case "Normal":
        val = Math.round(randomNormal(params.mean,params.sd));
        break;
      case "Poisson":
        val = randomPoisson(params.lambda);
        break;
      case "NegBin":
        val = randomNegBin(params.size, params.prob);
        break;
    }
    arr.push(val);
  }
  return arr;
}

// الدوال المساعدة للتوزيعات (يمكن إضافة توليد Poisson/NegBin)

// تحويل الحروف إلى كود وفكها
function charToCode(char){
  if(/[A-Za-z]/.test(char)){
    return {alpha:"latin", base:latin_letters.length, code:latin_letters.indexOf(char.toUpperCase())};
  } else if(arabic_letters.includes(char)){
    return {alpha:"arabic", base:arabic_letters.length, code:arabic_letters.indexOf(char)};
  } else return {alpha:"other", base:null, code:null};
}

function codeToChar(codeObj){
  if(codeObj.alpha=="latin") return latin_letters[codeObj.code];
  if(codeObj.alpha=="arabic") return arabic_letters[codeObj.code];
  return codeObj.char || "";
}

// تشفير النص
function encryptText(text, dist, params, seed){
  let chars = Array.from(text);
  let map = chars.map(c=>charToCode(c));
  let used_idx = map.map((v,i)=>v.alpha!="other"?i:null).filter(v=>v!=null);
  let ks = generateKeystream(used_idx.length, dist, params, seed);
  let cipher = [];
  let j=0;
  let keyUsed=[];
  for(let i=0;i<chars.length;i++){
    if(map[i].alpha=="other"){
      cipher.push(chars[i]); keyUsed.push(null); continue;
    }
    let base = map[i].base;
    let k = ((ks[j] % base) + base) % base;
    keyUsed.push(k);
    let newCode = ((map[i].code + k) % base);
    cipher.push(codeToChar({alpha:map[i].alpha, code:newCode}));
    j++;
  }
  return {ciphertext:cipher.join(""), keyUsed:keyUsed};
}

// فك التشفير
function decryptText(text, dist, params, seed){
  let chars = Array.from(text);
  let map = chars.map(c=>charToCode(c));
  let used_idx = map.map((v,i)=>v.alpha!="other"?i:null).filter(v=>v!=null);
  let ks = generateKeystream(used_idx.length, dist, params, seed);
  let plain=[];
  let j=0;
  for(let i=0;i<chars.length;i++){
    if(map[i].alpha=="other"){ plain.push(chars[i]); continue; }
    let base = map[i].base;
    let k = ((ks[j] % base)+base)%base;
    let newCode = ((map[i].code - k + base)%base);
    plain.push(codeToChar({alpha:map[i].alpha, code:newCode}));
    j++;
  }
  return plain.join("");
}

// التعامل مع الأزرار
document.getElementById("encrypt_btn").onclick = ()=>{
  let text = document.getElementById("plaintext").value;
  let dist = document.getElementById("dist").value;
  let seed = parseInt(document.getElementById("seed").value);
  let params = {a:0,b:25, mean:0, sd:2, lambda:2, size:2, prob:0.5};
  let res = encryptText(text, dist, params, seed);
  document.getElementById("cipher_out").textContent = res.ciphertext;
};

document.getElementById("decrypt_btn").onclick = ()=>{
  let text = document.getElementById("cipher_out").textContent;
  let dist = document.getElementById("dist").value;
  let seed = parseInt(document.getElementById("seed").value);
  let params = {a:0,b:25, mean:0, sd:2, lambda:2, size:2, prob:0.5};
  let res = decryptText(text, dist, params, seed);
  document.getElementById("plain_out").textContent = res;
};