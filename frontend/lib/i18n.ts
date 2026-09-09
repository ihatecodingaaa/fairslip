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
  /* ---------------------------------------------------------------- the shell */
  "nav.home": "FairSlip - home",
  "nav.skip": "Skip to the main content",
  "nav.worker": "Worker",
  "nav.workerHint": "after payday",
  "nav.employer": "Employer",
  "nav.employerHint": "before payday",
  "nav.coverage": "What FairSlip checks",
  "nav.display": "Display",
  "nav.displayOpen": "Language, text size and contrast",

  /* -------------------------------------------------------------- the landing */
  "home.promise": "Every dollar has a trail.",
  "home.lede":
    "FairSlip reconstructs what MOM's and CPF Board's published rules say a month should have paid, from a payslip and a roster a worker already has. The same rules read an employer's payroll file the day before payday.",
  "home.ctaWorker": "Check my pay",
  "home.ctaEmployer": "Check payroll before payday",
  "home.engine": "One rule engine",
  "home.engineWhat": "MOM's Employment Act rules and CPF Board's published rates, in code",
  "home.sideWorkerWhat": "Reconstruct the month from evidence you already have.",
  "home.sideEmployerWhat": "Catch the difference while it is still free to fix.",
  "home.pipeline": "How a figure is arrived at",
  "home.pipelineNote":
    "This is the actual path a number takes through FairSlip, and it is the same diagram the worker screen draws with your own figures on it.",
  "home.secondary": "AI reads. Code calculates. You confirm.",
  "home.examples": "Worked examples",
  "home.examplesWhy":
    "Three invented months, run through both engines just now. The third is refused on purpose: its overtime hours were not established, so nothing is calculated for it.",
  "home.exampleShow": "Show the figures",
  "home.exampleHide": "Hide the figures",

  /* ------------------------------------------------------ the trail, and its layers */
  /* These six names are used twice on purpose: once on the landing page, to say
     what the system does, and once on the worker's own screen, as the column
     headings of their own trail. Two names for one thing would be two things. */
  "trail.you": "You",
  "trail.youAnswers": "your answers",
  "trail.ifChanged": "if changed",
  "trail.lineGone": "no longer applies",
  "trail.layer.documents": "Documents",
  "trail.layer.readers": "Two readers",
  "trail.layer.facts": "Established facts",
  "trail.layer.rules": "Published rules",
  "trail.layer.money": "Money",
  "trail.layer.difference": "Difference",
  "home.step.documents": "A payslip, a roster, the terms you agreed to.",
  "home.step.readers": "Two models from two vendors read the same images, separately.",
  "home.step.facts": "A field counts only if both agreed, or you confirmed it.",
  "home.step.rules": "Code does the arithmetic, and refuses inputs it cannot use.",
  "home.step.money": "Every amount keeps the facts it was built from.",
  "home.step.difference": "What the rules give, against what reached the bank.",

  "trail.heading": "The money trail",
  "trail.blurb":
    "Every box below is something FairSlip established, and every line between them is a fact one of the engines recorded using. Choose any box to see what it rests on.",
  "trail.selectPrompt": "Choose any box in the trail.",
  "trail.tracing": "Showing what {label} rests on",
  "trail.clearTrace": "Show the whole trail",
  "trail.edgesNote":
    "The lines are drawn from what each amount recorded as its own inputs. Nothing here holds a list of what depends on what.",

  /* ------------------------------------------------------------- the inspector */
  "lens.heading": "How this was worked out",
  "lens.status": "Status",
  "lens.source": "Where this came from",
  "lens.readerSaid": "What each reader said",
  "lens.usedBy": "Used by",
  "lens.builtFrom": "Built from",
  "lens.howLines": "How these lines were drawn",
  "lens.formula": "Formula",
  "lens.role.payslip": "Given to both readers",
  "lens.notRead": "answered nothing",
  "lens.whatIf": "What if this were different?",
  "lens.newValue": "New value",
  "lens.rerun": "Re-run the engine",
  "lens.rerunning": "Re-running…",
  "lens.hypothetical": "Hypothetical - one fact changed",
  "lens.clearHypothetical": "Clear this hypothetical",
  "lens.movedCount": "{n} moved",
  "lens.heldCount": "{n} did not",
  "stage.progress": "Where you are",
  "stage.evidence": "Evidence",
  "stage.establish": "Establish",
  "stage.reconcile": "Reconcile",
  "stage.act": "Act",
  "stage.reached": "reached",
  "stage.notReached": "not yet",
  "evidence.heading": "Your evidence",
  "evidence.sub": "Add what you have. A payslip is enough to start.",
  "evidence.required": "Required",
  "evidence.optional": "Optional",
  "evidence.privacy": "Read once · not stored",
  "evidence.whatEach": "What each document is, and what happens to it",
  "flow.heading": "From your evidence to a figure",
  "flow.readers": "Two readers",
  "flow.establish": "Establish facts",
  "flow.check": "Check pay",
  "flow.notStarted": "not started",
  "evidence.blurb":
    "A photograph is enough. Nothing is stored: the images are read inside this one request and dropped.",
  "evidence.replace": "Replace",
  "evidence.choose": "Add",
  "evidence.chosen": "Ready",
  "evidence.noneYet": "No photo chosen yet",
  "evidence.preview": "What you chose",
  "evidence.readingNow": "Reading, independently",
  "establish.heading": "What was established, and what was not",
  "establish.oneAnswered": "One reader returned a value. The other did not establish one.",
  "establish.bothAnswered": "Both readers read the same value.",
  "establish.disagreed": "The readers read different values. FairSlip does not pick between them.",
  "establish.youAnswered": "You settled this.",
  "establish.onlyYou": "Only you can establish these",
  "establish.factsFound": "{n} facts found",
  "establish.established": "Established",
  "establish.needYou": "Need you",
  "establish.confirm": "Confirm {v}",
  "establish.enterAnother": "Enter another value",
  "establish.readerDetails": "View exactly what both readers returned",
  "establish.whyAsk": "Why FairSlip asks this",
  "establish.payslipNet": "The payslip's net",
  "establish.bankNet": "What reached your bank",
  "establish.notRead": "FairSlip does not read this",
  "establish.differentFacts": "Two different facts, one name.",
  "establish.restNotAskedReaders":
    "Not asked — both readers agree no hours were worked on a rest day, so MOM’s rest-day table does not apply.",
  "establish.restNotAskedYou":
    "Not asked — you told us no hours were worked on a rest day, so MOM’s rest-day table does not apply.",
  "establish.restUnknown":
    "Not asked yet. Answer “Hours worked on a rest day” above and this appears if it applies.",
  "establish.restUnknownWhy":
    "Whether a rest day was worked is not established. That is not the same as the documents showing no rest day, and FairSlip will not treat it as though it were.",
  "establish.netPaidWhy":
    "A payslip prints a net figure. What the engine needs is the amount that reached the bank. Those are two different facts with one name, and only you can settle the second.",
  "reconcile.trace": "Trace this amount",
  "reconcile.arithmetic": "The arithmetic, line by line",
  "reconcile.rulesGive": "What the published rules give",
  "reconcile.reachedBank": "What reached the bank",

  /* --------------------------------------------------------------- the employer */
  "employer.constellation": "Every row in the file",
  "employer.constellationNote":
    "One mark per row, in the order the file lists them. Shape carries the outcome, so it survives greyscale, a projector and a photocopy.",
  "employer.matched": "matched the published rates",
  "employer.exception": "differs from the published rates",
  "employer.notChecked": "not checked",
  "employer.filterAll": "All rows",
  "employer.rowSelected": "Row {n}",
  "employer.pickRow": "Choose a mark to see the row behind it.",
  "employer.keyboardHint": "Use the arrow keys to move between rows.",

  /* The state machine and the mandate ladder. Node names are the machine's own
     enum values and are never translated - they are its vocabulary. */
  "machine.heading": "What the agent may do next, and what it may not",
  "machine.verdicts": "Verdicts of the check",
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
  "readers.fields": "fields read",
  "readers.sameInput": "The same two images, and the same list of fields",
  "readers.noLink": "no link",
  "readers.reconciled": "Reconciled by code, not by a model",

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
  "result.stale": "An answer below has changed since these figures were worked out.",
  "result.staleAction": "Work them out again",

  "check.title": "Does your pay add up?",
  "check.intro":
    "Two readers transcribe your documents independently. Where they agree, we say so. Where they do not, you decide. And some things no document can tell us — those we ask you.",
  "check.read": "Read my evidence",
  "check.reading": "Both readers are reading…",
  "check.needPayslip": "A payslip is needed before we can read.",
  "check.readersHeading": "Who read your documents",
  "check.answered": "answered",
  "check.didNotAnswer": "did not answer",
  "check.fromCache": "from cache",
  "check.calledLive": "called live",
  "check.fellBackToCache": "live call failed - replayed from cache",
  "check.nothingRead": "nothing was read",
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
  "field.cpfOnlyNote":
    "This one is for the CPF check, which FairSlip does not run on this screen, so it does not hold up your figures.",

  "status.AGREED": "both readers agree",
  /* The one-word forms, for the money trail's nodes. Same four states, same
     distinctness rule - a dense diagram gets a label, not a sentence. */
  "status.short.AGREED": "agreed",
  "status.short.DISAGREED": "differ",
  "status.short.MISSING": "not set",
  "status.short.HUMAN_CONFIRMED": "yours",
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
  "gate.stale":
    "You changed an answer after these figures were worked out. The figures above are still the earlier ones until you work them out again.",

  "footer.outside": "Outside what FairSlip checks",
  "footer.outsideBody":
    "Daily and piece-rated workers; public-holiday pay; shift-work averaging; CPF on monthly wages of $750 or less; PR year 1 and 2 CPF rates; Additional Wages; platform workers; domestic workers; and any question of legal liability. Where an input falls outside these rules the engines refuse rather than approximate.",
  "footer.notADetermination":
    "Figures are reconstructed from MOM’s and CPF Board’s published rules and are not a determination of any kind. Check with MOM, TADM or CPF Board.",
  "footer.engines": "Engines at",

  "a11y.resultReady": "The reconciliation is ready.",
  "a11y.readersLanded": "Both readers have answered. Their readings are below.",
  "scale.title": "Who FairSlip is for",
  "scale.loading": "Asking the engines what they cover…",
  "scale.unreachable": "The engines could not be reached, so this page states nothing.",
  "scale.packs": "The two rule packs",
  "scale.covers": "Who it is for",
  "scale.thresholds": "Thresholds the engine holds",
  "scale.encoded": "Rules encoded",
  "scale.readFrom": "Read from",
  "scale.cpf": "Who is a CPF member, asked of the engine one status at a time",
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
  "chart.differenceNegative":
    "The amount recorded as reaching the bank is higher than the reconstructed expected net, so this row has no length to draw.",
} as const;

