const latin_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const arabic_letters = ["ا","أ","إ","آ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز",
                        "س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن",
                        "ه","و","ؤ","ي","ى","ئ","ة"];

document.getElementById("encrypt_btn").onclick = function(){
  let text = document.getElementById("plaintext").value;
  let seed = parseInt(document.getElementById("seed").value);
  let dist = document.getElementById("dist").value;
  // توليد المفتاح وتشفير النص هنا
  // تحديث #cipher_out و #enc_table
};