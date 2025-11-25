// app.js (مصحح وآمن)

// الحروف
const latin_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const arabic_letters = ["ا","أ","إ","آ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز",
  "س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ؤ","ي","ى","ئ","ة"];

// أمان: تحقق أن DOM جاهز
document.addEventListener("DOMContentLoaded", () => {

  // عناصر
  const toggleThemeBtn = document.getElementById("toggleTheme");
  const themeColorSelect = document.getElementById("themeColor");
  const encryptBtn = document.getElementById("encrypt_btn");
  const decryptBtn = document.getElementById("decrypt_btn");
  const plaintextEl = document.getElementById("plaintext");
  const cipherOut = document.getElementById("cipher_out");
  const plainOut = document.getElementById("plain_out");
  const distSelect = document.getElementById("dist");
  const seedEl = document.getElementById("seed");
  const encTable = document.getElementById("enc_table");
  const decTable = document.getElementById("dec_table");
  const chartCanvas = document.getElementById("dist_chart");

  // الوضع الليلي
  if (toggleThemeBtn) toggleThemeBtn.addEventListener("click", () => document.body.classList.toggle("dark"));

  // تغيير لون الثيم: حماية من عدم وجود thead
  if (themeColorSelect) {
    themeColorSelect.addEventListener("change", (e) => {
      const color = e.target.value;
      document.querySelectorAll("button").forEach(b => b.style.background = color);
      const firstThead = document.querySelector("thead");
      if (firstThead) firstThead.style.background = color;
    });
  }

  // تحقق من seedrandom
  if (typeof Math.seedrandom !== "function") {
    console.warn("seedrandom غير محمل. نتائج البذرة ستكون غير قابلة للتكرار (seed غير فعال).");
  }

  // دوال التوزيعات والمساعدة
  function randomNormal(mean = 0, sd = 1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function randomPoisson(lambda) {
    const L = Math.exp(-lambda);
    let p = 1, k = 0;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }
  function randomNegBin(r, p) {
    let count = 0;
    for (let i = 0; i < r; i++) {
      let x = 0;
      while (Math.random() > p) x++;
      count += x;
    }
    return count;
  }

  // تحويل حرف لكود
  function charToCode(char) {
    if (/[A-Za-z]/.test(char)) {
      const idx = latin_letters.indexOf(char.toUpperCase());
      return { alpha: "latin", base: latin_letters.length, code: idx >= 0 ? idx : null };
    } else if (arabic_letters.includes(char)) {
      const idx = arabic_letters.indexOf(char);
      return { alpha: "arabic", base: arabic_letters.length, code: idx >= 0 ? idx : null };
    }
    return { alpha: "other", base: null, code: null };
  }

  function codeToChar(codeObj) {
    if (!codeObj) return "";
    if (codeObj.alpha === "latin") return latin_letters[codeObj.code] || "";
    if (codeObj.alpha === "arabic") return arabic_letters[codeObj.code] || "";
    return codeObj.char || "";
  }

  // توليد keystream مع seed (آمن)
  function generateKeystream(n, dist, params, seed) {
    if (typeof seed === "number" && typeof Math.seedrandom === "function") {
      Math.seedrandom(seed);
    } else if (typeof seed === "number") {
      // إذا seedrandom غير متوفر، نستخدم console.warn فقط
      console.warn("Math.seedrandom غير متاح؛ سيتم استخدام Math.random غير المعتمدة على البذرة.");
    }
    const arr = [];
    for (let i = 0; i < n; i++) {
      let val = 0;
      switch (dist) {
        case "Uniform":
          val = Math.floor(Math.random() * (params.b - params.a + 1) + params.a);
          break;
        case "Normal":
          val = Math.round(randomNormal(params.mean, params.sd));
          break;
        case "Poisson":
          val = randomPoisson(params.lambda);
          break;
        case "NegBin":
          val = randomNegBin(params.size, params.prob);
          break;
        default:
          throw new Error("Unknown dist: " + dist);
      }
      arr.push(val);
    }
    return arr;
  }

  // التشفير
  function encryptText(text, dist, params, seed) {
    try {
      const chars = Array.from(text).map(c => ({ char: c, ...charToCode(c) }));
      const usedIdx = chars.map((v, i) => v.alpha !== "other" && v.code !== null ? i : null).filter(v => v !== null);
      if (usedIdx.length === 0) return { ciphertext: text, keyUsed: [], chars };
      const ks = generateKeystream(usedIdx.length, dist, params, seed);
      let j = 0;
      const keyUsed = [];
      for (let i = 0; i < chars.length; i++) {
        if (chars[i].alpha === "other" || chars[i].code === null) { keyUsed.push(null); continue; }
        const base = chars[i].base;
        const k = ((ks[j] % base) + base) % base;
        keyUsed.push(k);
        const newCode = ((chars[i].code + k) % base + base) % base;
        chars[i].cipherChar = codeToChar({ alpha: chars[i].alpha, code: newCode });
        j++;
      }
      return { ciphertext: chars.map(c => c.cipherChar || c.char).join(""), keyUsed, chars };
    } catch (err) {
      console.error("encryptText error:", err);
      return { ciphertext: "", keyUsed: [], chars: [] };
    }
  }

  // فك التشفير
  function decryptText(text, dist, params, seed) {
    try {
      const chars = Array.from(text).map(c => ({ char: c, ...charToCode(c) }));
      const usedIdx = chars.map((v, i) => v.alpha !== "other" && v.code !== null ? i : null).filter(v => v !== null);
      if (usedIdx.length === 0) return { plaintext: text, chars };
      const ks = generateKeystream(usedIdx.length, dist, params, seed);
      let j = 0;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i].alpha === "other" || chars[i].code === null) continue;
        const base = chars[i].base;
        const k = ((ks[j] % base) + base) % base;
        const newCode = ((chars[i].code - k) % base + base) % base;
        chars[i].plainChar = codeToChar({ alpha: chars[i].alpha, code: newCode });
        j++;
      }
      return { plaintext: chars.map(c => c.plainChar || c.char).join(""), chars };
    } catch (err) {
      console.error("decryptText error:", err);
      return { plaintext: "", chars: [] };
    }
  }

  // تحديث الجدول (محمي)
  function updateTable(id, chars, keys = [], cipher = false) {
    const table = document.getElementById(id);
    if (!table) return;
    table.innerHTML = "";
    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>الحرف</th><th>الكود</th><th>المفتاح</th><th>${cipher ? "الحرف المشفر" : "الحرف المفكك"}</th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (let i = 0; i < chars.length; i++) {
      const row = document.createElement("tr");
      const codeVal = chars[i].code !== null ? chars[i].code : "-";
      const keyVal = keys[i] !== undefined && keys[i] !== null ? keys[i] : "-";
      const outChar = cipher ? (chars[i].cipherChar || chars[i].char) : (chars[i].plainChar || chars[i].char);
      row.innerHTML = `<td>${chars[i].char}</td><td>${codeVal}</td><td>${keyVal}</td><td>${outChar}</td>`;
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
  }

  // الرسم (Chart.js) — حماية من عدم وجود عنصر
  let chart = null;
  function updateChart(keys) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    if (chart) try { chart.destroy(); } catch (e) { /* ignore */ }
    const data = keys.map(v => v === null ? 0 : v);
    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map((_, i) => i + 1),
        datasets: [{ label: "Key Value", data, backgroundColor: data.map(v => `rgba(64,79,104,${Math.min(0.9, 0.2 + (v / (Math.max(...data || [1]) + 1)))} )`) }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }

  // أحداث الأزرار — مع حماية
  if (encryptBtn) {
    encryptBtn.addEventListener("click", () => {
      try {
        const text = plaintextEl.value || "";
        const dist = distSelect.value || "Uniform";
        const seed = parseInt(seedEl.value || "0", 10);
        const params = { a: 0, b: 25, mean: 0, sd: 2, lambda: 2, size: 2, prob: 0.5 };
        const res = encryptText(text, dist, params, seed);
        cipherOut.textContent = res.ciphertext;
        updateTable("enc_table", res.chars, res.keyUsed, true);
        updateChart(res.keyUsed);
      } catch (e) {
        console.error("encrypt handler error:", e);
      }
    });
  }

  if (decryptBtn) {
    decryptBtn.addEventListener("click", () => {
      try {
        const text = cipherOut.textContent || "";
        const dist = distSelect.value || "Uniform";
        const seed = parseInt(seedEl.value || "0", 10);
        const params = { a: 0, b: 25, mean: 0, sd: 2, lambda: 2, size: 2, prob: 0.5 };
        const res = decryptText(text, dist, params, seed);
        plainOut.textContent = res.plaintext;
        updateTable("dec_table", res.chars, [], false);
      } catch (e) {
        console.error("decrypt handler error:", e);
      }
    });
  }

  // اختياري: تنفيذ تلقائي مرة عند التحميل لعرض مثال اختبار
  try {
    encryptBtn && encryptBtn.click();
  } catch (e) { /* ignore */ }

}); // DOMContentLoaded