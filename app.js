const SUPABASE_URL = 'https://ppqpgfxwlfskiaixtczc.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwcXBnZnh3bGZza2lhaXh0Y3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyODAwNzYsImV4cCI6MjEwMjg1NjA3Nn0.gChKP4Z7Q0hqvZZ7v82m24yoJlPMuSe_0qk2IMBdVlY';

const _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let useSupabase = SUPABASE_URL !== 'ТВОЙ_URL_ИЗ_SUPABASE';
let currentUser = null;
window.appProgress = {};
window.appGoals = {};

let currentDomainMode = "net";
let currentView = "medals";
let medalsSearchQuery = "";
let medalsFilterMode = "all";
let medalsSphereFilter = "all";
let achSearchQuery = "";
let achFilterMode = "all";
let achSphereFilter = "all";
let plannerSearchQuery = "";

if (!window.storage) {
  window.storage = {
    get: async (key) => { let v = localStorage.getItem(key); return v ? { value: v } : null; },
    set: async (key, value) => localStorage.setItem(key, value),
    delete: async (key) => localStorage.removeItem(key)
  };
}

function startApp() {
  initDomainToggle();
  if (useSupabase) {
    initAuthUI();
  } else {
    initLocalAuthUI();
  }
}

function setModalOpen(isOpen) {
  const modal = document.getElementById('authModal');
  modal.classList.toggle('open', isOpen);
  document.body.classList.toggle('modal-open', isOpen);
}

let authMode = "login";

function initAuthUI() {
  const btnLogout = document.getElementById('btnLogout');
  const btnSubmit = document.getElementById('btnAuthSubmit');
  const btnToggle = document.getElementById('btnAuthToggleMode');
  const btnForgot = document.getElementById('btnForgotPassword');
  
  const btnVerifySignup = document.getElementById('btnVerifySignup');
  const btnBackToAuth = document.getElementById('btnBackToAuth');
  
  const emailInp = document.getElementById('authEmail');
  const pwdInp = document.getElementById('authPassword');
  const codeInp = document.getElementById('authConfirmCode');
  
  const mainStep = document.getElementById('authMainStep');
  const confirmStep = document.getElementById('authConfirmStep');
  
  const errorEl = document.getElementById('authError');
  const infoEl = document.getElementById('authInfo');
  const titleEl = document.getElementById('authTitle');

  function showError(msg) { infoEl.style.display = 'none'; errorEl.textContent = msg; errorEl.style.display = 'block'; }
  function clearError() { errorEl.style.display = 'none'; }
  function showInfo(msg) { errorEl.style.display = 'none'; infoEl.textContent = msg; infoEl.style.display = 'block'; }
  function clearInfo() { infoEl.style.display = 'none'; }
  function clearMsg() { clearError(); clearInfo(); }

  function updateModeUI() {
    clearMsg();
    mainStep.style.display = 'block';
    confirmStep.style.display = 'none';
    if (authMode === "login") {
      titleEl.textContent = "Вход";
      btnSubmit.textContent = "Войти";
      btnToggle.textContent = "Зарегистрироваться";
    } else {
      titleEl.textContent = "Регистрация";
      btnSubmit.textContent = "Зарегистрироваться";
      btnToggle.textContent = "Уже есть аккаунт? Войти";
    }
  }

  btnToggle.onclick = () => { authMode = authMode === "login" ? "register" : "login"; updateModeUI(); };
  btnBackToAuth.onclick = () => { updateModeUI(); };

  btnForgot.onclick = async () => {
    clearMsg();
    const email = emailInp.value.trim();
    if (!email) { showError('Сначала введи email в поле выше.'); return; }
    const { data, error } = await _supabase.auth.resetPasswordForEmail(email);
    if (error) showError('Ошибка: ' + error.message);
    else showInfo('Письмо с кодом для сброса пароля отправлено! Проверь папку Спам.');
  };

  btnSubmit.onclick = async () => {
    clearMsg();
    const email = emailInp.value.trim();
    const password = pwdInp.value;
    
    if (!email || !password) { showError('Заполни email и пароль.'); return; }
    if (password.length < 6) { showError('Пароль должен быть не короче 6 символов.'); return; }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Загрузка...";

    if (authMode === "login") {
      const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message.includes("Email not confirmed")) {
           showError("Почта не подтверждена! Зарегистрируйся заново, чтобы получить код.");
        } else {
           showError('Ошибка входа. Проверь почту и пароль.');
        }
      }
    } else {
      const { data, error } = await _supabase.auth.signUp({ email, password });
      if (error) {
        showError('Ошибка регистрации: ' + error.message);
      } else {
        mainStep.style.display = 'none';
        confirmStep.style.display = 'block';
      }
    }
    btnSubmit.disabled = false;
    btnSubmit.textContent = authMode === "login" ? "Войти" : "Зарегистрироваться";
  };

  btnVerifySignup.onclick = async () => {
    clearMsg();
    const email = emailInp.value.trim();
    const token = codeInp.value.trim();
    
if (!token || token.length < 8) { showError('Введи 8-значный код.'); return; }

    btnVerifySignup.disabled = true;
    btnVerifySignup.textContent = "Проверка...";

    const { data, error } = await _supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'signup'
    });

    btnVerifySignup.disabled = false;
    btnVerifySignup.textContent = "Подтвердить код";

    if (error) {
      showError('Неверный код или срок действия истек.');
    }
  };

  if (btnLogout) {
    btnLogout.onclick = async () => {
      await _supabase.auth.signOut();
      window.location.reload();
    };
  }

  _supabase.auth.getSession().then(({ data: { session } }) => {
    handleSession(session, btnLogout);
  });

  _supabase.auth.onAuthStateChange((event, session) => {
    handleSession(session, btnLogout);
  });

  updateModeUI();
}

function handleSession(session, btnLogout) {
  if (session) {
    currentUser = session.user;
    setModalOpen(false);
    if (btnLogout) btnLogout.style.display = 'inline-block';
    loadCloudData();
  } else {
    currentUser = null;
    setModalOpen(true);
    if (btnLogout) btnLogout.style.display = 'none';
    window.appProgress = {}; 
    window.appGoals = {};
    window.appRenderAll();
  }
}

function initLocalAuthUI() {
  const btnLogout = document.getElementById('btnLogout');
  const btnToggle = document.getElementById('btnAuthToggleMode');
  const btnForgot = document.getElementById('btnForgotPassword');
  const infoEl = document.getElementById('authInfo');

  if (!localStorage.getItem('river-medals-auth')) {
    setModalOpen(true);
    if(btnLogout) btnLogout.style.display = 'none';
  } else {
    if(btnLogout) btnLogout.style.display = 'inline-block';
  }
  
  btnForgot.onclick = () => {
    infoEl.textContent = "Локальный режим: сброс пароля недоступен.";
    infoEl.style.display = 'block';
  };
  btnToggle.style.display = "none";
  
  document.getElementById('btnAuthSubmit').onclick = () => {
    const e = document.getElementById('authEmail').value.trim();
    const p = document.getElementById('authPassword').value;
    if (!e || p.length < 6) {
      infoEl.textContent = "Демо: введи любой email и пароль от 6 символов.";
      infoEl.style.display = 'block';
      return;
    }
    localStorage.setItem('river-medals-auth', 'true');
    setModalOpen(false);
    if(btnLogout) btnLogout.style.display = 'inline-block';
    flashSaved();
    window.appRenderAll();
  };
  
  if(btnLogout) {
    btnLogout.onclick = () => {
      localStorage.removeItem('river-medals-auth');
      window.location.reload();
    };
  }
  loadLocalFallbackData();
}

async function loadCloudData() {
  if (!currentUser) return;
  try {
    const { data, error } = await _supabase
      .from('user_data')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (data) {
      window.appProgress = data.progress || {};
      window.appGoals = data.goals || {};
    } else {
      window.appProgress = {}; 
      window.appGoals = {};
    }
    window.appRenderAll();
  } catch (e) {
    console.error("Ошибка загрузки данных из Supabase:", e);
  }
}

async function loadLocalFallbackData() {
  try {
    const res = await window.storage.get("river-medals-progress");
    if (res && res.value) window.appProgress = JSON.parse(res.value);
  } catch (e) { window.appProgress = {}; }
  try {
    const res4 = await window.storage.get("river-medals-goals");
    if (res4 && res4.value) window.appGoals = JSON.parse(res4.value);
  } catch (e) { window.appGoals = {}; }
  try {
    const resDomain = await window.storage.get("river-medals-domain");
    if (resDomain && resDomain.value) currentDomainMode = resDomain.value;
  } catch (e) { currentDomainMode = "net"; }
  window.appRenderAll();
}

