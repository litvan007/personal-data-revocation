// Load services data
let servicesData = null;

async function loadServices() {
  if (servicesData) return servicesData;
  const res = await fetch('/data/services.json');
  servicesData = (await res.json()).services;
  return servicesData;
}

// Router
function getRoute() {
  const hash = window.location.hash.slice(1) || '/';
  if (hash.startsWith('/service/')) {
    const slug = hash.replace('/service/', '');
    return { page: 'service', slug };
  }
  return { page: 'home' };
}

// Render
async function render() {
  const app = document.getElementById('app');
  const route = getRoute();

  if (route.page === 'service') {
    await renderServicePage(app, route.slug);
  } else {
    await renderHomePage(app);
  }
}

// ===== HOME PAGE =====
async function renderHomePage(app) {
  const services = await loadServices();

  app.innerHTML = `
    <header class="header">
      <div class="header__inner">
        <div class="header__title">Отзыв персональных данных</div>
        <div class="header__subtitle">Выберите сервис, чтобы отозвать согласие на обработку ПДн</div>
      </div>
    </header>
    <div class="container">
      <div class="service-grid">
        ${services.map(s => serviceCardHTML(s)).join('')}
      </div>
    </div>
  `;

  // Bind clicks
  app.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      window.location.hash = `/service/${card.dataset.slug}`;
    });
  });
}

function serviceCardHTML(service) {
  const initial = service.name.charAt(0).toUpperCase();
  return `
    <div class="service-card" data-slug="${service.slug}">
      <div class="service-card__icon" style="background:${service.color}">${initial}</div>
      <div class="service-card__name">${service.name}</div>
    </div>
  `;
}

// ===== SERVICE PAGE =====
async function renderServicePage(app, slug) {
  const services = await loadServices();
  const service = services.find(s => s.slug === slug);

  if (!service) {
    app.innerHTML = `<div class="container"><p>Сервис не найден</p></div>`;
    return;
  }

  const initial = service.name.charAt(0).toUpperCase();
  const savedData = loadFormData(slug);

  app.innerHTML = `
    <div class="container">
      <a class="back-link" id="backBtn">← Все сервисы</a>

      <div class="service-page__header">
        <div class="service-page__icon" style="background:${service.color}">${initial}</div>
        <div>
          <div class="service-page__name">${service.name}</div>
          <div class="service-page__legal">${service.legal.companyName} · ИНН ${service.legal.inn}</div>
        </div>
      </div>

      ${service.statementNotes ? `<div class="note-badge">⚠ ${service.statementNotes}</div>` : ''}

      <div class="tabs">
        <button class="tab tab--active" data-tab="statement">Шаблон заявления</button>
        <button class="tab" data-tab="guide">Как удалить в настройках</button>
      </div>

      <div id="tabContent"></div>
    </div>
  `;

  // Back button
  app.querySelector('#backBtn').addEventListener('click', () => {
    window.location.hash = '/';
  });

  // Tabs
  let activeTab = 'statement';
  const tabs = app.querySelectorAll('.tab');

  function switchTab(tabName) {
    activeTab = tabName;
    tabs.forEach(t => t.classList.toggle('tab--active', t.dataset.tab === tabName));
    renderTab(tabName, service, savedData);
  }

  tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
  switchTab('statement');
}

function renderTab(tabName, service, savedData) {
  const content = document.getElementById('tabContent');

  if (tabName === 'guide') {
    renderGuide(content, service);
  } else {
    renderStatementTab(content, service, savedData);
  }
}

// ===== GUIDE TAB =====
function renderGuide(el, service) {
  if (!service.steps || service.steps.length === 0) {
    el.innerHTML = `<div class="no-steps">Для данного сервиса удаление через настройки недоступно.<br>Используйте шаблон заявления для официального отзыва ПДн.</div>`;
    return;
  }

  el.innerHTML = `
    <ol class="steps">
      ${service.steps.map(s => `
        <li class="step">
          <div class="step__content">
            <div class="step__title">${s.title}</div>
            <div class="step__desc">${s.description}</div>
          </div>
        </li>
      `).join('')}
    </ol>
  `;
}

