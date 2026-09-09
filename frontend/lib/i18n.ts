/**
 * The interface, in four languages - and an honest account of which parts of it
 * this file can reach.
 *
 * THREE KINDS OF TEXT APPEAR ON A FAIRSLIP SCREEN, and only the first is here.
 *
 *   1. Interface text the client owns: headings, labels, buttons, the sentences
 *      that explain what the screen is doing. Translated below.
 *   2. Text the SERVER sends: engine formulas, refusal details, the drafted
 *      message, the worker-field prompts. The prompts are translated at their
 *      source in backend/fairslip/extract_schema.py, because one source of
 *      truth beats a client overlay that drifts. The rest renders as it arrives.
 *   3. QUOTATIONS from MOM, TADM and CPF Board. These stay in English in every
 *      language, and the interface says so IN THE READER'S LANGUAGE where they
 *      appear. Machine-translating a government's exact words onto a screen a
 *      worker carries to a mediation counter would be asserting a translation
 *      nobody verified - the precise thing this product exists not to do. The
 *      boundary is the thesis, not a shortfall.
 *
 * THE TRANSLATIONS BELOW ARE MODEL-PRODUCED AND HAVE NOT BEEN REVIEWED BY A
 * NATIVE SPEAKER. That is disclosed where the language is chosen, in the
 * language chosen - not in a footer. A product that says it does not assert what
 * it has not established has to apply that to its own interface.
 *
 * English is the complete set and the source of truth. A key missing from
 * another language renders the English, marked, with lang="en" on the element -
 * never a key, never an empty string, never a guess.
 */

export type Lang = "en" | "zh" | "bn" | "ta";

export const LANGS: { code: Lang; endonym: string; english: string }[] = [
  { code: "en", endonym: "English", english: "English" },
  { code: "zh", endonym: "中文", english: "Mandarin Chinese" },
  { code: "bn", endonym: "বাংলা", english: "Bengali" },
  { code: "ta", endonym: "தமிழ்", english: "Tamil" },
];

/** BCP-47 tags, for <html lang>, :lang() and SpeechSynthesis voice matching. */
export const BCP47: Record<Lang, string> = {
  en: "en",
  zh: "zh-CN",
  bn: "bn",
  ta: "ta",
};

export function isLang(v: string | null | undefined): v is Lang {
  return !!v && LANGS.some((l) => l.code === v);
}

/* ------------------------------------------------------------------ English */
/* Every value here is the string that was on the screen before this file
 * existed, character for character. The English rendering must not drift: the
 * demo script quotes it and the timing harness matches on it. */