window.firebaseSaveData = async function (progressData, goalsData) {
  window.appProgress = progressData;
  window.appGoals = goalsData;

  if (useSupabase && currentUser) {
    try {
      const { error } = await _supabase
        .from('user_data')
        .upsert({
          id: currentUser.id,
          progress: window.appProgress,
          goals: window.appGoals,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      flashSaved();
    } catch (e) {
      console.error("Ошибка сохранения в Supabase:", e);
    }
  } else {
    try {
      await window.storage.set("river-medals-progress", JSON.stringify(window.appProgress));
      await window.storage.set("river-medals-goals", JSON.stringify(window.appGoals));
      flashSaved();
    } catch (err) { console.error("storage error", err); }
  }
};

function formatDateTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = pad(d.getFullYear() % 100);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

const ICONS = {
  paw: `M32 34c9 0 18 8 18 17 0 6-5 9-11 9-4 0-6-2-7-2s-3 2-7 2c-6 0-11-3-11-9 0-9 9-17 18-17z M14 30c4 0 7-4 7-9s-3-9-7-9-7 4-7 9 3 9 7 9z M50 30c4 0 7-4 7-9s-3-9-7-9-7 4-7 9 3 9 7 9z M24 18c4 0 7-4 7-9s-3-9-7-9-7 4-7 9 3 9 7 9z M40 18c4 0 7-4 7-9s-3-9-7-9-7 4-7 9 3 9 7 9z`,
  moon: `M40 5 C23 5 10 19 10 36 C10 51 21 63 36 63 C27 56 21 45 21 33 C21 20 28 10 40 5 Z`,
  lightning: `M38 4 L16 36 H 30 L24 60 L48 26 H 34 Z`,
  grass: `M32 60 V 45 C20 40 10 30 15 15 C25 15 30 25 32 35 C28 20 28 8 32 4 C36 8 36 20 32 35 C34 25 39 15 49 15 C54 30 44 40 32 45 V 60 Z`,
  shield: `M32 4 L56 14 V30 C56 46 46 57 32 60 C18 57 8 46 8 30 V14 Z`,
  feather: `M50 6 C34 8 18 22 12 42 C12 42 22 50 34 44 C46 38 54 22 50 6 Z`,
  star: `M32 4 L40 24 L62 26 L45 40 L51 62 L32 50 L13 62 L19 40 L2 26 L24 24 Z`,
  palette: `M32,4 C14,4 4,18 4,36 C4,52 14,60 26,60 C30,60 34,56 34,50 C34,44 28,42 28,36 C28,30 34,26 40,26 C46,26 54,32 60,24 C66,12 54,4 32,4 Z M18,34 C15,34 12,31 12,28 C12,25 15,22 18,22 C21,22 24,25 24,28 C24,31 21,34 18,34 Z M28,20 C25,20 22,17 22,14 C22,11 25,8 28,8 C31,8 34,11 34,14 C34,17 31,20 28,20 Z M42,22 C39,22 36,19 36,16 C36,13 39,10 42,10 C45,10 48,13 48,16 C48,19 45,22 42,22 Z`
};
const SPHERE_ICON = {
  "Сфера активности": "lightning",
  "Сфера детства": "paw",
  "Сфера ресурсов": "grass",
  "Сфера безопасности и бойцов": "shield",
  "Сфера творчества": "feather",
  "Сфера художества": "palette",
  "Сфера обучения": "moon",
  "Особые медали": "star"
};
function iconSVG(key) { return `<svg viewBox="0 0 64 64"><path d="${ICONS[key] || ICONS.paw}"/></svg>`; }
function escapeHTML(str) { return String(str == null ? "" : str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

const MEDALS = [
// ---- МЕДАЛИ ----
{id:"a1", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За активное участие в патрулях»", req:"Достичь 60 баллов за посещение пограничных патрулей (60 патрулей или меньше для ведущих с надбавкой в баллах).", type:"counter", target:60, unit:"баллов", image:"https://catwar.net/medal/74.png", blog:"https://catwar.net/blog13664"},
{id:"a2", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За активное участие в дозорах»", req:"Набрать 3000 минут (50 часов) дозоров.", type:"counter", target:3000, unit:"минут", image:"https://catwar.net/medal/209.png", blog:"https://catwar.net/blog13664"},
{id:"a3", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За умелое ведение патрулей»", req:"Посетить 35 любых патрулей в роли ведущего.", type:"counter", target:35, unit:"патрулей", image:"https://catwar.net/medal/2799.png", blog:"https://catwar.net/blog13664"},
{id:"a4", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За отличные охотничьи навыки»", req:"Достичь 150 охотничьих баллов, пополняя Кучу с добычей и вылавливая мышей для целителей.", type:"counter", target:150, unit:"баллов", image:"https://catwar.net/medal/71.png", blog:"https://catwar.net/blog51844"},
{id:"a5", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За сбор трав»", req:"Заработать 40 баллов за посещение травников (баллы зависят от дальности локации, их кол-ва и размера спавна трав).", type:"counter", target:40, unit:"баллов", image:"https://catwar.net/medal/248.png", blog:"https://catwar.net/blog24395"},
{id:"a6", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За помощь в повышении силы»", req:"Набрать 300 баллов за грушевание большой (50 часов), маленькой или одиночной (30 часов) грушей суммарно.", type:"counter", target:300, unit:"баллов", image:"https://catwar.net/medal/3555.png", blog:"https://catwar.net/blog24272"},
{id:"a7", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За чистку локаций»", req:"Накопить 600 баллов за чистку локаций от спящих в неположенном месте котов.", type:"counter", target:600, unit:"баллов", image:"https://catwar.net/medal/75.png", blog:"https://catwar.net/blog13219"},
{id:"a8", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За усилия, ставшие жемчужным светом»", req:"Покупается в обмен на 80 жемчужин в племенном магазине.", type:"counter", target:80, unit:"жемчужин", image:"https://catwar.net/medal/5184.png", blog:"https://catwar.net/blog1177097"},
{id:"a9", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За выдающиеся успехи в прокачивании Плавательных умений»", req:"Достичь 9 уровня ПУ.", type:"toggle", image:"https://catwar.net/medal/613.png", blog:""},
{id:"a10", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За образцовое усердие»*", req:"Получить суммарно 8 ачивок из любых категорий.", type:"counter", target:8, unit:"ачивок", image:"https://catwar.net/medal/2993.png", blog:"https://catwar.net/blog618534"},
{id:"a11", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За пыл, держащий на гребнях волн»", req:"Стать активистом недели 12 и более раз.", type:"counter", target:12, unit:"раз", image:"https://catwar.net/medal/5146.png", blog:""},
{id:"a12", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«Друг вольных степей»", req:"Набрать 120 баллов на обмене с племенем Ветра.", type:"counter", target:120, unit:"баллов", image:"https://catwar.net/medal/5185.png", blog:"https://catwar.net/blog1172570"},
{id:"a13", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«Друг северных ветров»", req:"Набрать 120 баллов на обмене с Северным кланом.", type:"counter", target:120, unit:"баллов", image:"https://catwar.net/medal/2713.png", blog:"https://catwar.net/blog919063"},
{id:"a14", typeAward:"medal", sphere:"Сфера активности", subcat:"Общедоступные", name:"«За неугасаемый огонь в глазах»",
  req:"Набрать баллы за срок, отведённый для получения награды, одним из статусов: 4 балла — Главы/замы, успевшие вовремя, или Воители и выше; 15 баллов — Главы/замы, если срок был пропущен.",
  image:"https://catwar.net/medal/2967.png", blog:"",
  variants:[
    {label:"Глава/зам · вовремя", type:"counter", target:4, unit:"балла"},
    {label:"Глава/зам · другое", type:"counter", target:15, unit:"баллов"},
    {label:"Воители и выше", type:"counter", target:4, unit:"балла"}
  ]},
{id:"a15", typeAward:"medal", sphere:"Сфера активности", subcat:"Отрядные", name:"«За наблюдательность»",
  req:"Медаль выдаётся одним из двух способов: 1) набрать 350 баллов + 50 дозоров ПЦ/ГБ + 20 участий в травнике/квестах; 2) набрать 550 баллов суммарно. В обоих случаях — не иметь за собой серьёзных нарушений дисциплины.",
  image:"https://catwar.net/medal/411.png", blog:"https://catwar.net/blog291989", note:"Не иметь за собой серьёзных нарушений дисциплины.",
  variants:[
    {label:"Способ 1", type:"multi", items: [ {key:"pts", label:"Баллы", type:"counter", target:350, unit:"баллов"}, {key:"pat", label:"Дозоры ПЦ/ГБ", type:"counter", target:50, unit:"дозоров"}, {key:"hrb", label:"Травник/квесты", type:"counter", target:20, unit:"участий"} ]},
    {label:"Способ 2", type:"counter", target:550, unit:"баллов"}
  ]},
{id:"a16", typeAward:"medal", sphere:"Сфера активности", subcat:"Отрядные", name:"«За верность порядку»", req:"Совершить 100 проверок дозорных, будучи Проверяющим.", type:"counter", target:100, unit:"проверок", image:"https://catwar.net/medal/1365.png", blog:"https://catwar.net/blog13664"},
{id:"a17", typeAward:"medal", sphere:"Сфера активности", subcat:"Отрядные", name:"«За точность распределения»", req:"Собрать 30 патрулей, будучи Собирающим.", type:"counter", target:30, unit:"патрулей", image:"https://catwar.net/medal/2801.png", blog:"https://catwar.net/blog13664"},
{id:"a18", typeAward:"medal", sphere:"Сфера активности", subcat:"Мероприятия", name:"«За волю к победе на мероприятии «Мир, труд, Река!»»", type:"toggle", image:"https://catwar.net/medal/4246.png", blog:""},
{id:"a19", typeAward:"medal", sphere:"Сфера творчества", subcat:"Мероприятия", name:"«За след, оставленный в легендах»", type:"toggle", image:"https://catwar.net/medal/2146.png", blog:"", req: "Выдаётся за участие в особом регулярном квесте или за активную работу в его организации."},
{id:"a20", typeAward:"medal", sphere:"Сфера активности", subcat:"Мероприятия", name:"«За ловкость лап»", req:"Накопить 6 баллов за охотничьи турниры: 1 место = 4 балла; 2 место = 3 балла; 3-5 места = 2 балла; Участие = 1,5 балла; Организация = 2 балла.", type:"counter", target:6, unit:"баллов", image:"https://catwar.net/medal/2797.png", blog:"https://catwar.net/blog51844"},
{id:"d1", typeAward:"medal", sphere:"Сфера детства", subcat:"Общедоступные", name:"«За сохранение озорного нрава»", req:"Набрать 800 баллов, побеждая и принимая участие в играх от Озорников.", type:"counter", target:800, unit:"баллов", image:"https://catwar.net/medal/4249.png", blog:"https://catwar.net/blog14909"},
{id:"d2", typeAward:"medal", sphere:"Сфера детства", subcat:"Общедоступные", name:"«За активную родительскую деятельность и заботу о котятах»", req:"Достичь 140 баллов за родительскую деятельность.", type:"counter", target:140, unit:"баллов", image:"https://catwar.net/medal/73.png", blog:"https://catwar.net/blog15700"},
{id:"d3", typeAward:"medal", sphere:"Сфера детства", subcat:"Котячьи", name:"«За стремление к знаниям»", req:"Написать все 5 принятий на 10/10 без пересдач (или исправить недостающий балл путём дополнительных принятий) в качестве Познающего.", type:"toggle", image:"https://catwar.net/medal/504.png", blog:"https://catwar.net/blog428342"},
{id:"d4", typeAward:"medal", sphere:"Сфера детства", subcat:"Котячьи", name:"«За пылающее детским озорством сердце»", req:"Выполнить по 2 постоянных задания из 3-х любых категорий, набрать 30 очков за постоянные задания и выполнить 7 недельных заданий своей команды, будучи Сорванцом.", type:"multi",
  items: [{key:"cat", label:"Категории заданий", type:"counter", target:3, unit:"шт"}, {key:"pts", label:"Очки за постоянные", type:"counter", target:30, unit:"очков"}, {key:"week", label:"Недельные задания", type:"counter", target:7, unit:"шт"}], image:"https://catwar.net/medal/69.png", blog:"https://catwar.net/blog1043001"},
{id:"d5", typeAward:"medal", sphere:"Сфера детства", subcat:"Отрядные", name:"«За весёлые игры и звонкий смех»", req:"Набрать 125 баллов за активное проведение игр в отряде Озорников.", type:"counter", target:125, unit:"баллов", image:"https://catwar.net/medal/247.png", blog:"https://catwar.net/blog14909"},
{id:"d6", typeAward:"medal", sphere:"Сфера детства", subcat:"Отрядные", name:"«За создание тёплых воспоминаний о беззаботном детстве»", req:"Набрать 55 баллов, занимаясь котятами в составе Затейников.", type:"counter", target:55, unit:"баллов", image:"https://catwar.net/medal/2992.png", blog:"https://catwar.net/blog1043001"},
{id:"d7", typeAward:"medal", sphere:"Сфера детства", subcat:"Отрядные", name:"«За активную деятельность в Вожатых»", req:"Накопить 5000 баллов в отряде Вожатых за помощь с прокачиванием навыков вне лагеря Храбрецам.", type:"counter", target:5000, unit:"баллов", image:"https://catwar.net/medal/249.png", blog:"https://catwar.net/blog562586"},
{id:"d8", typeAward:"medal", sphere:"Сфера обучения", subcat:"Отрядные", name:"«За выпуск котят»", req:"Набрать 30 баллов за проверку принятий и проведение экскурсий, будучи Дарующим.", type:"counter", target:30, unit:"баллов", image:"https://catwar.net/medal/503.png", blog:"https://catwar.net/blog428342"},
{id:"d9", typeAward:"medal", sphere:"Сфера обучения", subcat:"Отрядные", name:"«За обучение оруженосцев»", req:"Набрать 25 баллов за кураторство переходящих и работу с оруженосцами в отряде Наставников.", type:"counter", target:25, unit:"баллов", image:"https://catwar.net/medal/70.png", blog:"https://catwar.net/blog288633"},
{id:"d10", typeAward:"medal", sphere:"Сфера обучения", subcat:"Отрядные", name:"«За проверку племенных экзаменов»", req:"Проверить 15 ППП, 20 ВИ или 25 ПРИВ/УПРИВ, а также пробыть на должности экзаменатора минимум 2 месяца.", image:"https://catwar.net/medal/246.png", blog:"",
  variants: [
    {label:"ППП", type:"multi", items: [ {key:"ppp", label:"Проверки ППП", type:"counter", target:15, unit:"шт"}, {key:"mon", label:"Стаж", type:"counter", target:2, unit:"мес"} ]},
    {label:"ВИ", type:"multi", items: [ {key:"vi", label:"Проверки ВИ", type:"counter", target:20, unit:"шт"}, {key:"mon", label:"Стаж", type:"counter", target:2, unit:"мес"} ]},
    {label:"ПРИВ/УПРИВ", type:"multi", items: [ {key:"priv", label:"Проверки ПРИВ", type:"counter", target:25, unit:"шт"}, {key:"mon", label:"Стаж", type:"counter", target:2, unit:"мес"} ]}
  ]
},
{id:"r1", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Общедоступные", name:"«За добычу подводных даров»", req:"Сдать в казну племени 35 добытых со дна ракушек.", type:"counter", target:35, unit:"ракушек", image:"https://catwar.net/medal/625.png", blog:"https://catwar.net/blog1091765"},
{id:"r2", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Общедоступные", name:"«За цепкий хват и зоркий глаз»", req:"Выловить 10 единиц паутины и перьев в сумме из дупла или расщелины.", type:"counter", target:10, unit:"единиц", image:"https://catwar.net/medal/370.png", blog:"https://catwar.net/blog1091768"},
{id:"r3", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Общедоступные", name:"«За готовность нести тяжкий груз»", req:"Принести из оазиса в Семидневном лабиринте и сдать в казну племени 2 камня на 4 места.", type:"counter", target:2, unit:"камней", image:"https://catwar.net/medal/626.png", blog:"https://catwar.net/blog1091763"},
{id:"r4", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Общедоступные", name:"«За экспедиции в далёкие края»", req:"Поймать 40 водорослей и/или кораллов для смесей в составе экспедиции.", type:"counter", target:40, unit:"штук", image:"https://catwar.net/medal/5253.png", blog:"https://catwar.net/blog1091763"},
{id:"r5", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Общедоступные", name:"«За невиданную щедрость»", req:"Набрать 50 баллов (или 25, если медаль была получена на предыдущих персонажах), сдавая в племенную казну уникальные предметы, сезонные баффы и, иногда, временные предметы.", type:"counter", target:50, unit:"баллов", image:"https://catwar.net/medal/3809.png", blog:"https://catwar.net/blog1177097"},
{id:"r6", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Отрядные", name:"«За сбор паутины»", req:"Набрать 350 баллов в отряде Туннелеров за посещение спавнов, ловлю паутины и не только.", type:"counter", target:350, unit:"баллов", image:"https://catwar.net/medal/245.png", blog:"https://catwar.net/blog14264"},
{id:"r7", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Отрядные", name:"«За покорение горных вершин»", req:"Набрать 350 баллов в отряде Покорителей вершин за осмотр гор после спавна, нахождение мха и не только.", type:"counter", target:350, unit:"баллов", image:"https://catwar.net/medal/244.png", blog:"https://catwar.net/blog60142"},
{id:"r8", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Отрядные", name:"«За отвагу на краю пропасти»", req:"Набрать 200 баллов в отряде Скалолазов в борьбе за ресурсы на уступах и в ущелье, а также посетить Зловонное ущелье минимум 20 раз.", type:"multi", items: [ {key:"pts", label:"Баллы в отряде", type:"counter", target:200, unit:"баллов"}, {key:"gorge", label:"Зловонное ущелье", type:"counter", target:20, unit:"раз"} ], image:"https://catwar.net/medal/369.png", blog:"https://catwar.net/blog1091768"},
{id:"r9", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Мероприятия", name:"«За ясный взор, что не страшится тьмы»", req:"Набрать 125 баллов за деятельность на Дне открытых дверей отряда Туннелеров.", type:"counter", target:125, unit:"баллов", image:"https://catwar.net/medal/2793.png", blog:"https://catwar.net/blog14264"},
{id:"r10", typeAward:"medal", sphere:"Сфера ресурсов", subcat:"Мероприятия", name:"«За сильный дух, что прокладывает тропы средь снежных хребтов»", req:"Набрать 125 баллов за деятельность на Дне открытых дверей отряда Покорителей вершин.", type:"counter", target:125, unit:"баллов", image:"https://catwar.net/medal/5145.png", blog:"https://catwar.net/blog60142"},
{id:"b1", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Общедоступные", name:"«За выдающиеся боевые умения»", req:"Достичь 9 уровня БУ.", type:"toggle", image:"https://catwar.net/medal/188.png", blog:""},
{id:"b2", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Отрядные", name:"«За отвагу над пропастью и под землёй»", req:"Собрать 20 баллов за посещение рейдов на Орлицу или Пещерную Лису в составе боевого ордена.", type:"counter", target:20, unit:"баллов", image:"https://catwar.net/medal/5254.png", blog:"https://catwar.net/blog268845"},
{id:"b3", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Отрядные", name:"«За бесстрашие в бою и преданность воинскому ремеслу»", req:"Набрать 70 баллов активности путём посещения различных боевых активностей: мероприятия, тренировки, рейды, обучение.", type:"counter", target:70, unit:"баллов", image:"https://catwar.net/medal/413.png", blog:"https://catwar.net/blog268845"},
{id:"b4", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Отрядные", name:"«За участие в битвах за локации»", req:"Принять участие в битве за локации хотя бы один раз или дважды активно помочь в подготовке к бою основной команды.", type:"toggle", image:"https://catwar.net/medal/119.png", blog:"https://catwar.net/blog268845"},
{id:"b5", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Отрядные", name:"«За воспитание воинского духа и обучение боевому искусству»", req:"Провести определённое количество тренировок: 15 для Учителя, 20 для Старосты или 25 для Знатока.", image:"https://catwar.net/medal/611.png", blog:"https://catwar.net/blog268845",
  variants:[ {label:"Учитель", type:"counter", target:15, unit:"тренировок"}, {label:"Староста", type:"counter", target:20, unit:"тренировок"}, {label:"Знаток", type:"counter", target:25, unit:"тренировок"} ]},
{id:"b6", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Отрядные", name:"«Никто не в силах разделить нас, пока свет указывает путь»", req:"Набегать 10 часов во время боевого обмена.", type:"counter", target:600, unit:"минут", image:"https://catwar.net/medal/2690.png", blog:""},
{id:"b7", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Отрядные", name:"«За каменный след там, где билось сердце»", req:"Накопить 20 баллов за деятельность в отряде Киллеров: убийства нарушителей, их выслеживание и многое другое.", type:"counter", target:20, unit:"баллов", image:"https://catwar.net/medal/5261.png", blog:"https://catwar.net/blog13647"},
{id:"b8", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Мероприятия", name:"«За победу в турнирах»", req:"Накопить 3 балла за главные места в межплеменных турнирах: 1 место = 1,5 балла; 2 место = 1 балл; 3 место = 0,5 балла.", type:"counter", target:3, unit:"баллов", image:"https://catwar.net/medal/250.png", blog:"https://catwar.net/blog268845"},
{id:"b9", typeAward:"medal", sphere:"Сфера безопасности и бойцов", subcat:"Мероприятия", name:"«За место в рядах сильнейших»", req:"Суммарно 2 раза принять активное участие в межфракционном турнире, в том числе посетить 2 боя из 3-х.", type:"counter", target:2, unit:"раз", image:"https://catwar.net/medal/5255.png", blog:"https://catwar.net/blog268845"},
{id:"c1", typeAward:"medal", sphere:"Сфера художества", subcat:"Общедоступные", name:"«За создание красочных пейзажей»", req:"Отрисовать 4 любых полноценных фона для локаций племени.", type:"counter", target:4, unit:"фонов", image:"https://catwar.net/medal/610.png", blog:"https://catwar.net/blog865117"},
{id:"c2", typeAward:"medal", sphere:"Сфера творчества", subcat:"Отрядные", name:"«За самую яркую фантазию»", req:"Достичь в общей сумме 150 баллов, работая над мероприятиями и не только в составе отряда Творцов.", type:"counter", target:150, unit:"баллов", image:"https://catwar.net/medal/502.png", blog:"https://catwar.net/blog971489"},
{id:"c3", typeAward:"medal", sphere:"Сфера творчества", subcat:"Отрядные", name:"«За переданные послания звёзд»", req:"Набрать 75 баллов в отряде Творцов.", type:"counter", target:75, unit:"баллов", image:"https://catwar.net/medal/1715.png", blog:"https://catwar.net/blog47872"},
{id:"c4", typeAward:"medal", sphere:"Сфера художества", subcat:"Отрядные", name:"«За преданность искусству»", req:"Набрать 120 баллов Иллюстратора, художественно помогая племени.", type:"counter", target:120, unit:"баллов", image:"https://catwar.net/medal/3393.png", blog:"https://catwar.net/blog865117"},
{id:"c5", typeAward:"medal", sphere:"Сфера художества", subcat:"Отрядные", name:"«За покраску клонов»", req:"Накопить 50 баллов Маляра путём покраски различных клонов.", type:"counter", target:50, unit:"баллов", image:"https://catwar.net/medal/4136.png", blog:"https://catwar.net/blog865117"},
{id:"c6", typeAward:"medal", sphere:"Сфера творчества", subcat:"Отрядные", name:"«За искусное владение пером»", req:"Достичь 30 баллов и состоять в отряде Журналистов минимум 2 месяца.", note:"Внимание: получение затруднено из-за проводящейся реформы отряда.", type:"multi", items: [ {key:"pts", label:"Баллы", type:"counter", target:30, unit:"баллов"}, {key:"mon", label:"Месяцы в отряде", type:"counter", target:2, unit:"мес"} ], image:"https://catwar.net/medal/3375.png", blog:"https://catwar.net/blog434004"},
{id:"c7", typeAward:"medal", sphere:"Сфера творчества", subcat:"Отрядные", name:"«За создание сюжетов, трогающих душу»", req:"Набрать 100 баллов за проведение мафии.", type:"counter", target:100, unit:"баллов", image:"https://catwar.net/medal/3374.png", blog:"https://catwar.net/blog931073"},
{id:"sp1", typeAward:"medal", sphere:"Особые медали", subcat:"Общедоступные", name:"«За активное участие в жизни племени»",
  req:"Три медали из списка на выбор. На выбор 8+ ПУ или 8+ БУ. Выполнить практику на выбор: Охраняющие границы, Охотники, Травники, Покорители, Туннелеры, Скалолазы.",
  variants: [
    {label:"Охраняющие (минуты)", type:"multi", items: [{key:"lvl", label:"8+ ПУ или БУ", type:"toggle"}, {key:"med", label:"Собрано 3 медали", type:"toggle"}, {key:"prc", label:"Дозоры", type:"counter", target:2400, unit:"мин"}]},
    {label:"Охраняющие (патрули)", type:"multi", items: [{key:"lvl", label:"8+ ПУ или БУ", type:"toggle"}, {key:"med", label:"Собрано 3 медали", type:"toggle"}, {key:"prc", label:"Патрули", type:"counter", target:40, unit:"шт"}]},
    {label:"Охотники", type:"multi", items: [{key:"lvl", label:"8+ ПУ или БУ", type:"toggle"}, {key:"med", label:"Собрано 3 медали", type:"toggle"}, {key:"prc", label:"Охота", type:"counter", target:70, unit:"баллов"}]},
    {label:"Травники", type:"multi", items: [{key:"lvl", label:"8+ ПУ или БУ", type:"toggle"}, {key:"med", label:"Собрано 3 медали", type:"toggle"}, {key:"prc", label:"Травники", type:"counter", target:20, unit:"баллов"}]},
    {label:"Покорители", type:"multi", items: [{key:"lvl", label:"8+ ПУ или БУ", type:"toggle"}, {key:"med", label:"Собрано 3 медали", type:"toggle"}, {key:"prc", label:"Патрули за мхом", type:"counter", target:10, unit:"шт"}]},
    {label:"Туннелеры", type:"multi", items: [{key:"lvl", label:"8+ ПУ или БУ", type:"toggle"}, {key:"med", label:"Собрано 3 медали", type:"toggle"}, {key:"prc", label:"Паутинники", type:"counter", target:10, unit:"шт"}]},
    {label:"Скалолазы", type:"multi", items: [{key:"lvl", label:"8+ ПУ или БУ", type:"toggle"}, {key:"med", label:"Собрано 3 медали", type:"toggle"}, {key:"prc", label:"Сборы со скал", type:"counter", target:12, unit:"шт"}]}
  ],
  note:"Отходить 2400 минут в дозорах или 40 патрулей (Охраняющие границы) · набрать 70 баллов (Охотники) · набрать 20 баллов (Травники) · посетить 10 патрулей за мхом (Покорители) · посетить 10 паутинников (Туннелеры) · посетить 12 сборов со скал (Скалолазы).",
  image:"https://catwar.net/medal/10.png", blog:""},
{id:"sp2", typeAward:"medal", sphere:"Особые медали", subcat:"Общедоступные", name:"«За неоценимый вклад в развитие племени»",
  req:"Подать одну крупную идею, реализованную без значительных изменений (или быть её главным реализатором), ИЛИ предложить/активно поучаствовать в реализации от трёх менее масштабных идей (чем меньше вклад — тем больше их нужно), ИЛИ совместить оба варианта.",
  note:"Если игрок ранее уже имел данную медаль — достаточно одной идеи (не обязательно крупной) или одного активного участия в нововведении. Идеи и участия в их реализации принимаются и с предыдущих персонажей — если можно подтвердить принадлежность персонажа и за них ранее медаль не выдавалась. Конкретизировать подходящие идеи трудно, всё рассматривается индивидуально: как правило, это новая система чего-либо, решение конкретной племенной/отрядной проблемы, новое мероприятие, новшество во фракции в целом либо неоднократная инициатива в реализации чего-то весомого. Обсуждение идей возможно как с предводителем, так и с доверенными лицами/главами соответствующих сфер.",
  type:"toggle", image:"https://catwar.net/medal/2798.png", blog:""},
// ---- АЧИВКИ ----
{id:"ac1", typeAward:"achievement", sphere:"Сфера активности", subcat:"Общедоступные", name:"«Удар за ударом»", req:"Набрать 20 часов грушевания мелкой или одиночной грушей.", type:"counter", target:1200, unit:"минут", image:"https://i.yapx.cc/Y3Qdj.png", blog:"https://catwar.net/blog24272"},
{id:"ac2", typeAward:"achievement", sphere:"Сфера активности", subcat:"Общедоступные", name:"«Висит груша, нельзя скушать»", req:"Набрать 25 часов грушевания большой грушей.", type:"counter", target:1500, unit:"минут", image:"https://i.yapx.cc/Y3Qee.png", blog:"https://catwar.net/blog24272"},
{id:"ac3", typeAward:"achievement", sphere:"Сфера детства", subcat:"Общедоступные", name:"«Давай, нападай!»", req:"Активировать котятам бабочку 500 раз.", type:"counter", target:500, unit:"раз", image:"https://i.yapx.cc/X6RSV.png", blog:"https://catwar.net/blog15700"},
{id:"ac4", typeAward:"achievement", sphere:"Сфера детства", subcat:"Общедоступные", name:"«Сквозь ветра и мрак»", req:"Набрать 15 баллов за сопровождение котят к Лисобойной и/или к Арин.", type:"counter", target:15, unit:"баллов", image:"https://i.yapx.cc/XwRy8.png", blog:"https://catwar.net/blog15700"},
{id:"ac5", typeAward:"achievement", sphere:"Сфера активности", subcat:"Общедоступные", name:"«Мышиный король»", req:"Поймать 100 и более мышей во время охотничьих патрулей.", type:"counter", target:100, unit:"мышей", image:"https://i.yapx.cc/X6RHK.png", blog:"https://catwar.net/blog51844"},
{id:"c6", typeAward:"medal", sphere:"Сфера творчества", subcat:"Отрядные", name:"«За искусное владение пером»", 
  req:"Достичь 30 баллов и состоять в отряде Журналистов минимум 2 месяца.", 
  note:"Внимание: получение затруднено из-за проводящейся реформы отряда.", 
  type:"multi", items: [ {key:"pts", label:"Баллы", type:"counter", target:30, unit:"баллов"}, {key:"mon", label:"Месяцы в отряде", type:"counter", target:2, unit:"мес"} ], image:"https://catwar.net/medal/3375.png", blog:"https://catwar.net/blog434004"},
{id:"c7", typeAward:"medal", sphere:"Сфера творчества", subcat:"Отрядные", name:"«За создание сюжетов, трогающих душу»", req:"Набрать 100 баллов за проведение мафии.", 
  note:"Внимание: получение затруднено из-за проводящейся реформы отряда.", 
  type:"counter", target:100, unit:"баллов", image:"https://catwar.net/medal/3374.png", blog:"https://catwar.net/blog931073"},
{id:"ac8", typeAward:"achievement", sphere:"Сфера безопасности и бойцов", subcat:"Боевые", name:"«Всё под контролям»", req:"Принять активную организаторскую деятельность в Орденах.", type:"toggle", image:"https://i.yapx.cc/XrSMg.png", blog:"https://catwar.net/blog268845"},
{id:"ac9", typeAward:"achievement", sphere:"Сфера безопасности и бойцов", subcat:"Боевые", name:"«Живи с честью, умри со славой!»", req:"Участвовать в мероприятии «Живи с честью, умри со славой!» минимум 3 раза.", type:"counter", target:3, unit:"раз", image:"https://i.ibb.co/LkGXS26/image.png", blog:"https://catwar.net/blog268845"},
{id:"ac10", typeAward:"achievement", sphere:"Сфера безопасности и бойцов", subcat:"Боевые", name:"«Я уже не чувствую боли»", req:"Прокачать Боевой Пропуск два раза до 45 уровня или один раз до 90 уровня.", type:"toggle", image:"https://i.yapx.cc/YCRdA.png", blog:"https://catwar.net/blog268845"},
{id:"ac11", typeAward:"achievement", sphere:"Сфера активности", subcat:"Мероприятия", name:"«Кошки-мышки»", req:"Поймать 18 единиц дичи за один охотничий турнир.", type:"counter", target:18, unit:"единиц", image:"https://i.yapx.cc/XrSSn.png", blog:"https://catwar.net/blog51844"},
{id:"ac12", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Мероприятия", name:"«Любитель озорства»", req:"Посетить 10 мафий.", type:"counter", target:10, unit:"мафий", image:"https://i.yapx.cc/X6RYV.png", blog:"https://catwar.net/blog931073"},
{id:"ac13", typeAward:"achievement", sphere:"Сфера активности", subcat:"Мероприятия", name:"«Активный участник мероприятия «Мир, труд, Река!»»", req:"Проявить себя в ходе мероприятия «Мир, труд, Река!».", type:"toggle", image:"https://i.yapx.cc/X6RZY.png", blog:""},
{id:"ac14", typeAward:"achievement", sphere:"Сфера детства", subcat:"Мероприятия", name:"«Солнечными лучами рисуется детство»", req:"Озорникам — принять участие в организации детских мероприятий; игрокам — пройти квест от начала до конца.", type:"toggle", image:"https://i.yapx.cc/X6RjE.png", blog:"https://catwar.net/blog14909"},
{id:"ac15", typeAward:"achievement", sphere:"Сфера детства", subcat:"Мероприятия", name:"«Я подарю вам звёзды»", req:"Затейникам — набрать 20 баллов за составление и проверку тематических заданий; Озорникам — набрать 45 баллов.", type:"toggle", image:"https://i.yapx.cc/YeU7d.png", blog:"https://catwar.net/blog14909"},
{id:"ac16", typeAward:"achievement", sphere:"Сфера детства", subcat:"Мероприятия", name:"«Мечты, отражённые в звёздах»", req:"Набрать 25 очков активности за тематические игры и задания по отдельности либо 50 очков за совместное мероприятие.", type:"toggle", image:"https://i.yapx.cc/YeU7w.png", blog:"https://catwar.net/blog14909"},
{id:"ac17", typeAward:"achievement", sphere:"Сфера активности", subcat:"Отрядные", name:"«Преданный делу»", req:"Отработать в любом Речном отряде более 6 месяцев и иметь медаль этого отряда.", type:"toggle", image:"https://i.yapx.cc/X0cA8.png", blog:""},
{id:"ac18", typeAward:"achievement", sphere:"Сфера обучения", subcat:"Отрядные", name:"«За кураторство»", req:"Выполнить требования из блогов отрядов: Целительский уголок, Мастера игр, Воспитатели, Мафиози, Поздравители.", type:"toggle", image:"https://i.yapx.cc/X0cGL.png", blog:"https://catwar.net/blog291989"},
{id:"ac19", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Творцы", name:"«Воплощающий идеи в реальность»", req:"Организовать и провести не менее 5 мероприятий в роли Творца.", type:"counter", target:5, unit:"мероприятий", image:"https://i.yapx.cc/XrSi9.png", blog:"https://catwar.net/blog971489"},
{id:"ac20", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Творцы", name:"«Вся жизнь — театр»", req:"Отыграть роль в сумме не менее 25 часов (для Актёров).", type:"counter", target:1500, unit:"минут", image:"https://i.yapx.cc/X6RvB.png", blog:"https://catwar.net/blog971489"},
{id:"ac21", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Самому старательному Журналисту»", req:"Принять активное участие в создании 5 выпусков журнала.", type:"counter", target:5, unit:"выпусков", image:"https://i.yapx.cc/X0cH6.png", blog:"https://catwar.net/blog434004"},
{id:"ac22", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Выдающийся дизайнер»", req:"Написать 10 кодов и подготовить 2 выпуска в роли дизайнера.", type:"multi", items: [ {key:"cod", label:"Коды", type:"counter", target:10, unit:"шт"}, {key:"iss", label:"Выпуски", type:"counter", target:2, unit:"шт"} ], image:"https://i.yapx.cc/XrSj3.png", blog:"https://catwar.net/blog434004"},
{id:"ac23", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"««Нет» ошибкам!»", req:"Проверить 2 выпуска и исправить 50 ошибок в роли редактора.", type:"multi", items: [ {key:"iss", label:"Выпуски", type:"counter", target:2, unit:"шт"}, {key:"err", label:"Ошибки", type:"counter", target:50, unit:"шт"} ], image:"https://i.yapx.cc/X0cI1.png", blog:"https://catwar.net/blog434004"},
{id:"ac24", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Зовущие за собой звёзды»", req:"Написать 12 предсказаний в роли астролога.", type:"counter", target:12, unit:"предсказаний", image:"https://i.yapx.cc/XrSnH.png", blog:"https://catwar.net/blog434004"},
{id:"ac25", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Мастер на все лапы»", req:"Сделать минимум 3 поделки для журнала.", type:"counter", target:3, unit:"поделок", image:"https://i.yapx.cc/X6Rw6.png", blog:"https://catwar.net/blog434004"},
{id:"ac26", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Камера, мотор!»", req:"Опросить 8 игроков в роли репортёра.", type:"counter", target:8, unit:"игроков", image:"https://i.yapx.cc/X0cJX.png", blog:"https://catwar.net/blog434004"},
{id:"ac27", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Опять диаграммы?»", req:"Опросить 50 игроков и составить 2 диаграммы в роли аналитика.", type:"multi", items: [ {key:"ply", label:"Игроки", type:"counter", target:50, unit:"шт"}, {key:"dia", label:"Диаграммы", type:"counter", target:2, unit:"шт"} ], image:"https://i.yapx.cc/XrSoG.png", blog:"https://catwar.net/blog434004"},
{id:"ac28", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Информатор»", req:"Написать 10 фактов и 3 описания к выпуску или постов в группу в роли исследователя.", type:"multi", items: [ {key:"fac", label:"Факты", type:"counter", target:10, unit:"шт"}, {key:"des", label:"Описания/посты", type:"counter", target:3, unit:"шт"} ], image:"https://i.yapx.cc/XrSq3.png", blog:"https://catwar.net/blog434004"},
{id:"ac29", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Игроман»", req:"Создать 6 игр и загадок суммарно.", type:"counter", target:6, unit:"игр и загадок", image:"https://i.yapx.cc/X4nvI.png", blog:"https://catwar.net/blog434004"},
{id:"ac30", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Журналисты", name:"«Провидец судьбы»", req:"Сделать 4 индивидуальных расклада и 2 расклада на месяц.", type:"multi", items: [ {key:"ind", label:"Индивид. расклады", type:"counter", target:4, unit:"шт"}, {key:"mon", label:"На месяц", type:"counter", target:2, unit:"шт"} ], image:"https://i.yapx.cc/ZzEfU.png", blog:"https://catwar.net/blog434004"},
{id:"ac31", typeAward:"achievement", sphere:"Сфера художества", subcat:"Иллюстраторы", name:"«Ювелирных дел мастер»", req:"Отрисовать 5 работ маленького разрешения.", type:"counter", target:5, unit:"работ", image:"https://i.yapx.cc/X0fWy.png", blog:"https://catwar.net/blog865117"},
{id:"ac32", typeAward:"achievement", sphere:"Сфера художества", subcat:"Иллюстраторы", name:"«Дело мастера боится»", req:"Отрисовать 5 работ большого формата.", type:"counter", target:5, unit:"работ", image:"https://i.yapx.cc/X0fX3.png", blog:"https://catwar.net/blog865117"},
{id:"ac33", typeAward:"achievement", sphere:"Сфера художества", subcat:"Иллюстраторы", name:"«Я в порядке»", req:"Отрисовать минимум 3 работы с дедлайном менее недели (не считая работ для журнала).", type:"counter", target:3, unit:"работ", image:"https://i.yapx.cc/X0fYM.png", blog:"https://catwar.net/blog865117"},
{id:"ac34", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Мафиози", name:"«Самому активному Ведущему»", req:"Организовать 15 игр мафии.", type:"counter", target:15, unit:"игр", image:"https://i.yapx.cc/XrSrn.png", blog:"https://catwar.net/blog931073"},
{id:"ac35", typeAward:"achievement", sphere:"Сфера ресурсов", subcat:"Туннелеры", name:"«Паутина на вес золота»", req:"Собрать 15 единиц паутины.", type:"counter", target:15, unit:"единиц", image:"https://i.yapx.cc/X0cKE.png", blog:"https://catwar.net/blog14264"},
{id:"ac36", typeAward:"achievement", sphere:"Сфера ресурсов", subcat:"Туннелеры", name:"«В окружении тьмы и надежды»", req:"Посетить 30 паутинников.", type:"counter", target:30, unit:"паутинников", image:"https://i.yapx.cc/X6Ryy.png", blog:"https://catwar.net/blog14264"},
{id:"ac37", typeAward:"achievement", sphere:"Сфера ресурсов", subcat:"Покорители вершин", name:"«Наследие гор»", req:"Собрать 15 единиц мха.", type:"counter", target:15, unit:"единиц", image:"https://i.yapx.cc/X662L.png", blog:"https://catwar.net/blog60142"},
{id:"ac38", typeAward:"achievement", sphere:"Сфера ресурсов", subcat:"Покорители вершин", name:"«На вершине мира»", req:"Посетить 30 горных патрулей.", type:"counter", target:30, unit:"патрулей", image:"https://i.yapx.cc/X6613.png", blog:"https://catwar.net/blog60142"},
{id:"ac39", typeAward:"achievement", sphere:"Сфера ресурсов", subcat:"Скалолазы", name:"«Скалолаз»", req:"Посетить 40 сборов в ущелье или на уступах.", type:"counter", target:40, unit:"сборов", image:"https://i.yapx.cc/X0cMn.png", blog:"https://catwar.net/blog1091768"},
{id:"ac40", typeAward:"achievement", sphere:"Сфера ресурсов", subcat:"Скалолазы", name:"«Удачливые лапки»", req:"Собрать 15 единиц паутины со Зловонного ущелья.", type:"counter", target:15, unit:"единиц", image:"https://i.yapx.cc/X3wY3.png", blog:"https://catwar.net/blog1091768"},
{id:"ac41", typeAward:"achievement", sphere:"Сфера активности", subcat:"Наблюдатели", name:"«Общий сбор»", req:"Оказать помощь во время нападения Выдры минимум 3 раза.", type:"counter", target:3, unit:"раз", image:"https://i.yapx.cc/X0cNF.png", blog:"https://catwar.net/blog291989"},
{id:"ac42", typeAward:"achievement", sphere:"Сфера активности", subcat:"Наблюдатели", name:"«Рассекающий грёзы»", req:"Доставить мох с Острова туманов в ПЦ и выполнить квест на Одиноком склоне минимум 20 раз.", type:"multi", items: [ {key:"mos", label:"Мох с Острова", type:"counter", target:20, unit:"раз"}, {key:"qst", label:"Квест на Склоне", type:"counter", target:20, unit:"раз"} ], image:"https://i.yapx.cc/X662i.png", blog:"https://catwar.net/blog291989"},
{id:"ac43", typeAward:"achievement", sphere:"Сфера активности", subcat:"Наблюдатели", name:"«Под прикрытием»", req:"Посетить минимум 20 травников в рамках отрядного задания.", type:"counter", target:20, unit:"травников", image:"https://i.yapx.cc/X0cOX.png", blog:"https://catwar.net/blog291989"},
{id:"ac44", typeAward:"achievement", sphere:"Сфера детства", subcat:"Озорники", name:"«Заядлый игрок»", req:"Организовать 70 и более игр для котят.", type:"counter", target:70, unit:"игр", image:"https://i.yapx.cc/XrSzE.png", blog:"https://catwar.net/blog14909"},
{id:"ac45", typeAward:"achievement", sphere:"Сфера детства", subcat:"Озорники", name:"«Вместе по следам букашек»", req:"Получить 15 баллов за работу над Детскими Охотничьими Турнирами.", type:"counter", target:15, unit:"баллов", image:"https://i.yapx.ru/ZzFPo.png", blog:"https://catwar.net/blog14909"},
{id:"ac46", typeAward:"achievement", sphere:"Сфера детства", subcat:"Сорванцы", name:"«Гениальный сомёнок»", req:"Выполнить 20 постоянных заданий в команде Сомят.", type:"counter", target:20, unit:"заданий", image:"https://i.yapx.cc/XrS0X.png", blog:"https://catwar.net/blog1043001"},
{id:"ac47", typeAward:"achievement", sphere:"Сфера детства", subcat:"Сорванцы", name:"«Обаятельный выдрёнок»", req:"Выполнить 20 постоянных заданий в команде Выдрят.", type:"counter", target:20, unit:"заданий", image:"https://i.yapx.cc/X6629.png", blog:"https://catwar.net/blog1043001"},
{id:"ac48", typeAward:"achievement", sphere:"Сфера детства", subcat:"Сорванцы", name:"«Мечтательный лягушонок»", req:"Выполнить 20 постоянных заданий в команде Лягушат.", type:"counter", target:20, unit:"заданий", image:"https://i.yapx.cc/X0cPg.png", blog:"https://catwar.net/blog1043001"},
{id:"ac49", typeAward:"achievement", sphere:"Сфера детства", subcat:"Затейники", name:"«Проводник во взрослую жизнь»", req:"Собрать 30 и более ДП.", type:"counter", target:30, unit:"ДП", image:"https://i.yapx.cc/X6R2j.png", blog:"https://catwar.net/blog14909"},
{id:"ac50", typeAward:"achievement", sphere:"Сфера детства", subcat:"Затейники", name:"«Творящий детство»", req:"Набрать 30 баллов за новые задания.", type:"counter", target:30, unit:"баллов", image:"https://i.yapx.cc/X6XO7.png", blog:"https://catwar.net/blog1043001"},
{id:"ac51", typeAward:"achievement", sphere:"Сфера детства", subcat:"Затейники", name:"«Дело горит в лапках»", req:"5 раз составить расписание недельных заданий и набрать 30 баллов за работу с таблицами.", type:"multi", items: [ {key:"sch", label:"Расписания", type:"counter", target:5, unit:"шт"}, {key:"pts", label:"Баллы (таблицы)", type:"counter", target:30, unit:"баллов"} ], image:"https://i.yapx.cc/X6XPK.png", blog:"https://catwar.net/blog1043001"},
{id:"ac52", typeAward:"achievement", sphere:"Сфера детства", subcat:"Затейники", name:"«Лапа помощи»", req:"Набрать 60 баллов за слежку за Сорванцами и 5 раз внести отчёты котят.", type:"multi", items: [ {key:"pts", label:"Баллы", type:"counter", target:60, unit:"баллов"}, {key:"rep", label:"Отчёты", type:"counter", target:5, unit:"шт"} ], image:"https://i.yapx.cc/X6XRD.png", blog:"https://catwar.net/blog1043001"},
{id:"ac53", typeAward:"achievement", sphere:"Сфера детства", subcat:"Вожатые", name:"«С ветки на ветку»", req:"Провести 60 и более часов с Храбрецами на лазательных локациях.", type:"counter", target:3600, unit:"минут", image:"https://i.yapx.cc/XrS3A.png", blog:"https://catwar.net/blog562586"},
{id:"ac54", typeAward:"achievement", sphere:"Сфера детства", subcat:"Вожатые", name:"«Не бойся глубины»", req:"Совершить 60 и более походов с Храбрецами на дно для ныряния.", type:"counter", target:60, unit:"походов", image:"https://i.yapx.cc/XrS4c.png", blog:"https://catwar.net/blog562586"},
{id:"ac55", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Речные звёздочки", name:"«Премия за смелость в журналистике»", req:"Собрать 70 поздравлений для именинников.", type:"counter", target:70, unit:"поздравлений", image:"https://i.yapx.cc/X1OBJ.png", blog:"https://catwar.net/blog47872"},
{id:"ac56", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Речные звёздочки", name:"«Рисуя млечный путь»", req:"Нарисовать 7 шапок и 10 рисунков для блогов именинников.", type:"multi", items: [ {key:"hed", label:"Шапки", type:"counter", target:7, unit:"шт"}, {key:"art", label:"Рисунки", type:"counter", target:10, unit:"шт"} ], image:"https://i.yapx.cc/X1OEW.png", blog:"https://catwar.net/blog47872"},
{id:"ac57", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Речные звёздочки", name:"«Креативный инженер»", req:"Создать не менее 10 блогов с уникальным оформлением.", type:"counter", target:10, unit:"блогов", image:"https://i.yapx.cc/X1OE7.png", blog:"https://catwar.net/blog47872"},
{id:"ac58", typeAward:"achievement", sphere:"Сфера творчества", subcat:"Речные звёздочки", name:"«Он показал новый мир»", req:"Создать 10 легенд, из которых хотя бы 2 — интерактивные.", type:"toggle", image:"https://i.yapx.cc/X1OHS.png", blog:"https://catwar.net/blog47872"},
];

const ALL_SPHERES = [...new Set(MEDALS.map(m=>m.sphere))];
const MEDAL_SPHERES = [...new Set(MEDALS.filter(m=>m.typeAward==='medal').map(m=>m.sphere))];
const ACH_SPHERES = [
  "Сфера активности",
    "Сфера творчества",
  "Сфера детства",
    "Сфера обучения",
  "Сфера ресурсов",
  "Сфера безопасности и бойцов",
  "Сфера художества",
  "Особые медали"
].filter(s => MEDALS.some(m => m.typeAward === 'achievement' && m.sphere === s));
const SUBCAT_ORDER = ["Общедоступные","Котячьи","Отрядные","Мероприятия","Боевые","Творцы","Журналисты","Иллюстраторы","Мафиози","Туннелеры","Покорители вершин","Скалолазы","Наблюдатели","Озорники","Сорванцы","Затейники","Вожатые","Речные звёздочки"];
const VIEWS = [
  {id:"medals", label:"Медали"},
  {id:"achievements", label:"Ачивки"},
    {id:"planner", label:"План"},
  {id:"requested", label:"Запрошено"},
  {id:"received", label:"Получено"},
  {id:"stats", label:"Статистика"},
];

function getBlogLink(url) {
  if (!url) return "";
  if (currentDomainMode === "su") return url.replace("catwar.net", "catwar.su");
  return url.replace("catwar.su", "catwar.net");
}
function checkMulti(items, dataObj) {
  if (!dataObj) return false;
  return items.every(it => {
    if (it.type === "toggle") return !!dataObj[it.key];
    return (dataObj[it.key] || 0) >= it.target;
  });
}
function variantEarned(m, idx) {
  const v = m.variants[idx];
  const p = window.appProgress[m.id] || {};
  const vp = (p.variants && p.variants[idx]) || {};
  if (v.type === "multi") return checkMulti(v.items, vp.multi);
  if (v.type === "toggle") return !!vp.done;
  return (vp.value || 0) >= v.target;
}
function selectedVariantIndex(m) {
  const p = window.appProgress[m.id] || {};
  if (p.selectedVariant != null && m.variants[p.selectedVariant]) return p.selectedVariant;
  const firstUnfinished = m.variants.findIndex((v, i) => !variantEarned(m, i));
  return firstUnfinished >= 0 ? firstUnfinished : 0;
}
function isRequirementMet(m) {
  if (m.variants) return m.variants.some((v, i) => variantEarned(m, i));
  const p = window.appProgress[m.id] || {};
  if (m.type === "multi") return checkMulti(m.items, p.multi);
  if (m.type === "toggle") return !!p.done;
  return (p.value || 0) >= m.target;
}
function getAwardStatus(m) { return (window.appProgress[m.id] && window.appProgress[m.id].status) || ""; }
function isRequested(m) { return getAwardStatus(m) === "requested"; }
function isReceived(m) { return getAwardStatus(m) === "received"; }
function isEarned(m) { return isReceived(m); }
function calcPct(type, target, items, valObj) {
  if (type === "toggle") return valObj?.done ? 100 : 0;
  if (type === "counter") return Math.min(100, Math.round(((valObj?.value) || 0) / target * 100));
  if (type === "multi") {
    if (!items || !items.length) return 0;
    let totalPct = 0;
    items.forEach(it => {
      if (it.type === "toggle") { totalPct += (valObj?.multi?.[it.key] ? 100 : 0); }
      else { let v = valObj?.multi?.[it.key] || 0; totalPct += Math.min(100, (v / it.target) * 100); }
    });
    return Math.round(totalPct / items.length);
  }
  return 0;
}
function awardProgressPct(m) {
  if (m.variants) {
    const selIdx = selectedVariantIndex(m);
    const v = m.variants[selIdx];
    const p = window.appProgress[m.id] || {};
    const vp = (p.variants && p.variants[selIdx]) || {};
    return calcPct(v.type, v.target, v.items, vp);
  }
  return calcPct(m.type, m.target, m.items, window.appProgress[m.id] || {});
}
function awardStage(m) {
  if (isReceived(m)) return "received";
  if (isRequested(m)) return "requested";
  if (isRequirementMet(m)) return "ready";
  if (awardProgressPct(m) > 0) return "in-progress";
  return "not-started";
}
function awardStageLabel(stage) {
  return ({
    "not-started": "не начато",
    "in-progress": "в процессе",
    ready: "можно запросить",
    requested: "запрошено",
    received: "получено"
  })[stage] || "не начато";
}
function sphereStats(sphere, typeAward) {
  const list = MEDALS.filter(m => (!sphere || m.sphere === sphere) && (!typeAward || m.typeAward === typeAward));
  const earned = list.filter(isEarned).length;
  return { earned, total: list.length };
}
function matchesFilter(m, state) {
  const q = state.query.trim().toLowerCase();
  const haystack = (m.req || "") + " " + (m.note || "") + " " + (m.variants ? m.variants.map(v => v.req || v.label || "").join(" ") : "");
  if (q && !m.name.toLowerCase().includes(q) && !haystack.toLowerCase().includes(q)) return false;
  const stage = awardStage(m);
  if (state.filterMode && state.filterMode !== "all" && stage !== state.filterMode) return false;
  if (state.sphereFilter && state.sphereFilter !== "all" && m.sphere !== state.sphereFilter) return false;
  return true;
}
function bindSearchInput(id, setter, onRender) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", (e) => {
    setter(e.target.value);
    const selStart = e.target.selectionStart;
    onRender();
    const el2 = document.getElementById(id);
    if (el2) { el2.focus(); el2.setSelectionRange(selStart, selStart); }
  });
}
function pulseCard(id) {
  const slot = document.querySelector(`.medal-slot[data-id="${id}"]`);
  const card = slot ? slot.closest(".card") : null;
  if (card) {
    card.classList.add("just-earned");
    setTimeout(() => card.classList.remove("just-earned"), 1000);
  }
}
function renderViewTabs() {
  const nav = document.getElementById("viewTabs");
  nav.innerHTML = VIEWS.map(v => `<button class="view-tab ${currentView === v.id ? "active" : ""}" data-view="${v.id}">${v.label}</button>`).join("");
  nav.querySelectorAll(".view-tab").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}
function switchView(view) {
  currentView = view;
  window.appRenderAll();
}
function sphereAnchor(sphere) { return "sph-" + sphere.replace(/[^a-zа-яё0-9]+/gi, "-"); }
function renderQuickjump(spheresToShow, typeAward) {
  return `<div class="quickjump">${spheresToShow.map(sphere => {
    const { earned, total } = sphereStats(sphere, typeAward);
    if (total === 0) return "";
    const key = SPHERE_ICON[sphere] || "paw";
    return `<button class="quickjump-btn" data-jump="${sphereAnchor(sphere)}">
      <span class="paw">${iconSVG(key)}</span>${sphere.replace("Сфера ", "")} · ${earned}/${total}
    </button>`;
  }).join("")}</div>`;
}
function toggleCheckHTML(id, checked, cls, variantIdx) {
  const dataAttrs = variantIdx != null ? `data-id="${id}" data-variant="${variantIdx}"` : `data-id="${id}"`;
  return `<label class="toggle-check ${checked ? "checked" : ""}">
    <input type="checkbox" ${dataAttrs} class="${cls}" ${checked ? "checked" : ""}>
    <span class="check-icon"><svg viewBox="0 0 16 16"><path d="M3 8l3.5 3.5L13 4.5"/></svg></span>
    <span class="txt">${checked ? "Выполнено" : "Выполнено"}</span>
  </label>`;
}
function statusControlsHTML(m, statusLog) {
  const requested = isRequested(m);
  const received = isReceived(m);

  if (received) {
    return `<div class="status-actions">
      <button type="button" class="status-btn" data-id="${m.id}" data-status="received" title="Отменить статус Получено" style="background: transparent; border: none; color: var(--text-muted); font-size: 24px; padding: 0 4px; cursor: pointer; min-width: auto; margin: 0; line-height: 1;">×</button>
      ${statusLog ? `<div class="date-log" style="margin: 0;">${statusLog}</div>` : ""}
    </div>`;
  }

  return `<div class="status-actions">
    <div class="status-buttons-group">
      <button type="button" class="status-btn ${requested ? "active" : ""}" data-id="${m.id}" data-status="requested">Запрошено</button>
      <button type="button" class="status-btn ${received ? "active" : ""}" data-id="${m.id}" data-status="received">Получено</button>
    </div>
    ${statusLog ? `<div class="date-log" style="margin: 0;">${statusLog}</div>` : ""}
  </div>`;
}
function renderMultiControls(items, mId, vIdx, valData) {
  let totalPct = 0;
  if (items && items.length) {
    items.forEach(it => {
      if (it.type === "toggle") { totalPct += (valData?.[it.key] ? 100 : 0); }
      else { let v = valData?.[it.key] || 0; totalPct += Math.min(100, (v / it.target) * 100); }
    });
    totalPct = Math.round(totalPct / items.length);
  }
  const inputsHTML = items.map(it => {
    let val = valData?.[it.key];
    if (it.type === "toggle") {
      val = !!val;
      return `<div style="display:flex; flex-direction:column; gap:4px;">
        <span style="font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">${it.label}</span>
        <label class="multi-check toggle-check ${val ? "checked" : ""}" style="margin:0; padding:4px 8px; min-height:28px;">
          <input type="checkbox" data-id="${mId}" data-variant="${vIdx != null ? vIdx : ""}" data-mkey="${it.key}" class="multi-toggle-input" ${val ? "checked" : ""}>
          <span class="check-icon" style="width:16px; height:16px; border-width:1px;"><svg viewBox="0 0 16 16"><path d="M3 8l3.5 3.5L13 4.5"/></svg></span>
          <span class="txt" style="font-size:12px;">Выполнено</span>
        </label>
      </div>`;
    } else if (it.unit === "минут" || it.unit === "мин" || it.unit === "часов" || it.unit === "час") {
      val = val || 0;
      const dataAttrs = `data-id="${mId}" data-variant="${vIdx != null ? vIdx : ""}" data-mkey="${it.key}"`;
      const h = Math.floor(val / 60); const mnt = val % 60;
      const targetH = Math.floor(it.target / 60); const targetM = it.target % 60;
     return `<div style="display:flex; flex-direction:column; gap:4px;">
        <span style="font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">${it.label}</span>
        <div class="hm-wrap">
          <input type="number" min="0" value="${h}" ${dataAttrs} class="hm-hours hm-input" placeholder="ч"> <span class="hm-sep">ч</span>
          <input type="number" min="0" max="59" value="${mnt}" ${dataAttrs} class="hm-minutes hm-input" placeholder="мин"> <span class="hm-sep">мин</span>
          <span class="of-target mono">/ ${targetH}ч${targetM > 0 ? ' ' + targetM + 'мин' : ''}</span>
        </div>
      </div>`;
    } else {
      val = val || 0;
      return `<div style="display:flex; flex-direction:column; gap:4px;">
        <span style="font-size:10.5px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.05em;">${it.label}</span>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="number" min="0" value="${val}" data-id="${mId}" data-variant="${vIdx != null ? vIdx : ""}" data-mkey="${it.key}" class="multi-counter-input">
          <span class="of-target mono">/ ${it.target} ${it.unit || ""}</span>
        </div>
      </div>`;
    }
  }).join("");
  return `<div class="multi-reqs" style="margin-top:10px;">
    <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end; margin-bottom:12px;">${inputsHTML}</div>
    <div class="mini-track"><div class="mini-fill" style="width:${totalPct}%;"></div></div>
  </div>`;
}
function hmInputHTML(val, dataAttrs, target) {
  const h = Math.floor((val || 0) / 60);
  const m = (val || 0) % 60;
  const targetH = Math.floor(target / 60);
  const targetM = target % 60;
  return `
    <div class="hm-wrap" style="margin-top:8px;">
      <input type="number" min="0" value="${h}" ${dataAttrs} class="hm-hours hm-input" placeholder="ч"> <span class="hm-sep">ч</span>
      <input type="number" min="0" max="59" value="${m}" ${dataAttrs} class="hm-minutes hm-input" placeholder="мин"> <span class="hm-sep">мин</span>
      <span class="of-target mono">/ ${targetH}ч${targetM > 0 ? ' ' + targetM + 'мин' : ''}</span>
    </div>`;
}

function simpleCardHTML(m) {
  const stage = awardStage(m);
  const imgUrl = m.image || "";
  const actualBlogLink = getBlogLink(m.blog);
  
  const nameHTML = actualBlogLink
    ? `<a href="${escapeHTML(actualBlogLink)}" target="_blank" rel="noopener noreferrer" class="medal-name display" style="font-size:14.5px; margin:0; padding-right: 20px;">${m.name}</a>`
    : `<div class="medal-name display" style="font-size:14.5px; margin:0; padding-right: 20px;">${m.name}</div>`;
    
  const p = window.appProgress[m.id] || {};
  
  let dateText = "";
  if (stage === "received" && p.receivedAt) dateText = `Получено: ${formatDateTime(p.receivedAt)}`;
  else if (stage === "requested" && p.requestedAt) dateText = `Запрошено: ${formatDateTime(p.requestedAt)}`;

  let controlsHTML = "";
  let closeBtnHTML = "";

  if (stage === "requested") {
    controlsHTML = `
      <div style="display: flex; gap: 8px; margin-top: 6px;">
        <button type="button" class="status-btn active" data-id="${m.id}" data-status="requested" style="padding: 4px 10px; font-size: 11px; margin: 0;">Запрошено</button>
        <button type="button" class="status-btn" data-id="${m.id}" data-status="received" style="padding: 4px 10px; font-size: 11px; margin: 0;">Получено</button>
      </div>`;
  } else if (stage === "received") {
    closeBtnHTML = `<button type="button" class="status-btn" data-id="${m.id}" data-status="received" title="Отменить отметку" style="position: absolute; top: 6px; right: 8px; background: transparent; border: none; color: var(--text-muted); font-size: 20px; padding: 0 4px; cursor: pointer; min-width: auto; margin: 0; line-height: 1;">×</button>`;
  }
  
  return `
  <div class="simple-card" style="position: relative;">
    ${closeBtnHTML}
    <div class="simple-card-img">
      ${imgUrl ? `<img src="${escapeHTML(imgUrl)}" alt="" referrerpolicy="no-referrer">` : ``}
    </div>
    <div class="simple-card-body">
      ${nameHTML}
      ${controlsHTML}
      ${dateText ? `<div class="date-log" style="text-align: left; margin-top: 6px;">${dateText}</div>` : ""}
    </div>
  </div>`;
}

function cardHTML(m) {
  const stage = awardStage(m);
  const earned = isEarned(m);
const locked = false;
  const imgUrl = m.image || "";
  const pinned = !!window.appGoals[m.id];
  const actualBlogLink = getBlogLink(m.blog);

  const nameHTML = actualBlogLink
    ? `<a href="${escapeHTML(actualBlogLink)}" target="_blank" rel="noopener noreferrer" class="medal-name display" style="font-size:15.5px;">${m.name}</a>`
    : `<div class="medal-name display" style="font-size:15.5px;">${m.name}</div>`;

  const p = window.appProgress[m.id] || {};
  let reqText = m.req;
  let bodyHTML;

  if (locked) {
    bodyHTML = m.note ? `<div class="note">${m.note}</div>` : "";
  } else if (m.variants) {
    const selIdx = selectedVariantIndex(m);
    const v = m.variants[selIdx];
    const vp = (p.variants && p.variants[selIdx]) || {};
    reqText = v.req || m.req;
    const isTime = (u) => u === "минут" || u === "мин" || u === "часов" || u === "час";
    const tabsHTML = `<div class="variant-tabs">${m.variants.map((vv, i) => {
      const ve = variantEarned(m, i);
      return `<button type="button" class="variant-tab ${i === selIdx ? "active" : ""} ${ve ? "done" : ""}" data-id="${m.id}" data-variant="${i}">${ve ? "✓ " : ""}${escapeHTML(vv.label)}</button>`;
    }).join("")}</div>`;

    let controlHTML;
    if (v.type === "multi") {
      controlHTML = renderMultiControls(v.items, m.id, selIdx, vp.multi);
    } else if (v.type === "counter") {
      const val = vp.value || 0;
      const pct = Math.min(100, Math.round(val / v.target * 100));
      if (isTime(v.unit)) {
        controlHTML = hmInputHTML(val, `data-id="${m.id}" data-variant="${selIdx}"`, v.target) + `<div class="mini-track" style="margin-top:8px;"><div class="mini-fill" style="width:${pct}%;"></div></div>`;
      } else {
        controlHTML = `
          <div class="control-row">
            <div class="num-wrap">
              <input type="number" min="0" value="${val}" data-id="${m.id}" data-variant="${selIdx}" class="variant-counter-input">
              <span class="of-target mono">/ ${v.target} ${v.unit || ""}</span>
            </div>
          </div>
          <div class="mini-track" style="margin-top:8px;"><div class="mini-fill" style="width:${pct}%;"></div></div>`;
      }
    } else {
      controlHTML = toggleCheckHTML(m.id, !!vp.done, "variant-toggle", selIdx);
    }
    bodyHTML = `
      ${m.note ? `<div class="note">${m.note}</div>` : ""}
      <div class="variant-hint">Выбери способ получения ниже — прогресс каждого варианта считается отдельно, награда засчитывается по любому из них.</div>
      ${tabsHTML}
      ${controlHTML}
    `;
  } else if (m.type === "multi") {
    bodyHTML = `
      ${m.note ? `<div class="note">${m.note}</div>` : ""}
      ${renderMultiControls(m.items, m.id, null, p.multi)}`;
  } else if (m.type === "counter") {
    const val = p.value || 0;
    const pct = Math.min(100, Math.round(val / m.target * 100));
    const isTime = (u) => u === "минут" || u === "мин" || u === "часов" || u === "час";
    if (isTime(m.unit)) {
      bodyHTML = `
        ${m.note ? `<div class="note">${m.note}</div>` : ""}
        ${hmInputHTML(val, `data-id="${m.id}"`, m.target)}
        <div class="mini-track" style="margin-top:8px;"><div class="mini-fill" style="width:${pct}%;"></div></div>`;
    } else {
      bodyHTML = `
        ${m.note ? `<div class="note">${m.note}</div>` : ""}
        <div class="control-row">
          <div class="num-wrap">
            <input type="number" min="0" value="${val}" data-id="${m.id}" class="progress-input">
            <span class="of-target mono">/ ${m.target} ${m.unit || ""}</span>
          </div>
        </div>
        <div class="mini-track" style="margin-top:8px;"><div class="mini-fill" style="width:${pct}%;"></div></div>`;
    }
  } else {
    bodyHTML = `
      ${m.note ? `<div class="note">${m.note}</div>` : ""}
      ${toggleCheckHTML(m.id, !!p.done, "progress-toggle")}`;
  }

  let statusLog = "";
  if (isReceived(m) && p.receivedAt) statusLog = "Получено: " + formatDateTime(p.receivedAt);
  else if (isRequested(m) && p.requestedAt) statusLog = "Запрошено: " + formatDateTime(p.requestedAt);
  else if (p.updatedAt) statusLog = "Обновлено: " + formatDateTime(p.updatedAt);

  return `
  <div class="card ${stage} ${earned ? "earned" : ""}">
    <div class="card-top">
      <div class="medal-slot" data-id="${m.id}">
        ${imgUrl ? `<img src="${escapeHTML(imgUrl)}" alt="" referrerpolicy="no-referrer">` : ``}
      </div>
      <div class="card-top-text">
        <div class="card-top-text-row">
          ${nameHTML}
          <div class="card-top-badges">
            ${(m.variants && !locked) ? `<span class="badge-variant">способов: ${m.variants.length}</span>` : ""}
            <span class="badge-status badge-${stage}">${awardStageLabel(stage)}</span>
          </div>
        </div>
        ${reqText ? `<div class="req-inline">${reqText}</div>` : ""}
      </div>
      <button class="pin-btn ${pinned ? "pinned" : ""}" data-id="${m.id}" title="${pinned ? "Убрать из плана" : "Добавить в план"}">★</button>
    </div>
    ${bodyHTML}
    ${statusControlsHTML(m, statusLog)}
  </div>`;
}

function updateProgressTime(id) {
  window.appProgress[id] = window.appProgress[id] || {};
  window.appProgress[id].updatedAt = Date.now();
}

function attachCardControlListeners(root) {
  if (!root) return;

  root.querySelectorAll(".progress-input").forEach(inp => {
    inp.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      let v = parseFloat(e.target.value);
      if (isNaN(v) || v < 0) v = 0;
      const medal = MEDALS.find(x => x.id === id);
      const wasReady = isRequirementMet(medal);
      updateProgressTime(id);
      window.appProgress[id].value = v;
      const nowReady = isRequirementMet(medal);
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
      if (!wasReady && nowReady) pulseCard(id);
    });
  });

  root.querySelectorAll(".hm-input").forEach(inp => {
    inp.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const vIdxStr = e.target.dataset.variant;
      const mkey = e.target.dataset.mkey;
      const wrap = e.target.closest(".hm-wrap");
      const hInp = wrap.querySelector(".hm-hours");
      const mInp = wrap.querySelector(".hm-minutes");
      let h = parseInt(hInp.value, 10); if (isNaN(h) || h < 0) h = 0;
      let mnt = parseInt(mInp.value, 10); if (isNaN(mnt) || mnt < 0) mnt = 0;
      if (mnt > 59) { h += Math.floor(mnt / 60); mnt = mnt % 60; }
      hInp.value = h; mInp.value = mnt;
      const total = h * 60 + mnt;
      const medal = MEDALS.find(x => x.id === id);
      const wasReady = isRequirementMet(medal);
      updateProgressTime(id);
      if (mkey) {
        if (vIdxStr) {
          const vIdx = parseInt(vIdxStr, 10);
          window.appProgress[id].variants = window.appProgress[id].variants || [];
          window.appProgress[id].variants[vIdx] = window.appProgress[id].variants[vIdx] || {};
          window.appProgress[id].variants[vIdx].multi = window.appProgress[id].variants[vIdx].multi || {};
          window.appProgress[id].variants[vIdx].multi[mkey] = total;
        } else {
          window.appProgress[id].multi = window.appProgress[id].multi || {};
          window.appProgress[id].multi[mkey] = total;
        }
      } else if (vIdxStr) {
        const vIdx = parseInt(vIdxStr, 10);
        window.appProgress[id].variants = window.appProgress[id].variants || [];
        window.appProgress[id].variants[vIdx] = window.appProgress[id].variants[vIdx] || {};
        window.appProgress[id].variants[vIdx].value = total;
      } else {
        window.appProgress[id].value = total;
      }
      const nowReady = isRequirementMet(medal);
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
      if (!wasReady && nowReady) pulseCard(id);
    });
  });

  root.querySelectorAll(".multi-counter-input").forEach(inp => {
    inp.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const vIdxStr = e.target.dataset.variant;
      const mkey = e.target.dataset.mkey;
      let v = parseFloat(e.target.value);
      if (isNaN(v) || v < 0) v = 0;
      const medal = MEDALS.find(x => x.id === id);
      const wasReady = isRequirementMet(medal);
      updateProgressTime(id);
      if (vIdxStr !== "") {
        const vIdx = parseInt(vIdxStr, 10);
        window.appProgress[id].variants = window.appProgress[id].variants || [];
        window.appProgress[id].variants[vIdx] = window.appProgress[id].variants[vIdx] || {};
        window.appProgress[id].variants[vIdx].multi = window.appProgress[id].variants[vIdx].multi || {};
        window.appProgress[id].variants[vIdx].multi[mkey] = v;
      } else {
        window.appProgress[id].multi = window.appProgress[id].multi || {};
        window.appProgress[id].multi[mkey] = v;
      }
      const nowReady = isRequirementMet(medal);
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
      if (!wasReady && nowReady) pulseCard(id);
    });
  });

  root.querySelectorAll(".multi-toggle-input").forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const vIdxStr = e.target.dataset.variant;
      const mkey = e.target.dataset.mkey;
      const val = e.target.checked;
      const medal = MEDALS.find(x => x.id === id);
      const wasReady = isRequirementMet(medal);
      updateProgressTime(id);
      if (vIdxStr !== "") {
        const vIdx = parseInt(vIdxStr, 10);
        window.appProgress[id].variants = window.appProgress[id].variants || [];
        window.appProgress[id].variants[vIdx] = window.appProgress[id].variants[vIdx] || {};
        window.appProgress[id].variants[vIdx].multi = window.appProgress[id].variants[vIdx].multi || {};
        window.appProgress[id].variants[vIdx].multi[mkey] = val;
      } else {
        window.appProgress[id].multi = window.appProgress[id].multi || {};
        window.appProgress[id].multi[mkey] = val;
      }
      const nowReady = isRequirementMet(medal);
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
      if (!wasReady && nowReady) pulseCard(id);
    });
  });

  root.querySelectorAll(".progress-toggle").forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const medal = MEDALS.find(x => x.id === id);
      const wasReady = isRequirementMet(medal);
      updateProgressTime(id);
      window.appProgress[id].done = e.target.checked;
      const nowReady = isRequirementMet(medal);
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
      if (!wasReady && nowReady) pulseCard(id);
    });
  });

  root.querySelectorAll(".variant-tab").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const vIdx = parseInt(btn.dataset.variant, 10);
      updateProgressTime(id);
      window.appProgress[id].selectedVariant = vIdx;
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
    });
  });

  root.querySelectorAll(".variant-counter-input").forEach(inp => {
    inp.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const vIdx = parseInt(e.target.dataset.variant, 10);
      let v = parseFloat(e.target.value);
      if (isNaN(v) || v < 0) v = 0;
      const medal = MEDALS.find(x => x.id === id);
      const wasReady = isRequirementMet(medal);
      updateProgressTime(id);
      window.appProgress[id].variants = window.appProgress[id].variants || [];
      window.appProgress[id].variants[vIdx] = window.appProgress[id].variants[vIdx] || {};
      window.appProgress[id].variants[vIdx].value = v;
      const nowReady = isRequirementMet(medal);
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
      if (!wasReady && nowReady) pulseCard(id);
    });
  });

  root.querySelectorAll(".variant-toggle").forEach(chk => {
    chk.addEventListener("change", async (e) => {
      const id = e.target.dataset.id;
      const vIdx = parseInt(e.target.dataset.variant, 10);
      const medal = MEDALS.find(x => x.id === id);
      const wasReady = isRequirementMet(medal);
      updateProgressTime(id);
      window.appProgress[id].variants = window.appProgress[id].variants || [];
      window.appProgress[id].variants[vIdx] = window.appProgress[id].variants[vIdx] || {};
      window.appProgress[id].variants[vIdx].done = e.target.checked;
      const nowReady = isRequirementMet(medal);
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
      if (!wasReady && nowReady) pulseCard(id);
    });
  });

  root.querySelectorAll(".status-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const status = btn.dataset.status;
      window.appProgress[id] = window.appProgress[id] || {};
      if (window.appProgress[id].status === status) {
        delete window.appProgress[id].status;
        if (status === 'requested') delete window.appProgress[id].requestedAt;
        if (status === 'received') delete window.appProgress[id].receivedAt;
      } else {
        window.appProgress[id].status = status;
        if (status === 'requested') window.appProgress[id].requestedAt = Date.now();
        if (status === 'received') window.appProgress[id].receivedAt = Date.now();
      }
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
    });
  });

  root.querySelectorAll(".medal-slot img").forEach(img => {
    img.addEventListener("error", () => {
      const span = document.createElement("span");
      img.replaceWith(span);
    });
  });

  attachPinButtons(root);
}

function attachPinButtons(root) {
  if (!root) return;
  root.querySelectorAll(".pin-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (window.appGoals[id]) delete window.appGoals[id]; else window.appGoals[id] = true;
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
    });
  });
}

window.markAllReadyAsRequested = function () {
  let changed = false;
  MEDALS.forEach(m => {
    if (awardStage(m) === "ready") {
      window.appProgress[m.id] = window.appProgress[m.id] || {};
      window.appProgress[m.id].status = "requested";
      window.appProgress[m.id].requestedAt = Date.now();
      changed = true;
    }
  });
  if (changed) {
    window.firebaseSaveData(window.appProgress, window.appGoals).then(() => window.appRenderAll());
  }
};

function renderAwardsList(wrapId, typeAward, state) {
  const wrap = document.getElementById(wrapId);
  const spheresToShow = typeAward === "medal" ? MEDAL_SPHERES : ACH_SPHERES;
  const filteredSpheres = spheresToShow.filter(s => state.sphereFilter === "all" || s === state.sphereFilter);

  let html = `
    <div class="filter-bar">
      <input type="text" id="${wrapId}Search" placeholder="Поиск по названию или требованию..." value="${escapeHTML(state.query)}">
      <select id="${wrapId}SphereFilter">
        <option value="all">Сферы</option>
        ${spheresToShow.map(s => `<option value="${escapeHTML(s)}">${s}</option>`).join("")}
      </select>
      <select id="${wrapId}FilterMode">
        <option value="all">Статусы</option>
        <option value="not-started">Не начато</option>
        <option value="in-progress">В процессе</option>
        <option value="ready">Можно запросить</option>
        <option value="requested">Запрошенные</option>
        <option value="received">Полученные</option>
      </select>
    </div>`;

  html += renderQuickjump(filteredSpheres, typeAward);

  const { earned, total } = sphereStats(null, typeAward);
  const pct = total ? Math.round(earned / total * 100) : 0;

  if (typeAward === "achievement") {
    html += `<div class="sphere-header">
      <div class="sphere-header-icon">${iconSVG("star")}</div>
      <div class="sphere-header-text">
        <h2 class="display sphere-header-title">Ачивки</h2>
        <div class="sphere-header-progress">
          <div class="mini-track"><div class="mini-fill" style="width:${pct}%;"></div></div>
          <span class="sphere-header-count mono">${earned}/${total}</span>
        </div>
      </div>
    </div>`;
  }

  let anyResults = false;
  filteredSpheres.forEach(sphere => {
    const list = MEDALS.filter(m => m.typeAward === typeAward && m.sphere === sphere && matchesFilter(m, state));
    if (!list.length) return;
    anyResults = true;
    const { earned: se, total: st } = sphereStats(sphere, typeAward);
    const spct = st ? Math.round(se / st * 100) : 0;
    const iconKey = SPHERE_ICON[sphere] || "paw";
    const subcats = SUBCAT_ORDER.filter(s => list.some(m => m.subcat === s));

    html += `<div class="sphere-block" id="${sphereAnchor(sphere)}">`;
    if (typeAward === "medal") {
      html += `
        <div class="sphere-header">
          <div class="sphere-header-icon">${iconSVG(iconKey)}</div>
          <div class="sphere-header-text">
            <h2 class="display sphere-header-title">${sphere}</h2>
            <div class="sphere-header-progress">
              <div class="mini-track"><div class="mini-fill" style="width:${spct}%;"></div></div>
              <span class="sphere-header-count mono">${se}/${st}</span>
            </div>
          </div>
        </div>`;
    } else {
      html += `<h2 class="display" style="color:var(--gold); margin:30px 0 10px;">${sphere}</h2>`;
    }

    subcats.forEach(sc => {
      html += `<div class="subcat-title">${sc}</div>`;
      list.filter(m => m.subcat === sc).forEach(m => { html += cardHTML(m); });
    });
    html += `</div>`;
  });

  if (!anyResults) {
    html += `<p class="empty-hint">Ничего не найдено.</p>`;
  }
  wrap.innerHTML = html;

  const filterSel = document.getElementById(`${wrapId}FilterMode`);
  if (filterSel) filterSel.value = state.filterMode;
  const sphereSel = document.getElementById(`${wrapId}SphereFilter`);
  if (sphereSel) sphereSel.value = state.sphereFilter;

  bindSearchInput(`${wrapId}Search`, v => { if (typeAward === "medal") medalsSearchQuery = v; else achSearchQuery = v; window.appRenderAll(); });
  if (filterSel) filterSel.addEventListener("change", (e) => { if (typeAward === "medal") medalsFilterMode = e.target.value; else achFilterMode = e.target.value; window.appRenderAll(); });
  if (sphereSel) sphereSel.addEventListener("change", (e) => { if (typeAward === "medal") medalsSphereFilter = e.target.value; else achSphereFilter = e.target.value; window.appRenderAll(); });

  document.querySelectorAll(`#${wrapId} .quickjump-btn`).forEach(btn => {
    btn.addEventListener("click", () => {
      const el = document.getElementById(btn.dataset.jump);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  attachCardControlListeners(wrap);
}
function renderMedals() {
  renderAwardsList("medalsList", "medal", { query: medalsSearchQuery, filterMode: medalsFilterMode, sphereFilter: medalsSphereFilter });
}
function renderAchievements() {
  renderAwardsList("achievementsList", "achievement", { query: achSearchQuery, filterMode: achFilterMode, sphereFilter: achSphereFilter });
}

function sortByProgress(list) { return list.slice().sort((a, b) => awardProgressPct(b) - awardProgressPct(a)); }
function simpleSplitCardsHTML(list, emptyText) {
  const med = list.filter(m => m.typeAward === 'medal');
  const ach = list.filter(m => m.typeAward === 'achievement');
  let html = "";
  if (med.length) html += `<div class="subcat-title" style="margin-top:18px;">Медали</div><div class="simple-grid">${med.map(m => simpleCardHTML(m)).join("")}</div>`;
  if (ach.length) html += `<div class="subcat-title" style="margin-top:18px;">Ачивки</div><div class="simple-grid">${ach.map(m => simpleCardHTML(m)).join("")}</div>`;
  return html || `<p class="empty-hint">${emptyText}</p>`;
}
function renderStatusView(viewId, stage, title, emptyText) {
  const wrap = document.getElementById(`${viewId}List`);
  const list = MEDALS.filter(m => awardStage(m) === stage);
  wrap.innerHTML = `
    <h2 class="subcat-title" style="margin-top:0;">${title} <span class="mono" style="color:var(--text-muted); text-transform:none; letter-spacing:0;">(${list.length})</span></h2>
    ${simpleSplitCardsHTML(list, emptyText)}
  `;
  attachCardControlListeners(wrap);
}
function splitAwardCardsHTML(list, emptyText) {
  const med = list.filter(m => m.typeAward === 'medal');
  const ach = list.filter(m => m.typeAward === 'achievement');
  let html = "";
  if (med.length) html += `<div class="subcat-title" style="margin-top:18px;">Медали</div>${med.map(m => cardHTML(m)).join("")}`;
  if (ach.length) html += `<div class="subcat-title" style="margin-top:18px;">Ачивки</div>${ach.map(m => cardHTML(m)).join("")}`;
  return html || `<p class="empty-hint">${emptyText}</p>`;
}
function plannerSectionHTML(title, list) {
  if (!list.length) return "";
  const sorted = sortByProgress(list);
  return `
    <h2 class="subcat-title" style="margin-top:32px;">${title} <span class="mono" style="color:var(--text-muted); text-transform:none; letter-spacing:0;">(${list.length})</span></h2>
    ${splitAwardCardsHTML(sorted, "")}
  `;
}

function renderPlanner() {
  const wrap = document.getElementById("view-planner");
  const pinnedIds = Object.keys(window.appGoals).filter(id => window.appGoals[id]);
  const pinnedMedals = pinnedIds
    .map(id => MEDALS.find(m => m.id === id))
    .filter(Boolean)
    .filter(m => { const s = awardStage(m); return s !== "requested" && s !== "received"; });

  const readyGoals = pinnedMedals.filter(m => awardStage(m) === "ready");
  const inProgressGoals = pinnedMedals.filter(m => awardStage(m) === "in-progress");
  const notStartedGoals = pinnedMedals.filter(m => awardStage(m) === "not-started");

  const planHTML = pinnedMedals.length
    ? [
        plannerSectionHTML("Можно запросить", readyGoals),
        plannerSectionHTML("В процессе", inProgressGoals),
        plannerSectionHTML("Не начато", notStartedGoals)
      ].join("")
    : `<p class="empty-hint">Отметь звездочкой невыполненную награду, чтобы добавить её сюда.</p>`;

  const q = plannerSearchQuery.trim().toLowerCase();
  const suggestions = q ? MEDALS.filter(m => {
    const s = awardStage(m);
    return !window.appGoals[m.id] && s !== "requested" && s !== "received" &&
      (m.name.toLowerCase().includes(q) || (m.req || "").toLowerCase().includes(q) || (m.note || "").toLowerCase().includes(q) ||
        (m.variants && m.variants.some(v => (v.req || v.label || "").toLowerCase().includes(q))));
  }).slice(0, 12) : [];

  const suggestionsHTML = suggestions.length ? `
    <div class="planner-suggestions">
      ${suggestions.map(m => `
        <div class="suggestion-item" data-id="${m.id}">
          <span class="suggestion-item-name">${m.name}</span>
          <span class="suggestion-item-sphere mono">${m.sphere.replace("Сфера ", "")}</span>
          <span class="suggestion-add">+</span>
        </div>`).join("")}
    </div>` : (q ? `<p class="empty-hint" style="padding:14px 4px;">Ничего не найдено по «${escapeHTML(plannerSearchQuery)}».</p>` : "");

  wrap.innerHTML = `
    <h2 class="subcat-title" style="margin-top:0;">План</h2>
    <div class="planner-add-wrap">
      <input type="text" id="plannerAddSearch" placeholder="Начни вводить название награды, чтобы добавить в план..." value="${escapeHTML(plannerSearchQuery)}">
      ${suggestionsHTML}
    </div>
    <h2 class="subcat-title">Мой план ${pinnedMedals.length ? `<span class="mono" style="color:var(--text-muted); text-transform:none; letter-spacing:0;">(${pinnedMedals.length})</span>` : ""}</h2>
    ${planHTML}
  `;

  const input = document.getElementById("plannerAddSearch");
  if (input) {
    input.addEventListener("input", (e) => {
      plannerSearchQuery = e.target.value;
      const selStart = e.target.selectionStart;
      renderPlanner();
      const el2 = document.getElementById("plannerAddSearch");
      if (el2) { el2.focus(); el2.setSelectionRange(selStart, selStart); }
    });
  }
  document.querySelectorAll(".suggestion-item").forEach(item => {
    item.addEventListener("click", async () => {
      const id = item.dataset.id;
      window.appGoals[id] = true;
      plannerSearchQuery = "";
      await window.firebaseSaveData(window.appProgress, window.appGoals);
      window.appRenderAll();
    });
  });
  attachCardControlListeners(document.getElementById("view-planner"));
}

function renderStats() {
  const wrap = document.getElementById("view-stats");

  const uniqueMedals = Array.from(new Set(MEDALS.filter(m => m.typeAward === "medal").map(m => m.id)));
  const uniqueAch = Array.from(new Set(MEDALS.filter(m => m.typeAward === "achievement").map(m => m.id)));

  const medalsEarned = uniqueMedals.filter(id => isEarned(MEDALS.find(x => x.id === id))).length;
  const achEarned = uniqueAch.filter(id => isEarned(MEDALS.find(x => x.id === id))).length;

  const readyCount = MEDALS.filter(m => awardStage(m) === "ready").length;
  const requestedCount = MEDALS.filter(m => awardStage(m) === "requested").length;
  const inProgressCount = MEDALS.filter(m => awardStage(m) === "in-progress").length;
  const notStartedCount = MEDALS.filter(m => awardStage(m) === "not-started").length;

  const bySphereHTML = ALL_SPHERES.map(sphere => {
    const { earned: se, total: st } = sphereStats(sphere);
    if (st === 0) return "";
    const pct = st ? Math.round(se / st * 100) : 0;
    return `<div class="stat-bar-row">
      <div class="stat-bar-label"><span>${sphere}</span><span class="mono">${se}/${st}</span></div>
      <div class="mini-track"><div class="mini-fill" style="width:${pct}%;"></div></div>
    </div>`;
  }).join("");

  const statusSummaryHTML = [
    ["Не начато", notStartedCount],
    ["В процессе", inProgressCount],
    ["Можно запросить", readyCount],
    ["Запрошено", requestedCount],
    ["Получено", medalsEarned + achEarned]
  ].map(([label, count]) => `<div class="stat-bar-row">
      <div class="stat-bar-label"><span>${label}</span><span class="mono">${count}</span></div>
    </div>`).join("");

  const nearest = MEDALS.filter(m => awardStage(m) === "in-progress" && awardProgressPct(m) > 0)
    .map(m => ({ m, pct: awardProgressPct(m) }))
    .sort((a, b) => b.pct - a.pct).slice(0, 5);

  const nearestHTML = nearest.length ? nearest.map(({ m, pct }) => `
    <div class="nearest-item">
      <span class="nearest-name">${m.name}</span>
      <div class="mini-track"><div class="mini-fill" style="width:${pct}%;"></div></div>
      <span class="nearest-pct mono">${pct}%</span>
    </div>`).join("") : `<p class="empty-hint">Пока нет наград в процессе</p>`;

  wrap.innerHTML = `
    <h2 class="subcat-title" style="margin-top:0;">По сферам</h2>
    ${bySphereHTML}

    <h2 class="subcat-title">По статусам</h2>
    ${statusSummaryHTML}
    
    <h2 class="subcat-title">Ближе всего к цели</h2>
    ${nearestHTML}
  `;
}

function renderOverview() {
  const uniqueMedals = Array.from(new Set(MEDALS.filter(m => m.typeAward === "medal").map(m => m.id)));
  const uniqueAch = Array.from(new Set(MEDALS.filter(m => m.typeAward === "achievement").map(m => m.id)));

  const medalsTotal = uniqueMedals.length;
  const medalsEarned = uniqueMedals.filter(id => {
    const m = MEDALS.find(x => x.id === id);
    return m && isEarned(m);
  }).length;

  const achTotal = uniqueAch.length;
  const achEarned = uniqueAch.filter(id => {
    const m = MEDALS.find(x => x.id === id);
    return m && isEarned(m);
  }).length;

  const readyCount = MEDALS.filter(m => awardStage(m) === "ready").length;
  const banner = document.getElementById("readyBanner");
  if (readyCount > 0) {
    banner.style.display = "flex";
    document.getElementById("readyCountDisplay").textContent = readyCount;
    document.getElementById("readyTextDisplay").textContent = getReadyAwardsPlural(readyCount);
  } else {
    banner.style.display = "none";
  }

  document.getElementById("medalsCount").textContent = `${medalsEarned} / ${medalsTotal}`;
  document.getElementById("medalsFill").style.width = (medalsTotal ? Math.round(medalsEarned / medalsTotal * 100) : 0) + "%";

  document.getElementById("achCount").textContent = `${achEarned} / ${achTotal}`;
  document.getElementById("achFill").style.width = (achTotal ? Math.round(achEarned / achTotal * 100) : 0) + "%";
}

function initDomainToggle() {
  const btnNet = document.getElementById("btnDomainNet");
  const btnSu = document.getElementById("btnDomainSu");
  
  function updateUI() {
    if (!btnNet || !btnSu) return;
    btnNet.classList.toggle("active", currentDomainMode === "net");
    btnSu.classList.toggle("active", currentDomainMode === "su");
  }

  const savedDomain = localStorage.getItem("river-medals-domain");
  if (savedDomain) {
    currentDomainMode = savedDomain;
  }
  updateUI();

  if (btnNet) {
    btnNet.addEventListener("click", async () => {
      currentDomainMode = "net";
      await window.storage.set("river-medals-domain", currentDomainMode);
      updateUI();
      window.appRenderAll();
    });
  }
  
  if (btnSu) {
    btnSu.addEventListener("click", async () => {
      currentDomainMode = "su";
      await window.storage.set("river-medals-domain", currentDomainMode);
      updateUI();
      window.appRenderAll();
    });
  }
}
window.appRenderAll = function () {
  renderViewTabs();
  document.getElementById("view-medals").style.display = currentView === "medals" ? "block" : "none";
  document.getElementById("view-achievements").style.display = currentView === "achievements" ? "block" : "none";
  document.getElementById("view-requested").style.display = currentView === "requested" ? "block" : "none";
  document.getElementById("view-received").style.display = currentView === "received" ? "block" : "none";
  document.getElementById("view-planner").style.display = currentView === "planner" ? "block" : "none";
  document.getElementById("view-stats").style.display = currentView === "stats" ? "block" : "none";

  if (currentView !== "medals") document.getElementById("medalsList").innerHTML = "";
  if (currentView !== "achievements") document.getElementById("achievementsList").innerHTML = "";
  if (currentView !== "requested") document.getElementById("requestedList").innerHTML = "";
  if (currentView !== "received") document.getElementById("receivedList").innerHTML = "";
  if (currentView !== "planner") document.getElementById("view-planner").innerHTML = "";

  if (currentView === "medals") renderMedals();
  if (currentView === "achievements") renderAchievements();
  if (currentView === "requested") renderStatusView("requested", "requested", "Запрошено", "Пока нет запрошенных наград.");
  if (currentView === "received") renderStatusView("received", "received", "Получено", "Пока нет полученных наград.");
  if (currentView === "planner") renderPlanner();
  if (currentView === "stats") renderStats();

  renderOverview();
};

function flashSaved() {
  const flag = document.getElementById("saveFlag");
  flag.textContent = "✓ сохранено";
  flag.classList.add("show");
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => flag.classList.remove("show"), 1200);
}

function getReadyAwardsPlural(n) {
  let v = Math.abs(n) % 100;
  let v1 = v % 10;
  if (v > 10 && v < 20) return "наград, готовых";
  if (v1 > 1 && v1 < 5) return "награды, готовые";
  if (v1 === 1) return "награда, готовая";
  return "наград, готовых";
}

startApp();

