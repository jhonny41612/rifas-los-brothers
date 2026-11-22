const MIN_TICKET = 3000;
const MAX_TICKET = 5000;
const TOTAL_TICKETS = MAX_TICKET - MIN_TICKET + 1;
const TICKET_PRICE = 30;
const PAGE_SIZE = 100;
const COLLECTION_NAME = "rifa_los_brothers_boletos";
const WHATSAPP_NUMBER = "524521300270";

const ticketsMap = new Map();
const selectedSet = new Set();

let activeFilter = "todos";
let exactNumberFilter = null;
let currentPage = 1;
let currentSlide = 0;
let autoplayTimer = null;

const boletosGrid = document.getElementById("boletosGrid");
const pagerLabel = document.getElementById("pagerLabel");
const prevPage = document.getElementById("prevPage");
const nextPage = document.getElementById("nextPage");
const filtroNumero = document.getElementById("filtroNumero");
const btnResetNumero = document.getElementById("btnResetNumero");

const countLibres = document.getElementById("countLibres");
const countApartados = document.getElementById("countApartados");
const countPagados = document.getElementById("countPagados");
const porcentajeAvance = document.getElementById("porcentajeAvance");
const barraAvance = document.getElementById("barraAvance");

const floatingCart = document.getElementById("floatingCart");
const cartCountText = document.getElementById("cartCountText");
const cartNumbersPreview = document.getElementById("cartNumbersPreview");
const cartTotalText = document.getElementById("cartTotalText");
const btnVaciarCarrito = document.getElementById("btnVaciarCarrito");
const btnAbrirModal = document.getElementById("btnAbrirModal");

const modalApartado = document.getElementById("modalApartado");
const btnCerrarModal = document.getElementById("btnCerrarModal");
const modalCount = document.getElementById("modalCount");
const modalChips = document.getElementById("modalChips");
const modalTotal = document.getElementById("modalTotal");
const formConfirmarApartado = document.getElementById("formConfirmarApartado");
const btnConfirmarEnvio = document.getElementById("btnConfirmarEnvio");
const modalFeedback = document.getElementById("modalFeedback");

const formVerificador = document.getElementById("formVerificador");
const inputVerificar = document.getElementById("inputVerificar");
const resultadoVerificador = document.getElementById("resultadoVerificador");
const btnAbrirVerificador = document.getElementById("btnAbrirVerificador");
const btnCopiarCuenta = document.getElementById("btnCopiarCuenta");

const carouselTrack = document.getElementById("carouselTrack");
const carouselDots = document.getElementById("carouselDots");
const prevSlideBtn = document.getElementById("prevSlide");
const nextSlideBtn = document.getElementById("nextSlide");

function resolveImageCandidates() {
  document.querySelectorAll("img[data-candidates]").forEach((img) => {
    const raw = img.getAttribute("data-candidates") || "";
    const candidates = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (candidates.length === 0) return;

    let idx = 0;
    const tryNext = () => {
      if (idx >= candidates.length) {
        img.style.visibility = "hidden";
        return;
      }
      const nextSrc = candidates[idx++];
      img.style.visibility = "visible";
      img.src = encodeURI(nextSrc);
    };

    img.addEventListener("error", tryNext);
    tryNext();
  });
}

function initCarousel() {
  if (!carouselTrack || !carouselDots) return;
  const slidesCount = carouselTrack.children.length;
  if (slidesCount === 0) return;

  carouselDots.innerHTML = "";
  for (let i = 0; i < slidesCount; i++) {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel-dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", `Ir a foto ${i + 1}`);
    dot.addEventListener("click", () => {
      goToSlide(i);
      restartAutoplay();
    });
    carouselDots.appendChild(dot);
  }

  function goToSlide(index) {
    currentSlide = (index + slidesCount) % slidesCount;
    carouselTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    carouselDots.querySelectorAll(".carousel-dot").forEach((d, idx) => {
      d.classList.toggle("active", idx === currentSlide);
    });
  }

  function restartAutoplay() {
    clearInterval(autoplayTimer);
    autoplayTimer = setInterval(() => goToSlide(currentSlide + 1), 4200);
  }

  prevSlideBtn?.addEventListener("click", () => {
    goToSlide(currentSlide - 1);
    restartAutoplay();
  });

  nextSlideBtn?.addEventListener("click", () => {
    goToSlide(currentSlide + 1);
    restartAutoplay();
  });

  restartAutoplay();
}

