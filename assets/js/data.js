export const examStructure = {
  durationMinutes: 125,
  sections: [
    { name: "写作", weight: 15 },
    { name: "听力", weight: 35, parts: ["短篇新闻", "长对话", "听力篇章"] },
    { name: "阅读", weight: 35, parts: ["选词填空", "长篇阅读匹配", "仔细阅读"] },
    { name: "翻译", weight: 15 }
  ]
};

export const vocabLibrary = [
  { id: "verb-1", group: "高频动词", term: "maintain", phonetic: "/meɪnˈteɪn/", meaning: "维持；保持", collocation: "maintain a balance", example: "It is hard to maintain focus after work." },
  { id: "verb-2", group: "高频动词", term: "indicate", phonetic: "/ˈɪndɪkeɪt/", meaning: "表明；指出", collocation: "data indicate that...", example: "The survey indicates that adults prefer short lessons." },
  { id: "verb-3", group: "高频动词", term: "contribute", phonetic: "/kənˈtrɪbjuːt/", meaning: "促成；贡献", collocation: "contribute to", example: "Daily review contributes to long-term memory." },
  { id: "verb-4", group: "高频动词", term: "enhance", phonetic: "/ɪnˈhɑːns/", meaning: "增强；提升", collocation: "enhance efficiency", example: "Keyword practice can enhance reading speed." },
  { id: "adj-1", group: "高频形容词", term: "essential", phonetic: "/ɪˈsenʃl/", meaning: "必要的；核心的", collocation: "essential skills", example: "Core grammar is essential for translation." },
  { id: "adj-2", group: "高频形容词", term: "considerable", phonetic: "/kənˈsɪdərəbl/", meaning: "相当大的", collocation: "considerable progress", example: "He has made considerable progress in listening." },
  { id: "adj-3", group: "高频形容词", term: "reliable", phonetic: "/rɪˈlaɪəbl/", meaning: "可靠的", collocation: "reliable method", example: "A fixed daily routine is a reliable method." },
  { id: "adj-4", group: "高频形容词", term: "limited", phonetic: "/ˈlɪmɪtɪd/", meaning: "有限的", collocation: "limited time", example: "Adults usually study with limited time." },
  { id: "phr-1", group: "高频短语", term: "be exposed to", phonetic: "/ɪkˈspəʊzd tuː/", meaning: "接触到", collocation: "be exposed to English", example: "You need to be exposed to English daily." },
  { id: "phr-2", group: "高频短语", term: "in terms of", phonetic: "/ɪn tɜːmz əv/", meaning: "就……而言", collocation: "in terms of efficiency", example: "In terms of score gains, vocabulary matters first." },
  { id: "phr-3", group: "高频短语", term: "account for", phonetic: "/əˈkaʊnt fɔː(r)/", meaning: "占据；解释", collocation: "account for 35%", example: "Listening accounts for 35% in CET4." },
  { id: "phr-4", group: "高频短语", term: "stick to", phonetic: "/stɪk tuː/", meaning: "坚持", collocation: "stick to the plan", example: "Try to stick to your daily checklist." },
  { id: "read-1", group: "阅读高频词", term: "decline", phonetic: "/dɪˈklaɪn/", meaning: "下降；拒绝", collocation: "a decline in", example: "The passage reports a decline in sales." },
  { id: "read-2", group: "阅读高频词", term: "assumption", phonetic: "/əˈsʌmpʃn/", meaning: "假设", collocation: "make an assumption", example: "Do not make assumptions before locating details." },
  { id: "read-3", group: "阅读高频词", term: "evidence", phonetic: "/ˈevɪdəns/", meaning: "证据", collocation: "strong evidence", example: "The writer gives evidence in paragraph four." },
  { id: "read-4", group: "阅读高频词", term: "approach", phonetic: "/əˈprəʊtʃ/", meaning: "方法；途径", collocation: "adopt an approach", example: "This approach saves time in matching tasks." },
  { id: "wt-1", group: "写作翻译高频表达", term: "There is no denying that...", phonetic: "/ðeə(r) ɪz nəʊ dɪˈnaɪɪŋ ðæt/", meaning: "不可否认……", collocation: "开头观点句", example: "There is no denying that a plan improves consistency." },
  { id: "wt-2", group: "写作翻译高频表达", term: "play a vital role in", phonetic: "/pleɪ ə ˈvaɪtl rəʊl ɪn/", meaning: "在……中起关键作用", collocation: "play a vital role in learning", example: "Review plays a vital role in memory." },
  { id: "wt-3", group: "写作翻译高频表达", term: "Only in this way can we...", phonetic: "/ˈəʊnli ɪn ðɪs weɪ kæn wiː/", meaning: "只有这样我们才能……", collocation: "结尾升华", example: "Only in this way can we gain stable scores." },
  { id: "wt-4", group: "写作翻译高频表达", term: "be committed to", phonetic: "/bi kəˈmɪtɪd tuː/", meaning: "致力于；坚持", collocation: "be committed to practice", example: "She is committed to daily translation practice." }
];