// ===== STATEMENT TAB =====
function renderStatementTab(el, service, savedData) {
  el.innerHTML = `
    <form class="form" id="pdrevForm">
      <div class="form-group">
        <label>ФИО</label>
        <input type="text" name="fullName" placeholder="Иванов Иван Иванович" value="${esc(savedData.fullName || '')}" required>
      </div>
      <div class="form-group">
        <label>Адрес регистрации</label>
        <input type="text" name="address" placeholder="г. Москва, ул. Примерная, д. 1, кв. 1" value="${esc(savedData.address || '')}" required>
      </div>
      <div class="form-group">
        <label>Паспорт <span class="optional">(необязательно)</span></label>
        <input type="text" name="passport" placeholder="12 34 567890, выдан ОВД …" value="${esc(savedData.passport || '')}">
      </div>
      <div class="form-group">
        <label>Телефон</label>
        <input type="tel" name="phone" placeholder="+7 (999) 123-45-67" value="${esc(savedData.phone || '')}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" placeholder="example@mail.ru" value="${esc(savedData.email || '')}" required>
      </div>
      <div class="form-group">
        <label>${esc(service.accountIdentifier)}</label>
        <input type="text" name="accountLogin" placeholder="Ваш логин / ID в сервисе" value="${esc(savedData.accountLogin || '')}" required>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn--primary">Предпросмотр</button>
      </div>
    </form>

    <div id="previewArea"></div>
  `;

  const form = el.querySelector('#pdrevForm');
  let saveTimer;

  // Auto-save
  form.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const data = getFormData(form);
      saveFormData(service.slug, data);
    }, 500);
  });

  // Submit → preview
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = getFormData(form);
    saveFormData(service.slug, data);
    renderPreview(document.getElementById('previewArea'), service, data);
  });
}

function getFormData(form) {
  const fd = new FormData(form);
  return {
    fullName: fd.get('fullName'),
    address: fd.get('address'),
    passport: fd.get('passport'),
    phone: fd.get('phone'),
    email: fd.get('email'),
    accountLogin: fd.get('accountLogin'),
  };
}

// ===== PREVIEW =====
function renderPreview(el, service, data) {
  const today = new Date().toLocaleDateString('ru-RU');

  el.innerHTML = `
    <div class="preview-section">
      <div class="preview-section__title">📄 Предпросмотр заявления</div>
      <div class="statement-preview" id="statementContent">
        <div class="section">
          Кому: <span class="field">${esc(service.legal.companyName)}</span><br>
          Юридический адрес: <span class="field">${esc(service.legal.address)}</span><br>
          ${service.legal.dpoName ? `DPO: <span class="field">${esc(service.legal.dpoName)}</span><br>` : ''}
          Email: <span class="field">${esc(service.legal.dpoEmail)}</span>
        </div>
        <div class="section">
          От: <span class="field">${esc(data.fullName)}</span><br>
          Адрес: <span class="field">${esc(data.address)}</span><br>
          ${data.passport ? `Паспорт: <span class="field">${esc(data.passport)}</span><br>` : ''}
          Телефон: <span class="field">${esc(data.phone)}</span><br>
          Email: <span class="field">${esc(data.email)}</span>
        </div>
        <h2>ЗАЯВЛЕНИЕ<br>об отзыве согласия на обработку персональных данных</h2>
        <div class="section">
          Настоящим заявлением отзываю свое согласие на обработку моих персональных данных, ранее данное при регистрации и использовании сервиса «<span class="field">${esc(service.name)}</span>».
        </div>
        <div class="section">
          Прошу:<br>
          1. Прекратить обработку моих персональных данных<br>
          2. Уничтожить мои персональные данные в сроки, установленные законодательством (до 30 дней)<br>
          3. Подтвердить факт прекращения обработки и уничтожения ПДн письменно
        </div>
        <div class="section">
          Мои данные в вашей системе:<br>
          — Аккаунт: <span class="field">${esc(data.accountLogin)}</span><br>
          — Email: <span class="field">${esc(data.email)}</span><br>
          — Телефон: <span class="field">${esc(data.phone)}</span>
        </div>
        <div class="section">
          Приложение: копия паспорта (основная страница)
        </div>
        <div style="text-align:right; margin-top:24px;">
          Дата: ${today}<br>
          Подпись: ___________
        </div>
      </div>

      <div class="form-actions" style="margin-top:16px;">
        <button class="btn btn--primary" id="btnPdf">📥 Скачать PDF</button>
        <button class="btn btn--secondary" id="btnDocx">📥 Скачать DOCX</button>
      </div>
    </div>
  `;

  el.querySelector('#btnPdf').addEventListener('click', () => generatePDF());
  el.querySelector('#btnDocx').addEventListener('click', () => generateDOCX(service, data));
}