function initTickets() {
  for (let n = MIN_TICKET; n <= MAX_TICKET; n++) {
    ticketsMap.set(n, { estado: "disponible" });
  }
}

function subscribeFirestore() {
  if (typeof db === "undefined") {
    renderAll();
    return;
  }

  db.collection(COLLECTION_NAME).onSnapshot(
    (snapshot) => {
      initTickets();
      snapshot.forEach((doc) => {
        const d = doc.data();
        const num = Number(d.numero ?? doc.id);
        if (num >= MIN_TICKET && num <= MAX_TICKET) {
          ticketsMap.set(num, {
            estado: d.estado || "disponible",
            nombre: d.nombre || "",
            ciudad: d.ciudad || ""
          });
          if (d.estado !== "disponible" && selectedSet.has(num)) {
            selectedSet.delete(num);
          }
        }
      });
      renderAll();
    },
    (err) => {
      console.error("Error Firestore:", err);
      renderAll();
    }
  );
}

function maskName(fullName) {
  if (!fullName) return "Participante registrado";
  const parts = fullName.trim().split(/\s+/);
  return parts
    .map((p) => (p.length <= 2 ? p : p[0].toUpperCase() + "***"))
    .join(" ");
}

function updateCounters() {
  let apartados = 0;
  let pagados = 0;
  for (let n = MIN_TICKET; n <= MAX_TICKET; n++) {
    const st = ticketsMap.get(n)?.estado;
    if (st === "apartado") apartados++;
    else if (st === "pagado") pagados++;
  }
  const libres = TOTAL_TICKETS - apartados - pagados;
  const pct = Math.min(100, Math.round(((apartados + pagados) / TOTAL_TICKETS) * 100));

  countLibres.textContent = libres.toLocaleString("es-MX");
  countApartados.textContent = apartados.toLocaleString("es-MX");
  countPagados.textContent = pagados.toLocaleString("es-MX");
  porcentajeAvance.textContent = `${pct}%`;
  barraAvance.style.width = `${pct}%`;
}

function getFilteredList() {
  const arr = [];
  for (let n = MIN_TICKET; n <= MAX_TICKET; n++) {
    if (exactNumberFilter !== null && n !== exactNumberFilter) continue;
    const estado = ticketsMap.get(n)?.estado || "disponible";
    if (activeFilter !== "todos" && estado !== activeFilter) continue;
    arr.push({ numero: n, estado });
  }
  return arr;
}

function renderMatrix() {
  const list = getFilteredList();
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = list.slice(start, start + PAGE_SIZE);

  boletosGrid.innerHTML = "";

  if (pageItems.length === 0) {
    boletosGrid.innerHTML = `<p style="grid-column:1/-1;color:var(--muted);">No hay boletos con ese filtro o número.</p>`;
  } else {
    pageItems.forEach(({ numero, estado }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = numero;
      btn.className = "boleto-item";

      if (estado === "apartado") {
        btn.classList.add("apartado");
        btn.disabled = true;
        btn.title = `Boleto #${numero} apartado · En revisión de comprobante`;
      } else if (estado === "pagado") {
        btn.classList.add("pagado");
        btn.disabled = true;
        btn.title = `Boleto #${numero} pagado y confirmado`;
      } else if (selectedSet.has(numero)) {
        btn.classList.add("selected");
        btn.title = `Boleto #${numero} seleccionado`;
      } else {
        btn.title = `Boleto #${numero} disponible ($30 MXN)`;
      }

      btn.addEventListener("click", () => {
        if (estado !== "disponible") return;
        if (selectedSet.has(numero)) {
          selectedSet.delete(numero);
        } else {
          selectedSet.add(numero);
        }
        renderCart();
        renderMatrix();
      });

      boletosGrid.appendChild(btn);
    });
  }

  pagerLabel.textContent = `Página ${currentPage} de ${totalPages} (${list.length} boletos)`;
  prevPage.disabled = currentPage <= 1;
  nextPage.disabled = currentPage >= totalPages;
}