const en = {
  /* The state machine and the mandate ladder. Node names are the machine's own
     enum values and are never translated - they are its vocabulary. */
  "machine.heading": "What the agent may do next, and what it may not",
  "machine.verdicts": "Verdicts of the check",
  "machine.ladder": "The mandate, as a ladder",
  "machine.youAreHere": "you are here",
  "machine.needsLevel": "out of reach - needs level {n}",
  "machine.notBuilt": "inside the mandate, and not built in this cut",
  "machine.notBuiltShort": "not built yet",
  "machine.terminal": "ends here",
  "machine.reattemptable": "can be attempted again - not an ending",
  "machine.wouldUnlock": "raising to here would unlock",
  "machine.nothingBeyond": "nothing beyond showing you the figures",
  "machine.lockedSummary":
    "{n} of these states are out of reach at level {level}. Each says the level that would permit it. Nothing changes until you choose.",

  /* The two-reader comparison. Column headings and the independence diagram;
     every VALUE in it is a reading the backend returned. */
  "readers.compare": "What each reader read, side by side",
  "readers.field": "Field",
  "readers.verdict": "Verdict",
  "readers.fields": "fields read",
  "readers.sameInput": "The same two images, and the same list of fields",
  "readers.noLink": "no link",
  "readers.reconciled": "Reconciled by code, not by a model",

  "home.employerLink": "Check a payroll before payday →",

  "ctl.heading": "Language, text size and contrast",
  "ctl.language": "Language",
  "ctl.textSize": "Text size",
  "ctl.textSize.1": "Normal",
  "ctl.textSize.2": "Large",
  "ctl.textSize.3": "Largest",
  "ctl.contrast": "Contrast",
  "ctl.disclosure":
    "These interface translations were produced by a language model and have not been checked by a native speaker. Figures are never translated - they come from the engines. Quotations from MOM, TADM and CPF Board stay in English, because FairSlip has not verified a translation of them.",
  "ctl.untranslatedLegend":
    "Text with a dotted underline is not yet translated and is shown in English.",
  "ctl.quotedInEnglish":
    "Quoted in English. These are the authority's exact words, and FairSlip has not verified a translation of them.",
  "ctl.contrast.normal": "Normal",
  "ctl.contrast.high": "Higher",
  "doc.payslip": "Payslip",
  "doc.payslip.hint": "The itemised pay record from your employer. A photo or a screenshot.",
  "doc.roster": "Roster or timesheet",
  "doc.roster.hint": "Your hours - a schedule, a timesheet, or a WhatsApp screenshot.",
  "doc.ket": "Key employment terms",
  "doc.ket.hint": "The terms you agreed to, if you have them.",
  "ctl.readAloud": "Read this aloud",
  "ctl.readAloud.stop": "Stop reading",

  "home.tagline": "Does your pay add up — and if not, what happens next?",
  "home.cta": "Check a payslip of your own →",
  "home.loading": "Loading fixtures…",
  "home.running": "Running the engines…",
  "home.unreachable": "The engines could not be reached.",
  "home.nothingShown":
    "Nothing is shown below, because nothing was calculated. Backend expected at",
  "home.cpf.heading": "CPF, based on CPF Board’s published rates",
  "home.cpf.owUsed": "Ordinary Wage used",
  "home.cpf.total": "Total",
  "home.cpf.employee": "Employee",
  "home.cpf.employer": "Employer",
  "home.cpf.employerComputed": "Employer computed on",
  "home.cpf.rulesGive": "Published rules give",
  "home.cpf.difference": "Difference",
  "home.cpf.ageBandFrom": "age band from",
  "home.cpf.salaryPeriod": "Salary period",
  "home.cpf.ageBand": "CPF age band:",
  "home.nothingCalculated": "Nothing was calculated for this month.",
  "home.factsSummary": "The facts this used, and where each came from",

  "result.difference": "Possible unreconciled difference",
  "result.expectedGross": "Expected gross",
  "result.deductions": "Deductions on the payslip",
  "result.expectedNet": "Expected net",
  "result.reachedBank": "Reached the bank",
  "result.whereFrom": "Where each dollar comes from",
  "result.flags": "Flags",

  "check.title": "Does your pay add up?",
  "check.intro":
    "Two readers transcribe your documents independently. Where they agree, we say so. Where they do not, you decide. And some things no document can tell us — those we ask you.",
  "check.docsHeading": "Your documents",
  "check.noFile": "no file chosen",
  "check.read": "Read my documents",
  "check.reading": "Both readers are reading…",
  "check.needPayslip": "A payslip is needed before we can read.",
  "check.readersHeading": "Who read your documents",
  "check.answered": "answered",
  "check.didNotAnswer": "did not answer",
  "check.fromCache": "from cache",
  "check.calledLive": "called live",
  "check.readersNote":
    "Neither reader saw the other’s answer. They were given the same images and the same list of fields.",

  "group.readHeading": "Read from your documents",
  "group.fieldCount": "{n} fields",
  "group.readBlurb":
    "These are figures a payslip or a roster actually shows, so two readers were each asked to transcribe them.",
  "group.allAgreed": "Both readers agreed on all {n}.",
  "group.allAgreedWhy":
    "Two models, given the same images separately, transcribed every one of these the same way. That is what agreement means here, and it is the only thing that makes a read field usable without asking you.",
  "group.someAgreed": "The readers agreed on {a} of {t}.",
  "group.someAgreedWhy":
    "The rest are below, with what each reader said. FairSlip does not pick between them.",
  "group.workerHeading": "Only you can answer these",
  "group.workerBlurb":
    "No reader was shown these. A better photograph would not help, and a better model would not either: some of these are facts no payslip states, and the rest are facts only you can settle. A model asked anyway would return a guess that looks exactly like a reading.",
  "group.mostImportant": "The one that matters most",
  "group.forCpf": "for the CPF check",
  "field.rightFigure": "What is the right figure?",
  "field.typeNumber": "type the number you know to be right",
  "field.answeredNothing": "answered nothing",
  "field.notANumber": "(not a number)",

  "status.AGREED": "both readers agree",
  "status.DISAGREED": "readers disagree",
  "status.MISSING": "not established",
  "status.HUMAN_CONFIRMED": "you answered this",

  "gate.compute": "Work out what the rules say this month should have paid",
  "gate.blockedOne": "One field is still unanswered, so nothing has been calculated:",
  "gate.blockedMany": "{n} fields are still unanswered, so nothing has been calculated:",
  "gate.reasonRead": "the readers did not settle it",
  "gate.reasonWorker": "we ask you, not a reader",
  "gate.ready":
    "Every field the engine needs has an answer — agreed by both readers, or given by you. The engine checks each value when it runs, and refuses any it cannot use.",

  "footer.outside": "Outside what FairSlip checks",
  "footer.outsideBody":
    "Daily and piece-rated workers; public-holiday pay; shift-work averaging; CPF on monthly wages of $750 or less; PR year 1 and 2 CPF rates; Additional Wages; platform workers; domestic workers; and any question of legal liability. Where an input falls outside these rules the engines refuse rather than approximate.",
  "footer.notADetermination":
    "Figures are reconstructed from MOM’s and CPF Board’s published rules and are not a determination of any kind. Check with MOM, TADM or CPF Board.",
  "footer.engines": "Engines at",

  "a11y.resultReady": "The reconciliation is ready.",
  "a11y.readersLanded": "Both readers have answered. Their readings are below.",
  "a11y.region": "Results",
  "home.scaleLink": "Who FairSlip is for, in rules →",

  /* The coverage screen. Its headings live here; everything it STATES about
     coverage arrives from /coverage, written from a quote, an engine constant,
     or the result of running an engine. */
  "scale.title": "Who FairSlip is for",
  "scale.back": "← FairSlip",
  "scale.loading": "Asking the engines what they cover…",
  "scale.unreachable": "The engines could not be reached, so this page states nothing.",
  "scale.packs": "The two rule packs",
  "scale.covers": "Who it is for",
  "scale.thresholds": "Thresholds the engine holds",
  "scale.encoded": "Rules encoded",
  "scale.readFrom": "Read from",
  "scale.cpf": "Who is a CPF member, asked of the engine one status at a time",
  "scale.whatTheEngineDid": "What the CPF engine did",
  "scale.outcome.CONTRIBUTES": "Contributions computed",
  "scale.outcome.NOT_A_MEMBER": "Not a CPF member",
  "scale.outcome.REFUSED": "Refused: not encoded",
  "scale.notEncoded": "What FairSlip does not do, and how each of those is known",
  "scale.kind.REFUSED_BY_ENGINE": "The engine refuses it",
  "scale.kind.NO_INPUT_EXISTS": "There is no input for it",
  "scale.kind.STATED_NOT_CHECKED": "Said here, not proved here",
  "scale.howKnown": "How this is known",
  "scale.interface": "What FairSlip’s own interface covers",
  "scale.questions": "The six questions asked of a worker",
  "scale.uiStrings": "The rest of the interface, counted from the dictionary",
  "scale.translatedOf": "{done} of {total} translated",
  "scale.serverText":
    "The count above is of this interface's own words. Sentences the engines send - refusal messages, formulas, and the explanations of coverage on this page - arrive in English and are not counted in it.",

  /* The charts. Labels only - every FIGURE on every chart is a Money the
     backend built, rendered through money(), and none of them is in here. */
  "chart.reconciliation": "How the month adds up",
  "chart.toScale":
    "Every bar is drawn to one scale, from the figure beside it. Tap a bar for the formula that produced it.",
  "chart.cpfOverlap": "Where the money went — and the part that is both",
  "chart.cpfUndrawable":
    "The CPF split is not drawn here: the engine did not return every line this chart needs, and a bar with a segment missing would still look finished.",
} as const;

export type Key = keyof typeof en;