// ===== PDF =====
function generatePDF() {
  const element = document.getElementById('statementContent');
  const opt = {
    margin: [15, 15, 15, 15],
    filename: 'заявление_отзыв_пдн.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
}

// ===== DOCX =====
function generateDOCX(service, data) {
  const today = new Date().toLocaleDateString('ru-RU');
  const { Document, Paragraph, TextRun, Packer, AlignmentType } = docx;

  const doc = new Document({
    sections: [{
      properties: {
        page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } }
      },
      children: [
        new Paragraph({ children: [new TextRun({ text: `Кому: ${service.legal.companyName}`, size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: `Юридический адрес: ${service.legal.address}`, size: 28 })] }),
        service.legal.dpoName ? new Paragraph({ children: [new TextRun({ text: `DPO: ${service.legal.dpoName}`, size: 28 })] }) : new Paragraph({}),
        new Paragraph({ children: [new TextRun({ text: `Email: ${service.legal.dpoEmail}`, size: 28 })] }),
        new Paragraph({}),
        new Paragraph({ children: [new TextRun({ text: `От: ${data.fullName}`, size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: `Адрес: ${data.address}`, size: 28 })] }),
        data.passport ? new Paragraph({ children: [new TextRun({ text: `Паспорт: ${data.passport}`, size: 28 })] }) : new Paragraph({}),
        new Paragraph({ children: [new TextRun({ text: `Телефон: ${data.phone}`, size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: `Email: ${data.email}`, size: 28 })] }),
        new Paragraph({}),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ЗАЯВЛЕНИЕ', bold: true, size: 32 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'об отзыве согласия на обработку персональных данных', size: 28 })] }),
        new Paragraph({}),
        new Paragraph({ children: [new TextRun({ text: `Настоящим заявлением отзываю свое согласие на обработку моих персональных данных, ранее данное при регистрации и использовании сервиса «${service.name}».`, size: 28 })], spacing: { after: 200 } }),
        new Paragraph({ children: [new TextRun({ text: 'Прошу:', size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: '1. Прекратить обработку моих персональных данных', size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: '2. Уничтожить мои персональные данные в сроки, установленные законодательством (до 30 дней)', size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: '3. Подтвердить факт прекращения обработки и уничтожения ПДн письменно', size: 28 })] }),
        new Paragraph({}),
        new Paragraph({ children: [new TextRun({ text: 'Мои данные в вашей системе:', size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: `— Аккаунт: ${data.accountLogin}`, size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: `— Email: ${data.email}`, size: 28 })] }),
        new Paragraph({ children: [new TextRun({ text: `— Телефон: ${data.phone}`, size: 28 })] }),
        new Paragraph({}),
        new Paragraph({ children: [new TextRun({ text: 'Приложение: копия паспорта (основная страница)', size: 28 })] }),
        new Paragraph({}),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Дата: ${today}`, size: 28 })] }),
        new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Подпись: ___________', size: 28 })] }),
      ]
    }]
  });

  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'заявление_отзыв_пдн.docx';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ===== LOCALSTORAGE =====
function saveFormData(slug, data) {
  localStorage.setItem(`pdrev_${slug}`, JSON.stringify(data));
}

function loadFormData(slug) {
  try {
    return JSON.parse(localStorage.getItem(`pdrev_${slug}`)) || {};
  } catch { return {}; }
}

// ===== UTILS =====
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ===== INIT =====
window.addEventListener('hashchange', render);
render();
