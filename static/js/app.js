const root = document.documentElement;

const webcam = document.getElementById("webcam");
const canvas = document.getElementById("captureCanvas");
const ctx = canvas.getContext("2d");

const particleCanvas = document.getElementById("particleCanvas");
const pctx = particleCanvas.getContext("2d");

const camStatus = document.getElementById("camStatus");
const predictedCharEl = document.getElementById("predictedChar");
const confirmedCharEl = document.getElementById("confirmedChar");
const resultText = document.getElementById("resultText");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const delayRange = document.getElementById("delayRange");
const delayValue = document.getElementById("delayValue");
const soundToggle = document.getElementById("soundToggle");
const skeletonToggle = document.getElementById("skeletonToggle");
const saveConfigBtn = document.getElementById("saveConfigBtn");
const themeToggle = document.getElementById("themeToggle");
const langButtons = document.querySelectorAll(".lang-btn");

const tutorialLetter = document.getElementById("tutorialLetter");
const tutorialTitle = document.getElementById("tutorialTitle");
const tutorialDesc = document.getElementById("tutorialDesc");
const prevTutorial = document.getElementById("prevTutorial");
const nextTutorial = document.getElementById("nextTutorial");
const playTutorial = document.getElementById("playTutorial");

let stream = null;
let isRunning = false;
let frameLoopId = null;
let currentDelay = 2;
let audioContext = null;
let particles = [];
let tutorialIndex = 0;
let tutorialTimer = null;
let tutorialPlaying = true;
let currentLang = "fr";
let camStatusKey = "camera_inactive";
const pointer = { x: -9999, y: -9999, active: false };

const i18n = {
    fr: {
        nav_yfc: "Youth For Challenge",
        nav_tutorial: "Mini Tutoriel ASL",
        nav_app: "Camera & Traduction",
        theme_light: "Theme clair",
        theme_dark: "Theme sombre",
        hero_title: "Translateur de signes en lettres, en direct.",
        hero_subtitle: "Une interface premium pour convertir les signes ASL en texte avec une experience visuelle moderne et fluide.",
        about_title: "Youth For Challenge Organization",
        about_subtitle: "Section d'information et de sensibilisation.",
        mission_title: "Mission",
        mission_body: "Youth For Challenge accompagne les jeunes sur les projets d'innovation, l'engagement citoyen et l'inclusion numerique.",
        why_title: "Pourquoi ce projet ASL",
        why_body: "Cette application favorise l'accessibilite en simplifiant la communication entre personnes qui utilisent la langue des signes et le public.",
        impact_title: "Impact attendu",
        impact_body: "Former, sensibiliser et deployer des outils pratiques dans les ecoles, clubs et evenements communautaires.",
        tutorial_title: "Mini Tutoriel ASL Anime",
        tutorial_subtitle: "Decouvre quelques gestes de base avant la capture live.",
        prev: "Precedent",
        next: "Suivant",
        pause: "Pause animation",
        resume: "Reprendre animation",
        capture_live: "Capture Live",
        camera_active: "Camera active",
        camera_inactive: "Camera inactive",
        camera_denied: "Autorisation webcam refusee",
        translation: "Traduction",
        live: "Live",
        detected_sign: "Signe detecte",
        confirmed_sign: "Derniere lettre validee",
        validation: "Validation",
        waiting: "En attente...",
        translated_text: "Texte traduit",
        translated_placeholder: "La traduction apparait ici...",
        space: "Espace",
        backspace: "Retour",
        newline: "Nouvelle ligne",
        clear: "Effacer",
        settings: "Reglages",
        confirm_delay: "Delai de confirmation (secondes)",
        ui_sounds: "Sons UI + confirmation",
        show_skeleton: "Afficher squelette main (serveur)",
        apply_settings: "Appliquer les reglages",
        start_cam: "Demarrer webcam",
        stop_cam: "Arreter"
    },
    en: {
        nav_yfc: "Youth For Challenge",
        nav_tutorial: "ASL Mini Tutorial",
        nav_app: "Camera & Translation",
        theme_light: "Light theme",
        theme_dark: "Dark theme",
        hero_title: "Live sign-to-letter translator.",
        hero_subtitle: "A premium interface to convert ASL signs into text with a smooth modern experience.",
        about_title: "Youth For Challenge Organization",
        about_subtitle: "Information and awareness section.",
        mission_title: "Mission",
        mission_body: "Youth For Challenge supports young people through innovation projects, civic engagement, and digital inclusion.",
        why_title: "Why this ASL project",
        why_body: "This app improves accessibility by simplifying communication between sign language users and the public.",
        impact_title: "Expected impact",
        impact_body: "Train, raise awareness, and deploy practical tools in schools, clubs, and community events.",
        tutorial_title: "ASL Mini Tutorial",
        tutorial_subtitle: "Discover some basic gestures before starting live capture.",
        prev: "Previous",
        next: "Next",
        pause: "Pause animation",
        resume: "Resume animation",
        capture_live: "Live Capture",
        camera_active: "Camera active",
        camera_inactive: "Camera inactive",
        camera_denied: "Camera permission denied",
        translation: "Translation",
        live: "Live",
        detected_sign: "Detected sign",
        confirmed_sign: "Last confirmed letter",
        validation: "Validation",
        waiting: "Waiting...",
        translated_text: "Translated text",
        translated_placeholder: "Translation appears here...",
        space: "Space",
        backspace: "Backspace",
        newline: "New line",
        clear: "Clear",
        settings: "Settings",
        confirm_delay: "Confirmation delay (seconds)",
        ui_sounds: "UI sounds + confirmation",
        show_skeleton: "Show hand skeleton (server)",
        apply_settings: "Apply settings",
        start_cam: "Start webcam",
        stop_cam: "Stop"
    }
};

