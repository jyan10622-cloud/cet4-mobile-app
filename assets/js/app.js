import {
  grammarLessons,
  readingStrategies
} from "./data.js";
import {
  loadState,
  saveState,
  ensureDailyTasks,
  setTaskStatus,
  getVocabDeck,
  rateVocabWord,
  getVocabStats,
  updateSettings,
  getDashboard,
  getPlanSummary,
  getProfileStats,
  getListeningList,
  toggleListeningFavorite,
  markListeningPracticed,
  submitListeningAnswer,
  markListeningUnderstanding,
  submitSpelling,
  getMistakeWords,
  setLastVocabSession,
  touchAudioTraining
} from "./store.js";
import { clamp, getTodayKey, getCountdown, escapeHtml } from "./utils.js";

let state = loadState();
let currentView = "home";
let vocabMode = state.lastVocabSession?.mode || "learn";
let vocabDeck = [];
let vocabIndex = 0;
let spellingType = "audio";
let activeListeningId = null;
let listeningSpeed = 1.0;
let practicePanel = "hub";
let selectedListeningType = "短篇新闻";
let activeListeningQuestionId = null;
const listeningAnswers = {};
const listeningShowResult = {};
let fakePlayerTimer = null;
let fakePlayerSec = 0;
let vocabAccent = "us";
let sentenceAccent = "us";
const expandedWordIds = new Set();
const vocabAudio = new Audio();

const synth = window.speechSynthesis;

const views = {
  home: document.getElementById("view-home"),
  daily: document.getElementById("view-daily"),
  vocab: document.getElementById("view-vocab"),
  practice: document.getElementById("view-practice"),
  plan: document.getElementById("view-plan"),
  profile: document.getElementById("view-profile")
};

function statusClass(status) {
  return status === "completed" ? "completed" : status === "deferred" ? "deferred" : status === "skipped" ? "skipped" : "pending";
}
function taskStatusText(status) {
  return status === "completed" ? "已完成" : status === "deferred" ? "已延期" : status === "skipped" ? "已跳过" : "待开始";
}

function markVocabSession(wordId = null) {
  setLastVocabSession(state, { mode: vocabMode, wordId });
}

function findBestVoice(accent = "us") {
  const voices = synth?.getVoices?.() || [];
  const preferred = accent === "uk" ? ["en-GB", "en_GB"] : ["en-US", "en_US"];
  return voices.find((v) => preferred.some((p) => v.lang?.includes(p))) || voices.find((v) => v.lang?.startsWith("en"));
}

function playPronunciation(type, card, accent = "us") {
  if (!card) return;
  const map = {
    word: accent === "uk" ? card.audio_uk : card.audio_us,
    example: accent === "uk" ? card.example_audio_uk : card.example_audio_us,
    phrase: accent === "uk" ? card.activePhraseAudioUk : card.activePhraseAudioUs,
    family: accent === "uk" ? card.activeFamilyAudioUk : card.activeFamilyAudioUs
  };
  const textMap = {
    word: card.word,
    example: card.example_en,
    phrase: card.activePhrase || "",
    family: card.activeFamilyWord || ""
  };
  const src = map[type];
  if (src) {
    vocabAudio.pause();
    vocabAudio.src = src;
    vocabAudio.currentTime = 0;
    vocabAudio.play().then(() => {
      const label = type === "word" ? "单词" : type === "example" ? "例句" : type === "phrase" ? "词组" : "派生词";
      showToast(`${label}${accent === "uk" ? "英音" : "美音"}播放中`);
    }).catch(() => {
      showToast("音频暂不可用，已切换语音朗读");
      speakFallback(textMap[type], accent);
    });
    return;
  }
  speakFallback(textMap[type], accent);
  const fallbackText = type === "word" ? "该词暂无真人音频，已用系统朗读" : type === "example" ? "该例句暂无真人音频，已用系统朗读" : type === "phrase" ? "该词组暂无真人音频，已用系统朗读" : "该派生词暂无真人音频，已用系统朗读";
  showToast(fallbackText);
}

function speakFallback(text, accent = "us") {
  if (!synth || !text) return;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = accent === "uk" ? "en-GB" : "en-US";
  utter.rate = 0.92;
  const voice = findBestVoice(accent);
  if (voice) utter.voice = voice;
  synth.speak(utter);
}

function refreshDeck() {
  const size = vocabMode === "spelling" ? 6 : vocabMode === "review" ? 20 : 12;
  vocabDeck = getVocabDeck(state, vocabMode, size);
  vocabIndex = 0;
  const resumeWordId = state.lastVocabSession?.wordId;
  if (resumeWordId) {
    const idx = vocabDeck.findIndex((item) => item.id === resumeWordId);
    if (idx >= 0) vocabIndex = idx;
  }
}

function gotoView(view) {
  currentView = view;
  renderView();
}

function startTask(task) {
  if (!task) return;
  if (task.type === "vocab") gotoView("vocab");
  else if (task.type === "listening") gotoView("practice");
  else if (task.type === "practice") gotoView("practice");
}