export type Key = keyof typeof en;

/* ------------------------------------------------------- Mandarin Chinese */
const zh: Partial<Record<Key, string>> = {
  "nav.home": "FairSlip — 首页",
  "nav.skip": "跳到主要内容",
  "nav.worker": "工人",
  "nav.workerHint": "发薪之后",
  "nav.employer": "雇主",
  "nav.employerHint": "发薪之前",
  "nav.coverage": "FairSlip 检查什么",
  "nav.display": "显示",
  "nav.displayOpen": "语言、字体大小与对比度",

  "home.promise": "每一元钱都有来路。",
  "home.lede":
    "FairSlip 依据人力部和公积金局公布的规则，从工人手上已有的工资单和排班表，重建这个月本应支付的金额。同一套规则也能在发薪前一天读取雇主的薪资文件。",
  "home.ctaWorker": "检查我的工资",
  "home.ctaEmployer": "在发薪前检查薪资表",
  "home.engine": "同一个规则引擎",
  "home.engineWhat": "人力部《雇佣法》规则与公积金局公布的缴费率，写成代码",
  "home.sideWorkerWhat": "用你手上已有的凭据重建这个月。",
  "home.sideEmployerWhat": "在错误还能免费更正时就发现差额。",
  "home.pipeline": "一个数字是怎么得出来的",
  "home.pipelineNote":
    "这就是数字在 FairSlip 内部真正走过的路径；工人页面画的是同一张图，只是上面是你自己的数字。",
  "home.secondary": "AI 阅读。代码计算。你来确认。",
  "home.examples": "示例演算",
  "home.examplesWhy":
    "三个虚构的月份，刚刚由两套引擎实际算过。第三个是故意被拒绝的：它的加班工时未能确立，所以什么都没有计算。",
  "home.exampleShow": "显示数字",
  "home.exampleHide": "隐藏数字",

  "trail.you": "你",
  "trail.youAnswers": "你的回答",
  "trail.ifChanged": "若改变",
  "trail.lineGone": "不再适用",
  "trail.layer.documents": "文件",
  "trail.layer.readers": "两个阅读模型",
  "trail.layer.facts": "已确立的事实",
  "trail.layer.rules": "公布的规则",
  "trail.layer.money": "金额",
  "trail.layer.difference": "差额",
  "home.step.documents": "一张工资单、一份排班表、你同意的条款。",
  "home.step.readers": "来自两家供应商的两个模型，各自独立读取同样的图像。",
  "home.step.facts": "只有两者一致、或你确认过的字段才算成立。",
  "home.step.rules": "由代码做算术，遇到无法使用的输入就拒绝。",
  "home.step.money": "每个金额都保留着它由哪些事实算出。",
  "home.step.difference": "规则得出的金额，对比实际到账的金额。",

  "trail.heading": "金额的来路",
  "trail.blurb":
    "下面每个方框都是 FairSlip 确立过的东西，方框之间的每条线都是某个引擎记录下自己用过的事实。点选任一方框，看看它依据什么。",
  "trail.selectPrompt": "请点选来路图中的任一方框。",
  "trail.tracing": "正在显示 {label} 依据什么",
  "trail.clearTrace": "显示完整来路",
  "trail.edgesNote":
    "这些线来自每个金额自己记录的输入项。这里没有任何一份「什么依赖什么」的清单。",

  "lens.heading": "这是怎么算出来的",
  "lens.status": "状态",
  "lens.source": "这是从哪里来的",
  "lens.readerSaid": "每个阅读模型说了什么",
  "lens.usedBy": "被用于",
  "lens.builtFrom": "由此算出",
  "lens.howLines": "这些线是怎么画出来的",
  "lens.formula": "算式",
  "lens.role.payslip": "同时交给两个阅读模型",
  "lens.notRead": "未给出任何答案",
  "lens.whatIf": "如果这个数字不同呢？",
  "lens.newValue": "新的数值",
  "lens.rerun": "重新运行引擎",
  "lens.rerunning": "重新运行中…",
  "lens.hypothetical": "假设情况 — 改动了一个事实",
  "lens.clearHypothetical": "清除这个假设",
  "lens.movedCount": "{n} 项变了",
  "lens.heldCount": "{n} 项没变",
  "stage.progress": "你在哪一步",
  "stage.evidence": "凭据",
  "stage.establish": "确立",
  "stage.reconcile": "对账",
  "stage.act": "接下来",
  "stage.reached": "已完成",
  "stage.notReached": "尚未",
  "evidence.heading": "你的证据",
  "evidence.sub": "有什么就加什么。一张工资单就足以开始。",
  "evidence.required": "必需",
  "evidence.optional": "可选",
  "evidence.privacy": "只读取一次 · 不保存",
  "evidence.whatEach": "每份文件是什么，以及它会怎样被处理",
  "flow.heading": "从你的证据到一个数字",
  "flow.readers": "两个阅读模型",
  "flow.establish": "确立事实",
  "flow.check": "核对薪资",
  "flow.notStarted": "尚未开始",
  "evidence.blurb":
    "一张照片就够。任何东西都不会被保存：图像在这一次请求内被读取，然后丢弃。",
  "evidence.replace": "更换",
  "evidence.choose": "添加",
  "evidence.chosen": "已就绪",
  "evidence.noneYet": "尚未选择照片",
  "evidence.preview": "你选择的内容",
  "evidence.readingNow": "正在各自独立读取",
  "establish.heading": "哪些已经确立，哪些没有",
  "establish.oneAnswered": "一个阅读模型给出了数值，另一个没有确立任何数值。",
  "establish.bothAnswered": "两个阅读模型读到同样的数值。",
  "establish.disagreed": "两个阅读模型读到不同的数值。FairSlip 不会替你在两者之间选择。",
  "establish.youAnswered": "这一项由你确定。",
  "establish.onlyYou": "这些只有你能确立",
  "establish.factsFound": "找到 {n} 项事实",
  "establish.established": "已确立",
  "establish.needYou": "需要你回答",
  "establish.confirm": "确认 {v}",
  "establish.enterAnother": "输入其他数值",
  "establish.readerDetails": "查看两个阅读模型各自返回的原始内容",
  "establish.whyAsk": "FairSlip 为什么问这一项",
  "establish.payslipNet": "工资单上的净额",
  "establish.bankNet": "实际到你银行的金额",
  "establish.notRead": "FairSlip 不读取这一项",
  "establish.differentFacts": "两个不同的事实，同一个名称。",
  "establish.restNotAskedReaders": "未询问 — 两个阅读模型都认为休息日没有工作时数，因此人力部的休息日表格不适用。",
  "establish.restNotAskedYou": "未询问 — 你告诉我们休息日没有工作时数，因此人力部的休息日表格不适用。",
  "establish.restUnknown": "尚未询问。请先回答上面的「休息日工作时数」，如果适用，这一项就会出现。",
  "establish.restUnknownWhy": "是否在休息日工作过尚未确立。这与文件显示没有休息日并不是一回事，FairSlip 不会把两者当成同一件事。",
  "establish.netPaidWhy":
    "工资单会印出一个净额。引擎需要的是真正到账的金额。这是两个同名而不同的事实，而后者只有你能确定。",
  "reconcile.trace": "追溯这笔金额",
  "reconcile.arithmetic": "逐行的算式",
  "reconcile.rulesGive": "公布的规则得出",
  "reconcile.reachedBank": "实际到账",

  "employer.constellation": "文件中的每一行",
  "employer.constellationNote":
    "每行一个标记，顺序与文件一致。结果由形状表示，所以在灰度、投影和复印件上都不会丢失。",
  "employer.matched": "与公布的缴费率一致",
  "employer.exception": "与公布的缴费率不符",
  "employer.notChecked": "未检查",
  "employer.filterAll": "全部行",
  "employer.rowSelected": "第 {n} 行",
  "employer.pickRow": "点选一个标记，查看它背后的那一行。",
  "employer.keyboardHint": "用方向键在各行之间移动。",

  "machine.heading": "代理接下来可以做什么，不可以做什么",
  "machine.verdicts": "核查的判定",
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
  "readers.fields": "已读字段",
  "readers.sameInput": "同样的两张图片，同样的字段清单",
  "readers.noLink": "无连接",
  "readers.reconciled": "由代码核对，而非由模型核对",

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
  "result.stale": "算出这些数字之后，下面有一个答案被改动过。",
  "result.staleAction": "重新算一次",

  "check.title": "你的工资对得上吗？",
  "check.intro":
    "两个阅读模型各自独立地转写你的文件。它们一致时，我们会说明。它们不一致时，由你决定。还有一些事情任何文件都无法告诉我们——那些我们会问你。",
  "check.read": "读取我的证据",
  "check.reading": "两个阅读模型正在阅读…",
  "check.needPayslip": "需要一张工资单才能开始阅读。",
  "check.readersHeading": "谁阅读了你的文件",
  "check.answered": "已回答",
  "check.didNotAnswer": "未回答",
  "check.fromCache": "来自缓存",
  "check.calledLive": "实时调用",
  "check.fellBackToCache": "实时调用失败，改用缓存",
  "check.nothingRead": "未读取到任何内容",
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
  "field.cpfOnlyNote":
    "这一项是给公积金检查用的，FairSlip 在本页并不运行那项检查，所以它不会拖住你的数字。",

  "status.AGREED": "两个阅读模型一致",
  "status.short.AGREED": "一致",
  "status.short.DISAGREED": "不一致",
  "status.short.MISSING": "未确立",
  "status.short.HUMAN_CONFIRMED": "你答的",
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
  "gate.stale":
    "算出这些数字之后，你改动了一个答案。在重新算一次之前，上面的数字仍是先前那次的。",

  "footer.outside": "FairSlip 不检查的范围",
  "footer.notADetermination":
    "所有数字均根据人力部和公积金局公布的规则重建，不构成任何形式的认定。请向人力部、TADM 或公积金局查证。",
  "footer.engines": "引擎位于",

  "a11y.resultReady": "对账结果已准备好。",
  "a11y.readersLanded": "两个阅读模型均已回答。它们的读取结果列在下方。",
  "scale.title": "FairSlip 服务哪些人",
  "scale.loading": "正在询问引擎它们涵盖的范围…",
  "scale.unreachable": "无法连接引擎，因此本页不作任何说明。",
  "scale.packs": "两套规则",
  "scale.covers": "适用于谁",
  "scale.thresholds": "引擎保存的阈值",
  "scale.encoded": "已编入的规则",
  "scale.readFrom": "出处",
  "scale.cpf": "谁是公积金会员：逐一询问引擎的结果",
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
  "chart.toScale": "所有条形使用同一比例，长度来自旁边的数字。点按条形可看产生它的算式。",
  "chart.cpfOverlap": "钱去了哪里 — 以及两边重叠的部分",
  "chart.cpfUndrawable":
    "此处不绘制公积金拆分：引擎并未返回本图所需的每一行，而缺少一段的条形看起来仍然是完整的。",
  "chart.differenceNegative":
    "记录为到账的金额高于依规则重建的应付净额，所以这一行没有可画的长度。",

};