/* ------------------------------------------------------- Mandarin Chinese */
const zh: Partial<Record<Key, string>> = {
  "machine.heading": "代理接下来可以做什么，不可以做什么",
  "machine.verdicts": "核查的判定",
  "machine.ladder": "授权层级，逐级呈现",
  "machine.youAreHere": "你在这里",
  "machine.needsLevel": "无法到达 — 需要第 {n} 级",
  "machine.notBuilt": "在授权范围内，但本版本尚未实现",
  "machine.notBuiltShort": "尚未实现",
  "machine.terminal": "到此结束",
  "machine.reattemptable": "可以再试一次 — 并非结束",
  "machine.wouldUnlock": "提升到这一级会解锁",
  "machine.nothingBeyond": "除了向你展示数字之外，什么都不做",
  "machine.lockedSummary":
    "在第 {level} 级，有 {n} 个状态无法到达。每一个都标明了需要哪一级。在你做出选择之前，什么都不会改变。",

  "readers.compare": "两位读取者各自读到什么，并排对照",
  "readers.field": "字段",
  "readers.verdict": "判定",
  "readers.fields": "已读字段",
  "readers.sameInput": "同样的两张图片，同样的字段清单",
  "readers.noLink": "无连接",
  "readers.reconciled": "由代码核对，而非由模型核对",

  "home.employerLink": "在发薪前检查薪资表 →",

  "ctl.heading": "语言、字体大小与对比度",
  "ctl.language": "语言",
  "ctl.textSize": "字体大小",
  "ctl.textSize.1": "正常",
  "ctl.textSize.2": "大",
  "ctl.textSize.3": "最大",
  "ctl.contrast": "提高对比度",
  "ctl.disclosure":
    "这些界面翻译由语言模型生成，未经母语使用者校对。金额从不翻译——它们来自计算引擎。人力部、TADM 和公积金局的引文保留英文，因为 FairSlip 未验证过它们的译文。",
  "ctl.untranslatedLegend":
    "带点状下划线的文字尚未翻译，以英文显示。",
  "ctl.quotedInEnglish":
    "以英文引用。这是主管机构的原文，FairSlip 未验证过它的译文。",
  "ctl.contrast.normal": "正常",
  "ctl.contrast.high": "更高",
  "doc.payslip": "工资单",
  "doc.payslip.hint": "雇主出具的逐项薪酬记录。照片或截图均可。",
  "doc.roster": "排班表或考勤表",
  "doc.roster.hint": "你的工时 — 排班表、考勤表，或 WhatsApp 截图。",
  "doc.ket": "主要雇佣条款",
  "doc.ket.hint": "你同意的条款，如果你手上有的话。",
  "ctl.readAloud": "朗读此内容",
  "ctl.readAloud.stop": "停止朗读",

  "home.tagline": "你的工资对得上吗——如果对不上，接下来怎么办？",
  "home.cta": "检查你自己的工资单 →",
  "home.loading": "正在加载示例数据…",
  "home.running": "引擎运行中…",
  "home.unreachable": "无法连接到计算引擎。",
  "home.nothingShown":
    "下方没有显示任何内容，因为没有进行任何计算。后端应位于",
  "home.cpf.heading": "公积金，依据公积金局公布的缴费率",
  "home.cpf.owUsed": "所用的普通工资",
  "home.cpf.total": "合计",
  "home.cpf.employee": "雇员",
  "home.cpf.employer": "雇主",
  "home.cpf.employerComputed": "雇主按此金额计算",
  "home.cpf.rulesGive": "公布规则得出",
  "home.cpf.difference": "差额",
  "home.cpf.ageBandFrom": "年龄区间来自",
  "home.cpf.salaryPeriod": "薪酬期",
  "home.cpf.ageBand": "公积金年龄区间：",
  "home.nothingCalculated": "本月未进行任何计算。",
  "home.factsSummary": "此计算所用的事实，以及它们各自的来源",

  "result.difference": "可能未对账的差额",
  "result.expectedGross": "应付总额",
  "result.deductions": "工资单上的扣款",
  "result.expectedNet": "应付净额",
  "result.reachedBank": "实际到账",
  "result.whereFrom": "每一元钱的来源",
  "result.flags": "标记",

  "check.title": "你的工资对得上吗？",
  "check.intro":
    "两个阅读模型各自独立地转写你的文件。它们一致时，我们会说明。它们不一致时，由你决定。还有一些事情任何文件都无法告诉我们——那些我们会问你。",
  "check.docsHeading": "你的文件",
  "check.noFile": "未选择文件",
  "check.read": "阅读我的文件",
  "check.reading": "两个阅读模型正在阅读…",
  "check.needPayslip": "需要一张工资单才能开始阅读。",
  "check.readersHeading": "谁阅读了你的文件",
  "check.answered": "已回答",
  "check.didNotAnswer": "未回答",
  "check.fromCache": "来自缓存",
  "check.calledLive": "实时调用",
  "check.readersNote":
    "两个阅读模型都没有看到对方的答案。它们收到的是相同的图像和相同的字段清单。",

  "group.readHeading": "从你的文件中读取",
  "group.fieldCount": "{n} 个字段",
  "group.readBlurb":
    "这些是工资单或排班表上确实显示的数字，因此两个阅读模型都被要求分别转写它们。",
  "group.allAgreed": "两个阅读模型在全部 {n} 项上一致。",
  "group.allAgreedWhy":
    "两个模型分别收到相同的图像，将每一项都转写成了同样的结果。这就是这里所说的一致，也是唯一能让一个读取字段无需询问你就可使用的条件。",
  "group.someAgreed": "阅读模型在 {t} 项中的 {a} 项上一致。",
  "group.someAgreedWhy":
    "其余列在下方，并附上每个阅读模型的说法。FairSlip 不会替你在它们之间做选择。",
  "group.workerHeading": "只有你能回答这些",
  "group.workerBlurb":
    "没有任何阅读模型看过这些。更好的照片帮不上忙，更好的模型也一样：其中一些是任何工资单都不会写明的事实，其余则是只有你能确定的事实。强行询问模型，得到的只会是一个看起来与读取结果一模一样的猜测。",
  "group.mostImportant": "最关键的一项",
  "group.forCpf": "用于公积金检查",
  "field.rightFigure": "正确的数字是多少？",
  "field.typeNumber": "请输入你确知正确的数字",
  "field.answeredNothing": "未给出任何答案",
  "field.notANumber": "（不是数字）",

  "status.AGREED": "两个阅读模型一致",
  "status.DISAGREED": "阅读模型不一致",
  "status.MISSING": "尚未确立",
  "status.HUMAN_CONFIRMED": "这是你回答的",

  "gate.compute": "算出规则规定本月应付的金额",
  "gate.blockedOne": "还有一个字段未回答，因此尚未进行任何计算：",
  "gate.blockedMany": "还有 {n} 个字段未回答，因此尚未进行任何计算：",
  "gate.reasonRead": "阅读模型未能确定它",
  "gate.reasonWorker": "我们问你，而不是问阅读模型",
  "gate.ready":
    "引擎所需的每个字段都有了答案——要么两个阅读模型一致，要么由你给出。引擎运行时会逐一检查每个值，并拒绝任何它无法使用的值。",

  "footer.outside": "FairSlip 不检查的范围",
  "footer.notADetermination":
    "所有数字均根据人力部和公积金局公布的规则重建，不构成任何形式的认定。请向人力部、TADM 或公积金局查证。",
  "footer.engines": "引擎位于",

  "a11y.resultReady": "对账结果已准备好。",
  "a11y.readersLanded": "两个阅读模型均已回答。它们的读取结果列在下方。",
  "a11y.region": "结果",
  "home.scaleLink": "FairSlip 服务哪些人：以规则说明 →",

  "scale.title": "FairSlip 服务哪些人",
  "scale.back": "← 返回 FairSlip",
  "scale.loading": "正在询问引擎它们涵盖的范围…",
  "scale.unreachable": "无法连接引擎，因此本页不作任何说明。",
  "scale.packs": "两套规则",
  "scale.covers": "适用于谁",
  "scale.thresholds": "引擎保存的阈值",
  "scale.encoded": "已编入的规则",
  "scale.readFrom": "出处",
  "scale.cpf": "谁是公积金会员：逐一询问引擎的结果",
  "scale.whatTheEngineDid": "公积金引擎的处理结果",
  "scale.outcome.CONTRIBUTES": "已计算缴款",
  "scale.outcome.NOT_A_MEMBER": "非公积金会员",
  "scale.outcome.REFUSED": "拒绝计算：未编入",
  "scale.notEncoded": "FairSlip 不做的事，以及每一项是如何知道的",
  "scale.kind.REFUSED_BY_ENGINE": "引擎会拒绝",
  "scale.kind.NO_INPUT_EXISTS": "没有对应的输入项",
  "scale.kind.STATED_NOT_CHECKED": "只是声明，本页未加证明",
  "scale.howKnown": "如何知道的",
  "scale.interface": "FairSlip 自身界面的覆盖情况",
  "scale.questions": "向工人提出的六个问题",
  "scale.uiStrings": "界面其余部分，按词典条目计数",
  "scale.translatedOf": "已翻译 {done} / {total}",
  "scale.serverText":
    "上面的计数只包括界面本身的文字。引擎发送的句子——拒绝说明、公式，以及本页对涵盖范围的解释——以英文送达，不计入其中。",
  "chart.reconciliation": "这个月是怎么算出来的",
  "chart.toScale": "所有条形使用同一比例，长度来自旁边的数字。点按条形可看produce它的算式。",
  "chart.cpfOverlap": "钱去了哪里 — 以及两边重叠的部分",
  "chart.cpfUndrawable":
    "此处不绘制公积金拆分：引擎并未返回本图所需的每一行，而缺少一段的条形看起来仍然是完整的。",

};