function renderHome() {
  const todayKey = getTodayKey();
  syncTaskCompletionFromProgress(todayKey);
  const dashboard = getDashboard(state, todayKey);
  const stats = getVocabStats(state);
  const countdown = getCountdown(state.settings.examDate);
  const resume = dashboard.resumeTask;
  const resumeVocab = dashboard.resumeVocab?.wordId;
  const modeHint = dashboard.missedDays > 0 ? `<p class="muted">你中断了 ${dashboard.missedDays} 天：今天先恢复 3 个任务，先找回节奏。</p>` : "";

  views.home.innerHTML = `
    <section class="hero card tone-good">
      <p class="eyebrow">CET4 移动备考</p>
      <h2>今天就学这几件事</h2>
      <div class="hero-kpis">
        <div><p class="kicker">今日任务</p><h3>${dashboard.today.total}</h3></div>
        <div><p class="kicker">已完成</p><h3>${dashboard.today.completed}</h3></div>
        <div><p class="kicker">预计时长</p><h3>${dashboard.today.minutes} 分钟</h3></div>
      </div>
      <div class="bar large"><span style="width:${dashboard.today.progress}%"></span></div>
      <p class="muted">连续打卡 ${dashboard.streak} 天 · 距考试 ${countdown} 天（${escapeHtml(state.settings.examDate)}）</p>
      ${modeHint}
      <button class="primary-btn big-btn candy" data-action="start-today">${resume ? "继续未完成任务" : "开始今天学习"}</button>
      ${resumeVocab ? `<button class="ghost-btn" data-action="resume-vocab">继续上次词汇学习</button>` : ""}
      ${resume ? `<button class="ghost-btn" data-action="resume-task" data-id="${resume.id}">继续未完成：${escapeHtml(resume.title)}</button>` : ""}
    </section>

    <section class="grid three stats-grid">
      <article class="card compact"><p class="kicker">今日新词</p><h3>${stats.today.newWords}</h3></article>
      <article class="card compact"><p class="kicker">今日复习</p><h3>${stats.today.reviewWords}</h3></article>
      <article class="card compact"><p class="kicker">今日拼写</p><h3>${stats.today.spelling}</h3></article>
    </section>

    <section class="card top-gap">
      <div class="section-head"><h3>今日学习链路</h3><span class="pill">打开就能学</span></div>
      <div class="path-row top-gap">
        ${dashboard.chain.map((line) => `<span class="path-chip">${escapeHtml(line)}</span>`).join("")}
      </div>
    </section>
  `;
}

function renderDaily() {
  const todayKey = getTodayKey();
  syncTaskCompletionFromProgress(todayKey);
  const tasks = ensureDailyTasks(state, todayKey);
  const done = tasks.filter((t) => t.status === "completed").length;
  const pendingTask = tasks.find((t) => t.status !== "completed");

  views.daily.innerHTML = `
    <section class="section-intro"><h2>今日任务</h2><p class="muted">每项 5-10 分钟，完成一项就有推进感。</p></section>
    <section class="card">
      <div class="section-head"><h3>完成进度</h3><span class="pill">${done}/${tasks.length}</span></div>
      <div class="bar"><span style="width:${Math.round((done / Math.max(1, tasks.length)) * 100)}%"></span></div>
      ${pendingTask ? `<button class="ghost-btn top-gap resume-pill" data-action="start-task" data-id="${pendingTask.id}">▶ 继续未完成：${escapeHtml(pendingTask.title)}</button>` : `<p class="feedback success top-gap">今日任务已清空，建议去词汇页做额外复习。</p>`}
    </section>
    <section class="task-stack top-gap">
      ${tasks.map((t) => `
        <article class="card task-card ${t.status === "completed" ? "is-done" : ""}">
          <div class="check-head">
            <button class="task-check-btn ${t.status === "completed" ? "checked" : ""}" data-action="task-quick-action" data-id="${t.id}" aria-label="任务状态">${t.status === "completed" ? "✅" : "🟣"}</button>
            <div>
              <h3>${escapeHtml(t.title)}</h3>
              <p class="muted">预计 ${t.minutes} 分钟</p>
            </div>
            <span class="mini-status ${statusClass(t.status)}">${taskStatusText(t.status)}</span>
          </div>
          <div class="action-row top-gap">
            <button class="small-btn ghost" data-action="start-task" data-id="${t.id}">去完成任务</button>
            <button class="small-btn ghost" data-action="task-status" data-id="${t.id}" data-status="deferred">稍后提醒</button>
          </div>
        </article>
      `).join("")}
    </section>
  `;
}

function highlightWordInSentence(sentence, word) {
  if (!sentence || !word) return escapeHtml(sentence || "");
  const safe = escapeHtml(sentence);
  const reg = new RegExp(`(${word})`, "ig");
  return safe.replace(reg, "<mark class='word-highlight'>$1</mark>");
}

function getWordStageTag(card) {
  if (vocabMode === "spelling") return "拼写";
  if (vocabMode === "review") return "复习";
  if (card?.familiarityStatus === "已掌握") return "已掌握";
  return card?.familiarityStatus === "未学习" ? "新词" : "学习中";
}