/* ------------------------------------------------------------------ Bengali */
const bn: Partial<Record<Key, string>> = {
  "nav.home": "FairSlip — শুরুর পাতা",
  "nav.skip": "মূল অংশে যান",
  "nav.worker": "কর্মী",
  "nav.workerHint": "বেতনের পরে",
  "nav.employer": "নিয়োগকর্তা",
  "nav.employerHint": "বেতনের আগে",
  "nav.coverage": "FairSlip কী কী দেখে",
  "nav.display": "প্রদর্শন",
  "nav.displayOpen": "ভাষা, লেখার আকার ও বৈসাদৃশ্য",

  "home.promise": "প্রতিটি ডলারের একটি পথ আছে।",
  "home.lede":
    "MOM ও CPF Board-এর প্রকাশিত নিয়ম অনুসারে এই মাসে কত দেওয়া উচিত ছিল, FairSlip সেটি আবার হিসাব করে — কর্মীর হাতে ইতিমধ্যেই থাকা বেতন স্লিপ আর রোস্টার থেকে। একই নিয়ম দিয়ে বেতনের ঠিক আগের দিন নিয়োগকর্তার পে-রোল ফাইলও পড়া যায়।",
  "home.ctaWorker": "আমার বেতন পরীক্ষা করুন",
  "home.ctaEmployer": "বেতনের আগে পে-রোল যাচাই করুন",
  "home.engine": "একটিই নিয়ম-ইঞ্জিন",
  "home.engineWhat": "MOM-এর Employment Act-এর নিয়ম আর CPF Board-এর প্রকাশিত হার, কোডে লেখা",
  "home.sideWorkerWhat": "আপনার হাতে যা আছে, তা থেকেই মাসটি আবার গড়ে তোলা।",
  "home.sideEmployerWhat": "ভুল যতক্ষণ বিনা খরচে শোধরানো যায়, ততক্ষণেই ধরা।",
  "home.pipeline": "একটি সংখ্যা কীভাবে বেরোয়",
  "home.pipelineNote":
    "FairSlip-এর ভেতরে একটি সংখ্যা সত্যিই এই পথেই যায়; কর্মীর পাতায় ঠিক এই ছবিটিই আঁকা হয়, শুধু তাতে আপনার নিজের সংখ্যা থাকে।",
  "home.secondary": "AI পড়ে। কোড হিসাব করে। আপনি নিশ্চিত করেন।",
  "home.examples": "উদাহরণ হিসাব",
  "home.examplesWhy":
    "তিনটি কল্পিত মাস, এইমাত্র দুটি ইঞ্জিনে চালানো। তৃতীয়টি ইচ্ছে করেই অস্বীকার করা হয়েছে: তার ওভারটাইম ঘণ্টা প্রতিষ্ঠিত হয়নি, তাই কিছুই হিসাব করা হয়নি।",
  "home.exampleShow": "সংখ্যাগুলি দেখান",
  "home.exampleHide": "সংখ্যাগুলি লুকান",

  "trail.you": "আপনি",
  "trail.youAnswers": "আপনার উত্তর",
  "trail.ifChanged": "বদলালে",
  "trail.lineGone": "আর প্রযোজ্য নয়",
  "trail.layer.documents": "কাগজপত্র",
  "trail.layer.readers": "দুই পাঠক",
  "trail.layer.facts": "প্রতিষ্ঠিত তথ্য",
  "trail.layer.rules": "প্রকাশিত নিয়ম",
  "trail.layer.money": "টাকা",
  "trail.layer.difference": "পার্থক্য",
  "home.step.documents": "একটি বেতন স্লিপ, একটি রোস্টার, আপনি যে শর্তে রাজি হয়েছিলেন।",
  "home.step.readers": "দুই আলাদা কোম্পানির দুটি মডেল একই ছবি আলাদাভাবে পড়ে।",
  "home.step.facts": "দুজন একমত হলে, বা আপনি নিশ্চিত করলেই একটি ঘর গোনা হয়।",
  "home.step.rules": "হিসাব কোড করে, আর যে ইনপুট কাজে লাগবে না তা অস্বীকার করে।",
  "home.step.money": "প্রতিটি টাকার অঙ্ক মনে রাখে সে কোন কোন তথ্য থেকে এসেছে।",
  "home.step.difference": "নিয়ম যা দেয়, আর ব্যাংকে যা পৌঁছেছে।",

  "trail.heading": "টাকার পথ",
  "trail.blurb":
    "নিচের প্রতিটি বাক্স এমন কিছু যা FairSlip প্রতিষ্ঠিত করেছে, আর বাক্সগুলির মাঝের প্রতিটি রেখা এমন একটি তথ্য যা কোনো ইঞ্জিন নিজে ব্যবহার করেছে বলে লিখে রেখেছে। যে কোনো বাক্স বেছে নিয়ে দেখুন সেটি কিসের উপর দাঁড়িয়ে আছে।",
  "trail.selectPrompt": "পথের যে কোনো একটি বাক্স বেছে নিন।",
  "trail.tracing": "{label} কিসের উপর দাঁড়িয়ে আছে, তা দেখানো হচ্ছে",
  "trail.clearTrace": "পুরো পথ দেখান",
  "trail.edgesNote":
    "রেখাগুলি আঁকা হয়েছে প্রতিটি অঙ্ক নিজের ইনপুট হিসেবে যা লিখে রেখেছে তা থেকে। কোনটি কোনটির উপর নির্ভর করে, তার কোনো তালিকা এখানে নেই।",

  "lens.heading": "এটি কীভাবে বেরোল",
  "lens.status": "অবস্থা",
  "lens.source": "এটি কোথা থেকে এল",
  "lens.readerSaid": "প্রতিটি পাঠক কী বলেছে",
  "lens.usedBy": "কোথায় ব্যবহৃত",
  "lens.builtFrom": "যা থেকে তৈরি",
  "lens.howLines": "এই রেখাগুলি কীভাবে আঁকা হয়েছে",
  "lens.formula": "সূত্র",
  "lens.role.payslip": "দুজন পাঠককেই দেওয়া হয়েছে",
  "lens.notRead": "কোনো উত্তর দেয়নি",
  "lens.whatIf": "এটি অন্য কিছু হলে কী হত?",
  "lens.newValue": "নতুন মান",
  "lens.rerun": "ইঞ্জিন আবার চালান",
  "lens.rerunning": "আবার চলছে…",
  "lens.hypothetical": "অনুমান — একটি তথ্য বদলানো হয়েছে",
  "lens.clearHypothetical": "এই অনুমান মুছে ফেলুন",
  "lens.movedCount": "{n}টি বদলেছে",
  "lens.heldCount": "{n}টি বদলায়নি",
  "stage.progress": "আপনি কোথায় আছেন",
  "stage.evidence": "কাগজ",
  "stage.establish": "প্রতিষ্ঠা",
  "stage.reconcile": "মিলিয়ে দেখা",
  "stage.act": "এরপর",
  "stage.reached": "হয়ে গেছে",
  "stage.notReached": "এখনও নয়",
  "evidence.heading": "আপনার প্রমাণ",
  "evidence.sub": "আপনার কাছে যা আছে যোগ করুন। শুরু করতে একটি বেতন স্লিপই যথেষ্ট।",
  "evidence.required": "আবশ্যক",
  "evidence.optional": "ঐচ্ছিক",
  "evidence.privacy": "একবার পড়া হয় · সংরক্ষণ করা হয় না",
  "evidence.whatEach": "প্রতিটি নথি কী, আর সেটির কী হয়",
  "flow.heading": "আপনার প্রমাণ থেকে একটি সংখ্যা পর্যন্ত",
  "flow.readers": "দুই পাঠক",
  "flow.establish": "তথ্য প্রতিষ্ঠা",
  "flow.check": "বেতন যাচাই",
  "flow.notStarted": "শুরু হয়নি",
  "evidence.blurb":
    "একটি ছবিই যথেষ্ট। কিছুই জমা রাখা হয় না: ছবিগুলি এই একটি অনুরোধের ভেতরেই পড়া হয়, তারপর ফেলে দেওয়া হয়।",
  "evidence.replace": "বদলান",
  "evidence.choose": "যোগ করুন",
  "evidence.chosen": "প্রস্তুত",
  "evidence.noneYet": "এখনও কোনো ছবি বাছা হয়নি",
  "evidence.preview": "আপনি যা বেছেছেন",
  "evidence.readingNow": "আলাদাভাবে পড়া হচ্ছে",
  "establish.heading": "কী প্রতিষ্ঠিত হল, আর কী হল না",
  "establish.oneAnswered": "একজন পাঠক একটি মান দিয়েছে। অন্যজন কোনো মান প্রতিষ্ঠিত করেনি।",
  "establish.bothAnswered": "দুজন পাঠকই একই মান পড়েছে।",
  "establish.disagreed": "পাঠকরা আলাদা মান পড়েছে। FairSlip তাদের মধ্যে বেছে নেয় না।",
  "establish.youAnswered": "এটি আপনি ঠিক করেছেন।",
  "establish.onlyYou": "এগুলি কেবল আপনিই প্রতিষ্ঠিত করতে পারেন",
  "establish.factsFound": "{n}টি তথ্য পাওয়া গেছে",
  "establish.established": "প্রতিষ্ঠিত",
  "establish.needYou": "আপনাকে দরকার",
  "establish.confirm": "{v} নিশ্চিত করুন",
  "establish.enterAnother": "অন্য একটি মান লিখুন",
  "establish.readerDetails": "দুই পাঠক ঠিক কী ফেরত দিয়েছে তা দেখুন",
  "establish.whyAsk": "FairSlip কেন এটি জিজ্ঞাসা করে",
  "establish.payslipNet": "বেতন স্লিপের নিট",
  "establish.bankNet": "আপনার ব্যাংকে যা পৌঁছেছে",
  "establish.notRead": "FairSlip এটি পড়ে না",
  "establish.differentFacts": "দুটি ভিন্ন তথ্য, একটি নাম।",
  "establish.restNotAskedReaders":
    "জিজ্ঞাসা করা হয়নি — দুই পাঠকই একমত যে বিশ্রামের দিনে কোনো ঘণ্টা কাজ হয়নি, তাই MOM-এর বিশ্রামদিন সারণি প্রযোজ্য নয়।",
  "establish.restNotAskedYou":
    "জিজ্ঞাসা করা হয়নি — আপনি জানিয়েছেন বিশ্রামের দিনে কোনো ঘণ্টা কাজ হয়নি, তাই MOM-এর বিশ্রামদিন সারণি প্রযোজ্য নয়।",
  "establish.restUnknown":
    "এখনও জিজ্ঞাসা করা হয়নি। উপরের “বিশ্রামের দিনে কাজ করা ঘণ্টা” উত্তর দিন, প্রযোজ্য হলে এটি দেখা যাবে।",
  "establish.restUnknownWhy":
    "বিশ্রামের দিনে কাজ হয়েছিল কি না তা প্রতিষ্ঠিত হয়নি। এটি নথিতে কোনো বিশ্রামদিন না দেখানোর সমান নয়, আর FairSlip সেটিকে সেভাবে ধরবে না।",
  "establish.netPaidWhy":
    "বেতন স্লিপে একটি নিট অঙ্ক ছাপা থাকে। ইঞ্জিনের দরকার সেই অঙ্ক যা সত্যিই ব্যাংকে পৌঁছেছে। এক নামে দুটি আলাদা তথ্য, আর দ্বিতীয়টি কেবল আপনিই ঠিক করতে পারেন।",
  "reconcile.trace": "এই অঙ্কের পথ দেখুন",
  "reconcile.arithmetic": "লাইনে লাইনে হিসাব",
  "reconcile.rulesGive": "প্রকাশিত নিয়ম যা দেয়",
  "reconcile.reachedBank": "ব্যাংকে যা পৌঁছেছে",

  "employer.constellation": "ফাইলের প্রতিটি সারি",
  "employer.constellationNote":
    "প্রতি সারিতে একটি চিহ্ন, ফাইলের ক্রম অনুসারে। ফলাফল বোঝায় আকৃতি, তাই সাদা-কালোতে, প্রোজেক্টরে এবং ফটোকপিতেও সেটি টেকে।",
  "employer.matched": "প্রকাশিত হারের সঙ্গে মিলেছে",
  "employer.exception": "প্রকাশিত হারের সঙ্গে মেলেনি",
  "employer.notChecked": "পরীক্ষা করা হয়নি",
  "employer.filterAll": "সব সারি",
  "employer.rowSelected": "সারি {n}",
  "employer.pickRow": "একটি চিহ্ন বেছে নিয়ে তার পেছনের সারিটি দেখুন।",
  "employer.keyboardHint": "সারিগুলির মধ্যে যেতে তীর-চিহ্নের কী ব্যবহার করুন।",

  "machine.heading": "এজেন্ট এরপর কী করতে পারে, আর কী পারে না",
  "machine.verdicts": "যাচাইয়ের রায়",
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
  "readers.fields": "পঠিত ক্ষেত্র",
  "readers.sameInput": "একই দুটি ছবি, আর একই ক্ষেত্রের তালিকা",
  "readers.noLink": "কোনো সংযোগ নেই",
  "readers.reconciled": "কোড মিলিয়েছে, কোনো মডেল নয়",

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
  "result.stale": "এই সংখ্যাগুলি বের করার পর নিচের একটি উত্তর বদলেছে।",
  "result.staleAction": "আবার হিসাব করুন",

  "check.title": "আপনার বেতন কি মিলছে?",
  "check.intro":
    "দুজন পাঠক আলাদাভাবে আপনার কাগজপত্র পড়ে। যেখানে তারা একমত, আমরা তা বলি। যেখানে নয়, সিদ্ধান্ত আপনার। আর কিছু বিষয় কোনো কাগজই বলতে পারে না — সেগুলি আমরা আপনাকেই জিজ্ঞাসা করি।",
  "check.read": "আমার প্রমাণ পড়ুন",
  "check.reading": "দুজন পাঠকই পড়ছেন…",
  "check.needPayslip": "পড়া শুরু করতে একটি বেতন স্লিপ প্রয়োজন।",
  "check.readersHeading": "কারা আপনার কাগজপত্র পড়ল",
  "check.answered": "উত্তর দিয়েছে",
  "check.didNotAnswer": "উত্তর দেয়নি",
  "check.fromCache": "ক্যাশ থেকে",
  "check.calledLive": "সরাসরি ডাকা হয়েছে",
  "check.fellBackToCache": "সরাসরি ডাক ব্যর্থ — ক্যাশ থেকে নেওয়া হয়েছে",
  "check.nothingRead": "কিছুই পড়া হয়নি",
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
  "field.cpfOnlyNote":
    "এটি CPF যাচাইয়ের জন্য, যা FairSlip এই স্ক্রিনে চালায় না, তাই এটি আপনার সংখ্যাগুলিকে আটকে রাখে না।",

  "status.AGREED": "দুজন পাঠকই একমত",
  "status.short.AGREED": "একমত",
  "status.short.DISAGREED": "ভিন্ন",
  "status.short.MISSING": "অপ্রতিষ্ঠিত",
  "status.short.HUMAN_CONFIRMED": "আপনার",
  "status.DISAGREED": "পাঠকরা একমত নন",
  "status.MISSING": "প্রতিষ্ঠিত হয়নি",
  "status.HUMAN_CONFIRMED": "আপনি এটির উত্তর দিয়েছেন",

  "gate.compute": "নিয়ম অনুসারে এই মাসে কত দেওয়া উচিত ছিল তা বের করুন",
  "gate.blockedOne": "একটি ফিল্ড এখনও অনুত্তরিত, তাই কোনো হিসাব করা হয়নি:",
  "gate.blockedMany": "{n}টি ফিল্ড এখনও অনুত্তরিত, তাই কোনো হিসাব করা হয়নি:",
  "gate.reasonRead": "পাঠকরা এটি নিষ্পত্তি করতে পারেনি",
  "gate.reasonWorker": "আমরা আপনাকে জিজ্ঞাসা করছি, পাঠককে নয়",
  "gate.stale":
    "এই সংখ্যাগুলি বের করার পরে আপনি একটি উত্তর বদলেছেন। আবার হিসাব না করা পর্যন্ত উপরের সংখ্যাগুলি আগেরগুলিই থাকবে।",

  "footer.outside": "FairSlip যা পরীক্ষা করে না",
  "footer.notADetermination":
    "সংখ্যাগুলি MOM এবং CPF Board-এর প্রকাশিত নিয়ম থেকে পুনঃনির্মিত এবং এগুলি কোনো ধরনের সিদ্ধান্ত নয়। MOM, TADM বা CPF Board-এর সঙ্গে যাচাই করুন।",
  "footer.engines": "ইঞ্জিন আছে",

  "a11y.resultReady": "হিসাব প্রস্তুত।",
  "a11y.readersLanded": "দুজন পাঠকই উত্তর দিয়েছেন। তাদের পঠন নিচে রয়েছে।",
  "scale.title": "FairSlip কাদের জন্য",
  "scale.loading": "ইঞ্জিনগুলো কী কী দেখে তা জিজ্ঞাসা করা হচ্ছে…",
  "scale.unreachable": "ইঞ্জিনে পৌঁছানো যায়নি, তাই এই পাতা কিছুই বলছে না।",
  "scale.packs": "দুই সেট নিয়ম",
  "scale.covers": "কাদের জন্য",
  "scale.thresholds": "ইঞ্জিনে রাখা সীমা",
  "scale.encoded": "যে নিয়মগুলো লেখা আছে",
  "scale.readFrom": "পড়া হয়েছে",
  "scale.cpf": "কে CPF সদস্য — একটি করে মর্যাদা নিয়ে ইঞ্জিনকে জিজ্ঞাসা করা হয়েছে",
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
  "chart.differenceNegative":
    "ব্যাংকে পৌঁছেছে বলে নথিভুক্ত অঙ্কটি নিয়ম থেকে পুনর্গঠিত প্রত্যাশিত নিট-এর চেয়ে বেশি, তাই এই সারিতে আঁকার মতো কোনো দৈর্ঘ্য নেই।",

};