/* ------------------------------------------------------------------ Bengali */
const bn: Partial<Record<Key, string>> = {
  "machine.heading": "এজেন্ট এরপর কী করতে পারে, আর কী পারে না",
  "machine.verdicts": "যাচাইয়ের রায়",
  "machine.ladder": "ম্যান্ডেট, ধাপে ধাপে",
  "machine.youAreHere": "আপনি এখানে",
  "machine.needsLevel": "নাগালের বাইরে — {n} স্তর দরকার",
  "machine.notBuilt": "ম্যান্ডেটের ভেতরে, তবে এই সংস্করণে তৈরি হয়নি",
  "machine.notBuiltShort": "এখনো তৈরি হয়নি",
  "machine.terminal": "এখানেই শেষ",
  "machine.reattemptable": "আবার চেষ্টা করা যায় — এটি শেষ নয়",
  "machine.wouldUnlock": "এই স্তরে উঠলে যা খুলবে",
  "machine.nothingBeyond": "আপনাকে সংখ্যাগুলো দেখানো ছাড়া কিছুই নয়",
  "machine.lockedSummary":
    "{level} স্তরে এর মধ্যে {n}টি অবস্থা নাগালের বাইরে। প্রতিটি বলে দেয় কোন স্তর লাগবে। আপনি না বাছা পর্যন্ত কিছুই বদলাবে না।",

  "readers.compare": "দুই পাঠক কী পড়েছে, পাশাপাশি",
  "readers.field": "ক্ষেত্র",
  "readers.verdict": "রায়",
  "readers.fields": "পঠিত ক্ষেত্র",
  "readers.sameInput": "একই দুটি ছবি, আর একই ক্ষেত্রের তালিকা",
  "readers.noLink": "কোনো সংযোগ নেই",
  "readers.reconciled": "কোড মিলিয়েছে, কোনো মডেল নয়",

  "home.employerLink": "বেতনের আগে পে-রোল যাচাই করুন →",

  "ctl.heading": "ভাষা, লেখার আকার ও বৈসাদৃশ্য",
  "ctl.language": "ভাষা",
  "ctl.textSize": "লেখার আকার",
  "ctl.textSize.1": "স্বাভাবিক",
  "ctl.textSize.2": "বড়",
  "ctl.textSize.3": "সবচেয়ে বড়",
  "ctl.contrast": "বেশি বৈসাদৃশ্য",
  "ctl.disclosure":
    "এই ইন্টারফেসের অনুবাদ একটি ভাষা মডেল তৈরি করেছে এবং কোনো মাতৃভাষী এটি যাচাই করেননি। সংখ্যাগুলি কখনোই অনূদিত হয় না — সেগুলি ইঞ্জিন থেকে আসে। MOM, TADM এবং CPF Board-এর উদ্ধৃতি ইংরেজিতেই থাকে, কারণ FairSlip সেগুলির কোনো অনুবাদ যাচাই করেনি।",
  "ctl.untranslatedLegend":
    "বিন্দুর নিচের দাগদেওয়া লেখা এখনও অনূদিত হয়নি এবং ইংরেজিতে দেখানো হচ্ছে।",
  "ctl.quotedInEnglish":
    "ইংরেজিতে উদ্ধৃত। এগুলি কর্তৃপক্ষের ঠিক নিজের শব্দ, এবং FairSlip সেগুলির কোনো অনুবাদ যাচাই করেনি।",
  "ctl.contrast.normal": "স্বাভাবিক",
  "ctl.contrast.high": "বেশি",
  "doc.payslip": "বেতন স্লিপ",
  "doc.payslip.hint": "নিয়োগকর্তার দেওয়া বিস্তারিত বেতনের রেকর্ড। ছবি বা স্ক্রিনশট।",
  "doc.roster": "রোস্টার বা টাইমশিট",
  "doc.roster.hint": "আপনার কাজের সময় — সূচি, টাইমশিট, বা WhatsApp স্ক্রিনশট।",
  "doc.ket": "প্রধান কর্মসংস্থানের শর্ত",
  "doc.ket.hint": "আপনি যে শর্তে রাজি হয়েছিলেন, যদি সেগুলি আপনার কাছে থাকে।",
  "ctl.readAloud": "এটি শুনুন",
  "ctl.readAloud.stop": "পড়া বন্ধ করুন",

  "home.tagline": "আপনার বেতন কি মিলছে — আর না মিললে এরপর কী?",
  "home.cta": "নিজের একটি বেতন স্লিপ পরীক্ষা করুন →",
  "home.loading": "ডেমো ডেটা লোড হচ্ছে…",
  "home.running": "ইঞ্জিন চলছে…",
  "home.unreachable": "ইঞ্জিনে পৌঁছানো যায়নি।",
  "home.nothingShown":
    "নিচে কিছু দেখানো হয়নি, কারণ কোনো হিসাব করা হয়নি। ব্যাকএন্ড থাকার কথা",
  "home.cpf.heading": "CPF, CPF Board-এর প্রকাশিত হার অনুসারে",
  "home.cpf.owUsed": "ব্যবহৃত সাধারণ মজুরি",
  "home.cpf.total": "মোট",
  "home.cpf.employee": "কর্মী",
  "home.cpf.employer": "নিয়োগকর্তা",
  "home.cpf.employerComputed": "নিয়োগকর্তা হিসাব করেছেন",
  "home.cpf.rulesGive": "প্রকাশিত নিয়ম অনুসারে",
  "home.cpf.difference": "পার্থক্য",
  "home.cpf.ageBandFrom": "বয়সের স্তর এসেছে",
  "home.cpf.salaryPeriod": "বেতনের সময়কাল",
  "home.cpf.ageBand": "CPF বয়সের স্তর:",
  "home.nothingCalculated": "এই মাসের জন্য কোনো হিসাব করা হয়নি।",
  "home.factsSummary": "এখানে যে তথ্যগুলি ব্যবহার হয়েছে, এবং প্রতিটি কোথা থেকে এল",

  "result.difference": "সম্ভাব্য অমিল পার্থক্য",
  "result.expectedGross": "প্রত্যাশিত মোট",
  "result.deductions": "বেতন স্লিপে থাকা কর্তন",
  "result.expectedNet": "প্রত্যাশিত নিট",
  "result.reachedBank": "ব্যাংকে পৌঁরানো",
  "result.whereFrom": "প্রতিটি ডলার কোথা থেকে এল",
  "result.flags": "চিহ্ন",

  "check.title": "আপনার বেতন কি মিলছে?",
  "check.intro":
    "দুজন পাঠক আলাদাভাবে আপনার কাগজপত্র পড়ে। যেখানে তারা একমত, আমরা তা বলি। যেখানে নয়, সিদ্ধান্ত আপনার। আর কিছু বিষয় কোনো কাগজই বলতে পারে না — সেগুলি আমরা আপনাকেই জিজ্ঞাসা করি।",
  "check.docsHeading": "আপনার কাগজপত্র",
  "check.noFile": "কোনো ফাইল নেওয়া হয়নি",
  "check.read": "আমার কাগজপত্র পড়ুন",
  "check.reading": "দুজন পাঠকই পড়ছেন…",
  "check.needPayslip": "পড়া শুরু করতে একটি বেতন স্লিপ প্রয়োজন।",
  "check.readersHeading": "কারা আপনার কাগজপত্র পড়ল",
  "check.answered": "উত্তর দিয়েছে",
  "check.didNotAnswer": "উত্তর দেয়নি",
  "check.fromCache": "ক্যাশ থেকে",
  "check.calledLive": "সরাসরি ডাকা হয়েছে",
  "check.readersNote":
    "একজন পাঠকও অন্যজনের উত্তর দেখেননি। দুজনকেই একই ছবি এবং একই ফিল্ডের তালিকা দেওয়া হয়েছিল।",

  "group.readHeading": "আপনার কাগজ থেকে পড়া",
  "group.fieldCount": "{n}টি ফিল্ড",
  "group.readBlurb":
    "এগুলি সেই সংখ্যা যা একটি বেতন স্লিপ বা রোস্টারে সত্যিই লেখা থাকে, তাই দুজন পাঠককেই সেগুলি নকল করতে বলা হয়েছিল।",
  "group.allAgreed": "দুজন পাঠকই সব কটি ({n}) বিষয়ে একমত।",
  "group.someAgreed": "পাঠকরা {t}-এর মধ্যে {a}টিতে একমত।",
  "group.someAgreedWhy":
    "বাকিগুলি নিচে রয়েছে, প্রতিটি পাঠক কী বলেছেন তাসহ। FairSlip তাদের মধ্যে বেছে নেয় না।",
  "group.workerHeading": "এগুলি কেবল আপনিই বলতে পারেন",
  "group.workerBlurb":
    "এগুলি কোনো পাঠককে দেখানো হয়নি। ভালো ছবিও সাহায্য করত না, ভালো মডেলও নয়: এগুলির কিছু এমন তথ্য যা কোনো বেতন স্লিপে লেখা থাকে না, আর বাকিগুলি কেবল আপনিই নিশ্চিত করতে পারেন। তবুও জিজ্ঞাসা করলে একটি মডেল এমন অনুমান দেবে যা দেখতে হুবহু একটি পাঠের মতো।",
  "group.mostImportant": "সবচেয়ে গুরুত্বপূর্ণটি",
  "group.forCpf": "CPF পরীক্ষার জন্য",
  "field.rightFigure": "সঠিক সংখ্যাটি কত?",
  "field.typeNumber": "আপনি যে সংখ্যাটি সঠিক জানেন সেটি লিখুন",
  "field.answeredNothing": "কোনো উত্তর দেয়নি",
  "field.notANumber": "(সংখ্যা নয়)",

  "status.AGREED": "দুজন পাঠকই একমত",
  "status.DISAGREED": "পাঠকরা একমত নন",
  "status.MISSING": "প্রতিষ্ঠিত হয়নি",
  "status.HUMAN_CONFIRMED": "আপনি এটির উত্তর দিয়েছেন",

  "gate.compute": "নিয়ম অনুসারে এই মাসে কত দেওয়া উচিত ছিল তা বের করুন",
  "gate.blockedOne": "একটি ফিল্ড এখনও অনুত্তরিত, তাই কোনো হিসাব করা হয়নি:",
  "gate.blockedMany": "{n}টি ফিল্ড এখনও অনুত্তরিত, তাই কোনো হিসাব করা হয়নি:",
  "gate.reasonRead": "পাঠকরা এটি নিষ্পত্তি করতে পারেনি",
  "gate.reasonWorker": "আমরা আপনাকে জিজ্ঞাসা করছি, পাঠককে নয়",

  "footer.outside": "FairSlip যা পরীক্ষা করে না",
  "footer.notADetermination":
    "সংখ্যাগুলি MOM এবং CPF Board-এর প্রকাশিত নিয়ম থেকে পুনঃনির্মিত এবং এগুলি কোনো ধরনের সিদ্ধান্ত নয়। MOM, TADM বা CPF Board-এর সঙ্গে যাচাই করুন।",
  "footer.engines": "ইঞ্জিন আছে",

  "a11y.resultReady": "হিসাব প্রস্তুত।",
  "a11y.readersLanded": "দুজন পাঠকই উত্তর দিয়েছেন। তাদের পঠন নিচে রয়েছে।",
  "a11y.region": "ফলাফল",
  "home.scaleLink": "FairSlip কাদের জন্য, নিয়ম দিয়ে বলা →",

  "scale.title": "FairSlip কাদের জন্য",
  "scale.back": "← FairSlip",
  "scale.loading": "ইঞ্জিনগুলো কী কী দেখে তা জিজ্ঞাসা করা হচ্ছে…",
  "scale.unreachable": "ইঞ্জিনে পৌঁছানো যায়নি, তাই এই পাতা কিছুই বলছে না।",
  "scale.packs": "দুই সেট নিয়ম",
  "scale.covers": "কাদের জন্য",
  "scale.thresholds": "ইঞ্জিনে রাখা সীমা",
  "scale.encoded": "যে নিয়মগুলো লেখা আছে",
  "scale.readFrom": "পড়া হয়েছে",
  "scale.cpf": "কে CPF সদস্য — একটি করে মর্যাদা নিয়ে ইঞ্জিনকে জিজ্ঞাসা করা হয়েছে",
  "scale.whatTheEngineDid": "CPF ইঞ্জিন যা করল",
  "scale.outcome.CONTRIBUTES": "চাঁদা হিসাব করা হয়েছে",
  "scale.outcome.NOT_A_MEMBER": "CPF সদস্য নন",
  "scale.outcome.REFUSED": "অস্বীকার: নিয়ম লেখা নেই",
  "scale.notEncoded": "FairSlip যা করে না, আর প্রতিটি কীভাবে জানা",
  "scale.kind.REFUSED_BY_ENGINE": "ইঞ্জিন এটি অস্বীকার করে",
  "scale.kind.NO_INPUT_EXISTS": "এর জন্য কোনো ঘর নেই",
  "scale.kind.STATED_NOT_CHECKED": "বলা হয়েছে, এই পাতায় প্রমাণ করা হয়নি",
  "scale.howKnown": "এটি কীভাবে জানা",
  "scale.interface": "FairSlip-এর নিজস্ব ইন্টারফেস কতটা অনুবাদ করা",
  "scale.questions": "কর্মীকে করা ছয়টি প্রশ্ন",
  "scale.uiStrings": "ইন্টারফেসের বাকি অংশ, শব্দকোষ থেকে গণনা করা",
  "scale.translatedOf": "{total}-এর মধ্যে {done} অনুবাদ করা",
  "scale.serverText":
    "উপরের গণনা কেবল এই ইন্টারফেসের নিজের শব্দের। ইঞ্জিন যে বাক্যগুলো পাঠায় — অস্বীকারের কারণ, সূত্র, এবং এই পাতায় পরিধির ব্যাখ্যা — সেগুলো ইংরেজিতে আসে এবং ওই গণনায় ধরা হয় না।",
  "chart.reconciliation": "এই মাসের হিসাব কীভাবে দাঁড়ায়",
  "chart.toScale":
    "প্রতিটি দণ্ড একই মাপে আঁকা, পাশের সংখ্যা থেকে। যে সূত্র থেকে এটি এসেছে দেখতে দণ্ডে চাপ দিন।",
  "chart.cpfOverlap": "টাকা কোথায় গেল — আর যে অংশটি দুই দিকেই পড়ে",
  "chart.cpfUndrawable":
    "এখানে CPF ভাগ আঁকা হয়নি: এই চিত্রের জন্য প্রয়োজনীয় প্রতিটি লাইন ইঞ্জিন ফেরত দেয়নি, আর একটি অংশ বাদ পড়া দণ্ডও দেখতে সম্পূর্ণ লাগে।",

};