function renderWordAudioControl(card) {
  const hasUS = Boolean(card.audio_us);
  const hasUK = Boolean(card.audio_uk);
  const playable = hasUS || hasUK;
  const label = !playable ? "暂无音频" : hasUS && hasUK ? "美/英" : hasUS ? "美音" : "英音";
  return `
    <div class="word-audio-wrap">
      <button class="tiny-audio ${playable ? "" : "disabled"}" data-action="play-word-audio" title="播放单词发音">🔊</button>
      <button class="accent-chip ${vocabAccent === "us" ? "active" : ""}" data-action="set-word-accent" data-accent="us" ${hasUS ? "" : "disabled"}>美</button>
      <button class="accent-chip ${vocabAccent === "uk" ? "active" : ""}" data-action="set-word-accent" data-accent="uk" ${hasUK ? "" : "disabled"}>英</button>
      <span class="mini-muted">${label}</span>
    </div>
  `;
}

function renderExampleAudioControl(card) {
  const hasUS = Boolean(card.example_audio_us);
  const hasUK = Boolean(card.example_audio_uk);
  const hasAny = hasUS || hasUK;
  return `
    <div class="example-audio-row">
      <button class="play-btn ${hasAny ? "" : "fallback"}" data-action="play-example-audio">🔊</button>
      <button class="accent-chip ${sentenceAccent === "us" ? "active" : ""}" data-action="set-example-accent" data-accent="us" ${hasUS ? "" : "disabled"}>美音</button>
      <button class="accent-chip ${sentenceAccent === "uk" ? "active" : ""}" data-action="set-example-accent" data-accent="uk" ${hasUK ? "" : "disabled"}>英音</button>
      <span class="mini-muted">${hasAny ? "例句播放" : "暂无真人句音频，自动切系统朗读"}</span>
    </div>
  `;
}

function renderExpandedArea(card) {
  const expanded = expandedWordIds.has(card.id);
  const extraMeanings = card.meanings.slice(1, 3);
  if (!expanded) {
    return `<button class="expand-btn" data-action="toggle-word-more" data-id="${card.id}">展开更多</button>`;
  }
  return `
    <section class="expand-area slide-expand">
      <button class="expand-btn active" data-action="toggle-word-more" data-id="${card.id}">收起扩展信息</button>
      ${card.secondaryMeanings?.length ? `<div class="detail-block"><h4>主义项 / 次义项</h4><div class="mini-list"><span class="soft-chip">主义项：${escapeHtml(card.mainMeaning || card.meaning)}</span>${card.secondaryMeanings.map((m) => `<span class="soft-chip">次义项：${escapeHtml(m.zh)}（${escapeHtml(m.scene)}）</span>`).join("")}</div></div>` : ""}
      ${extraMeanings.length ? `<div class="detail-block"><h4>更多词义</h4><div class="mini-list">${extraMeanings.map((m) => `<span class="soft-chip">${escapeHtml(m.enLabel)} ${escapeHtml(m.zh)}</span>`).join("")}</div></div>` : ""}
      ${card.roots.length ? `<div class="detail-block"><h4>词根词缀</h4><div class="mini-list">${card.roots.map((r) => `<span class="soft-chip">${escapeHtml(r.part)}：${escapeHtml(r.meaning)}</span>`).join("")}</div></div>` : ""}
      ${card.wordFamily.length ? `<div class="detail-block"><h4>派生词（可发音）</h4><ul class="bullet-list small">${card.wordFamily.slice(0, 4).map((f) => `<li><button class="inline-audio" data-action="play-family-audio" data-word="${escapeHtml(f.word)}">${escapeHtml(f.word)}</button> (${escapeHtml(f.pos)}) · ${escapeHtml(f.zh)}</li>`).join("")}</ul></div>` : ""}
      ${card.phrases?.length ? `<div class="detail-block"><h4>四级重点词组（可发音）</h4><div class="mini-list">${card.phrases.map((p) => `<button class="soft-chip clickable-chip" data-action="play-phrase-audio" data-phrase="${escapeHtml(p.phrase)}">${highlightWordInSentence(p.phrase, card.word)} · ${escapeHtml(p.zh)}</button>`).join("")}</div></div>` : ""}
      ${card.confusable?.length ? `<div class="detail-block"><h4>易混词对比</h4><div class="mini-list">${card.confusable.map((c) => `<span class="soft-chip">${escapeHtml(c.word)}：${escapeHtml(c.tip)}</span>`).join("")}</div></div>` : ""}
      ${card.extraExamples?.length ? `<div class="detail-block"><h4>补充例句</h4>${card.extraExamples.slice(0, 2).map((item) => `<p>${highlightWordInSentence(item.en, card.word)}<br/><span class="muted">${escapeHtml(item.zh)}</span></p>`).join("")}<p class="muted">补充例句无真人音频时，将自动使用系统朗读。</p></div>` : ""}
    </section>
  `;
}