const tutorialStepsByLang = {
    fr: [
        { letter: "A", title: "Lettre A", desc: "Ferme les doigts en poing, pouce sur le cote de l'index." },
        { letter: "B", title: "Lettre B", desc: "Main ouverte, doigts colles vers le haut, pouce replie devant la paume." },
        { letter: "C", title: "Lettre C", desc: "Courbe la main pour former un C visible de profil." },
        { letter: "L", title: "Lettre L", desc: "Index vers le haut et pouce horizontal pour former un angle droit." },
        { letter: "Y", title: "Lettre Y", desc: "Pouce et petit doigt ouverts, autres doigts fermes." }
    ],
    en: [
        { letter: "A", title: "Letter A", desc: "Close the fingers into a fist, with thumb resting on the index side." },
        { letter: "B", title: "Letter B", desc: "Open hand, fingers together up, thumb folded across the palm." },
        { letter: "C", title: "Letter C", desc: "Curve your hand to shape a visible C profile." },
        { letter: "L", title: "Letter L", desc: "Point index up and thumb out to form a right angle." },
        { letter: "Y", title: "Letter Y", desc: "Thumb and pinky out, other fingers folded." }
    ]
};

function t(key) {
    return (i18n[currentLang] && i18n[currentLang][key]) || i18n.fr[key] || key;
}

function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    localStorage.setItem("asl-theme", theme);
    themeToggle.textContent = theme === "dark" ? t("theme_light") : t("theme_dark");
}

function setLanguage(lang) {
    currentLang = i18n[lang] ? lang : "fr";
    localStorage.setItem("asl-lang", currentLang);
    root.lang = currentLang;
    root.dir = "ltr";

    langButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.lang === currentLang);
    });

    document.querySelectorAll("[data-i18n]").forEach((el) => {
        el.textContent = t(el.dataset.i18n);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });

    updatePlayButtonText();
    renderTutorial(tutorialIndex);
    setTheme(root.getAttribute("data-theme") || "dark");
    setCamStatusByKey(camStatusKey, camStatusKey === "camera_active");
    if (!progressBar.style.width || progressBar.style.width === "0%") {
        progressText.textContent = t("waiting");
    }
}

function initLanguage() {
    const saved = localStorage.getItem("asl-lang");
    setLanguage(saved && i18n[saved] ? saved : "fr");
}

function initTheme() {
    const saved = localStorage.getItem("asl-theme");
    setTheme(saved === "light" ? "light" : "dark");
}

function ensureAudioContext() {
    if (!audioContext) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioContext = new AC();
    }
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }
    return audioContext;
}