/* -------------------------------------------------------------------- Tamil */
const ta: Partial<Record<Key, string>> = {
  "nav.home": "FairSlip — முதல் பக்கம்",
  "nav.skip": "முதன்மை உள்ளடக்கத்திற்குச் செல்",
  "nav.worker": "தொழிலாளி",
  "nav.workerHint": "சம்பளத்திற்குப் பிறகு",
  "nav.employer": "முதலாளி",
  "nav.employerHint": "சம்பளத்திற்கு முன்",
  "nav.coverage": "FairSlip எதைச் சரிபார்க்கிறது",
  "nav.display": "காட்சி",
  "nav.displayOpen": "மொழி, எழுத்து அளவு மற்றும் வேறுபாடு",

  "home.promise": "ஒவ்வொரு டாலருக்கும் ஒரு தடம் உண்டு.",
  "home.lede":
    "MOM மற்றும் CPF Board வெளியிட்ட விதிகள்படி இந்த மாதம் எவ்வளவு வழங்கப்பட்டிருக்க வேண்டும் என்பதை, தொழிலாளியின் கையில் ஏற்கனவே உள்ள சம்பளச் சீட்டு மற்றும் பணி அட்டவணையிலிருந்து FairSlip மீண்டும் கணக்கிடுகிறது. அதே விதிகள் சம்பள நாளுக்கு முந்தைய நாள் முதலாளியின் சம்பளக் கோப்பையும் படிக்கின்றன.",
  "home.ctaWorker": "என் சம்பளத்தைச் சரிபார்",
  "home.ctaEmployer": "சம்பள நாளுக்கு முன் சம்பளப்பட்டியல் சரிபார்",
  "home.engine": "ஒரே விதி இயந்திரம்",
  "home.engineWhat": "MOM-இன் Employment Act விதிகளும் CPF Board வெளியிட்ட விகிதங்களும், நிரலாக",
  "home.sideWorkerWhat": "உங்கள் கையில் உள்ள சான்றுகளிலிருந்தே மாதத்தை மீண்டும் அமைக்கவும்.",
  "home.sideEmployerWhat": "தவறு இலவசமாகச் சரிசெய்யக்கூடிய நிலையிலேயே வேறுபாட்டைக் கண்டுபிடிக்கவும்.",
  "home.pipeline": "ஒரு எண் எப்படி வருகிறது",
  "home.pipelineNote":
    "FairSlip உள்ளே ஒரு எண் உண்மையில் செல்லும் பாதை இதுவே; தொழிலாளியின் திரையும் இதே படத்தை வரைகிறது, அதில் உங்கள் சொந்த எண்கள் இருக்கும்.",
  "home.secondary": "AI படிக்கிறது. நிரல் கணக்கிடுகிறது. நீங்கள் உறுதிப்படுத்துகிறீர்கள்.",
  "home.examples": "எடுத்துக்காட்டுக் கணக்குகள்",
  "home.examplesWhy":
    "மூன்று கற்பனை மாதங்கள், இப்போதே இரண்டு இயந்திரங்களிலும் ஓட்டப்பட்டவை. மூன்றாவது வேண்டுமென்றே மறுக்கப்படுகிறது: அதன் கூடுதல் நேர மணிகள் நிலைநிறுத்தப்படவில்லை, எனவே எதுவும் கணக்கிடப்படவில்லை.",
  "home.exampleShow": "எண்களைக் காட்டு",
  "home.exampleHide": "எண்களை மறை",

  "trail.you": "நீங்கள்",
  "trail.youAnswers": "உங்கள் பதில்கள்",
  "trail.ifChanged": "மாறினால்",
  "trail.lineGone": "இனி பொருந்தாது",
  "trail.layer.documents": "ஆவணங்கள்",
  "trail.layer.readers": "இரு வாசிப்பாளர்கள்",
  "trail.layer.facts": "நிலைநிறுத்தப்பட்ட உண்மைகள்",
  "trail.layer.rules": "வெளியிடப்பட்ட விதிகள்",
  "trail.layer.money": "பணம்",
  "trail.layer.difference": "வேறுபாடு",
  "home.step.documents": "ஒரு சம்பளச் சீட்டு, ஒரு பணி அட்டவணை, நீங்கள் ஒப்புக்கொண்ட விதிமுறைகள்.",
  "home.step.readers": "இரு வேறு நிறுவனங்களின் இரு மாதிரிகள் அதே படங்களைத் தனித்தனியே படிக்கின்றன.",
  "home.step.facts": "இரண்டும் ஒத்துக்கொண்டாலோ, நீங்கள் உறுதிப்படுத்தினாலோ மட்டுமே ஒரு புலம் கணக்கில் வரும்.",
  "home.step.rules": "நிரல் கணக்கிடுகிறது, பயன்படுத்த முடியாத உள்ளீட்டை மறுக்கிறது.",
  "home.step.money": "ஒவ்வொரு தொகையும் தான் எந்த உண்மைகளிலிருந்து வந்ததோ அதை வைத்திருக்கிறது.",
  "home.step.difference": "விதிகள் தரும் தொகை, வங்கிக்கு வந்த தொகைக்கு எதிராக.",

  "trail.heading": "பணத்தின் தடம்",
  "trail.blurb":
    "கீழே உள்ள ஒவ்வொரு கட்டமும் FairSlip நிலைநிறுத்திய ஒன்று, கட்டங்களுக்கு இடையேயான ஒவ்வொரு கோடும் ஒரு இயந்திரம் தான் பயன்படுத்தியதாகப் பதிவு செய்த ஒரு உண்மை. எந்தக் கட்டத்தையும் தேர்ந்து அது எதன் மேல் நிற்கிறது என்று பாருங்கள்.",
  "trail.selectPrompt": "தடத்தில் ஏதேனும் ஒரு கட்டத்தைத் தேர்ந்தெடுங்கள்.",
  "trail.tracing": "{label} எதன் மேல் நிற்கிறது என்பது காட்டப்படுகிறது",
  "trail.clearTrace": "முழுத் தடத்தையும் காட்டு",
  "trail.edgesNote":
    "ஒவ்வொரு தொகையும் தன் உள்ளீடுகளாகப் பதிவு செய்ததிலிருந்தே கோடுகள் வரையப்படுகின்றன. எது எதைச் சார்ந்தது என்ற பட்டியல் இங்கு எதுவும் இல்லை.",

  "lens.heading": "இது எப்படிக் கணக்கிடப்பட்டது",
  "lens.status": "நிலை",
  "lens.source": "இது எங்கிருந்து வந்தது",
  "lens.readerSaid": "ஒவ்வொரு வாசிப்பாளரும் என்ன சொன்னார்",
  "lens.usedBy": "எங்கே பயன்படுத்தப்பட்டது",
  "lens.builtFrom": "எதிலிருந்து அமைக்கப்பட்டது",
  "lens.howLines": "இந்த வரிகள் எப்படி வரையப்பட்டன",
  "lens.formula": "சூத்திரம்",
  "lens.role.payslip": "இரு வாசிப்பாளர்களுக்கும் தரப்பட்டது",
  "lens.notRead": "எந்தப் பதிலும் தரவில்லை",
  "lens.whatIf": "இது வேறாக இருந்திருந்தால்?",
  "lens.newValue": "புதிய மதிப்பு",
  "lens.rerun": "இயந்திரத்தை மீண்டும் ஓட்டு",
  "lens.rerunning": "மீண்டும் ஓடுகிறது…",
  "lens.hypothetical": "கற்பனை — ஒரு உண்மை மாற்றப்பட்டது",
  "lens.clearHypothetical": "இந்தக் கற்பனையை நீக்கு",
  "lens.movedCount": "{n} மாறியது",
  "lens.heldCount": "{n} மாறவில்லை",
  "stage.progress": "நீங்கள் எங்கே இருக்கிறீர்கள்",
  "stage.evidence": "சான்று",
  "stage.establish": "நிலைநிறுத்தம்",
  "stage.reconcile": "ஒப்பிடல்",
  "stage.act": "அடுத்து",
  "stage.reached": "முடிந்தது",
  "stage.notReached": "இன்னும் இல்லை",
  "evidence.heading": "உங்கள் சான்றுகள்",
  "evidence.sub": "உங்களிடம் உள்ளதைச் சேர்க்கவும். தொடங்க ஒரு சம்பளச் சீட்டு போதும்.",
  "evidence.required": "தேவை",
  "evidence.optional": "விருப்பம்",
  "evidence.privacy": "ஒருமுறை படிக்கப்படும் · சேமிக்கப்படாது",
  "evidence.whatEach": "ஒவ்வொரு ஆவணமும் என்ன, அதற்கு என்ன நடக்கிறது",
  "flow.heading": "உங்கள் சான்றிலிருந்து ஒரு எண் வரை",
  "flow.readers": "இரண்டு வாசகர்கள்",
  "flow.establish": "தகவல்களை நிலைநிறுத்து",
  "flow.check": "ஊதியத்தைச் சரிபார்",
  "flow.notStarted": "தொடங்கவில்லை",
  "evidence.blurb":
    "ஒரு புகைப்படமே போதும். எதுவும் சேமிக்கப்படுவதில்லை: படங்கள் இந்த ஒரு கோரிக்கைக்குள்ளேயே படிக்கப்பட்டு, பின் கைவிடப்படுகின்றன.",
  "evidence.replace": "மாற்று",
  "evidence.choose": "சேர்",
  "evidence.chosen": "தயார்",
  "evidence.noneYet": "இன்னும் படம் எதுவும் தேர்ந்தெடுக்கப்படவில்லை",
  "evidence.preview": "நீங்கள் தேர்ந்தெடுத்தது",
  "evidence.readingNow": "தனித்தனியே படிக்கப்படுகிறது",
  "establish.heading": "எது நிலைநிறுத்தப்பட்டது, எது இல்லை",
  "establish.oneAnswered": "ஒரு வாசிப்பாளர் ஒரு மதிப்பைத் தந்தார். மற்றவர் எந்த மதிப்பையும் நிலைநிறுத்தவில்லை.",
  "establish.bothAnswered": "இரு வாசிப்பாளர்களும் ஒரே மதிப்பைப் படித்தனர்.",
  "establish.disagreed": "வாசிப்பாளர்கள் வேறு மதிப்புகளைப் படித்தனர். FairSlip அவற்றுக்கு இடையே தேர்வு செய்வதில்லை.",
  "establish.youAnswered": "இதை நீங்கள் தீர்மானித்தீர்கள்.",
  "establish.onlyYou": "இவற்றை நீங்கள் மட்டுமே நிலைநிறுத்த முடியும்",
  "establish.factsFound": "{n} தகவல்கள் கிடைத்தன",
  "establish.established": "நிலைநிறுத்தப்பட்டவை",
  "establish.needYou": "உங்கள் பதில் தேவை",
  "establish.confirm": "{v} உறுதிசெய்",
  "establish.enterAnother": "வேறு மதிப்பை உள்ளிடு",
  "establish.readerDetails": "இரு வாசகர்களும் சரியாக என்ன திருப்பியளித்தனர் என்பதைப் பார்",
  "establish.whyAsk": "FairSlip இதை ஏன் கேட்கிறது",
  "establish.payslipNet": "சம்பளச் சீட்டின் நிகரம்",
  "establish.bankNet": "உங்கள் வங்கியை அடைந்தது",
  "establish.notRead": "FairSlip இதைப் படிப்பதில்லை",
  "establish.differentFacts": "இரண்டு வேறுபட்ட தகவல்கள், ஒரே பெயர்.",
  "establish.restNotAskedReaders":
    "கேட்கப்படவில்லை — ஓய்வு நாளில் எந்த மணிநேரமும் வேலை செய்யப்படவில்லை என்பதில் இரு வாசகர்களும் ஒத்துப்போகின்றனர்; எனவே MOM-இன் ஓய்வுநாள் அட்டவணை பொருந்தாது.",
  "establish.restNotAskedYou":
    "கேட்கப்படவில்லை — ஓய்வு நாளில் எந்த மணிநேரமும் வேலை செய்யவில்லை என நீங்கள் தெரிவித்தீர்கள்; எனவே MOM-இன் ஓய்வுநாள் அட்டவணை பொருந்தாது.",
  "establish.restUnknown":
    "இன்னும் கேட்கப்படவில்லை. மேலே உள்ள “ஓய்வு நாளில் வேலை செய்த மணிநேரம்” என்பதற்குப் பதிலளியுங்கள்; பொருந்தினால் இது தோன்றும்.",
  "establish.restUnknownWhy":
    "ஓய்வு நாளில் வேலை செய்யப்பட்டதா என்பது நிலைநிறுத்தப்படவில்லை. ஆவணங்கள் ஓய்வுநாள் இல்லை எனக் காட்டுவதற்கு இது சமமல்ல; FairSlip அதை அப்படிக் கருதாது.",
  "establish.netPaidWhy":
    "சம்பளச் சீட்டு ஒரு நிகர எண்ணை அச்சிடுகிறது. இயந்திரத்திற்குத் தேவை வங்கிக்கு உண்மையில் வந்த தொகை. ஒரே பெயரில் இரு வேறு உண்மைகள், இரண்டாவதை நீங்கள் மட்டுமே தீர்மானிக்க முடியும்.",
  "reconcile.trace": "இந்தத் தொகையின் தடத்தைப் பார்",
  "reconcile.arithmetic": "வரிக்கு வரி கணக்கு",
  "reconcile.rulesGive": "வெளியிடப்பட்ட விதிகள் தருவது",
  "reconcile.reachedBank": "வங்கிக்கு வந்தது",

  "employer.constellation": "கோப்பில் உள்ள ஒவ்வொரு வரி",
  "employer.constellationNote":
    "ஒரு வரிக்கு ஒரு குறி, கோப்பின் வரிசையிலேயே. முடிவை வடிவம் சுமக்கிறது, எனவே கருப்பு-வெள்ளையிலும், திரையிடலிலும், நகலெடுப்பிலும் அது தாங்கும்.",
  "employer.matched": "வெளியிடப்பட்ட விகிதங்களுடன் பொருந்தியது",
  "employer.exception": "வெளியிடப்பட்ட விகிதங்களுடன் பொருந்தவில்லை",
  "employer.notChecked": "சரிபார்க்கப்படவில்லை",
  "employer.filterAll": "எல்லா வரிகளும்",
  "employer.rowSelected": "வரி {n}",
  "employer.pickRow": "ஒரு குறியைத் தேர்ந்து அதன் பின்னுள்ள வரியைப் பாருங்கள்.",
  "employer.keyboardHint": "வரிகளுக்கு இடையே நகர அம்புக் குறி விசைகளைப் பயன்படுத்துங்கள்.",

  "machine.heading": "முகவர் அடுத்து என்ன செய்யலாம், என்ன செய்ய முடியாது",
  "machine.verdicts": "சரிபார்ப்பின் தீர்ப்புகள்",
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
  "readers.fields": "படித்த புலங்கள்",
  "readers.sameInput": "அதே இரண்டு படங்கள், அதே புலப் பட்டியல்",
  "readers.noLink": "இணைப்பு இல்லை",
  "readers.reconciled": "குறியீடு ஒப்பிட்டது, மாதிரி அல்ல",

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
  "result.stale": "இந்த எண்கள் கணக்கிடப்பட்ட பிறகு கீழே ஒரு பதில் மாற்றப்பட்டுள்ளது.",
  "result.staleAction": "மீண்டும் கணக்கிடு",

  "check.title": "உங்கள் சம்பளம் சரியாகக் கூட்டப்பட்டதா?",
  "check.intro":
    "இரண்டு வாசகர்கள் உங்கள் ஆவணங்களை தனித்தனியாக படிக்கிறார்கள். அவர்கள் ஒத்துப்போகும் இடத்தை நாங்கள் சொல்கிறோம். ஒத்துப்போகாத இடத்தை நீங்கள் தீர்மானிக்கிறீர்கள். மேலும் சில விஷயங்களை எந்த ஆவணமும் சொல்ல முடியாது — அவற்றை நாங்கள் உங்களிடமே கேட்கிறோம்.",
  "check.read": "என் சான்றுகளைப் படி",
  "check.readersHeading": "உங்கள் ஆவணங்களை யார் படித்தார்கள்",
  "check.answered": "பதிலளித்து",
  "check.didNotAnswer": "பதிலளிக்கவில்லை",
  "check.fromCache": "தேக்கத்திலிருந்து",
  "check.calledLive": "நேரலையில் அழைக்கப்பட்டது",
  "check.fellBackToCache": "நேரலை அழைப்பு தோல்வி — தேக்கத்திலிருந்து எடுக்கப்பட்டது",
  "check.nothingRead": "எதுவும் படிக்கப்படவில்லை",

  "group.readHeading": "உங்கள் ஆவணங்களில் இருந்து படிக்கப்பட்டது",
  "group.workerHeading": "இவற்றுக்கு நீங்கள் மட்டுமே பதிலளிக்க முடியும்",
  "group.mostImportant": "மிக முக்கியமானது",
  "group.forCpf": "CPF சரிபார்ப்புக்கு",
  "field.rightFigure": "சரியான எண் என்ன?",
  "field.cpfOnlyNote":
    "இது CPF சரிபார்ப்புக்கானது; FairSlip அதை இந்தத் திரையில் இயக்குவதில்லை, எனவே இது உங்கள் எண்களைத் தடுத்து நிறுத்தாது.",

  "status.AGREED": "இரு வாசகர்களும் ஒத்துக்கொள்கின்றனர்",
  "status.short.AGREED": "ஒத்தது",
  "status.short.DISAGREED": "வேறு",
  "status.short.MISSING": "நிலைபெறவில்லை",
  "status.short.HUMAN_CONFIRMED": "உங்களது",
  "status.DISAGREED": "வாசகர்கள் மாறுபடுகின்றனர்",
  "status.MISSING": "நிலைநிறுத்தப்படவில்லை",
  "status.HUMAN_CONFIRMED": "நீங்கள் பதிலளித்தீர்கள்",

  "gate.compute": "இந்த மாதம் எவ்வளவு வழங்கப்பட்டிருக்க வேண்டும் என்பதைக் கணக்கிடு",
  "gate.stale":
    "இந்த எண்கள் கணக்கிடப்பட்ட பிறகு நீங்கள் ஒரு பதிலை மாற்றியுள்ளீர்கள். மீண்டும் கணக்கிடும் வரை மேலே உள்ள எண்கள் பழையவையாகவே இருக்கும்.",

  "footer.outside": "FairSlip சரிபார்க்காதவை",
  "footer.engines": "என்ஜின்கள்",

  "scale.title": "FairSlip யாருக்காக",
  "scale.loading": "என்ஜின்கள் என்ன உள்ளடக்குகின்றன என்று கேட்கிறது…",
  "scale.unreachable": "என்ஜின்களை அணுக முடியவில்லை; ஆகவே இந்தப் பக்கம் எதையும் கூறவில்லை.",
  "scale.packs": "இரண்டு விதித் தொகுப்புகள்",
  "scale.covers": "யாருக்காக",
  "scale.thresholds": "என்ஜின் வைத்திருக்கும் வரம்புகள்",
  "scale.encoded": "எழுதப்பட்ட விதிகள்",
  "scale.readFrom": "எங்கிருந்து படிக்கப்பட்டது",
  "scale.cpf": "யார் CPF உறுப்பினர் — ஒவ்வொரு நிலையாக என்ஜினிடம் கேட்டது",
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
  "chart.differenceNegative":
    "வங்கியை அடைந்ததாகப் பதிவான தொகை, விதிகளிலிருந்து மீளமைக்கப்பட்ட எதிர்பார்க்கப்படும் நிகரத் தொகையை விட அதிகம்; எனவே இந்த வரிசைக்கு வரைவதற்கு நீளம் இல்லை.",

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