function renderSpellingCard(card, idx, total) {
  if (!card) return `<section class="card top-gap"><p>拼写池为空。先在学习/复习中把单词标记为“认识”，再回来挑战。</p></section>`;
  const cloze = card.example_en.replace(new RegExp(card.word, "i"), "____");
  return `
    <section class="card word-card top-gap slide-in">
      <p class="task-tag">拼写挑战 · ${idx + 1}/${total}</p>
      <h3>${spellingType === "audio" ? "听音拼写" : "例句填空"}</h3>
      <p class="muted">${spellingType === "audio" ? "点击发音后输入单词" : escapeHtml(cloze)}</p>
      <div class="action-row top-gap">
        <button class="small-btn candy" data-action="play-word-audio">播放发音</button>
        <button class="small-btn ghost" data-action="swap-spell-type">切换题型</button>
      </div>
      <label class="stack top-gap"><span>你的答案</span><input class="spell-input" id="spellingInput" autocomplete="off" placeholder="输入单词"/></label>
      <div class="action-row top-gap">
        <button class="small-btn candy" data-action="submit-spelling" data-id="${card.id}" data-word="${escapeHtml(card.word)}">提交</button>
        <button class="small-btn ghost" data-action="retry-spelling">再试一次</button>
      </div>
      <p class="muted top-gap">提示：${escapeHtml(card.mainMeaning)} · ${escapeHtml(card.example_zh)}。错词会自动进入错词池，支持再次挑战。</p>
    </section>
  `;
}

function renderVocab() {
  if (!vocabDeck.length) refreshDeck();
  const current = vocabDeck[vocabIndex];
  const stats = getVocabStats(state);
  const top = `
    <section class="section-intro"><h2>词汇核心学习</h2><p class="muted">看词 → 听发音 → 看例句 → 判断熟悉度 → 复习 → 拼写</p></section>
    <section class="card compact">
      <div class="chips">
        <button class="chip ${vocabMode === "learn" ? "active" : ""}" data-action="set-vocab-mode" data-mode="learn">学习新词</button>
        <button class="chip ${vocabMode === "review" ? "active" : ""}" data-action="set-vocab-mode" data-mode="review">复习旧词</button>
        <button class="chip ${vocabMode === "spelling" ? "active" : ""}" data-action="set-vocab-mode" data-mode="spelling">拼写挑战</button>
      </div>
      <p class="muted top-gap">拼写池：${stats.spellingEligible} 词可挑战（认识≥2次或完成复习后自动加入）。</p>
    </section>
  `;

  if (vocabMode === "spelling") {
    views.vocab.innerHTML = top + renderSpellingCard(current, vocabIndex, vocabDeck.length);
    return;
  }

  views.vocab.innerHTML = top + (current ? `
    <section class="card word-card top-gap slide-in ${vocabMode === "review" ? "review-tone" : "new-tone"}">
      <div class="word-head-row">
        <p class="task-tag">${escapeHtml(current.group)} · ${vocabIndex + 1}/${vocabDeck.length}</p>
        <span class="word-state-badge ${getWordStageTag(current)}">📍 当前学习词 · ${getWordStageTag(current)}</span>
      </div>
      <div class="word-main-row">
        <h2 class="word-title">${escapeHtml(current.word)}</h2>
        ${renderWordAudioControl(current)}
      </div>
      <p class="ipa-line">${escapeHtml(current.ipa)} · ${escapeHtml(current.pos || current.meanings?.[0]?.enLabel || "词性待补充")}</p>
      <p class="core-meaning">${escapeHtml(current.mainMeaning || current.meaning)}</p>
      <div class="chips secondary top-gap">
        ${(current.examTags?.length ? current.examTags : ["四级高频"]).map((tag) => `<span class="chip active">${escapeHtml(tag)}</span>`).join("")}
      </div>
      <article class="example-card">
        <p class="example-en">${highlightWordInSentence(current.example_en, current.word)}</p>
        <p class="example-zh">${escapeHtml(current.example_zh)}</p>
        ${renderExampleAudioControl(current)}
      </article>
      <div class="action-row top-gap">
        <button class="small-btn ghost" data-action="toggle-hard-word" data-id="${current.id}">${current.hardWord ? "已收藏难词" : "收藏难词"}</button>
        <button class="small-btn ghost" data-action="toggle-watch-later" data-id="${current.id}">${current.watchLater ? "已稍后再看" : "稍后再看"}</button>
      </div>
      ${renderExpandedArea(current)}
      <section class="grid three stats-grid top-gap">
        <article class="card compact inset"><p class="kicker">今日新词</p><h3>${stats.today.newWords}</h3></article>
        <article class="card compact inset"><p class="kicker">今日复习</p><h3>${stats.today.reviewWords}</h3></article>
        <article class="card compact inset"><p class="kicker">今日拼写</p><h3>${stats.today.spelling}</h3></article>
      </section>
      <div class="deck-dots top-gap">${vocabDeck.map((item, idx) => `<span class="dot ${idx === vocabIndex ? "active" : ""} ${item.id === current.id ? "current" : ""}" title="${escapeHtml(item.word)}"></span>`).join("")}</div>
      <div class="progress-line top-gap">学习进度：${vocabIndex + 1}/${vocabDeck.length}</div>
      <div class="action-row top-gap rate-row">
        <button class="small-btn ghost rate-btn rate-unknown" data-action="word-rate" data-id="${current.id}" data-rate="不认识">😭 不认识</button>
        <button class="small-btn ghost rate-btn rate-fuzzy" data-action="word-rate" data-id="${current.id}" data-rate="模糊">🤔 模糊</button>
        <button class="small-btn candy rate-btn rate-known" data-action="word-rate" data-id="${current.id}" data-rate="认识">✨ 认识</button>
      </div>
    </section>
  ` : `<section class="card top-gap"><p>当前模式今日卡片已完成，可切换模式继续。</p></section>`);
}