function renderCart() {
  const sorted = Array.from(selectedSet).sort((a, b) => a - b);
  if (sorted.length === 0) {
    floatingCart.classList.add("hidden");
    return;
  }

  floatingCart.classList.remove("hidden");
  cartCountText.textContent = `${sorted.length} boleto(s) seleccionado(s)`;
  cartNumbersPreview.textContent = sorted.slice(0, 12).map((n) => `#${n}`).join(", ") + (sorted.length > 12 ? "..." : "");
  cartTotalText.textContent = `$${(sorted.length * TICKET_PRICE).toLocaleString("es-MX")} MXN`;
}

function renderAll() {
  updateCounters();
  renderMatrix();
  renderCart();
}

document.querySelectorAll(".luck-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const qty = Number(btn.dataset.qty);
    const libres = [];
    for (let n = MIN_TICKET; n <= MAX_TICKET; n++) {
      if (ticketsMap.get(n)?.estado === "disponible" && !selectedSet.has(n)) {
        libres.push(n);
      }
    }

    for (let i = libres.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [libres[i], libres[j]] = [libres[j], libres[i]];
    }

    const picked = libres.slice(0, qty);
    if (picked.length === 0) return;

    picked.forEach((n) => selectedSet.add(n));
    const first = Math.min(...picked);
    currentPage = Math.floor((first - MIN_TICKET) / PAGE_SIZE) + 1;
    activeFilter = "todos";
    exactNumberFilter = null;
    filtroNumero.value = "";
    document.querySelectorAll(".tab-btn").forEach((t) => t.classList.toggle("active", t.dataset.state === "todos"));

    renderAll();
  });
});

btnAbrirVerificador.addEventListener("click", () => {
  document.getElementById("verificador").scrollIntoView({ behavior: "smooth" });
  inputVerificar.focus();
});

formVerificador.addEventListener("submit", (e) => {
  e.preventDefault();
  const num = Number(inputVerificar.value);
  if (num < MIN_TICKET || num > MAX_TICKET) {
    resultadoVerificador.innerHTML = `<div class="verif-pill verif-paid">Ingresa un número válido entre 3000 y 5000.</div>`;
    return;
  }

  const info = ticketsMap.get(num) || { estado: "disponible" };
  if (info.estado === "disponible") {
    resultadoVerificador.innerHTML = `<div class="verif-pill verif-free">✅ El boleto <strong>#${num}</strong> está <strong>DISPONIBLE</strong> ($30 MXN). Puedes seleccionarlo en el tablero.</div>`;
  } else if (info.estado === "apartado") {
    resultadoVerificador.innerHTML = `<div class="verif-pill verif-reserved">⏳ El boleto <strong>#${num}</strong> está <strong>APARTADO (en revisión de comprobante)</strong> a nombre de ${maskName(info.nombre)} (${info.ciudad || "México"}).</div>`;
  } else {
    resultadoVerificador.innerHTML = `<div class="verif-pill verif-paid">🔒 El boleto <strong>#${num}</strong> ya está <strong>PAGADO y confirmado</strong> a nombre de ${maskName(info.nombre)} (${info.ciudad || "México"}).</div>`;
  }
});

document.querySelectorAll(".tab-btn").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeFilter = tab.dataset.state;
    currentPage = 1;
    renderMatrix();
  });
});

