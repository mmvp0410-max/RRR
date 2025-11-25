// Professional client-side cipher app (encryption + decryption full-ready)

const latin_letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const arabic_letters = [
  "ا","أ","إ","آ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز",
  "س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن",
  "ه","و","ؤ","ي","ى","ئ","ة"
];

// store last keystream for reliable decryption (used positions have values, others null)
window._lastKeyStream = null;
window._lastKeyMeta = null;

document.addEventListener("DOMContentLoaded", () => {
  const plaintextEl = document.getElementById("plaintext");
  const cipherOut = document.getElementById("cipher_out");
  const plainOut = document.getElementById("plain_out");
  const distSelect = document.getElementById("dist");
  const seedEl = document.getElementById("seed");
  const paramsDiv = document.getElementById("params");
  const encryptBtn = document.getElementById("encrypt_btn");
  const decryptBtn = document.getElementById("decrypt_btn");
  const clearBtn = document.getElementById("clear_btn");
  const encTable = document.getElementById("enc_table");
  const decTable = document.getElementById("dec_table");
  const chartCanvas = document.getElementById("dist_chart");
  const themeToggle = document.getElementById("toggleTheme");
  const themeColor = document.getElementById("themeColor");

  let chart = null;

  // render params UI based on distribution
  function renderParams() {
    const dist = distSelect.value;
    paramsDiv.innerHTML = "";
    if (dist === "Uniform") {
      paramsDiv.innerHTML = `<div class="row"><div class="col"><label>Min (a)</label><input id="param_a" type="number" value="0" /></div>
                             <div class="col"><label>Max (b)</label><input id="param_b" type="number" value="25" /></div></div>`;
    } else if (dist === "Normal") {
      paramsDiv.innerHTML = `<div class="row"><div class="col"><label>Mean (μ)</label><input id="param_mean" type="number" value="0" /></div>
                             <div class="col"><label>SD (σ)</label><input id="param_sd" type="number" value="2" /></div></div>`;
    } else if (dist === "Poisson") {
      paramsDiv.innerHTML = `<label>Lambda (λ)</label><input id="param_lambda" type="number" value="2" step="0.1" />`;
    } else if (dist === "NegBin") {
      paramsDiv.innerHTML = `<div class="row"><div class="col"><label>Size (r)</label><input id="param_size" type="number" value="2" /></div>
                             <div class="col"><label>Prob (p)</label><input id="param_prob" type="number" value="0.5" step="0.01" /></div></div>`;
    }
  }

  distSelect.addEventListener("change", renderParams);
  renderParams();

  themeToggle.addEventListener("click", () => document.body.classList.toggle("dark"));
  themeColor.addEventListener("change", (e) => {
    const c = e.target.value;
    document.querySelectorAll("button").forEach(b => { b.style.background = c; });
    const firstThead = document.querySelector("thead");
    if (firstThead) firstThead.style.background = c;
    document.documentElement.style.setProperty('--accent', c);
  });

  // RNG helpers
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

  function charToCode(char) {
    if (/[A-Za-z]/.test(char)) {
      const idx = latin_letters.indexOf(char.toUpperCase());
      return { alpha: "latin", base: latin_letters.length, code: idx >= 0 ? idx : null };
    }
    const idxAr = arabic_letters.indexOf(char);
    if (idxAr >= 0) return { alpha: "arabic", base: arabic_letters.length, code: idxAr };
    return { alpha: "other", base: null, code: null };
  }

  function codeToChar(codeObj) {
    if (!codeObj) return "";
    if (codeObj.alpha === "latin") return latin_letters[codeObj.code] || "";
    if (codeObj.alpha === "arabic") return arabic_letters[codeObj.code] || "";
    return codeObj.char || "";
  }

  function getParamsFromUI() {
    const dist = distSelect.value;
    const p = {};
    if (dist === "Uniform") {
      p.a = parseInt(document.getElementById("param_a").value || "0", 10);
      p.b = parseInt(document.getElementById("param_b").value || "25", 10);
    } else if (dist === "Normal") {
      p.mean = parseFloat(document.getElementById("param_mean").value || "0");
      p.sd = parseFloat(document.getElementById("param_sd").value || "2");
    } else if (dist === "Poisson") {
      p.lambda = parseFloat(document.getElementById("param_lambda").value || "2");
    } else if (dist === "NegBin") {
      p.size = parseInt(document.getElementById("param_size").value || "2", 10);
      p.prob = parseFloat(document.getElementById("param_prob").value || "0.5");
    }
    return p;
  }

  function generateKeystream(n, dist, params, seed) {
    if (typeof seed !== "undefined" && seed !== null && typeof Math.seedrandom === "function") {
      Math.seedrandom(String(seed), { global: true });
    }
    const arr = [];
    for (let i = 0; i < n; i++) {
      let v = 0;
      switch (dist) {
        case "Uniform": v = Math.floor(Math.random() * (params.b - params.a + 1) + params.a); break;
        case "Normal": v = Math.round(randomNormal(params.mean, params.sd)); break;
        case "Poisson": v = randomPoisson(params.lambda); break;
        case "NegBin": v = randomNegBin(params.size, params.prob); break;
        default: v = Math.floor(Math.random() * (params.b - params.a + 1) + params.a);
      }
      arr.push(v);
    }
    return arr;
  }

  function encryptText(text, dist, params, seed) {
    const chars = Array.from(text).map(c => ({ char: c, ...charToCode(c) }));
    const usedIdx = chars.map((v, i) => (v.alpha !== "other" && v.code !== null ? i : null)).filter(v => v !== null);
    if (usedIdx.length === 0) {
      window._lastKeyStream = [];
      window._lastKeyMeta = null;
      return { ciphertext: text, keyUsed: [], chars };
    }
    const ks = generateKeystream(usedIdx.length, dist, params, seed);
    const keyUsed = Array(chars.length).fill(null);
    let j = 0;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i].alpha === "other" || chars[i].code === null) continue;
      const base = chars[i].base;
      const k = ((ks[j] % base) + base) % base;
      keyUsed[i] = k;
      const newCode = ((chars[i].code + k) % base + base) % base;
      chars[i].cipherChar = codeToChar({ alpha: chars[i].alpha, code: newCode });
      j++;
    }
    window._lastKeyStream = keyUsed.slice();
    window._lastKeyMeta = { dist, params: JSON.parse(JSON.stringify(params)), seed, length: usedIdx.length };
    return { ciphertext: chars.map(c => c.cipherChar || c.char).join(""), keyUsed, chars };
  }

  function decryptText(text, dist, params, seed) {
    const chars = Array.from(text).map(c => ({ char: c, ...charToCode(c) }));
    // prefer saved keystream if available and lengths match
    if (Array.isArray(window._lastKeyStream) && window._lastKeyStream.length === chars.length) {
      const saved = window._lastKeyStream;
      for (let i = 0; i < chars.length; i++) {
        if (chars[i].alpha === "other" || chars[i].code === null) continue;
        const base = chars[i].base;
        const k = saved[i] !== null && saved[i] !== undefined ? saved[i] : 0;
        const newCode = ((chars[i].code - k + base) % base + base) % base;
        chars[i].plainChar = codeToChar({ alpha: chars[i].alpha, code: newCode });
      }
      return { plaintext: chars.map(c => c.plainChar || c.char).join(""), chars };
    }
    // fallback: regenerate keystream based on seed/params
    const usedIdx = chars.map((v, i) => (v.alpha !== "other" && v.code !== null ? i : null)).filter(v => v !== null);
    if (usedIdx.length === 0) return { plaintext: text, chars };
    const ks = generateKeystream(usedIdx.length, dist, params, seed);
    let j = 0;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i].alpha === "other" || chars[i].code === null) continue;
      const base = chars[i].base;
      const k = ((ks[j] % base) + base) % base;
      const newCode = ((chars[i].code - k + base) % base + base) % base;
      chars[i].plainChar = codeToChar({ alpha: chars[i].alpha, code: newCode });
      j++;
    }
    return { plaintext: chars.map(c => c.plainChar || c.char).join(""), chars };
  }

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

  function updateChart(keys) {
    if (!chartCanvas) return;
    const ctx = chartCanvas.getContext("2d");
    if (chart) try { chart.destroy(); } catch (e) {}
    const data = keys.map(v => v === null ? 0 : v);
    chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.map((_, i) => i + 1),
        datasets: [{
          label: "Key Value",
          data,
          backgroundColor: data.map(v => `rgba(64,79,104,${(0.35 + (v / (Math.max(...data || [1]) + 1))).toFixed(2)})`)
        }]
      },
      options: { responsive: true, scales: { y: { beginAtZero: true } } }
    });
  }

  encryptBtn.addEventListener("click", () => {
    try {
      const text = plaintextEl.value || "";
      const dist = distSelect.value;
      const seed = parseInt(seedEl.value || "0", 10);
      const params = getParamsFromUI();
      const res = encryptText(text, dist, params, seed);
      cipherOut.textContent = res.ciphertext;
      updateTable("enc_table", res.chars, res.keyUsed, true);
      updateChart(res.keyUsed);
    } catch (e) {
      console.error("encrypt error", e);
    }
  });

  decryptBtn.addEventListener("click", () => {
    try {
      const text = cipherOut.textContent || "";
      const dist = distSelect.value;
      const seed = parseInt(seedEl.value || "0", 10);
      const params = getParamsFromUI();
      const res = decryptText(text, dist, params, seed);
      plainOut.textContent = res.plaintext;
      updateTable("dec_table", res.chars, [], false);
    } catch (e) {
      console.error("decrypt error", e);
    }
  });

  clearBtn.addEventListener("click", () => {
    plaintextEl.value = "";
    cipherOut.textContent = "";
    plainOut.textContent = "";
    encTable.innerHTML = "";
    decTable.innerHTML = "";
    if (chart) try { chart.destroy(); chart = null; } catch (e) {}
    window._lastKeyStream = null;
    window._lastKeyMeta = null;
  });

  // initial example run to show demo output
  try { encryptBtn.click(); } catch (e) {}
});