function playUISound(type = "click") {
    if (!soundToggle.checked) return;
    const ac = ensureAudioContext();
    if (!ac) return;

    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    const tones = {
        click: [580, 0.035],
        success: [820, 0.09],
        confirm: [980, 0.1],
        stop: [260, 0.06]
    };

    const [freq, dur] = tones[type] || tones.click;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
}

function setCamStatusByKey(key, active = false) {
    camStatusKey = key;
    camStatus.textContent = t(key);
    camStatus.style.background = active ? "rgba(16, 185, 129, 0.18)" : "rgba(148, 163, 184, 0.18)";
    camStatus.style.borderColor = active ? "rgba(16, 185, 129, 0.3)" : "rgba(148, 163, 184, 0.3)";
}

function updateProgress(data) {
    if (data.detection_active) {
        const remaining = data.time_remaining ?? currentDelay;
        const ratio = Math.max(0, Math.min(1, (currentDelay - remaining) / currentDelay));
        progressBar.style.width = `${ratio * 100}%`;
        progressText.textContent = `${data.detection_char || "-"} - ${remaining.toFixed(1)}s`;
    } else {
        progressBar.style.width = "0%";
        progressText.textContent = t("waiting");
    }
}

function updateDelayText() {
    delayValue.textContent = `${delayRange.value}s`;
}

function updatePlayButtonText() {
    playTutorial.textContent = tutorialPlaying ? t("pause") : t("resume");
}

async function postJson(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return res.json();
}

async function loadConfig() {
    try {
        const res = await fetch("/get_config");
        const data = await res.json();
        if (!data.success) return;

        currentDelay = data.config.confirmation_delay;
        delayRange.value = currentDelay;
        updateDelayText();
        soundToggle.checked = !!data.config.sound_enabled;
        skeletonToggle.checked = !!data.config.skeleton_enabled;
    } catch (err) {
        console.error("Erreur chargement config", err);
    }
}

async function saveConfig() {
    try {
        const payload = {
            confirmation_delay: parseInt(delayRange.value, 10),
            sound_enabled: soundToggle.checked,
            skeleton_enabled: skeletonToggle.checked
        };
        const data = await postJson("/update_config", payload);
        if (data.success) {
            currentDelay = data.config.confirmation_delay;
            delayRange.value = currentDelay;
            updateDelayText();
            playUISound("success");
        }
    } catch (err) {
        console.error("Erreur sauvegarde config", err);
    }
}

async function sendFrame() {
    if (!isRunning || webcam.readyState < 2) return;

    ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
    const frameData = canvas.toDataURL("image/jpeg", 0.72);

    try {
        const data = await postJson("/process_frame", { image: frameData });
        if (!data.success) return;

        predictedCharEl.textContent = (data.predicted_char || "-").toUpperCase();

        if (data.confirmed_char) {
            confirmedCharEl.textContent = data.confirmed_char.toUpperCase();
            playUISound("confirm");
        }

        resultText.value = data.current_text || "";
        updateProgress(data);
    } catch (err) {
        console.error("Erreur traitement frame", err);
    }
}

function frameLoop() {
    if (!isRunning) return;
    sendFrame();
    frameLoopId = setTimeout(frameLoop, 220);
}

async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });

        webcam.srcObject = stream;
        isRunning = true;

        startBtn.disabled = true;
        stopBtn.disabled = false;
        setCamStatusByKey("camera_active", true);
        playUISound("success");

        frameLoop();
    } catch (err) {
        setCamStatusByKey("camera_denied", false);
        console.error("Erreur webcam", err);
    }
}

function stopCamera() {
    isRunning = false;

    if (frameLoopId) {
        clearTimeout(frameLoopId);
        frameLoopId = null;
    }

    if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
    }

    webcam.srcObject = null;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    setCamStatusByKey("camera_inactive", false);
    playUISound("stop");
}

async function handleTextAction(action) {
    try {
        const data = await postJson("/update_text", { action });
        if (data.success) {
            resultText.value = data.current_text || "";
            playUISound("click");
        }
    } catch (err) {
        console.error("Erreur action texte", err);
    }
}

function setupParticles() {
    const particleCount = Math.min(110, Math.max(40, Math.floor(window.innerWidth / 16)));
    particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        r: Math.random() * 1.9 + 0.7
    }));
}