filtroNumero.addEventListener("input", () => {
  const val = filtroNumero.value.trim();
  exactNumberFilter = val === "" ? null : Number(val);
  currentPage = 1;
  renderMatrix();
});

btnResetNumero.addEventListener("click", () => {
  filtroNumero.value = "";
  exactNumberFilter = null;
  currentPage = 1;
  renderMatrix();
});

prevPage.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderMatrix();
  }
});

nextPage.addEventListener("click", () => {
  currentPage++;
  renderMatrix();
});

btnCopiarCuenta.addEventListener("click", async () => {
  const datos = "BBVA · Titular: Misael Abrego Aguado · Terminación: 6980 · Rifas Los Brothers";
  try {
    await navigator.clipboard.writeText(datos);
    btnCopiarCuenta.textContent = "✅ ¡Copiado!";
    setTimeout(() => (btnCopiarCuenta.textContent = "📋 Copiar datos"), 1800);
  } catch {
    alert(datos);
  }
});

btnVaciarCarrito.addEventListener("click", () => {
  selectedSet.clear();
  renderAll();
});

btnAbrirModal.addEventListener("click", () => {
  const sorted = Array.from(selectedSet).sort((a, b) => a - b);
  if (sorted.length === 0) return;

  modalCount.textContent = sorted.length;
  modalChips.innerHTML = sorted.map((n) => `<span>#${n}</span>`).join("");
  modalTotal.textContent = `$${(sorted.length * TICKET_PRICE).toLocaleString("es-MX")} MXN`;
  modalFeedback.textContent = "";
  modalApartado.classList.remove("hidden");
});

btnCerrarModal.addEventListener("click", () => {
  modalApartado.classList.add("hidden");
});

formConfirmarApartado.addEventListener("submit", async (e) => {
  e.preventDefault();
  const sorted = Array.from(selectedSet).sort((a, b) => a - b);
  if (sorted.length === 0) return;

  const nombre = document.getElementById("inputNombre").value.trim();
  const telefono = document.getElementById("inputTelefono").value.trim();
  const ciudad = document.getElementById("inputCiudad").value.trim();

  btnConfirmarEnvio.disabled = true;
  btnConfirmarEnvio.textContent = "Apartando boletos...";

  try {
    const batch = db.batch();
    const now = firebase.firestore.FieldValue.serverTimestamp();

    sorted.forEach((num) => {
      const ref = db.collection(COLLECTION_NAME).doc(String(num));
      batch.set(
        ref,
        {
          numero: Number(num),
          precio: TICKET_PRICE,
          estado: "apartado",
          revisionComprobante: true,
          nombre,
          telefono,
          ciudad,
          apartadoEn: now
        },
        { merge: true }
      );
    });

    await batch.commit();

    const total = sorted.length * TICKET_PRICE;
    const msg = encodeURIComponent(
      `Hola Rifas Los Brothers, aparté los boletos: ${sorted.join(", ")} (Total: $${total} MXN).\n` +
      `Nombre: ${nombre}\nWhatsApp: ${telefono}\nCiudad: ${ciudad}\n` +
      `Adjunto mi comprobante para que el admin lo revise y confirme mi pago (vigencia 24 hrs · BBVA Misael Abrego Aguado 6980).`
    );

    selectedSet.clear();
    formConfirmarApartado.reset();
    modalApartado.classList.add("hidden");
    renderAll();

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank", "noopener");
  } catch (err) {
    console.error("Error al apartar:", err);
    modalFeedback.innerHTML = `<span style="color:#fca5a5;">Error al apartar (es posible que otro usuario ya haya tomado alguno). Actualiza e intenta de nuevo.</span>`;
  } finally {
    btnConfirmarEnvio.disabled = false;
    btnConfirmarEnvio.textContent = "Confirmar apartado y abrir WhatsApp";
  }
});

resolveImageCandidates();
initCarousel();
initTickets();
renderAll();
subscribeFirestore();