/* -------------------------------------------------------------------- Tamil */
const ta: Partial<Record<Key, string>> = {
  "machine.heading": "முகவர் அடுத்து என்ன செய்யலாம், என்ன செய்ய முடியாது",
  "machine.verdicts": "சரிபார்ப்பின் தீர்ப்புகள்",
  "machine.ladder": "அதிகாரம், படிநிலையாக",
  "machine.youAreHere": "நீங்கள் இங்கே",
  "machine.needsLevel": "எட்டவில்லை — நிலை {n} தேவை",
  "machine.notBuilt": "அதிகாரத்திற்குள் உள்ளது, ஆனால் இந்தப் பதிப்பில் கட்டப்படவில்லை",
  "machine.notBuiltShort": "இன்னும் கட்டப்படவில்லை",
  "machine.terminal": "இங்கே முடிகிறது",
  "machine.reattemptable": "மீண்டும் முயற்சிக்கலாம் — இது முடிவல்ல",
  "machine.wouldUnlock": "இந்த நிலைக்கு உயர்த்தினால் திறக்கும்",
  "machine.nothingBeyond": "எண்களைக் காட்டுவதைத் தவிர வேறொன்றும் இல்லை",
  "machine.lockedSummary":
    "நிலை {level}-இல் இவற்றில் {n} நிலைகள் எட்டவில்லை. ஒவ்வொன்றும் தேவையான நிலையைச் சொல்கிறது. நீங்கள் தேர்வு செய்யும் வரை எதுவும் மாறாது.",

  "readers.compare": "இரு வாசிப்பாளர்கள் என்ன படித்தார்கள், அருகருகே",
  "readers.field": "புலம்",
  "readers.verdict": "தீர்ப்பு",
  "readers.fields": "படித்த புலங்கள்",
  "readers.sameInput": "அதே இரண்டு படங்கள், அதே புலப் பட்டியல்",
  "readers.noLink": "இணைப்பு இல்லை",
  "readers.reconciled": "குறியீடு ஒப்பிட்டது, மாதிரி அல்ல",

  "home.employerLink": "சம்பள நாளுக்கு முன் சம்பளப்பட்டியல் சரிபார்க்கவும் →",

  "ctl.heading": "மொழி, எழுத்து அளவு மற்றும் வேறுபாடு",
  "ctl.language": "மொழி",
  "ctl.textSize": "எழுத்து அளவு",
  "ctl.textSize.1": "இயல்பான",
  "ctl.textSize.2": "பெரிய",
  "ctl.textSize.3": "மிகப் பெரிய",
  "ctl.contrast": "அதிக வேறுபாடு",
  "ctl.disclosure":
    "இந்த இடைமுக மொழிபெயர்ப்புகள் ஒரு மொழி மாதிரியால் உருவாக்கப்பட்டது, தாய்மொழி பேசுபவர் சரிபார்க்கவில்லை. எண்கள் ஒருபோதும் மொழிபெயர்க்கப்படுவதில்லை — அவை என்ஜின்களிலிருந்து வருகின்றன. MOM, TADM மற்றும் CPF Board மேற்கோள்கள் ஆங்கிலத்திலேயே இருக்கின்றன, ஏெனென்றால் FairSlip அவற்றின் மொழிபெயர்ப்பை சரிபார்க்கவில்லை.",
  "ctl.untranslatedLegend":
    "புள்ளிக்கோட்டு அடிக்கோடிட்ட உரை இன்னும் மொழிபெயர்க்கப்படவில்லை, ஆங்கிலத்தில் காட்டப்படுகிறது.",
  "ctl.quotedInEnglish":
    "ஆங்கிலத்தில் மேற்கோள். இவை அதிகாரப்பூர்வ அமைப்பின் சொற்களே, FairSlip அவற்றின் மொழிபெயர்ப்பை சரிபார்க்கவில்லை.",
  "ctl.contrast.normal": "இயல்பான",
  "ctl.contrast.high": "அதிகம்",
  "doc.payslip": "சம்பளச் சீட்டு",
  "doc.payslip.hint": "முதலாளி தந்த விரிவான சம்பள பதிவு. புகைப்படம் அல்லது திரைப்படிவம்.",
  "doc.roster": "பணி அட்டவணை அல்லது நேரப்பட்டியல்",
  "doc.roster.hint": "உங்கள் பணி நேரங்கள் — அட்டவணை, நேரப்பட்டியல், அல்லது WhatsApp திரைப்படிவம்.",
  "doc.ket": "முக்கிய வேலைவாய்ப்பு விதிமுறைகள்",
  "doc.ket.hint": "நீங்கள் ஒப்புக்கொண்ட விதிமுறைகள், உங்களிடம் இருந்தால்.",
  "ctl.readAloud": "இதை ஒலியாகப் படி",
  "ctl.readAloud.stop": "படிப்பதை நிறுத்து",

  "home.tagline": "உங்கள் சம்பளம் சரியாகக் கூட்டப்பட்டதா — இல்லையெனில், அதற்குப் பிறகு என்ன?",
  "home.cta": "உங்கள் சம்பளச் சீட்டைச் சரிபார் →",
  "home.loading": "மாதிரி தரவு ஏற்றப்படுகிறது…",
  "home.running": "என்ஜின்கள் இயங்குகின்றன…",
  "home.unreachable": "என்ஜின்களை அணைய முடியவில்லை.",
  "home.cpf.heading": "CPF, CPF Board வெளியிட்ட விகிதங்கள் படி",
  "home.cpf.total": "மொத்தம்",
  "home.cpf.employee": "ஊழியர்",
  "home.cpf.employer": "முதலாளி",
  "home.cpf.difference": "வேறுபாடு",
  "home.cpf.salaryPeriod": "சம்பளக் காலகட்டம்",
  "home.nothingCalculated": "இந்த மாதத்திற்கு எதுவும் கணக்கிடப்படவில்லை.",

  "result.difference": "சரிபார்க்கப்படாத கூடுதல் வித்தியாசம்",
  "result.expectedGross": "எதிர்பார்க்கப்பட்ட மொத்தம்",
  "result.deductions": "சம்பளச் சீட்டில் உள்ள பிடித்தங்கள்",
  "result.expectedNet": "எதிர்பார்க்கப்பட்ட நிகரத் தொகை",
  "result.reachedBank": "வங்கிக்கு வந்தது",
  "result.whereFrom": "ஒவ்வொரு டாலரும் எங்கிருந்து வருகிறது",
  "result.flags": "குறியீடுகள்",

  "check.title": "உங்கள் சம்பளம் சரியாகக் கூட்டப்பட்டதா?",
  "check.intro":
    "இரண்டு வாசகர்கள் உங்கள் ஆவணங்களை தனித்தனியாக படிக்கிறார்கள். அவர்கள் ஒத்துப்போகும் இடத்தை நாங்கள் சொல்கிறோம். ஒத்துப்போகாத இடத்தை நீங்கள் தீர்மானிக்கிறீர்கள். மேலும் சில விஷயங்களை எந்த ஆவணமும் சொல்ல முடியாது — அவற்றை நாங்கள் உங்களிடமே கேட்கிறோம்.",
  "check.docsHeading": "உங்கள் ஆவணங்கள்",
  "check.read": "எனது ஆவணங்களைப் படி",
  "check.readersHeading": "உங்கள் ஆவணங்களை யார் படித்தார்கள்",
  "check.answered": "பதிலளித்து",
  "check.didNotAnswer": "பதிலளிக்கவில்லை",
  "check.fromCache": "தேக்கத்திலிருந்து",

  "group.readHeading": "உங்கள் ஆவணங்களில் இருந்து படிக்கப்பட்டது",
  "group.workerHeading": "இவற்றுக்கு நீங்கள் மட்டுமே பதிலளிக்க முடியும்",
  "group.mostImportant": "மிக முக்கியமானது",
  "group.forCpf": "CPF சரிபார்ப்புக்கு",
  "field.rightFigure": "சரியான எண் என்ன?",

  "status.AGREED": "இரு வாசகர்களும் ஒத்துக்கொள்கின்றனர்",
  "status.DISAGREED": "வாசகர்கள் மாறுபடுகின்றனர்",
  "status.MISSING": "நிலைநிறுத்தப்படவில்லை",
  "status.HUMAN_CONFIRMED": "நீங்கள் பதிலளித்தீர்கள்",

  "gate.compute": "இந்த மாதம் எவ்வளவு வழங்கப்பட்டிருக்க வேண்டும் என்பதைக் கணக்கிடு",

  "footer.outside": "FairSlip சரிபார்க்காதவை",
  "footer.engines": "என்ஜின்கள்",

  "a11y.region": "முடிவுகள்",
  "home.scaleLink": "FairSlip யாருக்காக, விதிகளாக →",

  "scale.title": "FairSlip யாருக்காக",
  "scale.back": "← FairSlip",
  "scale.loading": "என்ஜின்கள் என்ன உள்ளடக்குகின்றன என்று கேட்கிறது…",
  "scale.unreachable": "என்ஜின்களை அணுக முடியவில்லை; ஆகவே இந்தப் பக்கம் எதையும் கூறவில்லை.",
  "scale.packs": "இரண்டு விதித் தொகுப்புகள்",
  "scale.covers": "யாருக்காக",
  "scale.thresholds": "என்ஜின் வைத்திருக்கும் வரம்புகள்",
  "scale.encoded": "எழுதப்பட்ட விதிகள்",
  "scale.readFrom": "எங்கிருந்து படிக்கப்பட்டது",
  "scale.cpf": "யார் CPF உறுப்பினர் — ஒவ்வொரு நிலையாக என்ஜினிடம் கேட்டது",
  "scale.whatTheEngineDid": "CPF என்ஜின் செய்தது",
  "scale.outcome.CONTRIBUTES": "பங்களிப்பு கணக்கிடப்பட்டது",
  "scale.outcome.NOT_A_MEMBER": "CPF உறுப்பினர் அல்ல",
  "scale.outcome.REFUSED": "மறுத்தல்: விதி எழுதப்படவில்லை",
  "scale.notEncoded": "FairSlip செய்யாதவை, மற்றும் ஒவ்வொன்றும் எப்படி தெரிகிறது",
  "scale.kind.REFUSED_BY_ENGINE": "என்ஜின் இதை மறுக்கிறது",
  "scale.kind.NO_INPUT_EXISTS": "இதற்கு உள்ளீட்டுப் புலம் கிடையாது",
  "scale.kind.STATED_NOT_CHECKED": "கூறப்பட்டது, இந்தப் பக்கத்தில் நிரூபிக்கப்படவில்லை",
  "scale.howKnown": "இது எப்படி தெரிகிறது",
  "scale.interface": "FairSlip இன்டர்பேஸ் எவ்வளவு மொழிபெயர்க்கப்பட்டது",
  "scale.questions": "தொழிலாளியிடம் கேட்கும் ஆறு கேள்விகள்",
  "scale.uiStrings": "இன்டர்பேசின் மீதம், அகராதியிலிருந்து எண்ணப்பட்டது",
  "scale.translatedOf": "{total}-இல் {done} மொழிபெயர்க்கப்பட்டது",
  "scale.serverText":
    "மேலே உள்ள எண்ணிக்கை இந்த இன்டர்பேசின் சொந்த வார்த்தைகளுக்கானது. என்ஜின்கள் அனுப்பும் வாக்கியங்கள் — மறுத்தலின் காரணங்கள், சூத்திரங்கள், இந்தப் பக்கத்தில் உள்ள விளக்கங்கள் — ஆங்கிலத்தில் வருகின்றன, அவை அதில் சேர்க்கப்படவில்லை.",
  "chart.reconciliation": "இந்த மாதம் எப்படிக் கூடுகிறது",
  "chart.toScale":
    "ஒவ்வொரு கம்பியும் ஒரே அளவில் வரையப்பட்டுள்ளது, அருகிலுள்ள எண்ணிலிருந்து. அதை உருவாக்கிய சூத்திரத்தைக் காண கம்பியைத் தட்டவும்.",
  "chart.cpfOverlap": "பணம் எங்கே போனது — இரண்டிலும் சேரும் பகுதி",
  "chart.cpfUndrawable":
    "CPF பிரிவு இங்கு வரையப்படவில்லை: இந்த வரைபடத்திற்குத் தேவையான ஒவ்வொரு வரியையும் இயந்திரம் திருப்பி அளிக்கவில்லை; ஒரு பகுதி விடுபட்ட கம்பியும் முழுமையாகவே தெரியும்.",

};

const DICT: Record<Lang, Partial<Record<Key, string>>> = { en, zh, bn, ta };

export type Translated = {
  /** The string to render. */
  text: string;
  /** False when `text` is the English fallback, not a translation. */
  translated: boolean;
};

/**
 * Look a key up. Returns whether the result is a TRANSLATION or the English
 * fallback, because the screen has to mark the difference - a caller cannot be
 * given a bare string and be expected to remember.
 */
export function lookup(lang: Lang, key: Key, vars?: Record<string, string | number>): Translated {
  const hit = DICT[lang][key];
  const text = hit ?? en[key];
  const filled = vars
    ? Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), text)
    : text;
  return { text: filled, translated: lang === "en" || hit !== undefined };
}

/** How complete each language is. Reported on the switcher, not estimated. */
export function coverage(lang: Lang): { done: number; total: number } {
  const total = Object.keys(en).length;
  return { done: lang === "en" ? total : Object.keys(DICT[lang]).length, total };
}