function resizeParticles() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
    setupParticles();
}

function animateParticles() {
    pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    const isLight = root.getAttribute("data-theme") === "light";
    const dotColor = isLight ? "rgba(2, 132, 199, 0.35)" : "rgba(45, 212, 191, 0.4)";
    const lineColor = isLight ? "rgba(2, 132, 199, 0.14)" : "rgba(45, 212, 191, 0.16)";

    for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];

        if (pointer.active) {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 120) {
                p.vx += (dx / dist) * 0.03;
                p.vy += (dy / dist) * 0.03;
            }
        }

        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > particleCanvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > particleCanvas.height) p.vy *= -1;

        p.x = Math.max(0, Math.min(particleCanvas.width, p.x));
        p.y = Math.max(0, Math.min(particleCanvas.height, p.y));

        pctx.beginPath();
        pctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        pctx.fillStyle = dotColor;
        pctx.fill();

        for (let j = i + 1; j < particles.length; j += 1) {
            const q = particles[j];
            const dX = p.x - q.x;
            const dY = p.y - q.y;
            const d = Math.sqrt(dX * dX + dY * dY);
            if (d < 100) {
                pctx.beginPath();
                pctx.moveTo(p.x, p.y);
                pctx.lineTo(q.x, q.y);
                pctx.strokeStyle = lineColor;
                pctx.lineWidth = 1 - d / 100;
                pctx.stroke();
            }
        }
    }

    requestAnimationFrame(animateParticles);
}

function getTutorialSteps() {
    return tutorialStepsByLang[currentLang] || tutorialStepsByLang.fr;
}

function renderTutorial(index) {
    const steps = getTutorialSteps();
    const step = steps[index % steps.length];
    tutorialLetter.textContent = step.letter;
    tutorialTitle.textContent = step.title;
    tutorialDesc.textContent = step.desc;
    tutorialLetter.animate(
        [
            { transform: "scale(0.88)", opacity: 0.5 },
            { transform: "scale(1)", opacity: 1 }
        ],
        { duration: 350, easing: "ease-out" }
    );
}

function goTutorial(stepMove) {
    const steps = getTutorialSteps();
    tutorialIndex = (tutorialIndex + stepMove + steps.length) % steps.length;
    renderTutorial(tutorialIndex);
}

function startTutorialAutoplay() {
    if (tutorialTimer) clearInterval(tutorialTimer);
    tutorialTimer = setInterval(() => {
        if (tutorialPlaying) {
            goTutorial(1);
        }
    }, 2800);
}

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
saveConfigBtn.addEventListener("click", saveConfig);

themeToggle.addEventListener("click", () => {
    const current = root.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
    playUISound("click");
});

langButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        setLanguage(btn.dataset.lang);
        playUISound("click");
    });
});

delayRange.addEventListener("input", () => {
    updateDelayText();
});

document.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleTextAction(btn.dataset.action));
});

soundToggle.addEventListener("change", () => {
    if (soundToggle.checked) {
        playUISound("click");
    }
});

prevTutorial.addEventListener("click", () => {
    goTutorial(-1);
    playUISound("click");
});

nextTutorial.addEventListener("click", () => {
    goTutorial(1);
    playUISound("click");
});

playTutorial.addEventListener("click", () => {
    tutorialPlaying = !tutorialPlaying;
    updatePlayButtonText();
    playUISound("click");
});

window.addEventListener("resize", resizeParticles);
window.addEventListener("mousemove", (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.active = true;
});
window.addEventListener("mouseleave", () => {
    pointer.active = false;
});
window.addEventListener("touchmove", (e) => {
    const t0 = e.touches[0];
    if (!t0) return;
    pointer.x = t0.clientX;
    pointer.y = t0.clientY;
    pointer.active = true;
}, { passive: true });
window.addEventListener("touchend", () => {
    pointer.active = false;
});

window.addEventListener("beforeunload", () => {
    stopCamera();
    if (tutorialTimer) clearInterval(tutorialTimer);
});

initLanguage();
initTheme();
resizeParticles();
animateParticles();
renderTutorial(tutorialIndex);
startTutorialAutoplay();
loadConfig();
setCamStatusByKey("camera_inactive", false);
progressText.textContent = t("waiting");