function renderPractice() {
  const listAll = getListeningList(state);
  const list = listAll.filter((i) => i.type === selectedListeningType);
  const grammar = grammarLessons.slice(0, 4);
  const mistakes = getMistakeWords(state);
  const activeUnit = listAll.find((item) => item.id === activeListeningQuestionId) || list[0];
  const selectedAnswer = listeningAnswers[activeUnit?.id];
  const showResult = listeningShowResult[activeUnit?.id];
  const reading = readingStrategies.slice(0, 4);

  if (practicePanel === "hub") {
    views.practice.innerHTML = `
      <section class="section-intro"><h2>练习页</h2><p class="muted">先选训练入口，再进入单点练习。</p></section>
      <section class="task-stack">
        <article class="card entry-card"><h3>听力真题</h3><p class="muted">按四级结构做题：先听题，再提交答案，再看定位句与解析。</p><button class="primary-btn top-gap" data-action="open-practice-panel" data-panel="listening">进入听力真题</button></article>
        <article class="card entry-card"><h3>阅读定位</h3><p class="muted">${reading.map((r) => r.title).join(" · ")}</p><button class="small-btn top-gap" data-action="quick-complete" data-key="readingGrammar">完成 1 次阅读定位训练</button></article>
        <article class="card entry-card"><h3>语法基础</h3><p class="muted">${grammar.map((g) => g.topic).join(" · ")}</p><button class="small-btn top-gap" data-action="quick-complete" data-key="readingGrammar">完成 1 次语法训练</button></article>
        <article class="card entry-card"><h3>错题回顾</h3><p class="muted">拼写错词 ${mistakes.length} 个，建议立即回顾。</p><button class="small-btn top-gap" data-action="go-vocab-spelling">去错题回顾</button></article>
      </section>
    `;
    return;
  }

  views.practice.innerHTML = `
    <section class="section-intro"><h2>听力真题训练器</h2><p class="muted">做题驱动：先听题，再答题，再看解析。</p></section>
    <section class="card">
      <div class="section-head"><h3>题型入口</h3><button class="ghost-btn" data-action="open-practice-panel" data-panel="hub">返回练习主页</button></div>
      <div class="chips secondary">
        ${["短篇新闻", "长对话", "听力篇章"].map((t) => `<button class="chip ${selectedListeningType === t ? "active" : ""}" data-action="listening-type" data-type="${t}">${t}</button>`).join("")}
      </div>
      <div class="task-stack top-gap">
        ${list.map((item) => `
          <article class="card compact ${activeUnit?.id === item.id ? "active-training-card" : ""}">
            <div class="section-head"><h4>${escapeHtml(item.title)}</h4><span class="mini-status pending">${escapeHtml(item.qno)}</span></div>
            <p class="muted">${escapeHtml(item.year)} · 训练重点：${escapeHtml(item.target)}</p>
            <div class="action-row top-gap">
              <button class="small-btn ${activeUnit?.id === item.id ? "candy" : ""}" data-action="open-listening-unit" data-id="${item.id}">进入做题</button>
              <button class="small-btn ghost" data-action="listen-favorite" data-id="${item.id}">${item.favorite ? "取消收藏" : "收藏题目"}</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>

    ${activeUnit ? `<section class="card top-gap">
      <div class="section-head"><h3>${escapeHtml(activeUnit.title)}</h3><span class="pill">${escapeHtml(activeUnit.type)}</span></div>
      <p class="muted">训练重点：${escapeHtml(activeUnit.target)}</p>
      <p class="muted">题目：${escapeHtml(activeUnit.question)}</p>
      <div class="action-row top-gap">
        <button class="small-btn" data-action="listen-play" data-id="${activeUnit.id}">${activeListeningId === activeUnit.id ? "暂停音频" : "播放音频"}</button>
        <button class="small-btn ghost" data-action="set-speed" data-speed="0.8">慢速 0.8x</button>
        <button class="small-btn ghost" data-action="set-speed" data-speed="1.0">标准 1.0x</button>
      </div>
      <div class="radio-list top-gap">
        ${activeUnit.options.map((opt) => `<label class="option-row"><input type="radio" name="listen-option" ${selectedAnswer === opt.key ? "checked" : ""} data-action="select-listening-answer" data-id="${activeUnit.id}" data-answer="${opt.key}"/><span>${opt.key}. ${escapeHtml(opt.text)}</span></label>`).join("")}
      </div>
      <div class="action-row top-gap">
        <button class="primary-btn" data-action="submit-listening-answer" data-id="${activeUnit.id}">提交答案</button>
        <button class="small-btn ghost" data-action="listen-repeat" data-id="${activeUnit.id}">查看答案句</button>
      </div>
      ${showResult ? `<div class="feedback ${activeUnit.answer === selectedAnswer ? "success" : "warn"} top-gap">
        正确答案：${activeUnit.answer} · 你的答案：${selectedAnswer || "未选择"}
      </div>
      <p class="muted top-gap"><strong>答案句定位：</strong>${escapeHtml(activeUnit.answerSentence)}</p>
      <p class="muted"><strong>解析：</strong>${escapeHtml(activeUnit.analysis)}</p>
      <p class="muted"><strong>错因提示：</strong>${escapeHtml(activeUnit.errorTip)}</p>
      <details class="top-gap"><summary>查看原文</summary><p class="muted">${escapeHtml(activeUnit.transcript)}</p></details>
      <div class="action-row top-gap">
        <button class="small-btn ghost" data-action="mark-understood" data-id="${activeUnit.id}" data-understood="yes">听懂了</button>
        <button class="small-btn ghost" data-action="mark-understood" data-id="${activeUnit.id}" data-understood="no">没听懂</button>
      </div>` : ""}
      <p class="muted top-gap">播放状态：${activeListeningId ? `${activeListeningId} · ${fakePlayerSec}s · ${listeningSpeed}x` : "未播放"}</p>
    </section>` : ""}
  `;
}

function syncTaskCompletionFromProgress(dateKey = getTodayKey()) {
  const tasks = ensureDailyTasks(state, dateKey);
  const todayLog = state.studyLog[dateKey] || {};
  const completedByProgress = new Set();
  if ((todayLog.newWords || 0) > 0) completedByProgress.add("newWords");
  if ((todayLog.reviewWords || 0) > 0) completedByProgress.add("reviewWords");
  if ((todayLog.spelling || 0) > 0) completedByProgress.add("spelling");
  if ((todayLog.audioWords || 0) > 0) completedByProgress.add("audioWords");
  tasks.forEach((task) => {
    if (completedByProgress.has(task.key) && task.status !== "completed") {
      setTaskStatus(state, dateKey, task.id, "completed");
    }
  });
}

function renderPlan() {
  const plan = getPlanSummary(state);
  const week = plan.current;
  views.plan.innerHTML = `
    <section class="section-intro"><h2>计划中枢</h2><p class="muted">看得见阶段、看得见推进、看得见恢复路径。</p></section>
    <section class="card">
      <div class="section-head"><h3>总备考进度</h3><span class="pill">剩余 ${plan.daysLeft} 天</span></div>
      <div class="bar large"><span style="width:${plan.progress}%"></span></div>
      <p class="muted">第 ${plan.currentWeek} 周 · ${escapeHtml(week.stage)} · 完成今日任务可再前进约 ${plan.gainIfDoneToday}% 本周目标。</p>
    </section>

    <section class="card top-gap">
      <h3>本周目标</h3>
      <p class="muted">目标：${escapeHtml(week.goal)}</p>
      <p class="muted">重点：${escapeHtml(week.focus)}</p>
      <div class="bar"><span style="width:${week.doneRatio}%"></span></div>
      <p class="muted">已完成 ${week.doneRatio}% · 剩余 ${Math.max(0, 100 - week.doneRatio)}%</p>
      ${week.doneRatio < 40 ? `<button class="small-btn top-gap" data-action="go-tab" data-view="daily">恢复学习（先做 3 项）</button>` : `<button class="small-btn top-gap" data-action="go-tab" data-view="home">继续推进今日任务</button>`}
    </section>

    <section class="task-stack top-gap">
      ${plan.weekRows.map((w) => `
        <article class="card plan-card ${w.week === plan.currentWeek ? "current" : ""}">
          <div class="section-head"><h3>第 ${w.week} 周 · ${escapeHtml(w.stage)}</h3><span class="pill">${w.doneMinutes}/${w.expectedMinutes} 分钟</span></div>
          <p class="muted">${escapeHtml(w.goal)}</p>
          <div class="bar"><span style="width:${w.doneRatio}%"></span></div>
        </article>
      `).join("")}
    </section>
  `;
}

function renderProfile() {
  const profile = getProfileStats(state);
  views.profile.innerHTML = `
    <section class="section-intro"><h2>我的</h2><p class="muted">仅保留对备考有用的数据与设置。</p></section>
    <section class="grid three">
      <article class="card compact"><p class="kicker">考试日期</p><h3>${escapeHtml(state.settings.examDate)}</h3></article>
      <article class="card compact"><p class="kicker">每日学习时长</p><h3>${state.settings.dailyMinutes} 分钟</h3></article>
      <article class="card compact"><p class="kicker">目标分数</p><h3>${state.settings.targetScore}</h3></article>
      <article class="card compact"><p class="kicker">已学习天数</p><h3>${profile.learnedDays}</h3></article>
      <article class="card compact"><p class="kicker">累计完成任务</p><h3>${profile.totalTasksCompleted}</h3></article>
      <article class="card compact"><p class="kicker">已掌握词数</p><h3>${profile.masteredWords}</h3></article>
      <article class="card compact"><p class="kicker">听力练习次数</p><h3>${profile.listeningCount}</h3></article>
      <article class="card compact"><p class="kicker">当前连续打卡</p><h3>${profile.streak} 天</h3></article>
    </section>

    <section class="card top-gap">
      <h3>设置</h3>
      <label class="stack"><span>考试日期</span><input id="examDateInput" type="date" value="${state.settings.examDate}"/></label>
      <label class="stack"><span>每日学习时长（分钟）</span><input id="dailyMinutesInput" type="number" min="20" max="180" value="${state.settings.dailyMinutes}"/></label>
      <label class="stack"><span>目标分数</span><input id="targetScoreInput" type="number" min="425" max="710" value="${state.settings.targetScore}"/></label>
      <button class="primary-btn top-gap" data-action="save-settings">保存设置</button>
    </section>
  `;
}

function renderView() {
  Object.keys(views).forEach((k) => views[k].classList.toggle("active", k === currentView));
  if (currentView === "home") renderHome();
  if (currentView === "daily") renderDaily();
  if (currentView === "vocab") renderVocab();
  if (currentView === "practice") renderPractice();
  if (currentView === "plan") renderPlan();
  if (currentView === "profile") renderProfile();
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === currentView));
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 1300);
}

function toggleFakePlay(id) {
  if (activeListeningId === id) {
    activeListeningId = null;
    clearInterval(fakePlayerTimer);
    showToast("已暂停");
    return;
  }
  activeListeningId = id;
  clearInterval(fakePlayerTimer);
  fakePlayerSec = 0;
  fakePlayerTimer = setInterval(() => {
    fakePlayerSec += listeningSpeed;
    if (currentView === "practice") renderPractice();
  }, 1000);
  showToast(`播放中 ${listeningSpeed}x`);
}

function advanceVocab() {
  if (vocabIndex < vocabDeck.length - 1) vocabIndex += 1;
  else refreshDeck();
  markVocabSession(vocabDeck[vocabIndex]?.id || null);
}

function completeTaskByKey(taskKey) {
  const today = getTodayKey();
  const tasks = ensureDailyTasks(state, today);
  const target = tasks.find((t) => t.key === taskKey && t.status !== "completed");
  if (target) {
    setTaskStatus(state, today, target.id, "completed");
  }
}

function handleAction(action, el) {
  const today = getTodayKey();
  const current = vocabDeck[vocabIndex];
  if (action === "go-tab") {
    gotoView(el.dataset.view);
    return;
  }
  if (action === "start-today") {
    const pendingTask = ensureDailyTasks(state, today).find((t) => t.status !== "completed");
    if (pendingTask) {
      startTask(pendingTask);
      showToast(`继续未完成：${pendingTask.title}`);
      return;
    }
    gotoView("vocab");
    return;
  }
  if (action === "resume-vocab") {
    vocabMode = state.lastVocabSession?.mode || "learn";
    refreshDeck();
    gotoView("vocab");
    return;
  }
  if (action === "resume-task") {
    const task = ensureDailyTasks(state, today).find((t) => t.id === el.dataset.id);
    startTask(task);
    return;
  }
  if (action === "start-task") {
    const task = ensureDailyTasks(state, today).find((t) => t.id === el.dataset.id);
    startTask(task);
    return;
  }
  if (action === "task-quick-action") return;
  if (action === "task-status") {
    setTaskStatus(state, today, el.dataset.id, el.dataset.status);
    renderHome();
    renderDaily();
    return;
  }
  if (action === "set-vocab-mode") {
    vocabMode = el.dataset.mode;
    refreshDeck();
    markVocabSession(vocabDeck[vocabIndex]?.id || null);
    renderVocab();
    return;
  }
  if (action === "set-word-accent") {
    vocabAccent = el.dataset.accent;
    renderVocab();
    return;
  }
  if (action === "set-example-accent") {
    sentenceAccent = el.dataset.accent;
    renderVocab();
    return;
  }
  if (action === "play-word-audio") {
    playPronunciation("word", current, vocabAccent);
    completeTaskByKey("audioWords");
    touchAudioTraining(state);
    return;
  }
  if (action === "play-example-audio") {
    playPronunciation("example", current, sentenceAccent);
    return;
  }
  if (action === "play-phrase-audio") {
    current.activePhrase = el.dataset.phrase || "";
    current.activePhraseAudioUs = current.phraseAudio?.[current.activePhrase]?.us || "";
    current.activePhraseAudioUk = current.phraseAudio?.[current.activePhrase]?.uk || "";
    playPronunciation("phrase", current, sentenceAccent);
    return;
  }
  if (action === "play-family-audio") {
    current.activeFamilyWord = el.dataset.word || "";
    current.activeFamilyAudioUs = current.familyAudio?.[current.activeFamilyWord]?.us || "";
    current.activeFamilyAudioUk = current.familyAudio?.[current.activeFamilyWord]?.uk || "";
    playPronunciation("family", current, sentenceAccent);
    return;
  }
  if (action === "toggle-word-more") {
    if (expandedWordIds.has(el.dataset.id)) expandedWordIds.delete(el.dataset.id); else expandedWordIds.add(el.dataset.id);
    renderVocab();
    return;
  }
  if (action === "show-phrase") {
    showToast(`${el.dataset.phrase} · ${el.dataset.zh}`);
    return;
  }
  if (action === "toggle-hard-word") {
    const row = state.vocabProgress[el.dataset.id] || {};
    state.vocabProgress[el.dataset.id] = { ...row, hardWord: !row.hardWord };
    saveState(state);
    renderVocab();
    return;
  }
  if (action === "toggle-watch-later") {
    const row = state.vocabProgress[el.dataset.id] || {};
    state.vocabProgress[el.dataset.id] = { ...row, watchLater: !row.watchLater };
    saveState(state);
    renderVocab();
    return;
  }
  if (action === "word-rate") {
    el.classList.add("tap-pop");
    const row = rateVocabWord(state, el.dataset.id, el.dataset.rate);
    if (el.dataset.rate === "不认识") playPronunciation("word", current, vocabAccent);
    if (row.familiarityStatus === "已掌握") showToast("太棒了，已进入「已掌握」✨");
    else if (row.spellingEligible) showToast("该词已进入拼写池");
    else showToast(`已标记：${el.dataset.rate}`);
    completeTaskByKey(vocabMode === "review" ? "reviewWords" : "newWords");
    advanceVocab();
    renderVocab();
    return;
  }
  if (action === "swap-spell-type") {
    spellingType = spellingType === "audio" ? "cloze" : "audio";
    renderVocab();
    return;
  }
  if (action === "submit-spelling") {
    const input = document.getElementById("spellingInput")?.value?.trim().toLowerCase() || "";
    const target = (el.dataset.word || "").trim().toLowerCase();
    const ok = input && input === target;
    submitSpelling(state, el.dataset.id, ok);
    if (ok) {
      showToast("拼写正确 ✨");
      completeTaskByKey("spelling");
      advanceVocab();
      renderVocab();
    } else {
      showToast(`拼写错误，正确答案：${target}`);
      renderVocab();
    }
    return;
  }
  if (action === "retry-spelling") {
    const input = document.getElementById("spellingInput");
    if (input) input.value = "";
    input?.focus();
    return;
  }
  if (action === "go-vocab-spelling") {
    vocabMode = "spelling";
    refreshDeck();
    markVocabSession(vocabDeck[vocabIndex]?.id || null);
    gotoView("vocab");
    return;
  }
  if (action === "listening-type") {
    selectedListeningType = el.dataset.type;
    activeListeningQuestionId = getListeningList(state).find((i) => i.type === selectedListeningType)?.id || null;
    renderPractice();
    return;
  }
  if (action === "open-practice-panel") {
    practicePanel = el.dataset.panel;
    renderPractice();
    return;
  }
  if (action === "open-listening-unit") {
    activeListeningQuestionId = el.dataset.id;
    renderPractice();
    return;
  }
  if (action === "listen-play") {
    toggleFakePlay(el.dataset.id);
    renderPractice();
    return;
  }
  if (action === "set-speed") {
    listeningSpeed = Number(el.dataset.speed) || 1.0;
    showToast(`倍速 ${listeningSpeed}x`);
    return;
  }
  if (action === "listen-repeat") {
    const row = getListeningList(state).find((i) => i.id === el.dataset.id);
    showToast(row?.answerSentence || row?.keySentence || "重复重点句");
    return;
  }
  if (action === "select-listening-answer") {
    listeningAnswers[el.dataset.id] = el.dataset.answer;
    return;
  }
  if (action === "submit-listening-answer") {
    const answer = listeningAnswers[el.dataset.id];
    if (!answer) {
      showToast("请先选择一个选项");
      return;
    }
    const result = submitListeningAnswer(state, el.dataset.id, answer);
    listeningShowResult[el.dataset.id] = true;
    if (result.correct) {
      showToast("回答正确，已计入今日任务");
      completeTaskByKey("listening");
    } else {
      showToast(`回答错误，正确答案 ${result.answer}`);
    }
    renderPractice();
    return;
  }
  if (action === "listen-transcript") {
    document.getElementById(`transcript-${el.dataset.id}`)?.classList.toggle("hidden");
    return;
  }
  if (action === "listen-favorite") {
    toggleListeningFavorite(state, el.dataset.id);
    renderPractice();
    return;
  }
  if (action === "listen-done") {
    markListeningPracticed(state, el.dataset.id);
    completeTaskByKey("listening");
    showToast("已标记听力完成");
    renderPractice();
    return;
  }
  if (action === "mark-understood") {
    markListeningUnderstanding(state, el.dataset.id, el.dataset.understood === "yes");
    showToast(el.dataset.understood === "yes" ? "已标记：听懂了" : "已标记：没听懂");
    renderPractice();
    return;
  }
  if (action === "quick-complete") {
    completeTaskByKey(el.dataset.key);
    showToast("已记录完成");
    renderPractice();
    return;
  }
  if (action === "save-settings") {
    updateSettings(state, {
      examDate: document.getElementById("examDateInput").value || "2026-06-13",
      dailyMinutes: clamp(Number(document.getElementById("dailyMinutesInput").value || 55), 20, 180),
      targetScore: clamp(Number(document.getElementById("targetScoreInput").value || 500), 425, 710)
    });
    showToast("设置已保存");
    renderProfile();
  }
}

function registerEvents() {
  document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => {
    currentView = tab.dataset.view;
    renderView();
  }));
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    handleAction(btn.dataset.action, btn);
  });
}

function boot() {
  ensureDailyTasks(state);
  syncTaskCompletionFromProgress();
  refreshDeck();
  activeListeningQuestionId = getListeningList(state).find((i) => i.type === selectedListeningType)?.id || null;
  markVocabSession(vocabDeck[vocabIndex]?.id || null);
  registerEvents();
  renderView();
  saveState(state);
}

boot();