export const grammarLessons = [
  { id: "g1", topic: "主谓一致", points: ["先找主语核心词", "介词短语不决定动词单复数", "集合名词看语义"], drill: "The list of tasks ___ useful. (is)" },
  { id: "g2", topic: "基础时态", points: ["一般现在：习惯与事实", "一般过去：明确过去时间", "现在完成：过去动作影响现在"], drill: "I ___ this app for two weeks. (have used)" },
  { id: "g3", topic: "定语从句", points: ["找先行词", "确定关系词指人/物", "从句不完整才需要关系词"], drill: "The method ___ he suggested works well. (that)" },
  { id: "g4", topic: "非谓语基础", points: ["to do 表目的/将来", "doing 表主动/进行", "done 表被动/完成"], drill: "___ enough sleep, you will learn better. (Getting)" },
  { id: "g5", topic: "长难句主干拆解", points: ["先找主谓宾", "把插入语和从句先括起来", "优先抓逻辑词 but/however/therefore"], drill: "Identify the subject and verb first in every long sentence." }
];

export const readingStrategies = [
  { id: "r1", title: "题干定位", method: "圈出题干中的名词、时间、数字后回原文定位段落", prompt: "according to paragraph 3" },
  { id: "r2", title: "关键词回原文", method: "优先找同义词替换而非原词重现", prompt: "important = essential/significant" },
  { id: "r3", title: "同义替换识别", method: "把选项中的抽象词换成原文中的具体表达", prompt: "decline = decrease/fall" },
  { id: "r4", title: "干扰项识别", method: "警惕绝对词、偷换主语、转折前信息", prompt: "all/never/only 常为陷阱" }
];

export const writingTranslationBank = [
  { id: "w1", type: "模板句", cn: "在我看来，坚持比强度更重要。", en: "From my point of view, consistency is more important than intensity." },
  { id: "w2", type: "模板句", cn: "一个重要原因是时间管理更高效。", en: "One important reason is that time management becomes more efficient." },
  { id: "w3", type: "连接句", cn: "此外，短时高频学习更容易长期坚持。", en: "Moreover, short and frequent learning is easier to sustain." },
  { id: "w4", type: "连接句", cn: "总之，小步快跑比临时突击更有效。", en: "In conclusion, steady daily effort is more effective than last-minute cramming." },
  { id: "w5", type: "段落翻译高频表达", cn: "大学英语四级考试总时长为125分钟。", en: "The total duration of the CET4 exam is 125 minutes." },
  { id: "w6", type: "段落翻译高频表达", cn: "听力部分在总分中占35%。", en: "The listening section accounts for 35% of the total score." }
];

export const listeningLibrary = [
  {
    id: "l-news-1",
    type: "短篇新闻",
    title: "City Library Opens Night Study Area",
    duration: "01:18",
    audio: "",
    transcript: "Good evening. The city library has opened a new night study area for working adults...",
    target: "抓数字与转折：开放时间、服务对象",
    question: "Why did the library open the new area?"
  },
  {
    id: "l-dialog-1",
    type: "长对话",
    title: "Discussing a Weekly Study Plan",
    duration: "02:05",
    audio: "",
    transcript: "W: I only have 30 minutes after work. M: Then let's split it into vocabulary and listening...",
    target: "抓建议信号词 should / why don't you",
    question: "What does the man suggest first?"
  },
  {
    id: "l-pass-1",
    type: "听力篇章",
    title: "How Micro-learning Improves Adult Learning",
    duration: "02:42",
    audio: "",
    transcript: "Research shows that short but regular sessions improve retention among adult learners...",
    target: "抓主旨句与因果关系",
    question: "What is the main finding of the research?"
  }
];

export const dailyTaskTemplates = [
  { key: "newWords", title: "学习 12 个新词", minutes: 18, type: "vocab" },
  { key: "reviewWords", title: "复习 20 个旧词", minutes: 20, type: "vocab" },
  { key: "grammar", title: "完成 1 组语法训练", minutes: 16, type: "grammar" },
  { key: "reading", title: "完成 1 组阅读定位训练", minutes: 16, type: "reading" },
  { key: "listening", title: "听 1 段四级短篇新闻", minutes: 15, type: "listening" }
];

export const weeklyPlan = Array.from({ length: 12 }).map((_, i) => {
  const week = i + 1;
  const stages = ["基础搭建", "能力强化", "冲刺稳分"];
  const stage = week <= 4 ? stages[0] : week <= 9 ? stages[1] : stages[2];
  return {
    week,
    stage,
    goal: week <= 4 ? "词汇体系+语法地基" : week <= 9 ? "阅读听力提速" : "全题型稳态输出",
    focus: week <= 4 ? "高频词、主谓一致、时态" : week <= 9 ? "定位训练、听力信号、翻译表达" : "限时训练、错题复盘、写作模板",
    expectedMinutes: 420,
  };
});
