const STORAGE_KEYS = {
  expression: "calc991cn.expression",
  angleMode: "calc991cn.angleMode",
  memory: "calc991cn.memory",
  history: "calc991cn.history",
  shift: "calc991cn.shift",
  mode: "calc991cn.mode",
  tool: "calc991cn.tool",
  matrix: "calc991cn.matrix",
  equation: "calc991cn.equation",
  vector: "calc991cn.vector",
  stats: "calc991cn.stats",
  calculus: "calc991cn.calculus",
  complex: "calc991cn.complex",
  base: "calc991cn.base",
  logic: "calc991cn.logic",
  boolean: "calc991cn.boolean",
  labrec: "calc991cn.labrec",
  dataproc: "calc991cn.dataproc",
  table: "calc991cn.table",
  tools: "calc991cn.tools",
};

const storageTimers = {};
const storagePending = {};
let uiFilterActive = false;

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // 存储不可用（隐私模式或配额已满）时忽略，页面仍可正常计算
  }
}

// 高频输入路径使用防抖写入，避免每个按键都同步序列化并写盘
function persistDebounced(key, value, delay = 250) {
  storagePending[key] = value;
  clearTimeout(storageTimers[key]);
  storageTimers[key] = setTimeout(() => {
    delete storageTimers[key];
    const pending = storagePending[key];
    delete storagePending[key];
    if (typeof pending === "string") writeStorage(key, pending);
  }, delay);
}

function flushStorageWrites() {
  for (const key of Object.keys(storageTimers)) {
    clearTimeout(storageTimers[key]);
    delete storageTimers[key];
  }
  for (const key of Object.keys(storagePending)) {
    const pending = storagePending[key];
    delete storagePending[key];
    if (typeof pending === "string") writeStorage(key, pending);
  }
}

const MODE_LABELS = {
  standard: "标准",
  equation: "方程",
  matrix: "矩阵",
  vector: "向量",
  stats: "统计",
  calculus: "微积分",
  complex: "复数",
  base: "进制",
  logic: "逻辑",
  table: "表格",
  tools: "工具",
};

const TOOL_LABELS = {
  calc: "科学计算器",
  boolean: "布尔化简",
  labrec: "实验记录",
  dataproc: "数据处理",
};

const MODE_HINTS = {
  standard: "标准模式：表达式、常量、函数和记忆运算。",
  equation: "方程模式：线性方程组、多项式方程、不等式、SOLVE 与比例式。",
  matrix: "矩阵模式：2~4 阶矩阵的加减乘、转置、行列式与逆矩阵。",
  vector: "向量模式：三维向量 v1、v2 的加减、点积、叉积、模长与夹角。",
  stats: "统计模式：录入数据后查看均值、方差、标准差和极值。",
  calculus: "微积分模式：数值微分、数值积分与 Σ 求和。",
  complex: "复数模式：进行复数四则运算、共轭、模长和辐角计算。",
  base: "进制模式：在二、八、十、十六进制之间转换。",
  logic: "逻辑模式：AND、OR、NOT、XOR、XNOR 运算。",
  table: "表格模式：输入 f(x)/g(x) 与范围步长，生成函数值表。",
  tools: "工具模式：分数化简、DMS、坐标互转、素因数分解、ENG、随机数、常数与单位换算。",
};

const MAX_STATS_SAMPLES = 10000;

const SCIENTIFIC_KEY_ROWS = [
  [
    { label: "SHIFT", action: "shift", tip: "开启副功能；下一次按键会使用按钮右上角的替代功能。", className: "key key--func" },
    { label: "°", action: "angle", tip: "在 度 / 弧度 / 百分度 之间切换。", className: "key key--func" },
    { label: "MC", action: "mc", tip: "清空内存寄存器。", className: "key key--accent" },
    { label: "MR", action: "mr", tip: "把当前内存值插入到表达式中。", className: "key key--accent" },
    { label: "M+", action: "mplus", tip: "把当前结果加入内存。", className: "key key--accent" },
    { label: "M-", action: "mminus", tip: "把当前结果从内存中减去。", className: "key key--accent" },
  ],
  [
    { label: "sin", action: "sin(", shiftAction: "asin(", secondary: "asin", tip: "输入正弦函数。开启副功能后可输入反正弦。", className: "key key--func" },
    { label: "cos", action: "cos(", shiftAction: "acos(", secondary: "acos", tip: "输入余弦函数。开启副功能后可输入反余弦。", className: "key key--func" },
    { label: "tan", action: "tan(", shiftAction: "atan(", secondary: "atan", tip: "输入正切函数。开启副功能后可输入反正切。", className: "key key--func" },
    { label: "log", action: "log(", shiftAction: "pow10(", secondary: "10^x", tip: "输入常用对数。副功能可输入 10 的幂。", className: "key key--func" },
    { label: "ln", action: "ln(", shiftAction: "exp(", secondary: "e^x", tip: "输入自然对数。副功能可输入 e 的幂。", className: "key key--func" },
    { label: "√", action: "sqrt(", shiftAction: "square(", secondary: "x²", tip: "输入平方根。副功能可快速输入平方。", className: "key key--func" },
  ],
  [
    { label: "π", action: "pi", tip: "插入圆周率 π。", className: "key key--func" },
    { label: "e", action: "e", tip: "插入自然常数 e。", className: "key key--func" },
    { label: "Ans", action: "Ans", tip: "插入上一次计算结果。", className: "key key--func" },
    { label: "(", action: "(", tip: "插入左括号。", className: "key key--func" },
    { label: ")", action: ")", tip: "插入右括号。", className: "key key--func" },
    { label: "⌫", action: "del", tip: "删除表达式最后一个字符。", className: "key key--danger" },
  ],
  [
    { label: "7", action: "7", tip: "输入数字 7。", className: "key" },
    { label: "8", action: "8", tip: "输入数字 8。", className: "key" },
    { label: "9", action: "9", tip: "输入数字 9。", className: "key" },
    { label: "÷", action: "/", tip: "输入除号。", className: "key key--op" },
    { label: "AC", action: "ac", tip: "清空当前表达式。", className: "key key--danger" },
    { label: "^", action: "^", shiftAction: "root(", secondary: "开方", tip: "输入幂运算。副功能可输入开方。", className: "key key--op" },
  ],
  [
    { label: "4", action: "4", tip: "输入数字 4。", className: "key" },
    { label: "5", action: "5", tip: "输入数字 5。", className: "key" },
    { label: "6", action: "6", tip: "输入数字 6。", className: "key" },
    { label: "×", action: "*", tip: "输入乘号。", className: "key key--op" },
    { label: "!", action: "!", shiftAction: "mod(", secondary: "mod", tip: "输入阶乘。副功能可输入取模函数。", className: "key key--op" },
    { label: "=", action: "equals", tip: "执行计算并保存到记录。", className: "key key--tall key--op" },
  ],
  [
    { label: "1", action: "1", tip: "输入数字 1。", className: "key" },
    { label: "2", action: "2", tip: "输入数字 2。", className: "key" },
    { label: "3", action: "3", tip: "输入数字 3。", className: "key" },
    { label: "-", action: "-", tip: "输入减号。", className: "key key--op" },
    { label: "%", action: "%", tip: "输入百分比运算。", className: "key key--op" },
  ],
  [
    { label: "0", action: "0", tip: "输入数字 0。", className: "key key--double" },
    { label: ".", action: ".", tip: "输入小数点。", className: "key" },
    { label: "+/-", action: "negate", tip: "切换当前项的正负号。", className: "key key--func" },
    { label: "+", action: "+", tip: "输入加号。", className: "key key--op" },
    { label: ",", action: ",", tip: "输入函数参数分隔符。", className: "key key--func" },
  ],
];

const state = {
  tool: "calc",
  mode: "standard",
  expression: "",
  preview: "",
  angleMode: "DEG",
  memory: 0,
  history: [],
  shift: false,
  ans: 0,
  justEvaluated: false,
  uiSearch: "",
  matrix: {
    size: 2,
    activeAction: "add",
    matrices: {
      a: createMatrix(2),
      b: createMatrix(2),
      c: createMatrix(2),
      d: createMatrix(2),
    },
    result: "",
    operation: "A + B",
  },
  equation: {
    linearSize: 2,
    linearRows: defaultLinearRows(2),
    activeAction: "solve-linear",
    polyDegree: 2,
    polyCoefficients: [1, 0, 0, 0, 0],
    solveExpression: "x^3 - x - 1",
    solveInitial: "1",
    inequalityDegree: 2,
    inequalityCoefficients: [1, 0, -1, 0, 0],
    inequalitySign: ">=",
    proportion: { a: "1", b: "2", c: "3", d: "?" },
    result: "",
  },
  vector: {
    activeAction: "vector-dot",
    vectors: {
      v1: [1, 0, 0],
      v2: [0, 1, 0],
      v3: [0, 0, 1],
      v4: [1, 1, 1],
    },
    result: "",
  },
  stats: {
    values: [],
    input: "",
    activeAction: "add",
  },
  calculus: {
    expression: "sin(x)",
    variable: "x",
    point: "0",
    order: 1,
    activeAction: "calc-derivative",
    integralExpression: "sin(x)",
    lower: "0",
    upper: "3.1415926",
    sigmaExpression: "n^2",
    sigmaVar: "n",
    sigmaLower: "1",
    sigmaUpper: "10",
    result: "",
  },
  complex: {
    a: { re: 0, im: 0 },
    b: { re: 0, im: 0 },
    operation: "加",
    activeAction: "add",
    result: { re: 0, im: 0 },
  },
  base: {
    input: "1010",
    source: "BIN",
    target: "DEC",
    result: "10",
    activeQuick: "BIN",
  },
  logic: {
    a: "10",
    b: "12",
    base: "DEC",
    activeAction: "logic-and",
    result: "",
  },
  boolean: {
    varText: "A, B, C",
    outCount: 1,
    outNamesText: "",
    variables: ["A", "B", "C"],
    outputNames: ["Y1"],
    rows: [],
    tableReady: false,
    results: null,
    error: "",
    activeAction: "boolean-generate",
  },
  labrec: {
    projects: [],
    activeId: "",
    showCreate: false,
    newName: "",
    newFields: "测量次数, 电压 U/V, 电流 I/A",
    rowDraft: [],
    chartType: "line",
    xCol: -1,
    yCol: 1,
    confirmDelete: false,
    confirmClear: false,
  },
  dataproc: {
    rawInput: "",
    parsed: null,
    chartType: "scatter",
    xCol: 0,
    yCol: 1,
    fitType: "linear",
    fit: null,
    fitError: "",
    error: "",
    activeAction: "dp-analyze",
  },
  table: {
    fx: "x^2",
    gx: "sin(x)",
    start: "0",
    end: "10",
    step: "1",
    activeAction: "table",
    rows: [],
    result: "",
  },
  tools: {
    fractionInput: "42/56",
    dmsInput: "12°30'0\"",
    polarX: "3",
    polarY: "4",
    cartR: "5",
    cartTheta: "53.130102",
    primeInput: "360",
    randMin: "1",
    randMax: "100",
    engInput: "1234567",
    constantKey: "c",
    unitGroup: "length",
    unitFrom: "m",
    unitTo: "km",
    unitInput: "1000",
    activeAction: "fraction",
    result: "",
  },
};

const elements = {
  keypad: document.getElementById("keypad"),
  expressionView: document.getElementById("expressionView"),
  previewView: document.getElementById("previewView"),
  modeChip: document.getElementById("modeChip"),
  modeSubtitle: document.getElementById("modeSubtitle"),
  angleModeChip: document.getElementById("angleModeChip"),
  shiftChip: document.getElementById("shiftChip"),
  memoryChip: document.getElementById("memoryChip"),
  hoverHint: document.getElementById("hoverHint"),
  historyList: document.getElementById("historyList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  uiSearchInput: document.getElementById("uiSearchInput"),
  clearUiSearchBtn: document.getElementById("clearUiSearchBtn"),
  uiSearchStatus: document.getElementById("uiSearchStatus"),
  quickActions: document.querySelector(".quick-actions"),
  modeWorkspace: document.getElementById("modeWorkspace"),
  modeTabs: Array.from(document.querySelectorAll(".mode-tab")),
  toolTabs: Array.from(document.querySelectorAll(".tool-tab")),
  toolPages: {
    calc: document.getElementById("tool-calc"),
    boolean: document.getElementById("tool-boolean"),
    labrec: document.getElementById("tool-labrec"),
    dataproc: document.getElementById("tool-dataproc"),
  },
  toolRoots: {
    boolean: document.getElementById("booleanRoot"),
    labrec: document.getElementById("labrecRoot"),
    dataproc: document.getElementById("dataprocRoot"),
  },
};

// 当前激活的工作区容器：计算器页是模式工作区，工具页是各自的根节点
function getActiveWorkspaceEl() {
  if (state.tool !== "calc") return elements.toolRoots[state.tool] || null;
  return elements.modeWorkspace;
}

function initialize() {
  hydrateState();
  hydrateTool();
  renderKeypad();
  renderModeWorkspace();
  bindEvents();
  updateDisplay();
  renderHistory();
  renderModeTabs();
  syncModeWorkspace();
  setHoverHint(MODE_HINTS[state.mode]);
  evaluatePreview();
  applyUiFilter();
  switchTool(state.tool);
}

function hydrateState() {
  const storedExpression = readStorage(STORAGE_KEYS.expression);
  const storedAngleMode = readStorage(STORAGE_KEYS.angleMode);
  const storedMemory = readStorage(STORAGE_KEYS.memory);
  const storedHistory = readStorage(STORAGE_KEYS.history);
  const storedShift = readStorage(STORAGE_KEYS.shift);
  const storedMode = readStorage(STORAGE_KEYS.mode);

  if (storedExpression !== null) state.expression = storedExpression;
  if (storedAngleMode) state.angleMode = storedAngleMode;
  if (Number.isFinite(Number(storedMemory))) state.memory = Number(storedMemory);
  if (storedHistory) {
    try {
      state.history = JSON.parse(storedHistory);
    } catch {
      state.history = [];
    }
  }
  state.shift = storedShift === "true";
  if (storedMode && MODE_LABELS[storedMode]) state.mode = storedMode;
  // URL hash 深链接（如 index.html#dataproc）：工具页优先，其次是计算器模式
  const hash = String((window.location || {}).hash || "").replace(/^#/, "");
  if (TOOL_LABELS[hash]) state.tool = hash;
  else if (MODE_LABELS[hash]) state.mode = hash;

  hydrateMatrix();
  hydrateEquation();
  hydrateVector();
  hydrateStats();
  hydrateCalculus();
  hydrateComplex();
  hydrateBase();
  hydrateLogic();
  hydrateBoolean();
  hydrateLabrec();
  hydrateDataproc();
  hydrateTable();
  hydrateTools();
}

function getAdvancedResult(mode = state.mode) {
  if (state.tool === "boolean") return state.boolean.error;
  if (state.tool === "dataproc") return state.dataproc.error;
  switch (mode) {
    case "equation": return state.equation.result;
    case "vector": return state.vector.result;
    case "calculus": return state.calculus.result;
    case "logic": return state.logic.result;
    case "table": return state.table.result;
    case "tools": return state.tools.result;
    default: return "";
  }
}

function setAdvancedResult(text) {
  const value = text ?? "";
  if (state.tool === "boolean") { state.boolean.error = value; return; }
  if (state.tool === "dataproc") { state.dataproc.error = value; return; }
  switch (state.mode) {
    case "equation": state.equation.result = value; break;
    case "vector": state.vector.result = value; break;
    case "calculus": state.calculus.result = value; break;
    case "logic": state.logic.result = value; break;
    case "table": state.table.result = value; break;
    case "tools": state.tools.result = value; break;
  }
}

function compileExpression(expression) {
  try {
    const normalized = normalizeExpression(expression);
    if (!normalized.trim()) return null;
    const tokens = tokenize(normalized);
    return tokens.length ? tokens : null;
  } catch {
    return null;
  }
}

function persistAdvancedState() {
  if (state.tool === "boolean") { persistBoolean(); return; }
  if (state.tool === "labrec") { persistLabrec(); return; }
  if (state.tool === "dataproc") { persistDataproc(); return; }
  switch (state.mode) {
    case "equation": persistEquation(); break;
    case "vector": persistVector(); break;
    case "calculus": persistCalculus(); break;
    case "logic": persistLogic(); break;
    case "table": persistTable(); break;
    case "tools": persistTools(); break;
  }
}

function handleAdvancedAction(action) {
  try {
    setActiveAdvancedAction(action);
    if (action === "boolean-generate") {
      runBooleanGenerate();
    } else if (action.startsWith("boolean-preset-")) {
      const parts = action.replace("boolean-preset-", "").split("-");
      runBooleanPreset(Number(parts[0]) || 2, Number(parts[1]) || 1);
    } else if (action === "boolean-all-0" || action === "boolean-all-1" || action === "boolean-all-x") {
      runBooleanSetAll(action === "boolean-all-0" ? 0 : action === "boolean-all-1" ? 1 : "x");
    } else if (action === "boolean-compute") {
      runBooleanCompute();
    } else if (action === "labrec-new") {
      state.labrec.showCreate = !state.labrec.showCreate;
      state.labrec.confirmDelete = false;
      renderActiveWorkspace();
    } else if (action === "labrec-create") {
      runLabrecCreate();
    } else if (action === "labrec-delete") {
      runLabrecDelete();
    } else if (action === "labrec-add-row") {
      runLabrecAddRow();
    } else if (action === "labrec-clear") {
      runLabrecClear();
    } else if (action === "labrec-export") {
      runLabrecExport();
    } else if (action === "dp-analyze") {
      runDataprocAnalyze();
    } else if (action === "dp-demo") {
      state.dataproc.rawInput = DATAPROC_DEMO;
      runDataprocAnalyze();
    } else if (action === "dp-clear") {
      state.dataproc.rawInput = "";
      state.dataproc.parsed = null;
      state.dataproc.fit = null;
      state.dataproc.fitError = "";
      state.dataproc.error = "";
      renderActiveWorkspace();
    } else if (action === "dp-export-image") {
      runDataprocExportImage();
    } else if (action === "solve-linear") {
      const n = state.equation.linearSize;
      const rows = state.equation.linearRows && state.equation.linearRows.length === n ? state.equation.linearRows : defaultLinearRows(n);
      const solution = solveLinearSystem(rows);
      setAdvancedResult(solution.map((v, i) => `x${i + 1}=${formatNumber(v)}`).join(", "));
    } else if (action === "solve-poly") {
      const deg = state.equation.polyDegree;
      const coeffs = state.equation.polyCoefficients && state.equation.polyCoefficients.length === deg + 1 ? state.equation.polyCoefficients : Array.from({ length: deg + 1 }, (_, i) => (i === 0 ? 1 : 0));
      const roots = solvePolynomialRealOnly(coeffs);
      setAdvancedResult(`根: ${roots.join(", ") || "在 [-100, 100] 范围内未找到实根"}`);
    } else if (action === "solve-newton") {
      const result = solveByNewtonSimple(state.equation.solveExpression, Number(state.equation.solveInitial || 1));
      if (result.ok) {
        setAdvancedResult(`x≈${formatNumber(result.root)} (残差≈${formatNumber(result.residual)})`);
      } else {
        setAdvancedResult(`牛顿法未收敛：${result.reason}`);
      }
    } else if (action === "solve-ineq") {
      const coeffs = state.equation.inequalityCoefficients;
      const roots = solvePolynomialRealOnly(coeffs);
      const sign = state.equation.inequalitySign || ">=";
      setAdvancedResult(`不等式根: ${roots.join(", ") || "无"}\n请根据根和符号${sign}判断解集`);
    } else if (action === "vector-dot") {
      const a = state.vector.vectors.v1 || [1, 0, 0];
      const b = state.vector.vectors.v2 || [0, 1, 0];
      setAdvancedResult(`v1·v2 = ${formatNumber(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])}`);
    } else if (action === "vector-cross") {
      const a = state.vector.vectors.v1 || [1, 0, 0];
      const b = state.vector.vectors.v2 || [0, 1, 0];
      const cx = a[1] * b[2] - a[2] * b[1];
      const cy = a[2] * b[0] - a[0] * b[2];
      const cz = a[0] * b[1] - a[1] * b[0];
      setAdvancedResult(`v1×v2 = (${formatNumber(cx)}, ${formatNumber(cy)}, ${formatNumber(cz)})`);
    } else if (action === "vector-add") {
      const a = state.vector.vectors.v1 || [0, 0, 0];
      const b = state.vector.vectors.v2 || [0, 0, 0];
      setAdvancedResult(`v1+v2 = (${formatNumber(a[0] + b[0])}, ${formatNumber(a[1] + b[1])}, ${formatNumber(a[2] + b[2])})`);
    } else if (action === "vector-sub") {
      const a = state.vector.vectors.v1 || [0, 0, 0];
      const b = state.vector.vectors.v2 || [0, 0, 0];
      setAdvancedResult(`v1-v2 = (${formatNumber(a[0] - b[0])}, ${formatNumber(a[1] - b[1])}, ${formatNumber(a[2] - b[2])})`);
    } else if (action === "vector-norm1") {
      const a = state.vector.vectors.v1 || [0, 0, 0];
      setAdvancedResult(`|v1| = ${formatNumber(Math.hypot(a[0], a[1], a[2]))}`);
    } else if (action === "vector-norm2") {
      const a = state.vector.vectors.v2 || [0, 0, 0];
      setAdvancedResult(`|v2| = ${formatNumber(Math.hypot(a[0], a[1], a[2]))}`);
    } else if (action === "vector-angle") {
      const a = state.vector.vectors.v1 || [1, 0, 0];
      const b = state.vector.vectors.v2 || [0, 1, 0];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const normA = Math.hypot(a[0], a[1], a[2]);
      const normB = Math.hypot(b[0], b[1], b[2]);
      const cosAngle = dot / (normA * normB);
      const angleRad = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      const angleDeg = fromRadians(angleRad);
      setAdvancedResult(`θ = ${formatNumber(angleDeg)}° (弧度: ${formatNumber(angleRad)})`);
    } else if (action === "calc-second-derivative") {
      const x0 = Number(state.calculus.point);
      const h = 1e-4;
      const f1 = evaluateScopedExpression(state.calculus.expression, { x: x0 + h });
      const f2 = evaluateScopedExpression(state.calculus.expression, { x: x0 });
      const f3 = evaluateScopedExpression(state.calculus.expression, { x: x0 - h });
      const result = (f1 - 2 * f2 + f3) / (h * h);
      setAdvancedResult(`f''(${formatNumber(x0)})≈${formatNumber(result)}`);
    } else if (action === "solve-proportion") {
      const p = state.equation.proportion;
      const a = Number(p.a), b = Number(p.b), c = Number(p.c), dVal = p.d;
      if (dVal === "?" && a && b && c) {
        const result = (b * c) / a;
        state.equation.proportion.d = formatNumber(result);
        setAdvancedResult(`d = ${formatNumber(result)}`);
      } else if (a && b && c && Number(dVal)) {
        const result = (b * c) / a;
        setAdvancedResult(`d = ${formatNumber(result)} (验证: ${a}/${b} = ${c}/${Number(dVal)}，比值=${formatNumber(a/b)})`);
      } else {
        setAdvancedResult("比例式: 填写 a/b = c/d 中的三个值，未知项填 ?");
      }
    } else if (action === "calc-derivative") {
      const x0 = Number(state.calculus.point);
      const h = 1e-5;
      const f1 = evaluateScopedExpression(state.calculus.expression, { x: x0 + h });
      const f2 = evaluateScopedExpression(state.calculus.expression, { x: x0 - h });
      const result = (f1 - f2) / (2 * h);
      setAdvancedResult(`f'(${formatNumber(x0)})≈${formatNumber(result)}`);
    } else if (action === "calc-integral") {
      const a = Number(state.calculus.lower);
      const b = Number(state.calculus.upper);
      const n = 200;
      const h = (b - a) / n;
      let sum = 0;
      for (let i = 0; i <= n; i += 1) {
        const x = a + i * h;
        const y = evaluateScopedExpression(state.calculus.expression, { x });
        sum += (i === 0 || i === n ? 1 : (i % 2 === 0 ? 2 : 4)) * y;
      }
      const integral = (h / 3) * sum;
      setAdvancedResult(`∫≈${formatNumber(integral)}`);
    } else if (action === "calc-sigma") {
      const tokens = compileExpression(state.calculus.sigmaExpression);
      if (!tokens) {
        setAdvancedResult("Σ 通项表达式无效");
      } else {
        const lo = clampInt(state.calculus.sigmaLower, -100000, 100000, 1);
        const hi = clampInt(state.calculus.sigmaUpper, -100000, 100000, 10);
        let total = 0;
        let failed = false;
        try {
          for (let n = lo; n <= hi; n += 1) {
            runtimeScope = { n };
            total += createParser(tokens).parseExpression();
          }
        } catch (error) {
          failed = true;
          setAdvancedResult(`Σ 求和失败：${error.message}`);
        } finally {
          runtimeScope = null;
        }
        if (!failed) setAdvancedResult(`Σ=${formatNumber(total)}`);
      }
    } else if (action.startsWith("logic-")) {
      const a = parseInt(state.logic.a || "0", 10);
      const b = parseInt(state.logic.b || "0", 10);
      const base = state.logic.base || "DEC";
      const op = action.replace("logic-", "");
      let val;
      let label;
      switch (op) {
        case "and": val = a & b; label = "AND"; break;
        case "or": val = a | b; label = "OR"; break;
        case "xor": val = a ^ b; label = "XOR"; break;
        case "not": val = ~a; label = "NOT(A)"; break;
        case "xnor": val = ~(a ^ b); label = "XNOR"; break;
        default: val = 0; label = "?";
      }
      setAdvancedResult(`${label} = ${formatLogicValue(val, base)} (十进制: ${formatNumber(val)})`);
    } else if (action === "table") {
      state.table.rows = [];
      const start = Number(state.table.start);
      const end = Number(state.table.end);
      const step = Number(state.table.step || 1);
      for (let x = start; x <= end && state.table.rows.length < 100; x += step) {
        const fx = evaluateScopedExpression(state.table.fx, { x });
        const gx = evaluateScopedExpression(state.table.gx, { x });
        state.table.rows.push(`x=${formatNumber(x)}, f=${formatNumber(fx)}, g=${formatNumber(gx)}`);
      }
      setAdvancedResult(state.table.rows.slice(0, 12).join("\n"));
    } else if (action === "fraction") {
      setAdvancedResult(convertFractionFormats(state.tools.fractionInput || "1/2"));
    } else if (action === "dms") {
      setAdvancedResult(convertDms(state.tools.dmsInput || "30°15'0\""));
    } else if (action === "unit") {
      setAdvancedResult(convertUnitValue(state.tools.unitGroup, state.tools.unitFrom, state.tools.unitTo, Number(state.tools.unitInput || 0)));
    } else if (action === "prime") {
      const num = Number(state.tools.primeInput || 360);
      if (!Number.isFinite(num) || num < 2 || num !== Math.floor(num)) {
        setAdvancedResult("请输入 ≥2 的整数");
      } else if (num > 1e12) {
        setAdvancedResult("数字过大，素因数分解支持不超过 10^12 的整数");
      } else {
        const factors = primeFactorization(num);
        setAdvancedResult(`${num} = ${factors.join(" × ")}`);
      }
    } else if (action === "eng") {
      const v = Number(state.tools.engInput || 1234567);
      if (!Number.isFinite(v)) {
        setAdvancedResult("无效输入");
      } else {
        setAdvancedResult(formatEng(v));
      }
    } else if (action === "random") {
      const min = Number(state.tools.randMin || 0);
      const max = Number(state.tools.randMax || 1);
      setAdvancedResult(`随机数: ${formatNumber(min + Math.random() * (max - min))}`);
    } else if (action === "random-int") {
      const min = Math.ceil(Number(state.tools.randMin || 1));
      const max = Math.floor(Number(state.tools.randMax || 100));
      const r = Math.floor(Math.random() * (max - min + 1)) + min;
      setAdvancedResult(`整数随机: ${r}`);
    } else if (action === "polar") {
      const x = Number(state.tools.polarX || 3);
      const y = Number(state.tools.polarY || 4);
      const r = Math.hypot(x, y);
      const theta = fromRadians(Math.atan2(y, x));
      setAdvancedResult(`极坐标: r=${formatNumber(r)}, θ=${formatNumber(theta)}°`);
    } else if (action === "cartesian") {
      const r = Number(state.tools.cartR || 5);
      const thetaRad = toRadians(Number(state.tools.cartTheta || 53.130102));
      const x = r * Math.cos(thetaRad);
      const y = r * Math.sin(thetaRad);
      setAdvancedResult(`直角坐标: x=${formatNumber(x)}, y=${formatNumber(y)}`);
    } else if (action === "constant") {
      const key = state.tools.constantKey || "c";
      const val = NAMED_CONSTANTS[key];
      setAdvancedResult(val !== undefined ? `${key} = ${val}` : "未知常数");
    }
  } catch (error) {
    setAdvancedResult(error.message || "计算失败");
  }
  persistAdvancedState();
  if (state.tool === "calc") refreshEquationWorkspace();
  else refreshToolWorkspace(state.tool);
}


function setActiveAdvancedAction(action) {
  if (state.tool === "boolean") { state.boolean.activeAction = action; return; }
  if (state.tool === "labrec") { state.labrec.activeAction = action; return; }
  if (state.tool === "dataproc") { state.dataproc.activeAction = action; return; }
  switch (state.mode) {
    case "equation":
      state.equation.activeAction = action;
      break;
    case "vector":
      state.vector.activeAction = action;
      break;
    case "calculus":
      state.calculus.activeAction = action;
      break;
    case "logic":
      state.logic.activeAction = action;
      break;
    case "table":
      state.table.activeAction = action;
      break;
    case "tools":
      state.tools.activeAction = action;
      break;
    default:
      break;
  }
}
function evaluateScopedExpression(expression, scope) {
  const previous = runtimeScope;
  runtimeScope = { ...(runtimeScope || {}), ...scope };
  try {
    return evaluateExpression(expression);
  } finally {
    runtimeScope = previous;
  }
}

function solveLinearSystem(rows) {
  const n = rows.length;
  const aug = rows.map((r) => r.slice());
  for (let c = 0; c < n; c += 1) {
    let pivot = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(aug[r][c]) > Math.abs(aug[pivot][c])) pivot = r;
    [aug[c], aug[pivot]] = [aug[pivot], aug[c]];
    if (Math.abs(aug[c][c]) < 1e-12) throw new Error("无唯一解");
    const div = aug[c][c];
    for (let j = c; j <= n; j += 1) aug[c][j] /= div;
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const factor = aug[r][c];
      for (let j = c; j <= n; j += 1) aug[r][j] -= factor * aug[c][j];
    }
  }
  return aug.map((r) => r[n]);
}

// 去掉高次零系数，返回真正降幂排列的系数（零多项式退化为 [0]）
function trimPolynomialCoeffs(coeffs) {
  const arr = Array.isArray(coeffs) ? coeffs.slice() : [];
  let start = 0;
  while (start < arr.length - 1 && arr[start] === 0) start += 1;
  return arr.slice(start);
}

// 降幂多项式求导：[a_n, ..., a_0] -> [n*a_n, ..., 1*a_1]
function derivativeCoeffs(coeffs) {
  const n = coeffs.length - 1;
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(coeffs[i] * (n - i));
  return out;
}

// 在 x 处估计 |p(x)| 各项绝对值之和，作为相对残差容差的尺度
function polynomialResidualScale(coeffs, x) {
  const deg = coeffs.length - 1;
  const ax = Math.max(1, Math.abs(x));
  let scale = 0;
  for (let i = 0; i < coeffs.length; i += 1) {
    scale += Math.abs(coeffs[i]) * Math.pow(ax, deg - i);
  }
  return Math.max(scale, Number.MIN_VALUE);
}

// 合并相近数值（节点或根），按相对容差；返回升序数组
function mergeCloseValues(values, relTol) {
  const sorted = values.slice().sort((a, b) => a - b);
  const merged = [];
  for (const v of sorted) {
    if (merged.length && Math.abs(v - merged[merged.length - 1]) <= relTol * Math.max(1, Math.abs(v))) {
      merged[merged.length - 1] = (merged[merged.length - 1] + v) / 2;
    } else {
      merged.push(v);
    }
  }
  return merged;
}

// 递归求多项式全部实根（数值，未格式化）：
// 用导数的实根把区间划分为单调段，段内二分；驻点处用残差检测偶数重根。
// extraNodes 为顶层追加的划分点（均匀网格，保留原有步长语义）。
// 说明：单纯缩小步长无法一般性处理重根（偶数重根处函数不变号），故必须借助临界点。
function collectPolynomialRoots(coeffs, lo, hi, extraNodes, relTol, mergeTol) {
  const c = trimPolynomialCoeffs(coeffs);
  const deg = c.length - 1;
  if (deg <= 0) return []; // 常数（含零多项式）无离散根
  if (deg === 1) {
    const root = -c[1] / c[0];
    return Number.isFinite(root) && root >= lo - mergeTol && root <= hi + mergeTol ? [root] : [];
  }
  // 导数临界点递归求解；递归层不再插入网格，避免逐层细分造成性能退化
  const critical = collectPolynomialRoots(derivativeCoeffs(c), lo, hi, [], relTol, mergeTol);
  const rawNodes = [lo, hi, ...critical, ...extraNodes];
  const nodes = mergeCloseValues(
    rawNodes.filter((v) => Number.isFinite(v) && v >= lo - mergeTol && v <= hi + mergeTol),
    mergeTol
  );
  const residualAt = (x) => relTol * polynomialResidualScale(c, x);
  // 驻点是否为根只允许 Horner 求值的舍入误差，而非固定的近零容差。
  // 这里用实际 |x| 估计各项绝对值之和：x=0 时，非零常数项不能
  // 因为其它系数较大被当作零（如 x²+1e-14）。
  const stationaryAt = (x) => {
    const scale = c.reduce((acc, value) => acc * Math.abs(x) + Math.abs(value), 0);
    return 8 * c.length * Number.EPSILON * scale;
  };
  const roots = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const fx = polyEval(c, nodes[i]);
    if (Number.isFinite(fx) && Math.abs(fx) <= stationaryAt(nodes[i])) roots.push(nodes[i]);
  }
  // 单调段内符号变化用二分求单根。
  // 直接比较符号而不做乘积：系数整体极小（1e-200）时乘积会下溢为 0，
  // 系数整体极大时会上溢为 ±Infinity，两种情况都会丢掉符号变化信息。
  // 端点残差落在舍入噪声带内时跳过：此时该端点已按节点根处理，
  // 再二分只会在「p 被舍入成 0 的平台」边缘造出一个假根（如三阶重根 (x-0.2)^3）。
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const fa = polyEval(c, nodes[i]);
    const fb = polyEval(c, nodes[i + 1]);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (Math.abs(fa) <= stationaryAt(nodes[i]) || Math.abs(fb) <= stationaryAt(nodes[i + 1])) continue;
    if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
      roots.push(bisectRoot(c, nodes[i], nodes[i + 1]));
    }
  }
  // 残差校验 + 范围过滤 + 相近根去重
  const valid = roots.filter(
    (r) => Number.isFinite(r) && r >= lo - mergeTol && r <= hi + mergeTol && Math.abs(polyEval(c, r)) <= residualAt(r)
  );
  return mergeCloseValues(valid, mergeTol);
}

function solvePolynomialRealOnly(coeffs, options) {
  const opts = options || {};
  // 保持原有扫描范围与步长语义，并允许按需配置：{ min, max, step }
  const lo = Number.isFinite(opts.min) ? opts.min : -100;
  const hi = Number.isFinite(opts.max) ? opts.max : 100;
  const step = Number.isFinite(opts.step) && opts.step > 0 ? opts.step : 0.5;
  const relTol = 1e-9;   // 相对残差容差（用于最终残差校验）
  const mergeTol = 1e-7; // 相近根/节点合并容差
  if (!(hi > lo)) return [];
  const source = trimPolynomialCoeffs(coeffs);
  if (!source.length) return [];
  // 系数归一化：整体除以 max|coeff|。等比例缩放的同一方程（如 ×1e-200 或 ×1e200）
  // 归一化后完全相同，从而避免量级极小导致乘积下溢、量级极大导致尺度上溢。
  let maxAbs = 0;
  for (const v of source) {
    const a = Math.abs(v);
    if (Number.isFinite(a) && a > maxAbs) maxAbs = a;
  }
  if (!(maxAbs > 0)) return []; // 零多项式无离散根
  const normalized = source.map((v) => v / maxAbs);
  // 均匀网格与原有 0.5 步长扫描一致；叠加临界点以分离相邻实根并检测重根
  const grid = [];
  const segments = Math.ceil((hi - lo) / step);
  for (let k = 0; k <= segments; k += 1) grid.push(lo + ((hi - lo) * k) / segments);
  const numericRoots = collectPolynomialRoots(normalized, lo, hi, grid, relTol, mergeTol);
  // 按原方程复核：相对残差是无量纲量，与系数整体缩放无关
  const verified = numericRoots.filter((r) => polynomialRelativeResidual(source, r) <= relTol);
  return Array.from(new Set(verified.slice(0, 8).map((r) => formatNumber(r))));
}

// 相对残差 |p(x)| / Σ|c_i|·max(1,|x|)^(n-i)：无量纲，系数整体缩放不改变其值
function polynomialRelativeResidual(coeffs, x) {
  let p = Math.abs(polyEval(coeffs, x));
  let scale = polynomialResidualScale(coeffs, x);
  if (!Number.isFinite(p) || !Number.isFinite(scale)) {
    // 系数（或 x）量级过大导致尺度上溢时，改用归一化系数计算：
    // 相对残差与系数整体缩放无关，归一化不改变判定结果，只避免上溢。
    let maxAbs = 0;
    for (const v of coeffs) {
      const a = Math.abs(v);
      if (Number.isFinite(a) && a > maxAbs) maxAbs = a;
    }
    if (!(maxAbs > 0)) return Infinity;
    const normalized = coeffs.map((v) => v / maxAbs);
    p = Math.abs(polyEval(normalized, x));
    scale = polynomialResidualScale(normalized, x);
  }
  if (!Number.isFinite(p) || !Number.isFinite(scale) || scale === 0) return Infinity;
  return p / scale;
}

function polyEval(coeffs, x) {
  return coeffs.reduce((acc, c) => acc * x + c, 0);
}

// 二分求根：以区间宽度收敛为准（不再用绝对残差提前退出），
// 避免斜率很小的根因 |f| 过早达标而损失精度；结果仍由外层统一做残差校验。
function bisectRoot(coeffs, a, b) {
  let l = a;
  let r = b;
  let fl = polyEval(coeffs, l);
  for (let i = 0; i < 100; i += 1) {
    const m = (l + r) / 2;
    const fm = polyEval(coeffs, m);
    if (fm === 0 || r - l <= 1e-14 * Math.max(1, Math.abs(m))) return m;
    // 用符号比较代替乘积，避免乘积极大/下溢导致选错半区间
    if ((fl < 0) === (fm < 0)) { l = m; fl = fm; }
    else r = m;
  }
  return (l + r) / 2;
}

// 牛顿法求方程数值解：始终返回收敛状态，绝不静默返回未经残差校验的伪根。
// 成功：{ ok: true, root, residual, iterations }
// 失败：{ ok: false, reason }（导数为零、发散、迭代到限、表达式无效）
//
// 收敛判定说明（与「方程/函数局部尺度」相关，而不是与初值处的 |f(x0)| 相关）：
//   判据：|f(x)| <= 1e-10 * |f'(x)| * max(1, |x|)
//   等价形式：牛顿修正量 |f/f'| <= 1e-10 * max(1, |x|)。
//   该判据对 f 的整体等比例缩放完全不变（f→c·f 时 f/f' 不变），
//   因此 1e-12·x+1e-12 这类小尺度方程不会被绝对阈值误判为已收敛；
//   同时它只依赖当前迭代点附近的斜率与 x 的量级，巨大初值不会永久放宽阈值，
//   所以 x²+1 在初值 1e5 下不会被判成功（残差 9.65 远大于局部尺度）。
function solveByNewtonSimple(expr, x0) {
  const start = Number(x0);
  if (!Number.isFinite(start)) return { ok: false, reason: "初值不是有限数值" };
  const h = 1e-6;
  // 重根处牛顿法只线性收敛（(x-r)^k 的收敛比为 1-1/k），迭代次数明显多于单根
  // （单根通常 3~6 次），故上限取 100 次。
  const maxIterations = 100;
  const stepTol = 1e-10; // 修正量相对容差
  let f0;
  try {
    f0 = evaluateScopedExpression(expr, { x: start });
  } catch (error) {
    return { ok: false, reason: `表达式求值失败：${error.message || "未知错误"}` };
  }
  if (!Number.isFinite(f0)) {
    return { ok: false, reason: "表达式在初值处无有限值，请检查表达式是否有效" };
  }
  const evalAt = (x) => {
    try {
      return evaluateScopedExpression(expr, { x });
    } catch {
      return NaN; // 迭代点求值失败按不收敛处理
    }
  };
  // 中心差分估计导数；失败返回 NaN
  const slopeAt = (x) => {
    const d = (evalAt(x + h) - evalAt(x - h)) / (2 * h);
    return Number.isFinite(d) ? d : NaN;
  };
  const isConverged = (x, fx, d) => {
    if (fx === 0) return true; // 精确零点
    if (!Number.isFinite(fx) || !Number.isFinite(d) || d === 0) return false;
    return Math.abs(fx) <= stepTol * Math.abs(d) * Math.max(1, Math.abs(x));
  };
  let x = start;
  for (let i = 0; i < maxIterations; i += 1) {
    const fx = evalAt(x);
    if (!Number.isFinite(fx)) return { ok: false, reason: "迭代点函数值非有限，牛顿法发散" };
    if (fx === 0) return { ok: true, root: x, residual: 0, iterations: i };
    const d = slopeAt(x);
    if (isConverged(x, fx, d)) {
      return { ok: true, root: x, residual: Math.abs(fx), iterations: i };
    }
    if (!Number.isFinite(d) || d === 0) {
      return { ok: false, reason: "导数接近 0，牛顿法无法继续（该初值可能不收敛或方程无实根）" };
    }
    const step = fx / d;
    const nx = x - step;
    if (!Number.isFinite(nx)) return { ok: false, reason: "迭代产生非有限值，牛顿法发散" };
    // 修正量比 x 的量级大 1e12 倍：等价于导数相对函数值过小，继续迭代无意义
    if (Math.abs(step) > 1e12 * Math.max(1, Math.abs(x))) {
      return { ok: false, reason: "导数接近 0，牛顿法无法继续（该初值可能不收敛或方程无实根）" };
    }
    x = nx;
  }
  // 迭代耗尽：仍用同一判据复核，未达标则明确报失败
  const lastFx = evalAt(x);
  const lastResidual = Number.isFinite(lastFx) ? Math.abs(lastFx) : Infinity;
  if (isConverged(x, lastFx, slopeAt(x))) {
    return { ok: true, root: x, residual: lastResidual, iterations: maxIterations };
  }
  return { ok: false, reason: `迭代 ${maxIterations} 次仍未收敛（残差≈${formatNumber(lastResidual)}）` };
}

function convertFractionFormats(input) {
  const text = String(input || "").trim();
  const mixed = text.match(/^([+-]?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const n = Number(mixed[2]);
    const d = Number(mixed[3]);
    const improper = `${whole < 0 ? "-" : ""}${Math.abs(whole) * d + n}/${d}`;
    return `带分数=${text}\n假分数=${improper}`;
  }
  const frac = text.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (!frac) return "分数格式错误";
  const n = Number(frac[1]);
  const d = Number(frac[2]);
  if (d === 0) return "分母不能为0";
  const g = gcdInt(Math.trunc(Math.abs(n)), Math.trunc(Math.abs(d)));
  const sn = Math.trunc(n / g);
  const sd = Math.trunc(d / g);
  const whole = Math.trunc(sn / sd);
  const rem = Math.abs(sn % sd);
  const mixedText = rem ? `${whole} ${rem}/${Math.abs(sd)}` : `${whole}`;
  return `最简=${sn}/${sd}\n带分数=${mixedText}`;
}

function gcdInt(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function convertDms(input) {
  const t = String(input || "").trim();
  const match = t.match(/^([+-]?\d+)(?:°|\s)\s*(\d+)?(?:'|\s)?\s*(\d+(?:\.\d+)?)?(?:"|)?$/);
  if (match) {
    const d = Number(match[1] || 0);
    const m = Number(match[2] || 0);
    const s = Number(match[3] || 0);
    const sign = d < 0 ? -1 : 1;
    const deg = sign * (Math.abs(d) + m / 60 + s / 3600);
    return `十进制度=${formatNumber(deg)}`;
  }
  const value = Number(t);
  if (!Number.isFinite(value)) return "DMS格式无效";
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const d = Math.floor(abs);
  const mFloat = (abs - d) * 60;
  const m = Math.floor(mFloat);
  const s = (mFloat - m) * 60;
  return `${sign < 0 ? "-" : ""}${d}°${m}'${formatNumber(s)}"`;
}

function convertUnitValue(group, from, to, value) {
  if (!Number.isFinite(value)) return "输入无效";
  const units = UNIT_GROUPS[group];
  if (!units || !(from in units) || !(to in units)) return "单位无效";
  if (group === "temperature") {
    return formatNumber(convertTemperature(value, from, to));
  }
  const base = value * units[from];
  return formatNumber(base / units[to]);
}

function convertTemperature(value, from, to) {
  let k = value;
  if (from === "C") k = value + 273.15;
  if (from === "F") k = ((value - 32) * 5) / 9 + 273.15;
  if (from === "K") k = value;
  if (to === "K") return k;
  if (to === "C") return k - 273.15;
  return ((k - 273.15) * 9) / 5 + 32;
}

function renderAdvancedWorkspace() {
  return `
    <div class="layout-stack">
      <div class="adv-panel">${renderAdvancedPanel(state.mode)}</div>
    </div>
  `;
}

function renderAdvancedPanel(mode) {
  switch (mode) {
    case "equation": return renderEquationPanel();
    case "vector": return renderVectorPanel();
    case "calculus": return renderCalculusPanel();
    case "logic": return renderLogicPanel();
    case "table": return renderTablePanel();
    case "tools": return renderToolsPanel();
    default: return "";
  }
}

function renderEquationPanel() {
  return `
    <section class="module-card">
      <h3>方程求解</h3>
      <div class="button-row">
        <button class="mode-action is-active" type="button" data-adv-action="solve-linear">线性方程组</button>
        <button class="mode-action" type="button" data-adv-action="solve-poly">2~4次方程</button>
        <button class="mode-action" type="button" data-adv-action="solve-newton">SOLVE</button>
        <button class="mode-action" type="button" data-adv-action="solve-ineq">不等式</button>
        <button class="mode-action" type="button" data-adv-action="solve-proportion">比例式</button>
      </div>
      <div class="summary-grid">
        <label class="field-card"><span class="field-label">线性方程元数</span><select id="linearSize" class="base-select">${[2, 3, 4].map((n) => `<option value="${n}" ${state.equation.linearSize === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="field-card"><span class="field-label">多项式次数</span><select id="polyDegree" class="base-select">${[2, 3, 4].map((n) => `<option value="${n}" ${state.equation.polyDegree === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="field-card"><span class="field-label">SOLVE f(x)</span><input id="solveExpr" class="stats-input" type="text" value="${escapeAttr(state.equation.solveExpression)}" /></label>
        <label class="field-card"><span class="field-label">SOLVE 初值</span><input id="solveInitial" class="stats-input" type="number" step="any" value="${escapeAttr(state.equation.solveInitial)}" /></label>
        <label class="field-card"><span class="field-label">比例 a</span><input id="propA" class="stats-input" type="text" value="${escapeAttr(state.equation.proportion.a)}" /></label>
        <label class="field-card"><span class="field-label">比例 b</span><input id="propB" class="stats-input" type="text" value="${escapeAttr(state.equation.proportion.b)}" /></label>
        <label class="field-card"><span class="field-label">比例 c</span><input id="propC" class="stats-input" type="text" value="${escapeAttr(state.equation.proportion.c)}" /></label>
        <label class="field-card"><span class="field-label">比例 d (未知填?)</span><input id="propD" class="stats-input" type="text" value="${escapeAttr(state.equation.proportion.d)}" /></label>
        <label class="field-card"><span class="field-label">不等号</span><select id="ineqSign" class="base-select">${[">=", ">", "<=", "<"].map((s) => `<option value="${s}" ${state.equation.inequalitySign === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      </div>
      <pre id="advancedResult" class="result-pre">${escapeHtml(getAdvancedResult("equation") || "点击按钮执行对应功能")}</pre>
      <button class="mode-result-btn" type="button" data-mode-action="commit-result">得出结果</button>
    </section>
  `;
}

function renderVectorPanel() {
  return `
    <section class="module-card">
      <h3>向量运算 (3维)</h3>
      <div class="summary-grid">
        <label class="field-card"><span class="field-label">v1.x</span><input id="v1x" class="stats-input" type="number" step="any" value="${escapeAttr(String(state.vector.vectors.v1[0]))}" /></label>
        <label class="field-card"><span class="field-label">v1.y</span><input id="v1y" class="stats-input" type="number" step="any" value="${escapeAttr(String(state.vector.vectors.v1[1]))}" /></label>
        <label class="field-card"><span class="field-label">v1.z</span><input id="v1z" class="stats-input" type="number" step="any" value="${escapeAttr(String(state.vector.vectors.v1[2]))}" /></label>
        <label class="field-card"><span class="field-label">v2.x</span><input id="v2x" class="stats-input" type="number" step="any" value="${escapeAttr(String(state.vector.vectors.v2[0]))}" /></label>
        <label class="field-card"><span class="field-label">v2.y</span><input id="v2y" class="stats-input" type="number" step="any" value="${escapeAttr(String(state.vector.vectors.v2[1]))}" /></label>
        <label class="field-card"><span class="field-label">v2.z</span><input id="v2z" class="stats-input" type="number" step="any" value="${escapeAttr(String(state.vector.vectors.v2[2]))}" /></label>
      </div>
      <div class="button-row">
        <button class="mode-action is-active" type="button" data-adv-action="vector-dot">点积</button>
        <button class="mode-action" type="button" data-adv-action="vector-cross">叉积</button>
        <button class="mode-action" type="button" data-adv-action="vector-add">向量加</button>
        <button class="mode-action" type="button" data-adv-action="vector-sub">向量减</button>
        <button class="mode-action" type="button" data-adv-action="vector-norm1">|v1|</button>
        <button class="mode-action" type="button" data-adv-action="vector-norm2">|v2|</button>
        <button class="mode-action" type="button" data-adv-action="vector-angle">夹角</button>
      </div>
      <pre id="advancedResult" class="result-pre">${escapeHtml(getAdvancedResult("vector") || "")}</pre>
      <button class="mode-result-btn" type="button" data-mode-action="commit-result" style="margin-top:12px">得出结果</button>
    </section>
  `;
}

function renderCalculusPanel() {
  return `
    <section class="module-card">
      <h3>微积分与求和</h3>
      <div class="button-row">
        <button class="mode-action is-active" type="button" data-adv-action="calc-derivative">一阶导数</button>
        <button class="mode-action" type="button" data-adv-action="calc-second-derivative">二阶导数</button>
        <button class="mode-action" type="button" data-adv-action="calc-integral">定积分</button>
        <button class="mode-action" type="button" data-adv-action="calc-sigma">Σ求和</button>
      </div>
      <div class="summary-grid">
        <label class="field-card"><span class="field-label">f(x) 表达式</span><input id="diffExpr" class="stats-input" type="text" value="${escapeAttr(state.calculus.expression)}" /></label>
        <label class="field-card"><span class="field-label">求导点 x₀</span><input id="diffPoint" class="stats-input" type="number" step="any" value="${escapeAttr(state.calculus.point)}" /></label>
        <label class="field-card"><span class="field-label">积分下限</span><input id="intLower" class="stats-input" type="number" step="any" value="${escapeAttr(state.calculus.lower)}" /></label>
        <label class="field-card"><span class="field-label">积分上限</span><input id="intUpper" class="stats-input" type="number" step="any" value="${escapeAttr(state.calculus.upper)}" /></label>
        <label class="field-card"><span class="field-label">Σ 通项</span><input id="sigmaExpr" class="stats-input" type="text" value="${escapeAttr(state.calculus.sigmaExpression)}" /></label>
        <label class="field-card"><span class="field-label">Σ 下限</span><input id="sigmaLower" class="stats-input" type="number" step="1" value="${escapeAttr(state.calculus.sigmaLower)}" /></label>
        <label class="field-card"><span class="field-label">Σ 上限</span><input id="sigmaUpper" class="stats-input" type="number" step="1" value="${escapeAttr(state.calculus.sigmaUpper)}" /></label>
      </div>
      <pre id="advancedResult" class="result-pre">${escapeHtml(getAdvancedResult("calculus") || "")}</pre>
      <button class="mode-result-btn" type="button" data-mode-action="commit-result" style="margin-top:12px">得出结果</button>
    </section>
  `;
}

function renderLogicPanel() {
  const a = parseInt(state.logic.a || "0", 10);
  const b = parseInt(state.logic.b || "0", 10);
  const base = state.logic.base || "DEC";
  const results = {
    and: a & b,
    or: a | b,
    xor: a ^ b,
    notA: ~a,
    xnor: ~(a ^ b),
  };
  return `
    <section class="module-card">
      <h3>逻辑运算</h3>
      <div class="summary-grid">
        <label class="field-card"><span class="field-label">A (十进制)</span><input id="logicA" class="stats-input" type="number" step="1" value="${escapeAttr(state.logic.a)}" /></label>
        <label class="field-card"><span class="field-label">B (十进制)</span><input id="logicB" class="stats-input" type="number" step="1" value="${escapeAttr(state.logic.b)}" /></label>
        <label class="field-card"><span class="field-label">显示进制</span><select id="logicBase" class="base-select"><option value="DEC" ${base==="DEC"?"selected":""}>十进制</option><option value="HEX" ${base==="HEX"?"selected":""}>十六进制</option><option value="BIN" ${base==="BIN"?"selected":""}>二进制</option><option value="OCT" ${base==="OCT"?"selected":""}>八进制</option></select></label>
      </div>
      <div class="button-row">
        <button class="mode-action is-active" type="button" data-adv-action="logic-and">AND</button>
        <button class="mode-action" type="button" data-adv-action="logic-or">OR</button>
        <button class="mode-action" type="button" data-adv-action="logic-xor">XOR</button>
        <button class="mode-action" type="button" data-adv-action="logic-not">NOT(A)</button>
        <button class="mode-action" type="button" data-adv-action="logic-xnor">XNOR</button>
      </div>
      <div class="summary-grid" style="margin-top:10px">
        <div class="summary-card"><span class="summary-label">A</span><strong>${formatLogicValue(a, base)}</strong></div>
        <div class="summary-card"><span class="summary-label">B</span><strong>${formatLogicValue(b, base)}</strong></div>
        <div class="summary-card"><span class="summary-label">AND</span><strong>${formatLogicValue(results.and, base)}</strong></div>
        <div class="summary-card"><span class="summary-label">OR</span><strong>${formatLogicValue(results.or, base)}</strong></div>
        <div class="summary-card"><span class="summary-label">XOR</span><strong>${formatLogicValue(results.xor, base)}</strong></div>
        <div class="summary-card"><span class="summary-label">NOT(A)</span><strong>${formatLogicValue(results.notA, base)}</strong></div>
        <div class="summary-card"><span class="summary-label">XNOR</span><strong>${formatLogicValue(results.xnor, base)}</strong></div>
      </div>
      <pre id="advancedResult" class="result-pre">${escapeHtml(getAdvancedResult("logic") || "点击按钮查看运算结果")}</pre>
      <button class="mode-result-btn" type="button" data-mode-action="commit-result" style="margin-top:12px">得出结果</button>
    </section>
  `;
}

function formatLogicValue(val, base) {
  const n = val >>> 0;
  switch (base) {
    case "HEX": return formatBaseNumber(n, 16);
    case "BIN": return formatBaseNumber(n, 2);
    case "OCT": return formatBaseNumber(n, 8);
    default: return formatNumber(val);
  }
}

function renderTablePanel() {
  return `
    <section class="module-card">
      <h3>函数表格</h3>
      <div class="summary-grid">
        <label class="field-card"><span class="field-label">f(x)</span><input id="tableFx" class="stats-input" type="text" value="${escapeAttr(state.table.fx)}" /></label>
        <label class="field-card"><span class="field-label">g(x) (可选)</span><input id="tableGx" class="stats-input" type="text" value="${escapeAttr(state.table.gx)}" /></label>
        <label class="field-card"><span class="field-label">x 起始</span><input id="tableStart" class="stats-input" type="number" step="any" value="${escapeAttr(state.table.start)}" /></label>
        <label class="field-card"><span class="field-label">x 结束</span><input id="tableEnd" class="stats-input" type="number" step="any" value="${escapeAttr(state.table.end)}" /></label>
        <label class="field-card"><span class="field-label">步长</span><input id="tableStep" class="stats-input" type="number" step="any" value="${escapeAttr(state.table.step)}" /></label>
      </div>
      <div class="button-row">
        <button class="mode-action is-active" type="button" data-adv-action="table">生成表格</button>
      </div>
      <pre id="advancedResult" class="result-pre">${escapeHtml(getAdvancedResult("table") || "")}</pre>
      <button class="mode-result-btn" type="button" data-mode-action="commit-result" style="margin-top:12px">得出结果</button>
    </section>
  `;
}

function renderToolsPanel() {
  return `
    <section class="module-card">
      <h3>分数 / DMS / 坐标 / 素因数 / ENG / 随机数 / 常数 / 单位</h3>
      <div class="button-row" style="flex-wrap:wrap">
        <button class="mode-action is-active" type="button" data-adv-action="fraction">分数化简</button>
        <button class="mode-action" type="button" data-adv-action="dms">DMS转换</button>
        <button class="mode-action" type="button" data-adv-action="polar">极坐标</button>
        <button class="mode-action" type="button" data-adv-action="cartesian">直角坐标</button>
        <button class="mode-action" type="button" data-adv-action="prime">素因数分解</button>
        <button class="mode-action" type="button" data-adv-action="eng">ENG符号</button>
        <button class="mode-action" type="button" data-adv-action="random">随机数</button>
        <button class="mode-action" type="button" data-adv-action="random-int">整数随机</button>
        <button class="mode-action" type="button" data-adv-action="constant">科学常数</button>
        <button class="mode-action" type="button" data-adv-action="unit">单位换算</button>
      </div>
      <div class="summary-grid">
        <label class="field-card"><span class="field-label">分数 (a/b 或 a b/c)</span><input id="fractionInput" class="stats-input" type="text" value="${escapeAttr(state.tools.fractionInput)}" /></label>
        <label class="field-card"><span class="field-label">DMS (如 12°30'0\")</span><input id="dmsInput" class="stats-input" type="text" value="${escapeAttr(state.tools.dmsInput)}" /></label>
        <label class="field-card"><span class="field-label">极坐标 x</span><input id="polarX" class="stats-input" type="number" step="any" value="${escapeAttr(state.tools.polarX)}" /></label>
        <label class="field-card"><span class="field-label">极坐标 y</span><input id="polarY" class="stats-input" type="number" step="any" value="${escapeAttr(state.tools.polarY)}" /></label>
        <label class="field-card"><span class="field-label">直角 r</span><input id="cartR" class="stats-input" type="number" step="any" value="${escapeAttr(state.tools.cartR)}" /></label>
        <label class="field-card"><span class="field-label">直角 θ°</span><input id="cartTheta" class="stats-input" type="number" step="any" value="${escapeAttr(state.tools.cartTheta)}" /></label>
        <label class="field-card"><span class="field-label">素因数 数字</span><input id="primeInput" class="stats-input" type="number" step="1" value="${escapeAttr(state.tools.primeInput)}" /></label>
        <label class="field-card"><span class="field-label">ENG 数值</span><input id="engInput" class="stats-input" type="number" step="any" value="${escapeAttr(state.tools.engInput)}" /></label>
        <label class="field-card"><span class="field-label">随机最小</span><input id="randMin" class="stats-input" type="number" step="any" value="${escapeAttr(state.tools.randMin)}" /></label>
        <label class="field-card"><span class="field-label">随机最大</span><input id="randMax" class="stats-input" type="number" step="any" value="${escapeAttr(state.tools.randMax)}" /></label>
        <label class="field-card"><span class="field-label">常数</span><select id="constKey" class="base-select">${Object.keys(NAMED_CONSTANTS).map((k) => `<option value="${k}" ${state.tools.constantKey === k ? "selected" : ""}>${k}</option>`).join("")}</select></label>
        <label class="field-card"><span class="field-label">单位换算组</span><select id="unitGroup" class="base-select">${Object.keys(UNIT_GROUPS).map((g) => `<option value="${g}" ${state.tools.unitGroup === g ? "selected" : ""}>${g}</option>`).join("")}</select></label>
        <label class="field-card"><span class="field-label">从</span><input id="unitFrom" class="stats-input" type="text" value="${escapeAttr(state.tools.unitFrom)}" /></label>
        <label class="field-card"><span class="field-label">到</span><input id="unitTo" class="stats-input" type="text" value="${escapeAttr(state.tools.unitTo)}" /></label>
        <label class="field-card"><span class="field-label">单位值</span><input id="unitInput" class="stats-input" type="number" step="any" value="${escapeAttr(state.tools.unitInput)}" /></label>
      </div>
      <pre id="advancedResult" class="result-pre">${escapeHtml(getAdvancedResult("tools") || "")}</pre>
      <button class="mode-result-btn" type="button" data-mode-action="commit-result" style="margin-top:12px">得出结果</button>
    </section>
  `;
}

function hydrateEquation() {
  const stored = readStorage(STORAGE_KEYS.equation);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    state.equation.linearSize = [2, 3, 4].includes(parsed.linearSize) ? parsed.linearSize : 2;
    state.equation.linearRows = normalizeLinearRows(parsed.linearRows, state.equation.linearSize);
    state.equation.polyDegree = [2, 3, 4].includes(parsed.polyDegree) ? parsed.polyDegree : 2;
    state.equation.polyCoefficients = normalizeCoefficientArray(parsed.polyCoefficients, 5);
    state.equation.solveExpression = typeof parsed.solveExpression === "string" ? parsed.solveExpression : state.equation.solveExpression;
    state.equation.solveInitial = typeof parsed.solveInitial === "string" ? parsed.solveInitial : state.equation.solveInitial;
    state.equation.inequalityDegree = [2, 3, 4].includes(parsed.inequalityDegree) ? parsed.inequalityDegree : 2;
    state.equation.inequalityCoefficients = normalizeCoefficientArray(parsed.inequalityCoefficients, 5);
    state.equation.inequalitySign = [">", ">=", "<", "<="].includes(parsed.inequalitySign) ? parsed.inequalitySign : ">=";
    state.equation.proportion = normalizeProportion(parsed.proportion);
    state.equation.result = typeof parsed.result === "string"
      ? parsed.result
      : String(parsed.linearResult ?? parsed.polyResult ?? "");
  } catch {
    // keep defaults
  }
}

function hydrateVector() {
  const stored = readStorage(STORAGE_KEYS.vector);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    for (const key of ["v1", "v2", "v3", "v4"]) {
      if (state.vector.vectors[key]) {
        state.vector.vectors[key] = normalizeVector(parsed.vectors?.[key]);
      }
    }
  } catch {
    // keep defaults
  }
}

function hydrateStats() {
  const stored = readStorage(STORAGE_KEYS.stats);
  if (!stored) return;

  try {
    const parsed = JSON.parse(stored);
    state.stats.values = Array.isArray(parsed.values) ? parsed.values.map(Number).filter(Number.isFinite) : [];
    state.stats.input = typeof parsed.input === "string" ? parsed.input : "";
  } catch {
    state.stats.values = [];
  }
}

function hydrateCalculus() {
  const stored = readStorage(STORAGE_KEYS.calculus);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    const pickString = (value, fallback) => (typeof value === "string" ? value : fallback);
    state.calculus.expression = pickString(parsed.expression, state.calculus.expression);
    state.calculus.point = pickString(parsed.point, state.calculus.point);
    state.calculus.order = parsed.order === 2 ? 2 : 1;
    state.calculus.lower = pickString(parsed.lower, state.calculus.lower);
    state.calculus.upper = pickString(parsed.upper, state.calculus.upper);
    state.calculus.sigmaExpression = pickString(parsed.sigmaExpression, state.calculus.sigmaExpression);
    state.calculus.sigmaLower = pickString(parsed.sigmaLower, state.calculus.sigmaLower);
    state.calculus.sigmaUpper = pickString(parsed.sigmaUpper, state.calculus.sigmaUpper);
    state.calculus.result = pickString(parsed.result, "");
  } catch {
    // keep defaults
  }
}

function hydrateComplex() {
  const stored = readStorage(STORAGE_KEYS.complex);
  if (!stored) return;

  try {
    const parsed = JSON.parse(stored);
    state.complex.a = normalizeComplex(parsed.a);
    state.complex.b = normalizeComplex(parsed.b);
    state.complex.operation = parsed.operation ?? "加";
    state.complex.result = normalizeComplex(parsed.result ?? state.complex.result);
  } catch {
    // keep defaults
  }
}

function hydrateBase() {
  const stored = readStorage(STORAGE_KEYS.base);
  if (!stored) return;

  try {
    const parsed = JSON.parse(stored);
    state.base.input = typeof parsed.input === "string" ? parsed.input : state.base.input;
    state.base.source = normalizeBaseName(parsed.source) ?? state.base.source;
    state.base.target = normalizeBaseName(parsed.target) ?? state.base.target;
    state.base.result = typeof parsed.result === "string" ? parsed.result : state.base.result;
  } catch {
    // keep defaults
  }
}

function hydrateLogic() {
  const stored = readStorage(STORAGE_KEYS.logic);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    state.logic.a = typeof parsed.a === "string" ? parsed.a : state.logic.a;
    state.logic.b = typeof parsed.b === "string" ? parsed.b : state.logic.b;
    state.logic.base = normalizeBaseName(parsed.base) ?? "DEC";
  } catch {
    // keep defaults
  }
}

function hydrateTable() {
  const stored = readStorage(STORAGE_KEYS.table);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    state.table.fx = typeof parsed.fx === "string" ? parsed.fx : state.table.fx;
    state.table.gx = typeof parsed.gx === "string" ? parsed.gx : state.table.gx;
    state.table.start = typeof parsed.start === "string" ? parsed.start : state.table.start;
    state.table.end = typeof parsed.end === "string" ? parsed.end : state.table.end;
    state.table.step = typeof parsed.step === "string" ? parsed.step : state.table.step;
    state.table.rows = Array.isArray(parsed.rows) ? parsed.rows.slice(0, 200) : [];
    state.table.result = typeof parsed.result === "string" ? parsed.result : "";
  } catch {
    // keep defaults
  }
}

function hydrateTools() {
  const stored = readStorage(STORAGE_KEYS.tools);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    const keys = [
      "fractionInput", "dmsInput", "polarX", "polarY", "cartR", "cartTheta",
      "primeInput", "randMin", "randMax", "engInput", "constantKey",
      "unitGroup", "unitFrom", "unitTo", "unitInput",
    ];
    for (const key of keys) {
      if (typeof parsed[key] === "string" && state.tools[key] !== undefined) {
        state.tools[key] = parsed[key];
      }
    }
  } catch {
    // keep defaults
  }
}

function bindEvents() {
  elements.modeTabs.forEach((button) => button.addEventListener("click", handleModeTabClick));
  // 工具顶栏按钮在 handleGlobalClick 中委托处理
  if (elements.quickActions) {
    elements.quickActions.addEventListener("click", handleQuickActionClick);
  }
  elements.clearHistoryBtn.addEventListener("click", () => {
    state.history = [];
    persistHistory();
    renderHistory();
  });
  if (elements.uiSearchInput) {
    elements.uiSearchInput.addEventListener("input", handleUiSearchInput);
  }
  if (elements.clearUiSearchBtn) {
    elements.clearUiSearchBtn.addEventListener("click", clearUiSearch);
  }

  elements.historyList.addEventListener("click", handleHistoryClick);

  document.addEventListener("keydown", handleKeyboard);
  document.addEventListener("pointerover", handlePointerHint);
  document.addEventListener("pointerout", handlePointerHintLeave);

  document.addEventListener("click", handleGlobalClick);
  document.addEventListener("input", handleGlobalInput);
  document.addEventListener("change", handleGlobalChange);

  window.addEventListener("pagehide", flushStorageWrites);
  window.addEventListener("resize", handleChartResize);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushStorageWrites();
  });
}

function handleGlobalClick(event) {
  const target = event.target;

  // 工具顶栏在所有栏目通用，用委托处理（直接绑定在部分内核上不触发）
  const toolTab = target.closest(".tool-tab");
  if (toolTab) { switchTool(toolTab.dataset.tool); return; }

  if (elements.keypad && elements.keypad.contains(target)) {
    const btn = target.closest("button[data-action]");
    if (btn) {
      const action = btn.dataset.action;
      const shiftAction = btn.dataset.shiftAction;
      if (state.shift && shiftAction) {
        insertText(shiftAction);
        state.shift = false;
        persistShift();
      } else {
        handleAction(action);
      }
      if (action !== "shift") { state.shift = false; persistShift(); }
      if (action !== "equals") { state.justEvaluated = false; }
      if (state.expression === "") { state.preview = ""; }
      persistExpression();
      updateDisplay();
      evaluatePreview();
    }
    return;
  }

  const activeWorkspace = getActiveWorkspaceEl();
  if (!activeWorkspace || !activeWorkspace.contains(target)) return;

  handleWorkspaceClick(target);
}

function handleWorkspaceClick(target) {
  const matrixOp = target.closest("[data-matrix-op]");
  if (matrixOp) { try { applyMatrixOperation(matrixOp.dataset.matrixOp); } catch (e) { setHoverHint("矩阵运算出错: " + e.message); } return; }

  const statsAction = target.closest("[data-stats-action]");
  if (statsAction) { handleStatsAction(statsAction.dataset.statsAction, statsAction.dataset.index); return; }

  const complexOp = target.closest("[data-complex-op]");
  if (complexOp) { try { applyComplexOperation(complexOp.dataset.complexOp); } catch (e) { setHoverHint("复数运算出错: " + e.message); } return; }

  const baseQuick = target.closest("[data-base-quick]");
  if (baseQuick) {
    state.base.activeQuick = baseQuick.dataset.baseQuick;
    state.base.source = baseQuick.dataset.baseQuick;
    if (["BIN", "OCT", "DEC", "HEX"].includes(baseQuick.dataset.baseQuick)) state.base.target = baseQuick.dataset.baseQuick;
    persistBase();
    renderModeWorkspace();
    return;
  }

  const commitResult = target.closest('[data-mode-action="commit-result"]');
  if (commitResult) {
    if (state.mode === "standard") {
      commitEvaluation();
    } else if (state.mode === "matrix") {
      const activeOp = document.querySelector("[data-matrix-op].is-active, .mode-action.is-active");
      if (activeOp) applyMatrixOperation(activeOp.dataset.matrixOp);
    } else if (state.mode === "stats") {
      if (String(state.stats.input).trim()) {
        handleStatsAction("add");
      } else {
        refreshStatsWorkspace();
      }
    } else if (state.mode === "complex") {
      const activeOp = document.querySelector("[data-complex-op].is-active, .complex-op-btn.is-active");
      if (activeOp) applyComplexOperation(activeOp.dataset.complexOp);
    } else if (state.mode === "base") {
      convertAndPersistBase();
    } else if (state.mode === "equation" || state.mode === "vector" || state.mode === "calculus" || state.mode === "logic" || state.mode === "table" || state.mode === "tools") {
      const activeAction = document.querySelector("[data-adv-action].is-active, .mode-action.is-active");
      if (activeAction) handleAdvancedAction(activeAction.dataset.advAction);
    }
    return;
  }

  const baseConvert = target.closest('[data-mode-action="convert-base"]');
  if (baseConvert) { convertAndPersistBase(); return; }

  const copyBtn = target.closest("[data-copy-text]");
  if (copyBtn) { copyTextToClipboard(copyBtn.dataset.copyText || "", copyBtn); return; }

  const labRowDel = target.closest('[data-adv-action="labrec-del-row"]');
  if (labRowDel) {
    const project = labActiveProject();
    if (project) {
      project.rows.splice(Number(labRowDel.dataset.row), 1);
      persistLabrec();
      renderActiveWorkspace();
    }
    return;
  }

  const labPhotoDel = target.closest('[data-adv-action="labrec-del-photo"]');
  if (labPhotoDel) {
    const project = labActiveProject();
    if (project) {
      project.photos = project.photos.filter((p) => p.id !== labPhotoDel.dataset.photo);
      persistLabrec();
      renderActiveWorkspace();
    }
    return;
  }

  const advAction = target.closest("[data-adv-action]");
  if (advAction) { handleAdvancedAction(advAction.dataset.advAction); return; }

}

function handleGlobalInput(event) {
  const target = event.target;
  const activeWorkspace = getActiveWorkspaceEl();
  if (!activeWorkspace || !activeWorkspace.contains(target)) return;

  switch (target.id) {
    case "statsInput": state.stats.input = target.value; persistStats(); break;
    case "baseInput": state.base.input = target.value; persistBase(); refreshBaseWorkspace(); break;
    case "solveExpr": state.equation.solveExpression = target.value; persistEquation(); break;
    case "solveInitial": state.equation.solveInitial = target.value; persistEquation(); break;
    case "diffExpr": state.calculus.expression = target.value; persistCalculus(); break;
    case "diffPoint": state.calculus.point = target.value; persistCalculus(); break;
    case "intLower": state.calculus.lower = target.value; persistCalculus(); break;
    case "intUpper": state.calculus.upper = target.value; persistCalculus(); break;
    case "sigmaExpr": state.calculus.sigmaExpression = target.value; persistCalculus(); break;
    case "sigmaLower": state.calculus.sigmaLower = target.value; persistCalculus(); break;
    case "sigmaUpper": state.calculus.sigmaUpper = target.value; persistCalculus(); break;
    case "propA": state.equation.proportion.a = target.value; persistEquation(); break;
    case "propB": state.equation.proportion.b = target.value; persistEquation(); break;
    case "propC": state.equation.proportion.c = target.value; persistEquation(); break;
    case "propD": state.equation.proportion.d = target.value; persistEquation(); break;
    case "v1x": if (state.vector.vectors.v1) state.vector.vectors.v1[0] = Number(target.value) || 0; persistVector(); break;
    case "v1y": if (state.vector.vectors.v1) state.vector.vectors.v1[1] = Number(target.value) || 0; persistVector(); break;
    case "v1z": if (state.vector.vectors.v1) state.vector.vectors.v1[2] = Number(target.value) || 0; persistVector(); break;
    case "v2x": if (state.vector.vectors.v2) state.vector.vectors.v2[0] = Number(target.value) || 0; persistVector(); break;
    case "v2y": if (state.vector.vectors.v2) state.vector.vectors.v2[1] = Number(target.value) || 0; persistVector(); break;
    case "v2z": if (state.vector.vectors.v2) state.vector.vectors.v2[2] = Number(target.value) || 0; persistVector(); break;
    case "logicA": state.logic.a = target.value; persistLogic(); break;
    case "logicB": state.logic.b = target.value; persistLogic(); break;
    case "booleanVars": state.boolean.varText = target.value; persistBoolean(); updateBooleanVarHint(); break;
    case "booleanOutCount": state.boolean.outCount = clampInt(target.value, 1, 10, 1); persistBoolean(); break;
    case "booleanOutNames": state.boolean.outNamesText = target.value; persistBoolean(); break;
    case "labNewName": state.labrec.newName = target.value; persistLabrec(); break;
    case "labNewFields": state.labrec.newFields = target.value; persistLabrec(); break;
    case "dpRawInput": state.dataproc.rawInput = target.value; persistDataproc(); break;
    case "tableFx": state.table.fx = target.value; persistTable(); break;
    case "tableGx": state.table.gx = target.value; persistTable(); break;
    case "tableStart": state.table.start = target.value; persistTable(); break;
    case "tableEnd": state.table.end = target.value; persistTable(); break;
    case "tableStep": state.table.step = target.value; persistTable(); break;
    case "fractionInput": state.tools.fractionInput = target.value; persistTools(); break;
    case "dmsInput": state.tools.dmsInput = target.value; persistTools(); break;
    case "polarX": state.tools.polarX = target.value; persistTools(); break;
    case "polarY": state.tools.polarY = target.value; persistTools(); break;
    case "cartR": state.tools.cartR = target.value; persistTools(); break;
    case "cartTheta": state.tools.cartTheta = target.value; persistTools(); break;
    case "primeInput": state.tools.primeInput = target.value; persistTools(); break;
    case "engInput": state.tools.engInput = target.value; persistTools(); break;
    case "randMin": state.tools.randMin = target.value; persistTools(); break;
    case "randMax": state.tools.randMax = target.value; persistTools(); break;
    case "unitFrom": state.tools.unitFrom = target.value; persistTools(); break;
    case "unitTo": state.tools.unitTo = target.value; persistTools(); break;
    case "unitInput": state.tools.unitInput = target.value; persistTools(); break;
    case "complexARe": state.complex.a.re = Number(target.value) || 0; persistComplex(); break;
    case "complexAIm": state.complex.a.im = Number(target.value) || 0; persistComplex(); break;
    case "complexBRe": state.complex.b.re = Number(target.value) || 0; persistComplex(); break;
    case "complexBIm": state.complex.b.im = Number(target.value) || 0; persistComplex(); break;
  }

  const matrixInput = target.closest("[data-matrix-input]");
  if (matrixInput) { updateMatrixField(matrixInput); }

  const labCell = target.closest("[data-lab-cell]");
  if (labCell) {
    const project = labActiveProject();
    const [rowIdx, colIdx] = String(labCell.dataset.labCell || "").split(",").map(Number);
    if (project && project.rows[rowIdx]) {
      project.rows[rowIdx][colIdx] = target.value;
      persistLabrec();
    }
  }

  const labNewCell = target.closest("[data-lab-new-col]");
  if (labNewCell) {
    state.labrec.rowDraft[Number(labNewCell.dataset.labNewCol)] = target.value;
  }
}

function handleGlobalChange(event) {
  const target = event.target;
  const activeWorkspace = getActiveWorkspaceEl();
  if (!activeWorkspace || !activeWorkspace.contains(target)) return;

  if (target.classList.contains("tt-select")) {
    const row = state.boolean.rows[Number(target.dataset.ttRow)];
    const outIdx = Number(target.dataset.ttOut);
    if (row && row.outputs[outIdx] !== undefined) {
      row.outputs[outIdx] = target.value === "1" ? 1 : target.value === "x" ? "x" : 0;
      state.boolean.results = null;
      const hint = document.getElementById("booleanDirtyHint");
      if (hint) hint.textContent = "输出已修改，请重新点击「生成最简表达式」。";
      persistBoolean();
    }
    return;
  }

  if (target.id === "labPhotoCamera" || target.id === "labPhotoGallery") {
    handleLabPhotoFiles(target.files);
    target.value = "";
    return;
  }

  switch (target.id) {
    case "matrixSizeSelect": {
      const n = Number(target.value);
      if ([2, 3, 4].includes(n)) {
        state.matrix.size = n;
        state.matrix.matrices.a = resizeMatrix(state.matrix.matrices.a, n);
        state.matrix.matrices.b = resizeMatrix(state.matrix.matrices.b, n);
        state.matrix.matrices.c = resizeMatrix(state.matrix.matrices.c, n);
        state.matrix.matrices.d = resizeMatrix(state.matrix.matrices.d, n);
        persistMatrix();
        renderModeWorkspace();
      }
      break;
    }
    case "linearSize": {
      const n = Number(target.value);
      if ([2, 3, 4].includes(n)) { state.equation.linearSize = n; state.equation.linearRows = defaultLinearRows(n); persistEquation(); }
      break;
    }
    case "polyDegree": state.equation.polyDegree = Number(target.value); persistEquation(); break;
    case "ineqSign": state.equation.inequalitySign = target.value; persistEquation(); break;
    case "logicBase": state.logic.base = target.value; persistLogic(); renderModeWorkspace(); break;
    case "labProjectSelect": {
      state.labrec.activeId = target.value;
      state.labrec.confirmDelete = false;
      state.labrec.confirmClear = false;
      persistLabrec();
      renderActiveWorkspace();
      break;
    }
    case "labChartType": state.labrec.chartType = target.value; persistLabrec(); renderActiveWorkspace(); break;
    case "labXCol": state.labrec.xCol = Number(target.value); persistLabrec(); renderActiveWorkspace(); break;
    case "labYCol": state.labrec.yCol = Number(target.value); persistLabrec(); renderActiveWorkspace(); break;
    case "dpChartType": state.dataproc.chartType = target.value; persistDataproc(); renderActiveWorkspace(); break;
    case "dpXCol": state.dataproc.xCol = Number(target.value); computeDataprocFit(); persistDataproc(); renderActiveWorkspace(); break;
    case "dpYCol": state.dataproc.yCol = Number(target.value); computeDataprocFit(); persistDataproc(); renderActiveWorkspace(); break;
    case "dpFitType": state.dataproc.fitType = target.value; computeDataprocFit(); persistDataproc(); renderActiveWorkspace(); break;
    case "constKey": state.tools.constantKey = target.value; persistTools(); break;
    case "unitGroup": {
      state.tools.unitGroup = target.value;
      const units = UNIT_GROUPS[state.tools.unitGroup];
      if (units) {
        const keys = Object.keys(units);
        if (keys.length > 0) {
          state.tools.unitFrom = keys[0];
          state.tools.unitTo = keys.length > 1 ? keys[1] : keys[0];
        }
      }
      persistTools();
      renderModeWorkspace();
      break;
    }
    case "baseSource": state.base.source = normalizeBaseName(target.value) ?? state.base.source; persistBase(); refreshBaseWorkspace(); break;
    case "baseTarget": state.base.target = normalizeBaseName(target.value) ?? state.base.target; persistBase(); refreshBaseWorkspace(); break;
  }
}

function handlePointerHint(event) {
  const target = event.target.closest("[data-tip]");
  if (!target) return;
  setHoverHint(target.dataset.tip);
}

function handlePointerHintLeave(event) {
  const target = event.target.closest("[data-tip]");
  if (!target) return;

  const related = event.relatedTarget && event.relatedTarget.closest ? event.relatedTarget.closest("[data-tip]") : null;
  if (related === target) return;
  setHoverHint(MODE_HINTS[state.mode]);
}

function setHoverHint(text) {
  elements.hoverHint.textContent = text || MODE_HINTS[state.mode];
}

function handleModeTabClick(event) {
  const button = event.target.closest("button[data-mode]");
  if (!button) return;
  switchMode(button.dataset.mode);
}

function switchMode(mode) {
  if (!MODE_LABELS[mode]) return;
  state.mode = mode;
  state.shift = false;
  persistMode();
  persistShift();
  updateDisplay();
  renderModeTabs();
  renderModeWorkspace();
  syncModeWorkspace();
  updateModeSubtitle();
  setHoverHint(MODE_HINTS[state.mode]);
}

function renderModeTabs() {
  elements.modeTabs.forEach((button) => {
    const active = button.dataset.mode === state.mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  applyUiFilter();
}

function renderKeypad() {
  elements.keypad.innerHTML = SCIENTIFIC_KEY_ROWS.map((row) => {
    return `<div class="key-row">${row.map((key) => {
      const secondary = key.secondary ? `<span class="key__secondary">${escapeHtml(key.secondary)}</span>` : "";
      return `
        <button class="${key.className}" type="button" data-action="${escapeHtml(key.action)}" ${key.shiftAction ? `data-shift-action="${escapeHtml(key.shiftAction)}"` : ""} data-tip="${escapeHtml(key.tip)}">
          <span class="key__primary">${escapeHtml(key.label)}</span>
          ${secondary}
        </button>
      `;
    }).join("")}</div>`;
  }).join("");
  applyUiFilter();
}

function renderHistory() {
  elements.historyList.innerHTML = state.history.length
    ? state.history.map((item, index) => `
      <li>
        <button class="history-item" type="button" data-history-index="${index}" data-tip="点击可恢复这条表达式">
          <div class="history-top">${escapeHtml(prettyExpression(item.expression))}</div>
          <div class="history-bottom">= ${escapeHtml(item.result)}</div>
        </button>
      </li>
    `).join("")
    : `<li class="history-empty">暂无计算记录</li>`;
  applyUiFilter();
}

function handleHistoryClick(event) {
  const button = event.target.closest("button[data-history-index]");
  if (!button) return;
  const entry = state.history[Number(button.dataset.historyIndex)];
  if (!entry) return;
  state.expression = entry.expression;
  state.preview = entry.result;
  state.justEvaluated = false;
  persistExpression();
  updateDisplay();
  evaluatePreview();
}

function handleKeypadClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const shiftAction = button.dataset.shiftAction;

  if (state.shift && shiftAction) {
    insertText(shiftAction);
    state.shift = false;
    persistShift();
    updateDisplay();
    evaluatePreview();
    return;
  }

  handleAction(action);
}

function handleAction(action) {
  switch (action) {
    case "shift":
      state.shift = !state.shift;
      persistShift();
      break;
    case "angle":
      cycleAngleMode();
      break;
    case "ac":
      state.expression = "";
      state.preview = "";
      state.justEvaluated = false;
      break;
    case "del":
      state.expression = state.expression.slice(0, -1);
      break;
    case "equals":
      commitEvaluation();
      break;
    case "negate":
      toggleSignedTerm();
      break;
    case "mc":
      state.memory = 0;
      persistMemory();
      break;
    case "mr":
      insertText(formatNumber(state.memory));
      break;
    case "mplus":
      applyMemoryDelta(1);
      break;
    case "mminus":
      applyMemoryDelta(-1);
      break;
    default:
      insertText(action);
      break;
  }

  if (action !== "shift") {
    state.shift = false;
    persistShift();
  }

  if (action !== "equals") {
    state.justEvaluated = false;
  }

  if (state.expression === "") {
    state.preview = "";
  }

  persistExpression();
  updateDisplay();
  evaluatePreview();
}

function handleKeyboard(event) {
  if (isEditableTarget(event.target)) return;

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    focusUiSearch();
    return;
  }

  const key = event.key;

  if (key === "Enter" || key === "=") {
    event.preventDefault();
    commitEvaluation();
    return;
  }

  if (key === "Backspace") {
    event.preventDefault();
    state.expression = state.expression.slice(0, -1);
    persistExpression();
    updateDisplay();
    evaluatePreview();
    return;
  }

  if (key === "Escape") {
    event.preventDefault();
    if (state.uiSearch) {
      clearUiSearch();
      return;
    }
    handleAction("ac");
    return;
  }

  const keyMap = {
    "/": "/",
    "*": "*",
    "-": "-",
    "+": "+",
    "^": "^",
    "(": "(",
    ")": ")",
    ".": ".",
    ",": ",",
    "!": "!",
    "%": "%",
  };

  if (Object.prototype.hasOwnProperty.call(keyMap, key)) {
    insertText(keyMap[key]);
    persistExpression();
    updateDisplay();
    evaluatePreview();
    return;
  }

  if (/^[0-9]$/.test(key)) {
    insertText(key);
    persistExpression();
    updateDisplay();
    evaluatePreview();
  }
}

function isEditableTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function handleQuickActionClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  handleAction(button.dataset.action);
}

function handleUiSearchInput(event) {
  state.uiSearch = event.target.value || "";
  applyUiFilter();
}

function clearUiSearch() {
  state.uiSearch = "";
  if (elements.uiSearchInput) {
    elements.uiSearchInput.value = "";
    elements.uiSearchInput.focus();
  }
  applyUiFilter();
}

function focusUiSearch() {
  if (!elements.uiSearchInput) return;
  elements.uiSearchInput.focus();
  elements.uiSearchInput.select();
}

function applyUiFilter() {
  const query = state.uiSearch.trim().toLowerCase();
  if (!query && !uiFilterActive) return;
  uiFilterActive = Boolean(query);

  // 只在当前栏目内筛选，避免统计到隐藏工具页里的按钮
  const selectors = state.tool === "calc"
    ? ["#keypad button", ".mode-tabs button", ".quick-actions button", ".history-item", ".mode-workspace button"]
    : [".tool-page.is-active button"];
  const buttons = document.querySelectorAll(selectors.join(", "));
  let visibleCount = 0;

  buttons.forEach((button) => {
    const searchable = [
      button.textContent,
      button.dataset.action,
      button.dataset.mode,
      button.dataset.tip,
      button.getAttribute("aria-label"),
      button.getAttribute("title"),
    ].filter(Boolean).join(" ").toLowerCase();
    const matches = !query || searchable.includes(query);
    // 模式标签只淡化不隐藏，保证搜索时仍可切换模式
    if (button.classList.contains("mode-tab")) {
      button.hidden = false;
      button.classList.toggle("search-dimmed", !matches);
    } else {
      button.hidden = !matches;
    }
    if (matches) visibleCount += 1;
  });

  if (elements.uiSearchStatus) {
    elements.uiSearchStatus.textContent = query
      ? visibleCount > 0
        ? `找到 ${visibleCount} 个匹配项`
        : "未找到匹配按钮"
      : "输入关键字筛选按钮";
  }
}

function cycleAngleMode() {
  state.angleMode = state.angleMode === "DEG" ? "RAD" : state.angleMode === "RAD" ? "GRAD" : "DEG";
  persistAngleMode();
  updateDisplay();
}

function toggleSignedTerm() {
  if (!state.expression) {
    state.expression = "-";
    return;
  }

  const boundaryMatch = state.expression.match(/(^|[+\-*/^(,])([^+\-*/^(,]+)$/);
  if (!boundaryMatch) {
    state.expression = state.expression.startsWith("-") ? state.expression.slice(1) : `-${state.expression}`;
    return;
  }

  const term = boundaryMatch[2];
  const startIndex = state.expression.length - term.length;
  const beforeTerm = state.expression.slice(0, startIndex);

  if (term.startsWith("-")) {
    state.expression = `${beforeTerm}${term.slice(1)}`;
    return;
  }

  state.expression = `${beforeTerm}(-${term})`;
}

function applyMemoryDelta(sign) {
  const value = getCurrentValue();
  if (!Number.isFinite(value)) return;
  state.memory += value * sign;
  persistMemory();
}

function insertText(text) {
  if (!text) return;

  const normalized = normalizeDisplayText(text);
  if (state.justEvaluated && /^[0-9.(a-zA-Z]/.test(normalized)) {
    state.expression = "";
  }

  if (!state.expression || state.expression === "0") {
    if (/^[+*/^,)]$/.test(normalized)) {
      state.expression = `0${normalized}`;
      return;
    }
    state.expression = normalized;
    return;
  }

  const lastChar = state.expression.slice(-1);
  const startsWithDigit = /^[0-9.]$/.test(normalized[0]);
  const endsWithDigit = /[0-9.]$/.test(lastChar);
  const shouldInsertMultiplication = !(startsWithDigit && endsWithDigit) && /[0-9)aeinrs]/i.test(lastChar) && /^[a-zA-Z(0-9]/.test(normalized);
  state.expression += shouldInsertMultiplication ? `*${normalized}` : normalized;
}

function commitEvaluation() {
  const value = evaluateExpression(state.expression);
  if (!Number.isFinite(value)) {
    state.preview = "数学错误";
    updateDisplay();
    return;
  }

  const result = formatNumber(value);
  if (state.expression.trim()) {
    state.history.unshift({ expression: state.expression, result });
    state.history = state.history.slice(0, 12);
    persistHistory();
    renderHistory();
  }

  state.ans = value;
  state.expression = result;
  state.preview = result;
  state.justEvaluated = true;
  persistExpression();
  updateDisplay();
}

function evaluatePreview() {
  if (!state.expression.trim()) {
    state.preview = "";
    updateDisplay();
    return;
  }

  const value = evaluateExpression(state.expression);
  if (!Number.isFinite(value)) {
    state.preview = "";
    updateDisplay();
    return;
  }

  state.preview = formatNumber(value);
  updateDisplay();
}

function getCurrentValue() {
  const previewValue = evaluateExpression(state.expression);
  if (Number.isFinite(previewValue)) {
    state.ans = previewValue;
    return previewValue;
  }
  return state.ans;
}

function updateDisplay() {
  elements.expressionView.textContent = prettyExpression(state.expression || "0");
  elements.previewView.textContent = state.preview || "";
  elements.modeChip.textContent = MODE_LABELS[state.mode] || "标准";
  elements.angleModeChip.textContent = `角度：${angleModeLabel(state.angleMode)}`;
  elements.shiftChip.textContent = state.shift ? "副功能：开" : "副功能：关";
  elements.memoryChip.textContent = `内存 ${formatNumber(state.memory)}`;
}

function updateModeSubtitle() {
  if (elements.modeSubtitle) {
    elements.modeSubtitle.textContent = `${MODE_LABELS[state.mode] || "标准"}工具区`;
  }
}

function syncModeWorkspace() {
  switch (state.mode) {
    case "standard":
      break;
    case "equation":
      refreshEquationWorkspace();
      break;
    case "matrix":
      refreshMatrixWorkspace();
      break;
    case "vector":
      refreshVectorWorkspace();
      break;
    case "stats":
      refreshStatsWorkspace();
      break;
    case "calculus":
      refreshCalculusWorkspace();
      break;
    case "complex":
      refreshComplexWorkspace();
      break;
    case "base":
      refreshBaseWorkspace();
      break;
    case "logic":
      refreshLogicWorkspace();
      break;
    case "table":
      refreshTableWorkspace();
      break;
    case "tools":
      refreshToolsWorkspace();
      break;
    default:
      break;
  }
}

function renderModeWorkspace() {
  try {
    elements.modeWorkspace.innerHTML = buildModeWorkspace();
  } catch (e) {
    elements.modeWorkspace.innerHTML = `<div class="mode-banner"><h3 class="mode-title">加载错误</h3><p class="mode-copy">工作区渲染出错：${escapeHtml(e.message)}</p></div>`;
  }
  syncModeWorkspace();
  updateModeSubtitle();
  syncWorkspaceButtonStates();
  applyUiFilter();
}

/* ===================== 工具栏目切换 ===================== */

const TOOL_RENDERERS = {
  boolean: renderBooleanWorkspace,
  labrec: renderLabrecWorkspace,
  dataproc: renderDataprocWorkspace,
};

function renderActiveWorkspace() {
  if (state.tool === "calc") {
    renderModeWorkspace();
    return;
  }
  renderToolPage(state.tool);
}

function renderToolPage(tool) {
  const root = elements.toolRoots[tool];
  const renderer = TOOL_RENDERERS[tool];
  if (!root || !renderer) return;
  try {
    root.innerHTML = renderer();
  } catch (e) {
    root.innerHTML = `<div class="mode-banner"><h3 class="mode-title">加载错误</h3><p class="mode-copy">页面渲染出错：${escapeHtml(e.message)}</p></div>`;
  }
  refreshToolWorkspace(tool);
}

function refreshToolWorkspace(tool) {
  const root = elements.toolRoots[tool];
  if (root) syncWorkspaceButtonStates(root);
  if (tool === "labrec") requestAnimationFrame(drawLabChart);
  if (tool === "dataproc") requestAnimationFrame(drawDataprocChart);
}

function switchTool(tool) {
  if (!TOOL_LABELS[tool]) tool = "calc";
  state.tool = tool;
  persistTool();

  elements.toolTabs.forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  Object.entries(elements.toolPages).forEach(([key, page]) => {
    if (page) page.classList.toggle("is-active", key === tool);
  });

  if (tool === "calc") {
    updateDisplay();
    syncWorkspaceButtonStates();
    return;
  }
  renderToolPage(tool);
}

function persistTool() {
  writeStorage(STORAGE_KEYS.tool, state.tool);
}

function hydrateTool() {
  const stored = readStorage(STORAGE_KEYS.tool);
  if (stored && TOOL_LABELS[stored]) state.tool = stored;
}

function buildModeWorkspace() {
  if (state.mode === "standard") {
    return `
      <div class="mode-banner">
        <h3 class="mode-title">标准模式</h3>
        <p class="mode-copy">在上方键盘输入表达式或直接用键盘键入。把鼠标悬停在按钮上可以查看中文说明。</p>
        <div class="mode-badges">
          <span class="mode-badge">角度：${angleModeLabel(state.angleMode)}</span>
          <span class="mode-badge">历史：${state.history.length} 条</span>
          <span class="mode-badge">内存：${formatNumber(state.memory)}</span>
        </div>
        <button class="mode-result-btn" type="button" data-mode-action="commit-result">得出结果</button>
      </div>
      <div class="module-card">
        <h3>使用提示</h3>
        <p class="mode-copy">支持常用三角函数、指数对数、阶乘、组合排列、随机数、常量和上次结果。副功能键可以快速输入反三角、平方、开方和取模。</p>
      </div>
    `;
  }

  if (state.mode === "matrix") {
    return `
      <div class="mode-banner">
        <h3 class="mode-title">矩阵模式</h3>
        <p class="mode-copy">支持 2×2、3×3 和 4×4 矩阵的加法、减法、乘法、转置、行列式和逆矩阵。输入后点击运算按钮即可得到结果。</p>
      </div>
      <div class="matrix-layout">
        <div class="mode-action-row">
          <label class="field-card">
            <span class="field-label">阶数</span>
            <select id="matrixSizeSelect" class="base-select mode-control" data-mode-action="matrix-size">
              <option value="2" ${state.matrix.size === 2 ? "selected" : ""}>2 × 2</option>
              <option value="3" ${state.matrix.size === 3 ? "selected" : ""}>3 × 3</option>
              <option value="4" ${state.matrix.size === 4 ? "selected" : ""}>4 × 4</option>
            </select>
          </label>
          <button class="mode-action is-active" type="button" data-matrix-op="add" data-tip="计算 A + B">A + B</button>
          <button class="mode-action" type="button" data-matrix-op="sub" data-tip="计算 A - B">A - B</button>
          <button class="mode-action" type="button" data-matrix-op="mul" data-tip="计算 A × B">A × B</button>
          <button class="mode-action" type="button" data-matrix-op="transposeA" data-tip="计算 A 的转置">Aᵀ</button>
          <button class="mode-action" type="button" data-matrix-op="transposeB" data-tip="计算 B 的转置">Bᵀ</button>
          <button class="mode-action" type="button" data-matrix-op="detA" data-tip="计算 A 的行列式">det A</button>
          <button class="mode-action" type="button" data-matrix-op="detB" data-tip="计算 B 的行列式">det B</button>
          <button class="mode-action" type="button" data-matrix-op="inverseA" data-tip="计算 A 的逆矩阵">A⁻¹</button>
          <button class="mode-action" type="button" data-matrix-op="inverseB" data-tip="计算 B 的逆矩阵">B⁻¹</button>
        </div>

        <div class="matrix-columns">
          <section class="matrix-card">
            <div class="panel-head">
              <h3 class="section-title">矩阵 A</h3>
              <span class="section-subtitle">可编辑</span>
            </div>
            <div class="matrix-grid" style="--matrix-size:${state.matrix.size}">
              ${renderMatrixInputs("a")}
            </div>
          </section>

          <section class="matrix-card">
            <div class="panel-head">
              <h3 class="section-title">矩阵 B</h3>
              <span class="section-subtitle">可编辑</span>
            </div>
            <div class="matrix-grid" style="--matrix-size:${state.matrix.size}">
              ${renderMatrixInputs("b")}
            </div>
          </section>
        </div>

        <section class="result-panel">
          <h3>结果</h3>
          <p class="matrix-status">${escapeHtml(state.matrix.operation || "请先选择一个矩阵运算。")}</p>
          <pre id="matrixResult" class="result-pre">${escapeHtml(state.matrix.result || "尚未计算")}</pre>
          <button class="mode-result-btn" type="button" data-mode-action="commit-result">得出结果</button>
        </section>
      </div>
    `;
  }

  if (state.mode === "stats") {
    return `
      <div class="mode-banner">
        <h3 class="mode-title">统计模式</h3>
        <p class="mode-copy">录入样本数据后，可直接查看样本数量、总和、均值、方差、标准差、最小值和最大值。</p>
      </div>
      <div class="layout-stack">
        <section class="field-card">
          <span class="field-label">输入样本</span>
          <input id="statsInput" class="stats-input" type="text" value="${escapeAttr(state.stats.input)}" placeholder="例如：12, 18, 24" data-tip="输入一个数字后按加入，或用逗号、空格分隔多个样本。" />
          <div class="button-row" style="margin-top: 10px;">
            <button class="stats-pill is-active" type="button" data-stats-action="add" data-tip="把输入框中的样本加入统计列表">加入样本</button>
            <button class="stats-pill" type="button" data-stats-action="clear" data-tip="清空所有统计数据">清空</button>
            <button class="stats-pill" type="button" data-stats-action="fill-demo" data-tip="填入一组示例数据">示例数据</button>
          </div>
        </section>

        <section class="module-card">
          <h3>样本列表</h3>
          <ul id="statsList" class="stats-list">${renderStatsList()}</ul>
        </section>

        <section class="result-panel">
          <h3>统计结果</h3>
          <div class="summary-grid">${renderStatsSummary()}</div>
          <button class="mode-result-btn" type="button" data-mode-action="commit-result">得出结果</button>
        </section>
      </div>
    `;
  }

  if (state.mode === "complex") {
    return `
      <div class="mode-banner">
        <h3 class="mode-title">复数模式</h3>
        <p class="mode-copy">输入 a + bi 与 c + di 两个复数，可以直接做加减乘除，也能查看共轭、模长和辐角。</p>
      </div>
      <div class="complex-layout">
        <div class="complex-grid">
          <section class="field-card">
            <span class="field-label">复数 A 实部</span>
            <input id="complexARe" class="complex-input" type="number" step="any" value="${escapeAttr(String(state.complex.a.re))}" data-complex-field="aRe" data-tip="复数 A 的实数部分。" />
          </section>
          <section class="field-card">
            <span class="field-label">复数 A 虚部</span>
            <input id="complexAIm" class="complex-input" type="number" step="any" value="${escapeAttr(String(state.complex.a.im))}" data-complex-field="aIm" data-tip="复数 A 的虚数部分。" />
          </section>
          <section class="field-card">
            <span class="field-label">复数 B 实部</span>
            <input id="complexBRe" class="complex-input" type="number" step="any" value="${escapeAttr(String(state.complex.b.re))}" data-complex-field="bRe" data-tip="复数 B 的实数部分。" />
          </section>
          <section class="field-card">
            <span class="field-label">复数 B 虚部</span>
            <input id="complexBIm" class="complex-input" type="number" step="any" value="${escapeAttr(String(state.complex.b.im))}" data-complex-field="bIm" data-tip="复数 B 的虚数部分。" />
          </section>
        </div>

        <div class="button-row">
          <button class="complex-op-btn is-active" type="button" data-complex-op="add" data-tip="A + B">加法</button>
          <button class="complex-op-btn" type="button" data-complex-op="sub" data-tip="A - B">减法</button>
          <button class="complex-op-btn" type="button" data-complex-op="mul" data-tip="A × B">乘法</button>
          <button class="complex-op-btn" type="button" data-complex-op="div" data-tip="A ÷ B">除法</button>
          <button class="complex-op-btn" type="button" data-complex-op="conjA" data-tip="A 的共轭">A 共轭</button>
          <button class="complex-op-btn" type="button" data-complex-op="absA" data-tip="A 的模长">|A|</button>
          <button class="complex-op-btn" type="button" data-complex-op="argA" data-tip="A 的辐角">arg A</button>
        </div>

        <section class="result-panel">
          <h3>结果</h3>
          <p class="complex-status">${escapeHtml(state.complex.operation || "请选择一个复数运算。")}</p>
          <pre id="complexResult" class="result-pre">${escapeHtml(formatComplexResult(state.complex.result))}</pre>
          <button class="mode-result-btn" type="button" data-mode-action="commit-result">得出结果</button>
        </section>
      </div>
    `;
  }

  if (state.mode === "equation" || state.mode === "vector" || state.mode === "calculus" || state.mode === "logic" || state.mode === "table" || state.mode === "tools") {
    return renderAdvancedWorkspace();
  }

  return `
    <div class="mode-banner">
      <h3 class="mode-title">进制模式</h3>
      <p class="mode-copy">输入数值后，选择源进制和目标进制即可转换。也会同步显示二、八、十、十六进制结果。</p>
    </div>
    <div class="base-layout">
      <section class="field-card">
        <span class="field-label">输入数值</span>
        <input id="baseInput" class="base-input" type="text" value="${escapeAttr(state.base.input)}" placeholder="例如：1010 或 1A3F" data-tip="输入待转换的数值。支持 2 到 36 进制的字符。" />
      </section>

      <div class="base-grid">
        <section class="field-card">
          <span class="field-label">源进制</span>
          <select id="baseSource" class="base-select" data-tip="选择输入值所属的进制。">
            ${baseOptionMarkup(state.base.source)}
          </select>
        </section>
        <section class="field-card">
          <span class="field-label">目标进制</span>
          <select id="baseTarget" class="base-select" data-tip="选择希望得到的目标进制。">
            ${baseOptionMarkup(state.base.target)}
          </select>
        </section>
      </div>

      <div class="base-btn-row">
        <button class="base-btn is-active" type="button" data-base-quick="BIN" data-tip="快速切换到二进制">二进制</button>
        <button class="base-btn" type="button" data-base-quick="OCT" data-tip="快速切换到八进制">八进制</button>
        <button class="base-btn" type="button" data-base-quick="DEC" data-tip="快速切换到十进制">十进制</button>
        <button class="base-btn" type="button" data-base-quick="HEX" data-tip="快速切换到十六进制">十六进制</button>
        <button class="base-btn" type="button" data-mode-action="convert-base" data-tip="立即执行转换">转换</button>
      </div>

      <section class="result-panel">
        <h3>转换结果</h3>
        <p class="base-status">${escapeHtml(state.base.source)} → ${escapeHtml(state.base.target)}</p>
        <pre id="baseResult" class="result-pre">${escapeHtml(state.base.result || "尚未转换")}</pre>
        <div class="base-output-grid">${renderBaseSummary()}</div>
        <button class="mode-result-btn" type="button" data-mode-action="commit-result">得出结果</button>
      </section>
    </div>
  `;
}

function baseOptionMarkup(selected) {
  const options = ["BIN", "OCT", "DEC", "HEX"];
  return options.map((base) => `<option value="${base}" ${base === selected ? "selected" : ""}>${base}</option>`).join("");
}

function renderMatrixInputs(which) {
  const matrix = state.matrix.matrices[which];
  let markup = "";
  for (let row = 0; row < state.matrix.size; row += 1) {
    for (let col = 0; col < state.matrix.size; col += 1) {
      const value = matrix[row][col] ?? 0;
      markup += `
        <label class="field-card">
          <span class="matrix-cell-label">${which.toUpperCase()}[${row + 1},${col + 1}]</span>
          <input
            class="matrix-input"
            type="number"
            step="any"
            value="${escapeAttr(String(value))}"
            data-matrix-input="${which}"
            data-row="${row}"
            data-col="${col}"
            data-tip="编辑矩阵 ${which.toUpperCase()} 的第 ${row + 1} 行第 ${col + 1} 列。"
          />
        </label>
      `;
    }
  }
  return markup;
}

function renderStatsList() {
  if (!state.stats.values.length) {
    return `<li class="matrix-status">尚未添加样本。</li>`;
  }

  return state.stats.values.map((value, index) => `<li><button type="button" data-stats-action="remove" data-index="${index}" data-tip="点击删除这个样本">${formatNumber(value)}</button></li>`).join("");
}

function renderStatsSummary() {
  const summary = calculateStats(state.stats.values);
  const cards = [
    ["样本数", formatNumber(summary.count)],
    ["总和", formatNumber(summary.sum)],
    ["平均值", formatNumber(summary.mean)],
    ["最小值", formatNumber(summary.min)],
    ["最大值", formatNumber(summary.max)],
    ["总体标准差", formatNumber(summary.populationStdDev)],
    ["样本标准差", formatNumber(summary.sampleStdDev)],
    ["总体方差", formatNumber(summary.populationVariance)],
    ["样本方差", formatNumber(summary.sampleVariance)],
  ];

  return cards.map(([label, value]) => `
    <div class="summary-card">
      <span class="summary-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function renderBaseSummary() {
  const converted = convertBaseValue(state.base.input, state.base.source, state.base.target);
  if (!converted.ok) {
    return `
      <div class="summary-card">
        <span class="summary-label">错误</span>
        <strong>${escapeHtml(converted.error)}</strong>
      </div>
    `;
  }

  return [
    ["二进制", converted.bin],
    ["八进制", converted.oct],
    ["十进制", converted.dec],
    ["十六进制", converted.hex],
  ].map(([label, value]) => `
    <div class="summary-card">
      <span class="summary-label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function updateMatrixField(input) {
  const matrixName = input.dataset.matrixInput;
  const row = Number(input.dataset.row);
  const col = Number(input.dataset.col);
  const numericValue = Number.parseFloat(input.value);
  if (!state.matrix.matrices[matrixName]) return;
  state.matrix.matrices[matrixName][row][col] = Number.isFinite(numericValue) ? numericValue : 0;
  persistMatrix();
}

function updateComplexField(input) {
  const field = input.dataset.complexField;
  const value = Number.parseFloat(input.value);
  const numeric = Number.isFinite(value) ? value : 0;
  if (field === "aRe") state.complex.a.re = numeric;
  if (field === "aIm") state.complex.a.im = numeric;
  if (field === "bRe") state.complex.b.re = numeric;
  if (field === "bIm") state.complex.b.im = numeric;
  persistComplex();
}

function handleStatsAction(action, index) {
  state.stats.activeAction = action;
  if (action === "add") {
    const parsed = parseStatsInput(state.stats.input);
    if (!parsed.length) return;
    const remaining = MAX_STATS_SAMPLES - state.stats.values.length;
    if (remaining <= 0) {
      setHoverHint(`样本数已达上限 ${MAX_STATS_SAMPLES}，请先清理部分数据`);
      return;
    }
    state.stats.values.push(...parsed.slice(0, remaining));
    state.stats.input = "";
    persistStats();
    refreshStatsWorkspace();
    return;
  }

  if (action === "clear") {
    state.stats.values = [];
    state.stats.input = "";
    state.stats.result = null;
    persistStats();
    refreshStatsWorkspace();
    return;
  }

  if (action === "fill-demo") {
    state.stats.values = [12, 18, 24, 30, 32, 36];
    state.stats.input = "";
    persistStats();
    refreshStatsWorkspace();
    return;
  }

  if (action === "remove") {
    const idx = Number(index);
    if (Number.isInteger(idx) && idx >= 0 && idx < state.stats.values.length) {
      state.stats.values.splice(idx, 1);
      persistStats();
      refreshStatsWorkspace();
    }
  }
}

function applyMatrixOperation(operation) {
  state.matrix.activeAction = operation;
  let result;
  let label = "";

  try {
    switch (operation) {
      case "add":
        result = matrixAdd(state.matrix.matrices.a, state.matrix.matrices.b);
        label = "A + B";
        break;
      case "sub":
        result = matrixSubtract(state.matrix.matrices.a, state.matrix.matrices.b);
        label = "A - B";
        break;
      case "mul":
        result = matrixMultiply(state.matrix.matrices.a, state.matrix.matrices.b);
        label = "A × B";
        break;
      case "transposeA":
        result = transposeMatrix(state.matrix.matrices.a);
        label = "A 的转置";
        break;
      case "transposeB":
        result = transposeMatrix(state.matrix.matrices.b);
        label = "B 的转置";
        break;
      case "detA":
        result = matrixDeterminant(state.matrix.matrices.a);
        label = "A 的行列式";
        break;
      case "detB":
        result = matrixDeterminant(state.matrix.matrices.b);
        label = "B 的行列式";
        break;
      case "inverseA":
        result = inverseMatrix(state.matrix.matrices.a);
        label = "A 的逆矩阵";
        break;
      case "inverseB":
        result = inverseMatrix(state.matrix.matrices.b);
        label = "B 的逆矩阵";
        break;
      default:
        return;
    }
  } catch (error) {
    state.matrix.operation = `${label || "矩阵运算"} 失败`;
    state.matrix.result = error.message || "矩阵运算失败";
    persistMatrix();
    refreshMatrixWorkspace();
    return;
  }

  state.matrix.operation = label;
  state.matrix.result = Array.isArray(result) ? formatMatrix(result) : formatNumber(result);
  persistMatrix();
  refreshMatrixWorkspace();
}

function applyComplexOperation(operation) {
  state.complex.activeAction = operation;
  let result;
  let label = "";

  switch (operation) {
    case "add":
      result = complexAdd(state.complex.a, state.complex.b);
      label = "A + B";
      break;
    case "sub":
      result = complexSubtract(state.complex.a, state.complex.b);
      label = "A - B";
      break;
    case "mul":
      result = complexMultiply(state.complex.a, state.complex.b);
      label = "A × B";
      break;
    case "div":
      result = complexDivide(state.complex.a, state.complex.b);
      label = "A ÷ B";
      break;
    case "conjA":
      result = complexConjugate(state.complex.a);
      label = "A 的共轭";
      break;
    case "absA":
      result = { re: complexMagnitude(state.complex.a), im: 0 };
      label = "A 的模长";
      break;
    case "argA":
      result = { re: complexArgument(state.complex.a), im: 0 };
      label = "A 的辐角";
      break;
    default:
      return;
  }

  state.complex.operation = label;
  state.complex.result = normalizeComplex(result);
  persistComplex();
  refreshComplexWorkspace();
}

function convertAndPersistBase() {
  const converted = convertBaseValue(state.base.input, state.base.source, state.base.target);
  state.base.result = converted.ok ? converted.target : converted.error;
  persistBase();
  refreshBaseWorkspace();
}

function refreshMatrixWorkspace() {
  const result = elements.modeWorkspace.querySelector("#matrixResult");
  if (result) result.textContent = state.matrix.result || "尚未计算";

  const operation = elements.modeWorkspace.querySelector(".matrix-status");
  if (operation) operation.textContent = state.matrix.operation || "请先选择一个矩阵运算。";
  syncWorkspaceButtonStates();
}

function refreshStatsWorkspace() {
  const list = elements.modeWorkspace.querySelector("#statsList");
  if (list) list.innerHTML = renderStatsList();
  const summary = elements.modeWorkspace.querySelector(".summary-grid");
  if (summary) summary.innerHTML = renderStatsSummary();
  const input = elements.modeWorkspace.querySelector("#statsInput");
  if (input) input.value = state.stats.input;
  syncWorkspaceButtonStates();
}

function refreshComplexWorkspace() {
  const result = elements.modeWorkspace.querySelector("#complexResult");
  if (result) result.textContent = formatComplexResult(state.complex.result);
  const operation = elements.modeWorkspace.querySelector(".complex-status");
  if (operation) operation.textContent = state.complex.operation || "请选择一个复数运算。";
  syncWorkspaceButtonStates();
}

function refreshBaseWorkspace() {
  const result = elements.modeWorkspace.querySelector("#baseResult");
  if (result) result.textContent = state.base.result || "尚未转换";
  const outputs = elements.modeWorkspace.querySelector(".base-output-grid");
  if (outputs) outputs.innerHTML = renderBaseSummary();
  syncWorkspaceButtonStates();
}

function refreshEquationWorkspace() {
  const result = elements.modeWorkspace.querySelector("#advancedResult");
  if (result) result.textContent = getAdvancedResult() || "点击按钮执行对应功能。";
  syncWorkspaceButtonStates();
}

function refreshVectorWorkspace() {
  refreshEquationWorkspace();
}

function refreshCalculusWorkspace() {
  refreshEquationWorkspace();
}

function refreshLogicWorkspace() {
  refreshEquationWorkspace();
}

function refreshTableWorkspace() {
  refreshEquationWorkspace();
}

function refreshToolsWorkspace() {
  refreshEquationWorkspace();
}

function syncWorkspaceButtonStates(container = getActiveWorkspaceEl()) {
  if (!container) return;

  const activeAdvAction = getActiveAdvancedAction();
  if (state.tool !== "calc") {
    syncButtonGroup(container, "[data-adv-action]", activeAdvAction);
    return;
  }
  syncButtonGroup(container, "[data-matrix-op]", state.matrix.activeAction);
  syncButtonGroup(container, "[data-complex-op]", state.complex.activeAction);
  syncButtonGroup(container, "[data-stats-action]", state.stats.activeAction);
  syncButtonGroup(container, "[data-base-quick]", state.base.activeQuick);
  syncButtonGroup(container, "[data-adv-action]", activeAdvAction);
}

function syncButtonGroup(container, selector, activeValue) {
  const buttons = container.querySelectorAll(selector);
  buttons.forEach((button) => {
    button.classList.toggle("is-active", Boolean(activeValue) && button.dataset[datasetKeyForSelector(selector)] === activeValue);
  });
}

function datasetKeyForSelector(selector) {
  switch (selector) {
    case "[data-matrix-op]": return "matrixOp";
    case "[data-complex-op]": return "complexOp";
    case "[data-stats-action]": return "statsAction";
    case "[data-base-quick]": return "baseQuick";
    case "[data-adv-action]": return "advAction";
    default: return "action";
  }
}

function getActiveAdvancedAction() {
  if (state.tool === "boolean") return state.boolean.activeAction;
  if (state.tool === "labrec") return state.labrec.activeAction;
  if (state.tool === "dataproc") return state.dataproc.activeAction;
  switch (state.mode) {
    case "equation": return state.equation.activeAction;
    case "vector": return state.vector.activeAction;
    case "calculus": return state.calculus.activeAction;
    case "logic": return state.logic.activeAction;
    case "table": return state.table.activeAction;
    case "tools": return state.tools.activeAction;
    default: return "";
  }
}

function persistExpression() {
  persistDebounced(STORAGE_KEYS.expression, state.expression);
}

function persistAngleMode() {
  writeStorage(STORAGE_KEYS.angleMode, state.angleMode);
}

function persistMemory() {
  writeStorage(STORAGE_KEYS.memory, String(state.memory));
  updateDisplay();
}

function persistHistory() {
  writeStorage(STORAGE_KEYS.history, JSON.stringify(state.history));
}

function persistShift() {
  writeStorage(STORAGE_KEYS.shift, String(state.shift));
}

function persistMode() {
  writeStorage(STORAGE_KEYS.mode, state.mode);
}

function persistMatrix() {
  persistDebounced(STORAGE_KEYS.matrix, JSON.stringify(state.matrix));
}

function persistStats() {
  persistDebounced(STORAGE_KEYS.stats, JSON.stringify(state.stats));
}

function persistComplex() {
  persistDebounced(STORAGE_KEYS.complex, JSON.stringify(state.complex));
}

function persistBase() {
  persistDebounced(STORAGE_KEYS.base, JSON.stringify(state.base));
}

function prettyExpression(expression) {
  const replacements = [
    ["asin(", "反正弦("],
    ["acos(", "反余弦("],
    ["atan(", "反正切("],
    ["sin(", "正弦("],
    ["cos(", "余弦("],
    ["tan(", "正切("],
    ["log(", "常对数("],
    ["ln(", "自然对数("],
    ["sqrt(", "平方根("],
    ["square(", "平方("],
    ["pow10(", "10的幂("],
    ["exp(", "e的幂("],
    ["ncr(", "组合("],
    ["npr(", "排列("],
    ["mod(", "取模("],
    ["root(", "开方("],
    ["rand()", "随机数()"],
    ["Ans", "结果"],
    ["pi", "π"],
  ];

  let output = expression || "";
  for (const [from, to] of replacements) {
    output = output.replaceAll(from, to);
  }
  return output
    .replaceAll("*", "×")
    .replaceAll("/", "÷")
    .replaceAll("-", "−");
}

function normalizeDisplayText(text) {
  return text.replaceAll("π", "pi").replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-");
}

function evaluateExpression(expression) {
  try {
    const normalized = normalizeExpression(expression);
    if (!normalized.trim()) return NaN;
    const tokens = tokenize(normalized);
    if (!tokens.length) return NaN;
    const parser = createParser(tokens);
    const value = parser.parseExpression();
    if (!parser.isAtEnd()) return NaN;
    return value;
  } catch {
    return NaN;
  }
}

function normalizeExpression(expression) {
  return expression
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("π", "pi")
    .replaceAll("ANS", "Ans")
    .replace(/\s+/g, "");
}

function tokenize(input) {
  const tokens = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      let sawExponent = false;
      while (end < input.length) {
        const current = input[end];
        if (/[0-9.]/.test(current)) {
          end += 1;
          continue;
        }
        if ((current === "e" || current === "E") && !sawExponent) {
          sawExponent = true;
          end += 1;
          if (input[end] === "+" || input[end] === "-") end += 1;
          continue;
        }
        break;
      }
      tokens.push({ type: "number", value: Number(input.slice(index, end)) });
      index = end;
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let end = index + 1;
      while (end < input.length && /[a-zA-Z0-9_]/.test(input[end])) end += 1;
      tokens.push({ type: "identifier", value: input.slice(index, end).toLowerCase() });
      index = end;
      continue;
    }

    if ("+-*/^!,()% ,".replace(/\s+/g, "").includes(char)) {
      const type = char === "(" ? "lparen" : char === ")" ? "rparen" : char === "," ? "comma" : "operator";
      tokens.push({ type, value: char });
      index += 1;
      continue;
    }

    throw new Error(`无法识别的字符：${char}`);
  }

  return insertImplicitMultiplication(tokens);
}

function insertImplicitMultiplication(tokens) {
  const result = [];
  const functionNames = new Set([
    "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "asinh", "acosh", "atanh",
    "log", "ln", "sqrt", "square", "pow10", "exp", "abs", "floor", "ceil", "round", "ncr", "npr", "mod", "root", "rand",
  ]);

  for (const token of tokens) {
    const previous = result[result.length - 1];
    if (previous && needsMultiplication(previous, token, functionNames)) {
      result.push({ type: "operator", value: "*" });
    }
    result.push(token);
  }
  return result;
}

function needsMultiplication(left, right, functionNames) {
  const leftCanEnd = left.type === "number" || left.type === "identifier" || left.type === "rparen" || (left.type === "operator" && left.value === "!");
  const rightCanStart = right.type === "number" || right.type === "identifier" || right.type === "lparen";

  if (!leftCanEnd || !rightCanStart) return false;
  if (left.type === "identifier" && right.type === "lparen" && functionNames.has(left.value)) return false;
  return true;
}

function createParser(tokens) {
  let index = 0;

  function peek() {
    return tokens[index];
  }

  function match(type, value) {
    const token = peek();
    if (!token || token.type !== type) return false;
    if (typeof value !== "undefined" && token.value !== value) return false;
    index += 1;
    return token;
  }

  function expect(type, value) {
    const token = match(type, value);
    if (!token) throw new Error(`缺少 ${value ?? type}`);
    return token;
  }

  function parseExpression() {
    return parseAdditive();
  }

  function parseAdditive() {
    let value = parseMultiplicative();
    while (true) {
      if (match("operator", "+")) {
        value += parseMultiplicative();
        continue;
      }
      if (match("operator", "-")) {
        value -= parseMultiplicative();
        continue;
      }
      return value;
    }
  }

  function parseMultiplicative() {
    let value = parseUnary();
    while (true) {
      if (match("operator", "*")) {
        value *= parseUnary();
        continue;
      }
      if (match("operator", "/")) {
        value /= parseUnary();
        continue;
      }
      return value;
    }
  }

  // 幂运算优先级高于一元负号（-2^2 = -4），指数侧允许带符号（2^-3）
  function parsePower() {
    const value = parsePostfix();
    if (match("operator", "^")) {
      return Math.pow(value, parseUnary());
    }
    return value;
  }

  function parseUnary() {
    if (match("operator", "+")) return parseUnary();
    if (match("operator", "-")) return -parseUnary();
    return parsePower();
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (true) {
      if (match("operator", "!")) {
        value = factorial(value);
        continue;
      }
      if (match("operator", "%")) {
        value /= 100;
        continue;
      }
      return value;
    }
  }

  function parsePrimary() {
    const token = peek();
    if (!token) throw new Error("表达式不完整");

    if (match("number")) return token.value;

    if (match("identifier")) {
      const name = token.value;
      if (match("lparen")) {
        const args = [];
        if (!match("rparen")) {
          args.push(parseExpression());
          while (match("comma")) args.push(parseExpression());
          expect("rparen");
        }
        return evaluateFunction(name, args);
      }
      return resolveIdentifier(name);
    }

    if (match("lparen")) {
      const value = parseExpression();
      expect("rparen");
      return value;
    }

    throw new Error(`无法识别的符号：${token.value}`);
  }

  return {
    parseExpression,
    isAtEnd() {
      return index >= tokens.length;
    },
  };
}

function resolveIdentifier(name) {
  if (runtimeScope && Object.prototype.hasOwnProperty.call(runtimeScope, name)) {
    return runtimeScope[name];
  }
  switch (name) {
    case "pi":
      return Math.PI;
    case "e":
      return Math.E;
    case "ans":
      return state.ans;
    case "m":
      return state.memory;
    default:
      throw new Error(`未知标识符：${name}`);
  }
}

function evaluateFunction(name, args) {
  const single = args[0];
  const pair = args.slice(0, 2);

  switch (name) {
    case "sin":
      return Math.sin(toRadians(single));
    case "cos":
      return Math.cos(toRadians(single));
    case "tan":
      return Math.tan(toRadians(single));
    case "asin":
      return fromRadians(Math.asin(single));
    case "acos":
      return fromRadians(Math.acos(single));
    case "atan":
      return fromRadians(Math.atan(single));
    case "sinh":
      return Math.sinh(single);
    case "cosh":
      return Math.cosh(single);
    case "tanh":
      return Math.tanh(single);
    case "asinh":
      return Math.asinh(single);
    case "acosh":
      return Math.acosh(single);
    case "atanh":
      return Math.atanh(single);
    case "log":
      return Math.log10(single);
    case "ln":
      return Math.log(single);
    case "sqrt":
      return Math.sqrt(single);
    case "square":
      return single * single;
    case "pow10":
      return Math.pow(10, single);
    case "exp":
      return Math.exp(single);
    case "abs":
      return Math.abs(single);
    case "floor":
      return Math.floor(single);
    case "ceil":
      return Math.ceil(single);
    case "round":
      return Math.round(single);
    case "ncr":
      return combinations(pair[0], pair[1]);
    case "npr":
      return permutations(pair[0], pair[1]);
    case "mod":
      return pair[0] % pair[1];
    case "root":
      return Math.pow(pair[1], 1 / pair[0]);
    case "rand":
      return Math.random();
    default:
      throw new Error(`未知函数：${name}`);
  }
}

function toRadians(value) {
  if (state.angleMode === "DEG") return (value * Math.PI) / 180;
  if (state.angleMode === "GRAD") return (value * Math.PI) / 200;
  return value;
}

function fromRadians(value) {
  if (state.angleMode === "DEG") return (value * 180) / Math.PI;
  if (state.angleMode === "GRAD") return (value * 200) / Math.PI;
  return value;
}

function factorial(value) {
  if (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value) {
    throw new Error("阶乘仅支持非负整数");
  }
  let result = 1;
  for (let number = 2; number <= value; number += 1) result *= number;
  return result;
}

// 组合/排列：逐项相乘（必要时用 BigInt 精确累乘），避免中间阶乘溢出产生 NaN。
// 对输入范围、迭代次数（耗时）、不可表示结果作明确限制；保持数值返回类型。
const COMBINATORICS_MAX_N = Number.MAX_SAFE_INTEGER; // n 上限，保证可精确转为整数
const COMBINATORICS_MAX_ITERATIONS = 5000;          // 逐项相乘的迭代上限，控制大整数耗时

function validateCombinatoricsInput(n, r) {
  if (!Number.isFinite(n) || !Number.isFinite(r) ||
      !Number.isInteger(n) || !Number.isInteger(r) ||
      n < 0 || r < 0 || r > n) {
    throw new Error("组合/排列要求 n、r 为非负整数且 0 ≤ r ≤ n");
  }
  if (n > COMBINATORICS_MAX_N) {
    throw new Error(`n 过大（上限 ${COMBINATORICS_MAX_N}），无法保证精度`);
  }
}

function permutations(n, r) {
  validateCombinatoricsInput(n, r);
  if (r > COMBINATORICS_MAX_ITERATIONS) {
    throw new Error(`排列数计算量过大（需 ${r} 次迭代，上限 ${COMBINATORICS_MAX_ITERATIONS}）`);
  }
  let result = 1n;
  for (let i = 0; i < r; i += 1) result *= BigInt(n - i);
  const value = Number(result);
  if (!Number.isFinite(value)) {
    throw new Error("排列数结果超出 JavaScript 数值可表示范围（约 1.8×10^308）");
  }
  return value;
}

function combinations(n, r) {
  validateCombinatoricsInput(n, r);
  const k = Math.min(r, n - r); // C(n,r)=C(n,n-r)，取较小迭代数
  if (k > COMBINATORICS_MAX_ITERATIONS) {
    throw new Error(`组合数计算量过大（需 ${k} 次迭代，上限 ${COMBINATORICS_MAX_ITERATIONS}）`);
  }
  let result = 1n;
  for (let i = 1; i <= k; i += 1) {
    result = (result * BigInt(n - k + i)) / BigInt(i); // 每步整除，精确且无中间溢出
  }
  const value = Number(result);
  if (!Number.isFinite(value)) {
    throw new Error("组合数结果超出 JavaScript 数值可表示范围（约 1.8×10^308）");
  }
  return value;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "数学错误";
  if (Object.is(value, -0)) return "0";
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude >= 1e10 || magnitude < 1e-8)) {
    return value.toExponential(10).replace(/\.0+e/, "e").replace(/(\.\d*?)0+e/, "$1e");
  }
  const text = Number(value.toPrecision(12)).toString();
  return text.includes("e") ? text : text.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function angleModeLabel(mode) {
  if (mode === "DEG") return "度";
  if (mode === "RAD") return "弧度";
  return "百分度";
}

function formatMatrix(matrix) {
  return matrix.map((row) => `[ ${row.map((value) => formatNumber(value)).join(" , ")} ]`).join("\n");
}

function createMatrix(size, fill = 0) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => fill));
}

function normalizeMatrix(matrix, size) {
  const output = createMatrix(size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = matrix?.[row]?.[col];
      output[row][col] = Number.isFinite(Number(value)) ? Number(value) : 0;
    }
  }
  return output;
}

function resizeMatrix(matrix, size) {
  const output = createMatrix(size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      output[row][col] = Number.isFinite(matrix?.[row]?.[col]) ? matrix[row][col] : 0;
    }
  }
  return output;
}

function matrixAdd(a, b) {
  return a.map((row, rowIndex) => row.map((value, colIndex) => value + b[rowIndex][colIndex]));
}

function matrixSubtract(a, b) {
  return a.map((row, rowIndex) => row.map((value, colIndex) => value - b[rowIndex][colIndex]));
}

function matrixMultiply(a, b) {
  const size = a.length;
  const result = createMatrix(size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      let sum = 0;
      for (let index = 0; index < size; index += 1) {
        sum += a[row][index] * b[index][col];
      }
      result[row][col] = sum;
    }
  }
  return result;
}

function transposeMatrix(matrix) {
  const size = matrix.length;
  const result = createMatrix(size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      result[col][row] = matrix[row][col];
    }
  }
  return result;
}

function matrixDeterminant(matrix) {
  const size = matrix.length;
  const working = matrix.map((row) => row.slice());
  let sign = 1;

  for (let pivot = 0; pivot < size; pivot += 1) {
    let bestRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(working[row][pivot]) > Math.abs(working[bestRow][pivot])) bestRow = row;
    }

    if (Math.abs(working[bestRow][pivot]) < 1e-12) return 0;
    if (bestRow !== pivot) {
      [working[pivot], working[bestRow]] = [working[bestRow], working[pivot]];
      sign *= -1;
    }

    for (let row = pivot + 1; row < size; row += 1) {
      const factor = working[row][pivot] / working[pivot][pivot];
      for (let col = pivot; col < size; col += 1) {
        working[row][col] -= factor * working[pivot][col];
      }
    }
  }

  return working.reduce((product, row, index) => product * row[index], sign);
}

function inverseMatrix(matrix) {
  const size = matrix.length;
  const augmented = matrix.map((row, rowIndex) => [...row, ...identityRow(size, rowIndex)]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let bestRow = pivot;
    for (let row = pivot; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[bestRow][pivot])) bestRow = row;
    }

    if (Math.abs(augmented[bestRow][pivot]) < 1e-12) {
      throw new Error("矩阵不可逆");
    }

    if (bestRow !== pivot) [augmented[pivot], augmented[bestRow]] = [augmented[bestRow], augmented[pivot]];

    const pivotValue = augmented[pivot][pivot];
    for (let col = 0; col < size * 2; col += 1) {
      augmented[pivot][col] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = augmented[row][pivot];
      for (let col = 0; col < size * 2; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}

function identityRow(size, index) {
  return Array.from({ length: size }, (_, col) => (col === index ? 1 : 0));
}

function parseStatsInput(text) {
  return text
    .split(/[,\s，]+/)
    .map((item) => Number.parseFloat(item))
    .filter(Number.isFinite);
}

function calculateStats(values) {
  if (!values.length) {
    return {
      count: 0,
      sum: 0,
      mean: 0,
      min: 0,
      max: 0,
      populationVariance: 0,
      sampleVariance: 0,
      populationStdDev: 0,
      sampleStdDev: 0,
    };
  }

  const count = values.length;
  const sum = values.reduce((total, value) => total + value, 0);
  const mean = sum / count;
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const populationVariance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / count;
  const sampleVariance = count > 1 ? values.reduce((total, value) => total + (value - mean) ** 2, 0) / (count - 1) : 0;

  return {
    count,
    sum,
    mean,
    min,
    max,
    populationVariance,
    sampleVariance,
    populationStdDev: Math.sqrt(populationVariance),
    sampleStdDev: Math.sqrt(sampleVariance),
  };
}

function formatComplexResult(value) {
  if (!value) return "尚未计算";
  if (typeof value === "number") return formatNumber(value);
  const re = formatNumber(value.re);
  const im = formatNumber(Math.abs(value.im));
  if (Math.abs(value.im) < 1e-12) return re;
  return `${re} ${value.im >= 0 ? "+" : "-"} ${im}i`;
}

function normalizeComplex(value) {
  if (!value) return { re: 0, im: 0 };
  return {
    re: Number.isFinite(Number(value.re)) ? Number(value.re) : 0,
    im: Number.isFinite(Number(value.im)) ? Number(value.im) : 0,
  };
}

function complexAdd(a, b) {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexSubtract(a, b) {
  return { re: a.re - b.re, im: a.im - b.im };
}

function complexMultiply(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function complexDivide(a, b) {
  const denominator = b.re * b.re + b.im * b.im;
  if (Math.abs(denominator) < 1e-12) throw new Error("复数除法的分母不能为 0");
  return {
    re: (a.re * b.re + a.im * b.im) / denominator,
    im: (a.im * b.re - a.re * b.im) / denominator,
  };
}

function complexConjugate(a) {
  return { re: a.re, im: -a.im };
}

function complexMagnitude(a) {
  return Math.hypot(a.re, a.im);
}

function complexArgument(a) {
  return Math.atan2(a.im, a.re);
}

function normalizeBaseName(value) {
  const name = String(value || "").toUpperCase();
  if (["BIN", "OCT", "DEC", "HEX"].includes(name)) return name;
  return null;
}

function convertBaseValue(input, source, target) {
  const decimal = parseBaseNumber(input, source);
  if (!Number.isFinite(decimal)) {
    return { ok: false, error: "输入数值无法按源进制解析" };
  }

  const bin = formatBaseNumber(decimal, 2);
  const oct = formatBaseNumber(decimal, 8);
  const dec = formatBaseNumber(decimal, 10);
  const hex = formatBaseNumber(decimal, 16);
  const targetValue = formatBaseNumber(decimal, baseToNumber(target));

  return { ok: true, bin, oct, dec, hex, target: targetValue };
}

function baseToNumber(base) {
  switch (normalizeBaseName(base)) {
    case "BIN":
      return 2;
    case "OCT":
      return 8;
    case "DEC":
      return 10;
    case "HEX":
      return 16;
    default:
      return 10;
  }
}

function parseBaseNumber(input, baseName) {
  const base = baseToNumber(baseName);
  const text = String(input || "").trim().replaceAll("_", "").toUpperCase();
  if (!text) return NaN;

  let sign = 1;
  let working = text;
  if (working.startsWith("+")) working = working.slice(1);
  if (working.startsWith("-")) {
    sign = -1;
    working = working.slice(1);
  }

  const parts = working.split(".");
  if (parts.length > 2) return NaN;

  const integerPart = parts[0] || "0";
  const fractionPart = parts[1] || "";
  let integerValue = 0;

  for (const char of integerPart) {
    const digit = charToDigit(char);
    if (digit >= base) return NaN;
    integerValue = integerValue * base + digit;
  }

  let fractionValue = 0;
  let divisor = base;
  for (const char of fractionPart) {
    const digit = charToDigit(char);
    if (digit >= base) return NaN;
    fractionValue += digit / divisor;
    divisor *= base;
  }

  return sign * (integerValue + fractionValue);
}

function formatBaseNumber(value, base) {
  if (!Number.isFinite(value)) return "无法转换";
  if (Object.is(value, -0)) value = 0;
  const sign = value < 0 ? "-" : "";
  let working = Math.abs(value);
  const integerPart = Math.floor(working);
  let fractionPart = working - integerPart;
  let integerText = integerPart.toString(base).toUpperCase();

  if (fractionPart < 1e-12) {
    return `${sign}${integerText}`;
  }

  let fractionText = "";
  for (let index = 0; index < 12 && fractionPart > 1e-12; index += 1) {
    fractionPart *= base;
    const digit = Math.floor(fractionPart + 1e-12);
    fractionText += digitToChar(digit);
    fractionPart -= digit;
  }

  fractionText = fractionText.replace(/0+$/, "");
  return fractionText ? `${sign}${integerText}.${fractionText}` : `${sign}${integerText}`;
}

function charToDigit(char) {
  if (char >= "0" && char <= "9") return char.charCodeAt(0) - 48;
  if (char >= "A" && char <= "Z") return char.charCodeAt(0) - 55;
  return 36;
}

function digitToChar(digit) {
  if (digit >= 0 && digit <= 9) return String(digit);
  return String.fromCharCode(55 + digit);
}

function formatAttr(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return formatAttr(value);
}

const NAMED_CONSTANTS = {
  c: 299792458,
  g: 9.80665,
  h: 6.62607015e-34,
  k: 1.380649e-23,
  NA: 6.02214076e23,
  R: 8.314462618,
};

const UNIT_GROUPS = {
  length: { m: 1, km: 1000, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048, mi: 1609.344 },
  mass: { kg: 1, g: 0.001, mg: 1e-6, t: 1000, lb: 0.45359237 },
  time: { s: 1, ms: 0.001, min: 60, h: 3600, day: 86400 },
  speed: { "m/s": 1, "km/h": 0.2777777778, mph: 0.44704, knot: 0.5144444444 },
  pressure: { Pa: 1, kPa: 1000, MPa: 1e6, bar: 100000, atm: 101325, psi: 6894.757293168 },
  energy: { J: 1, kJ: 1000, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6 },
  temperature: { C: "temp", F: "temp", K: "temp" },
};

function primeFactorization(n) {
  const factors = [];
  let num = n;
  for (let i = 2; i * i <= num; i++) {
    while (num % i === 0) {
      factors.push(i);
      num /= i;
    }
  }
  if (num > 1) factors.push(num);
  return factors;
}

function formatEng(value) {
  const prefixes = [{ exp: -3, sym: "m" }, { exp: -6, sym: "μ" }, { exp: -9, sym: "n" }, { exp: -12, sym: "p" }, { exp: 3, sym: "k" }, { exp: 6, sym: "M" }, { exp: 9, sym: "G" }, { exp: 12, sym: "T" }];
  for (const p of prefixes) {
    const scaled = value / Math.pow(10, p.exp);
    if (Math.abs(scaled) >= 1 && Math.abs(scaled) < 1000) {
      return `${formatNumber(scaled)} ${p.sym}`;
    }
  }
  return formatNumber(value);
}

function normalizeLinearRows(rows, size) {
  const source = Array.isArray(rows) ? rows : [];
  return Array.from({ length: size }, (_, row) => {
    const values = Array.isArray(source[row]) ? source[row] : [];
    return Array.from({ length: size + 1 }, (_, col) => {
      const value = Number(values[col]);
      return Number.isFinite(value) ? value : 0;
    });
  });
}

function normalizeCoefficientArray(arr, len) {
  if (!Array.isArray(arr)) return new Array(len).fill(0);
  const result = arr.slice(0, len).map((v) => Number.isFinite(Number(v)) ? Number(v) : 0);
  while (result.length < len) result.push(0);
  return result;
}

function normalizeProportion(obj) {
  if (!obj || typeof obj !== "object") return { a: "1", b: "2", c: "3", d: "?" };
  return {
    a: typeof obj.a === "string" ? obj.a : "1",
    b: typeof obj.b === "string" ? obj.b : "2",
    c: typeof obj.c === "string" ? obj.c : "3",
    d: typeof obj.d === "string" ? obj.d : "?",
  };
}

function normalizeVector(arr) {
  const output = [0, 0, 0];
  if (!Array.isArray(arr)) return output;
  for (let index = 0; index < 3; index += 1) {
    const value = Number(arr[index]);
    if (Number.isFinite(value)) output[index] = value;
  }
  return output;
}

let runtimeScope = null;

function defaultLinearRows(size) {
  return Array.from({ length: size }, (_, row) => Array.from({ length: size + 1 }, (_, col) => (col === row ? 1 : 0)));
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function persistEquation() {
  persistDebounced(STORAGE_KEYS.equation, JSON.stringify(state.equation));
}

function persistVector() {
  persistDebounced(STORAGE_KEYS.vector, JSON.stringify(state.vector));
}

function persistCalculus() {
  persistDebounced(STORAGE_KEYS.calculus, JSON.stringify(state.calculus));
}

function persistLogic() {
  persistDebounced(STORAGE_KEYS.logic, JSON.stringify(state.logic));
}

function persistTable() {
  persistDebounced(STORAGE_KEYS.table, JSON.stringify(state.table));
}

function persistTools() {
  persistDebounced(STORAGE_KEYS.tools, JSON.stringify(state.tools));
}

function hydrateMatrix() {
  const stored = readStorage(STORAGE_KEYS.matrix);
  if (!stored) {
    state.matrix.matrices = { a: createMatrix(state.matrix.size), b: createMatrix(state.matrix.size), c: createMatrix(state.matrix.size), d: createMatrix(state.matrix.size) };
    return;
  }
  try {
    const parsed = JSON.parse(stored);
    state.matrix.size = [2, 3, 4].includes(parsed.size) ? parsed.size : 2;
    const matrices = parsed.matrices || {};
    state.matrix.matrices = {
      a: normalizeMatrix(matrices.a ?? parsed.a, state.matrix.size),
      b: normalizeMatrix(matrices.b ?? parsed.b, state.matrix.size),
      c: normalizeMatrix(matrices.c, state.matrix.size),
      d: normalizeMatrix(matrices.d, state.matrix.size),
    };
    state.matrix.result = typeof parsed.result === "string" ? parsed.result : "";
    state.matrix.operation = typeof parsed.operation === "string" ? parsed.operation : "A + B";
  } catch {
    state.matrix.matrices = { a: createMatrix(state.matrix.size), b: createMatrix(state.matrix.size), c: createMatrix(state.matrix.size), d: createMatrix(state.matrix.size) };
  }
}

/* ===================== 布尔化简（Quine-McCluskey 算法） ===================== */

const BOOLEAN_MAX_VARS = 10;
const BOOLEAN_MAX_OUTPUTS = 10;
const QM_EXACT_MAX_TERMS = 24;
const QM_EXACT_MAX_IMPLICANTS = 64;

function qmPopcount(n) {
  n = n - ((n >>> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return ((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101 >>> 24;
}

function qmCovers(imp, term) {
  return (term & ~imp.mask) === imp.value;
}

function qmCombine(a, b) {
  if (a.mask !== b.mask) return null;
  const diff = (a.value ^ b.value) & ~a.mask;
  if (qmPopcount(diff) !== 1) return null;
  return { value: a.value & ~diff, mask: a.mask | diff };
}

function qmGeneratePrimeImplicants(ones, dontCares) {
  const all = new Set([...ones, ...dontCares]);
  let current = new Map();
  for (const term of all) current.set(`${term}:0`, { value: term, mask: 0 });

  const primes = new Map();
  while (current.size > 0) {
    const used = new Set();
    const nextLevel = new Map();
    const buckets = new Map();
    for (const imp of current.values()) {
      const onesCount = qmPopcount(imp.value & ~imp.mask);
      const key = `${onesCount}:${imp.mask}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(imp);
    }

    const keys = [...buckets.keys()].sort((x, y) => {
      const [xo, xm] = x.split(":").map(Number);
      const [yo, ym] = y.split(":").map(Number);
      return xo - yo || xm - ym;
    });

    for (const key of keys) {
      const [onesCount, mask] = key.split(":").map(Number);
      const group = buckets.get(key);
      const nextGroup = buckets.get(`${onesCount + 1}:${mask}`) || [];
      for (const a of group) {
        for (const b of nextGroup) {
          const combined = qmCombine(a, b);
          if (combined) {
            used.add(`${a.value}:${a.mask}`);
            used.add(`${b.value}:${b.mask}`);
            nextLevel.set(`${combined.value}:${combined.mask}`, combined);
          }
        }
      }
    }

    for (const [k, imp] of current) {
      if (!used.has(k)) primes.set(k, imp);
    }
    current = nextLevel;
  }
  return [...primes.values()];
}

function qmCountLiterals(imp, numVars) {
  return numVars - qmPopcount(imp.mask);
}

function qmPostSimplify(cover, ones) {
  if (cover.length <= 1) return cover.slice();
  const result = cover.slice();
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < result.length; i += 1) {
      const imp = result[i];
      const termsOfImp = new Set([...ones].filter((t) => qmCovers(imp, t)));
      const othersCovered = new Set();
      for (let j = 0; j < result.length; j += 1) {
        if (i === j) continue;
        for (const t of ones) if (qmCovers(result[j], t)) othersCovered.add(t);
      }
      let allCovered = true;
      for (const t of termsOfImp) {
        if (!othersCovered.has(t)) {
          allCovered = false;
          break;
        }
      }
      if (allCovered) {
        result.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return result;
}

function qmSelectCover(numVars, ones, primeImplicants) {
  if (ones.size === 0) return [];

  const onesArr = [...ones];
  const chart = new Map();
  for (const term of onesArr) {
    const list = [];
    for (const imp of primeImplicants) {
      if (qmCovers(imp, term)) list.push(imp);
    }
    chart.set(term, list);
  }

  const selected = [];
  const selectedKeys = new Set();
  for (const term of onesArr) {
    const list = chart.get(term);
    if (list.length === 1 && !selectedKeys.has(`${list[0].value}:${list[0].mask}`)) {
      selectedKeys.add(`${list[0].value}:${list[0].mask}`);
      selected.push(list[0]);
    }
  }

  const covered = new Set();
  for (const imp of selected) {
    for (const t of onesArr) if (qmCovers(imp, t)) covered.add(t);
  }

  const remainingTerms = onesArr.filter((t) => !covered.has(t));
  if (!remainingTerms.length) return qmPostSimplify(selected, ones);

  const remainingImplicants = primeImplicants.filter((imp) =>
    remainingTerms.some((t) => qmCovers(imp, t))
  );

  if (remainingTerms.length <= QM_EXACT_MAX_TERMS && remainingImplicants.length <= QM_EXACT_MAX_IMPLICANTS) {
    let best = null;
    const termToImps = {};
    for (const t of remainingTerms) {
      termToImps[t] = remainingImplicants.filter((imp) => qmCovers(imp, t));
    }

    const candidateLit = (list) => list.reduce((acc, imp) => acc + qmCountLiterals(imp, numVars), 0);

    const search = (uncovered, chosen) => {
      if (uncovered.size === 0) {
        if (best === null || chosen.length < best.length ||
            (chosen.length === best.length && candidateLit(chosen) < candidateLit(best))) {
          best = chosen.slice();
        }
        return;
      }
      if (best !== null && chosen.length >= best.length) return;

      let target = null;
      let minLen = Infinity;
      for (const t of uncovered) {
        if (termToImps[t].length < minLen) {
          minLen = termToImps[t].length;
          target = t;
        }
      }

      const options = termToImps[target].slice().sort((a, b) => {
        const la = qmCountLiterals(a, numVars);
        const lb = qmCountLiterals(b, numVars);
        return la - lb || qmPopcount(b.mask) - qmPopcount(a.mask);
      });

      for (const imp of options) {
        chosen.push(imp);
        const next = new Set([...uncovered].filter((t) => !qmCovers(imp, t)));
        search(next, chosen);
        chosen.pop();
      }
    };

    search(new Set(remainingTerms), []);
    if (best) {
      selected.push(...best);
      return qmPostSimplify(selected, ones);
    }
  }

  const uncovered = new Set(remainingTerms);
  let active = remainingImplicants.slice();
  while (uncovered.size > 0) {
    let bestImp = null;
    let bestRatio = -1;
    let bestCount = -1;
    for (const imp of active) {
      let count = 0;
      for (const t of uncovered) if (qmCovers(imp, t)) count += 1;
      const ratio = count / Math.max(1, qmCountLiterals(imp, numVars));
      if (ratio > bestRatio || (ratio === bestRatio && count > bestCount)) {
        bestRatio = ratio;
        bestCount = count;
        bestImp = imp;
      }
    }
    selected.push(bestImp);
    for (const t of [...uncovered]) if (qmCovers(bestImp, t)) uncovered.delete(t);
    active = active.filter((imp) => [...uncovered].some((t) => qmCovers(imp, t)));
  }

  return qmPostSimplify(selected, ones);
}

function qmTermToExpression(imp, variables) {
  const parts = [];
  const n = variables.length;
  for (let i = 0; i < n; i += 1) {
    const bit = 1 << (n - i - 1);
    if (imp.mask & bit) continue;
    parts.push(imp.value & bit ? variables[i] : `!${variables[i]}`);
  }
  return parts.length ? parts.join(" & ") : "1";
}

function qmDetectXorXnor(ones, numVars, variables) {
  if (numVars < 2) return null;
  const total = 1 << numVars;
  const xorSet = new Set();
  const xnorSet = new Set();
  for (let t = 0; t < total; t += 1) {
    (qmPopcount(t) % 2 === 1 ? xorSet : xnorSet).add(t);
  }
  const sameSet = (a, b) => a.size === b.size && [...a].every((t) => b.has(t));
  if (sameSet(ones, xorSet)) return variables.join(" ⊕ ");
  if (sameSet(ones, xnorSet)) return variables.join(" ⊙ ");
  return null;
}

function qmStandardExpression(customExpr, ones, numVars, variables) {
  if (customExpr === "0" || customExpr === "1") return customExpr;
  const xorXnor = qmDetectXorXnor(ones, numVars, variables);
  if (xorXnor) return xorXnor;
  return customExpr.replace(/ # /g, " + ");
}

function qmMinimizeOneOutput(variables, rows, outputIdx) {
  const ones = new Set();
  const dontCares = new Set();
  for (const row of rows) {
    const output = row.outputs[outputIdx];
    let term = 0;
    for (const bit of row.inputs) term = (term << 1) | (bit ? 1 : 0);
    if (output === 1 || output === "1" || output === true) {
      ones.add(term);
      dontCares.delete(term);
    } else if (output === "x" || output === "X" || output === "-") {
      if (!ones.has(term)) dontCares.add(term);
    } else {
      ones.delete(term);
      dontCares.delete(term);
    }
  }

  if (ones.size === 0) return { expression: "0", standard: "0" };
  if (ones.size + dontCares.size === (1 << variables.length)) {
    return { expression: "1", standard: "1" };
  }

  const primes = qmGeneratePrimeImplicants(ones, dontCares);
  const cover = qmSelectCover(variables.length, ones, primes);

  const exprMap = new Map();
  const uniqueCover = [];
  for (const imp of cover) {
    const key = `${imp.value}:${imp.mask}`;
    if (!exprMap.has(key)) {
      exprMap.set(key, qmTermToExpression(imp, variables));
      uniqueCover.push({ key, imp });
    }
  }
  // 排序时把取反符号 ! 视为最大字符，让正变量项排在取反项之前（与原 Python 版一致）
  const sortKey = (expr) => expr.replace(/!/g, "\uffff");
  uniqueCover.sort((a, b) => {
    const ea = sortKey(exprMap.get(a.key));
    const eb = sortKey(exprMap.get(b.key));
    if (ea !== eb) return ea < eb ? -1 : 1;
    return a.imp.value - b.imp.value;
  });

  const terms = uniqueCover.map((u) => exprMap.get(u.key));
  const customExpr = terms.length ? terms.join(" # ") : "0";
  return { expression: customExpr, standard: qmStandardExpression(customExpr, ones, variables.length, variables) };
}

function qmMinimizeTruthTable(variables, outputNames, rows) {
  if (!Array.isArray(variables) || variables.length === 0) {
    throw new Error("至少需要一个输入变量。");
  }
  if (variables.length > BOOLEAN_MAX_VARS) {
    throw new Error(`最多支持 ${BOOLEAN_MAX_VARS} 个输入变量。`);
  }
  if (!Array.isArray(outputNames) || outputNames.length === 0) {
    throw new Error("至少需要一个输出。");
  }
  if (outputNames.length > BOOLEAN_MAX_OUTPUTS) {
    throw new Error(`最多支持 ${BOOLEAN_MAX_OUTPUTS} 个输出。`);
  }
  const results = {};
  outputNames.forEach((name, oi) => {
    results[name] = qmMinimizeOneOutput(variables, rows, oi);
  });
  return results;
}

function validateBooleanVarNames(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false, message: "请输入至少一个变量名，例如 A, B, C" };
  const names = text.split(/[,，\s]+/).filter(Boolean);
  if (!names.length) return { ok: false, message: "请输入至少一个变量名" };
  if (names.length > BOOLEAN_MAX_VARS) return { ok: false, message: `最多支持 ${BOOLEAN_MAX_VARS} 个变量` };
  const bad = names.filter((n) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n));
  if (bad.length) return { ok: false, message: `无效变量名：${bad.join(", ")}（仅支持字母、数字、下划线，不能以数字开头）` };
  if (new Set(names).size !== names.length) return { ok: false, message: "变量名重复" };
  return { ok: true, names, message: `${names.length} 个变量，共 ${1 << names.length} 行真值表` };
}

function generateBooleanRows(varCount, outCount) {
  const total = 1 << varCount;
  const rows = [];
  for (let i = 0; i < total; i += 1) {
    const inputs = [];
    for (let j = varCount - 1; j >= 0; j -= 1) inputs.push((i >> j) & 1);
    rows.push({ inputs, outputs: Array.from({ length: outCount }, () => 0) });
  }
  return rows;
}

function runBooleanGenerate() {
  const b = state.boolean;
  b.error = "";
  try {
    const check = validateBooleanVarNames(b.varText);
    if (!check.ok) throw new Error(check.message);
    const outCount = clampInt(b.outCount, 1, BOOLEAN_MAX_OUTPUTS, 1);
    b.outCount = outCount;
    let names = b.outNamesText.split(/[,，\s]+/).filter(Boolean);
    if (names.length !== outCount) {
      names = Array.from({ length: outCount }, (_, i) => `Y${i + 1}`);
      b.outNamesText = names.join(", ");
    }
    b.variables = check.names;
    b.outputNames = names;
    b.rows = generateBooleanRows(check.names.length, outCount);
    b.tableReady = true;
    b.results = null;
  } catch (e) {
    b.error = e.message || "生成真值表失败";
  }
  renderActiveWorkspace();
}

function runBooleanPreset(varCount, outCount) {
  const b = state.boolean;
  b.varText = Array.from({ length: varCount }, (_, i) => String.fromCharCode(65 + i)).join(", ");
  b.outCount = clampInt(outCount, 1, BOOLEAN_MAX_OUTPUTS, 1);
  b.outNamesText = "";
  runBooleanGenerate();
}

function runBooleanSetAll(value) {
  const b = state.boolean;
  if (!b.rows.length) {
    b.error = "请先生成真值表";
    renderActiveWorkspace();
    return;
  }
  b.error = "";
  for (const row of b.rows) row.outputs = row.outputs.map(() => value);
  b.results = null;
  renderActiveWorkspace();
}

function runBooleanCompute() {
  const b = state.boolean;
  b.error = "";
  try {
    if (!b.tableReady || !b.rows.length) throw new Error("请先生成真值表");
    b.results = qmMinimizeTruthTable(b.variables, b.outputNames, b.rows);
  } catch (e) {
    b.results = null;
    b.error = e.message || "化简失败";
  }
  renderActiveWorkspace();
}

function updateBooleanVarHint() {
  const hint = document.getElementById("booleanVarHint");
  if (!hint) return;
  const check = validateBooleanVarNames(state.boolean.varText);
  hint.textContent = check.message;
  hint.classList.toggle("is-ok", Boolean(check.ok));
  hint.classList.toggle("is-error", !check.ok);
}

function renderBooleanWorkspace() {
  const b = state.boolean;
  const presets = [
    { label: "2 输入", action: "boolean-preset-2-1" },
    { label: "3 输入", action: "boolean-preset-3-1" },
    { label: "4 输入", action: "boolean-preset-4-1" },
    { label: "5 输入", action: "boolean-preset-5-1" },
    { label: "3 入 2 出", action: "boolean-preset-3-2" },
    { label: "4 入 3 出", action: "boolean-preset-4-3" },
  ];
  const check = validateBooleanVarNames(b.varText);
  return `
    <div class="mode-banner">
      <h3 class="mode-title">布尔化简</h3>
      <p class="mode-copy">配置变量与输出后生成真值表，一键用 Quine-McCluskey 算法化简为最简表达式，支持无关项 x 和多输出。</p>
      <div class="mode-badges">
        <span class="mode-badge">最多 ${BOOLEAN_MAX_VARS} 变量 ${BOOLEAN_MAX_OUTPUTS} 输出</span>
        <span class="mode-badge">支持无关项 x</span>
      </div>
    </div>

    <section class="module-card">
      <h3>1. 配置变量</h3>
      <div class="input-grid">
        <label class="field-card input-grid--wide"><span class="field-label">输入变量名（逗号分隔）</span><input id="booleanVars" class="stats-input" type="text" value="${escapeAttr(b.varText)}" placeholder="例如：A, B, C" /></label>
        <label class="field-card"><span class="field-label">输出个数</span><input id="booleanOutCount" class="stats-input" type="number" min="1" max="10" step="1" value="${escapeAttr(String(b.outCount))}" /></label>
        <label class="field-card"><span class="field-label">输出名称（留空自动 Y1…）</span><input id="booleanOutNames" class="stats-input" type="text" value="${escapeAttr(b.outNamesText)}" placeholder="例如：Y1, Y2" /></label>
      </div>
      <p id="booleanVarHint" class="validation-msg ${check.ok ? "is-ok" : "is-error"}">${escapeHtml(check.message)}</p>
      <div class="button-row">
        ${presets.map((p) => `<button class="mode-action" type="button" data-adv-action="${p.action}">${p.label}</button>`).join("")}
        <button class="mode-action is-active" type="button" data-adv-action="boolean-generate">生成真值表</button>
      </div>
    </section>

    ${b.tableReady ? renderBooleanTableCard() : ""}
    ${b.error ? `<section class="module-card"><p class="mode-copy boolean-error">${escapeHtml(b.error)}</p></section>` : ""}
    ${renderBooleanResults()}
  `;
}

function renderBooleanTableCard() {
  const b = state.boolean;
  const rowsHtml = b.rows.map((row, ri) => `
    <tr>
      <td class="bits">${ri}</td>
      ${row.inputs.map((v) => `<td class="bits">${v}</td>`).join("")}
      ${row.outputs.map((val, oi) => `
        <td><select class="tt-select" data-tt-row="${ri}" data-tt-out="${oi}" aria-label="第 ${ri} 行 ${escapeHtml(b.outputNames[oi])} 的输出值">
          ${["0", "1", "x"].map((v) => `<option value="${v}" ${String(val) === v ? "selected" : ""}>${v}</option>`).join("")}
        </select></td>`).join("")}
    </tr>`).join("");
  return `
    <section class="module-card">
      <h3>2. 设置输出值（0 / 1 / x）</h3>
      <div class="table-scroll table-scroll--tall">
        <table class="data-table">
          <thead><tr>
            <th>#</th>
            ${b.variables.map((v) => `<th>${escapeHtml(v)}</th>`).join("")}
            ${b.outputNames.map((v) => `<th class="col-out">${escapeHtml(v)}</th>`).join("")}
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="button-row" style="margin-top:12px">
        <button class="mode-action" type="button" data-adv-action="boolean-all-0">全部 0</button>
        <button class="mode-action" type="button" data-adv-action="boolean-all-1">全部 1</button>
        <button class="mode-action" type="button" data-adv-action="boolean-all-x">全部 x</button>
        <button class="mode-action is-active" type="button" data-adv-action="boolean-compute">生成最简表达式</button>
      </div>
      <p id="booleanDirtyHint" class="validation-msg"></p>
    </section>
  `;
}

function renderBooleanResults() {
  const b = state.boolean;
  if (!b.results) return "";
  const entries = b.outputNames.map((name) => ({ name, r: b.results[name] })).filter((e) => e.r);
  if (!entries.length) return "";
  return `
    <section class="result-panel">
      <h3>最简表达式</h3>
      <div class="boolean-result">
        ${entries.map((e) => `
          <div class="result-row">
            <span class="result-tag">最简</span>
            <code>${escapeHtml(e.name)} = ${escapeHtml(e.r.expression)}</code>
            <button class="ghost-btn ghost-btn--compact" type="button" data-copy-text="${escapeAttr(e.r.expression)}">复制</button>
          </div>
          <div class="result-row result-row--standard">
            <span class="result-tag">标准</span>
            <code>${escapeHtml(e.name)} = ${escapeHtml(e.r.standard)}</code>
            <button class="ghost-btn ghost-btn--compact" type="button" data-copy-text="${escapeAttr(e.r.standard)}">复制</button>
          </div>`).join("")}
      </div>
      <p class="mode-copy" style="margin-top:10px">符号约定：! 取反、& 与、# 或；标准形式中 + 表示或，⊕ 异或，⊙ 同或。</p>
    </section>
  `;
}

function persistBoolean() {
  const b = state.boolean;
  persistDebounced(STORAGE_KEYS.boolean, JSON.stringify({
    varText: b.varText,
    outCount: b.outCount,
    outNamesText: b.outNamesText,
    variables: b.variables,
    outputNames: b.outputNames,
    rows: b.rows,
    tableReady: b.tableReady,
    results: b.results,
    error: b.error,
  }));
}

function hydrateBoolean() {
  const stored = readStorage(STORAGE_KEYS.boolean);
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    const b = state.boolean;
    if (typeof parsed.varText === "string") b.varText = parsed.varText;
    if (Number.isFinite(Number(parsed.outCount))) b.outCount = clampInt(parsed.outCount, 1, BOOLEAN_MAX_OUTPUTS, 1);
    if (typeof parsed.outNamesText === "string") b.outNamesText = parsed.outNamesText;
    if (Array.isArray(parsed.variables) && parsed.variables.length > 0 && parsed.variables.length <= BOOLEAN_MAX_VARS && parsed.variables.every((v) => typeof v === "string")) {
      b.variables = parsed.variables;
    }
    if (Array.isArray(parsed.outputNames) && parsed.outputNames.length > 0 && parsed.outputNames.length <= BOOLEAN_MAX_OUTPUTS && parsed.outputNames.every((v) => typeof v === "string")) {
      b.outputNames = parsed.outputNames;
    }
    if (Array.isArray(parsed.rows)) {
      b.rows = parsed.rows.filter((r) => r && Array.isArray(r.inputs) && Array.isArray(r.outputs));
    }
    b.tableReady = Boolean(parsed.tableReady) && b.rows.length > 0;
    b.results = parsed.results && typeof parsed.results === "object" ? parsed.results : null;
    b.error = typeof parsed.error === "string" ? parsed.error : "";
  } catch {
    // keep defaults
  }
}

/* ===================== 实验记录 ===================== */

const LAB_MAX_PHOTOS = 12;

function labActiveProject() {
  return state.labrec.projects.find((p) => p.id === state.labrec.activeId) || null;
}

function labClampCols(project) {
  const lr = state.labrec;
  const numericCols = project.fields
    .map((_, ci) => ({ ci, numeric: project.rows.some((r) => String(r[ci] ?? "").trim() !== "" && Number.isFinite(Number(r[ci]))) }))
    .filter((c) => c.numeric)
    .map((c) => c.ci);
  if (!(lr.yCol >= 0 && lr.yCol < project.fields.length)) {
    lr.yCol = numericCols.length ? numericCols[0] : 0;
  }
  if (lr.xCol !== -1 && !(lr.xCol >= 0 && lr.xCol < project.fields.length)) {
    lr.xCol = -1;
  }
}

function createDemoLabProject() {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    id: `p${Date.now().toString(36)}`,
    name: "示例 · 伏安法测电阻",
    date,
    fields: ["测量次数", "电压 U/V", "电流 I/mA"],
    rows: [[1, "1.0", "20.4"], [2, "2.0", "40.2"], [3, "3.0", "60.8"], [4, "4.0", "79.5"], [5, "5.0", "101.3"], [6, "6.0", "119.6"]],
    photos: [],
  };
}

function runLabrecCreate() {
  const lr = state.labrec;
  const name = String(lr.newName || "").trim();
  const fields = String(lr.newFields || "").split(/[,，]+/).map((f) => f.trim()).filter(Boolean);
  if (!name) {
    setHoverHint("请先填写项目名称");
    return;
  }
  if (!fields.length) {
    setHoverHint("请至少填写一个数据列，例如：测量次数, 电压 U/V");
    return;
  }
  const now = new Date();
  const project = {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    fields,
    rows: [],
    photos: [],
  };
  lr.projects.push(project);
  lr.activeId = project.id;
  lr.showCreate = false;
  lr.newName = "";
  lr.rowDraft = [];
  lr.confirmDelete = false;
  persistLabrec();
  renderActiveWorkspace();
  setHoverHint(`已创建项目「${name}」`);
}

function runLabrecDelete() {
  const lr = state.labrec;
  const project = labActiveProject();
  if (!project) return;
  if (!lr.confirmDelete) {
    lr.confirmDelete = true;
    renderActiveWorkspace();
    setHoverHint("再点一次「确认删除」以删除该项目及其全部数据");
    return;
  }
  lr.projects = lr.projects.filter((p) => p.id !== project.id);
  lr.confirmDelete = false;
  lr.activeId = lr.projects.length ? lr.projects[0].id : "";
  persistLabrec();
  renderActiveWorkspace();
  setHoverHint(`已删除项目「${project.name}」`);
}

function runLabrecAddRow() {
  const lr = state.labrec;
  const project = labActiveProject();
  if (!project) return;
  const row = project.fields.map((_, ci) => {
    const value = lr.rowDraft[ci];
    return value === undefined || value === null ? "" : String(value).trim();
  });
  project.rows.push(row);
  lr.rowDraft = [];
  persistLabrec();
  renderActiveWorkspace();
}

function runLabrecClear() {
  const lr = state.labrec;
  const project = labActiveProject();
  if (!project) return;
  if (!lr.confirmClear) {
    lr.confirmClear = true;
    renderActiveWorkspace();
    setHoverHint("再点一次「确认清空」以清空全部记录行");
    return;
  }
  project.rows = [];
  lr.confirmClear = false;
  persistLabrec();
  renderActiveWorkspace();
}

function runLabrecExport() {
  const project = labActiveProject();
  if (!project) return;
  if (!project.rows.length) {
    setHoverHint("当前项目还没有记录行，无法导出");
    return;
  }
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [project.fields.map(esc).join(",")];
  for (const row of project.rows) {
    lines.push(project.fields.map((_, ci) => esc(row[ci])).join(","));
  }
  const filename = `${project.name.replace(/[\\/:*?"<>|]/g, "_")}.csv`;
  downloadTextFile(filename, lines.join("\r\n"));
  setHoverHint(`已导出 ${filename}，可直接粘贴到实验报告`);
}

function compressImageFile(file, maxDim = 900, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("图片解码失败"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

async function handleLabPhotoFiles(fileList) {
  const project = labActiveProject();
  if (!project) return;
  const files = Array.from(fileList || []);
  if (!files.length) return;
  let added = 0;
  for (const file of files) {
    if (project.photos.length >= LAB_MAX_PHOTOS) {
      setHoverHint(`每份实验最多保存 ${LAB_MAX_PHOTOS} 张照片，多余照片已跳过`);
      break;
    }
    try {
      const dataUrl = await compressImageFile(file);
      project.photos.push({
        id: `ph${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        name: file.name || "实验照片",
        dataUrl,
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
      });
      added += 1;
    } catch (e) {
      setHoverHint(`照片处理失败：${e.message}`);
    }
  }
  if (added) {
    persistLabrec();
    renderActiveWorkspace();
    setHoverHint(`已添加 ${added} 张照片（自动压缩保存）`);
  }
}

function renderLabrecWorkspace() {
  const lr = state.labrec;
  const project = labActiveProject();
  const projectOptions = lr.projects.map((p) => `<option value="${escapeAttr(p.id)}" ${p.id === lr.activeId ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("");
  return `
    <div class="mode-banner">
      <h3 class="mode-title">实验记录</h3>
      <p class="mode-copy">按实验项目当场录入数据，自动生成记录表与图表；支持拍照记录实验现象，一键导出 CSV 直接贴进实验报告。</p>
      <div class="mode-badges">
        <span class="mode-badge">数据保存在本机浏览器</span>
        <span class="mode-badge">照片自动压缩</span>
      </div>
    </div>

    <section class="module-card">
      <h3>实验项目</h3>
      <div class="button-row">
        ${lr.projects.length ? `<label class="field-card" style="flex:1;min-width:200px"><span class="field-label">当前项目</span><select id="labProjectSelect" class="base-select">${projectOptions}</select></label>` : ""}
        <button class="mode-action ${lr.showCreate ? "is-active" : ""}" type="button" data-adv-action="labrec-new">新建项目</button>
        ${project ? `<button class="mode-action" type="button" data-adv-action="labrec-export">导出 CSV</button>` : ""}
        ${project ? `<button class="mode-action ${lr.confirmDelete ? "is-active" : ""}" type="button" data-adv-action="labrec-delete">${lr.confirmDelete ? "再点一次确认删除" : "删除项目"}</button>` : ""}
      </div>
      ${lr.showCreate ? `
        <div class="input-grid" style="margin-top:12px">
          <label class="field-card"><span class="field-label">项目名称</span><input id="labNewName" class="stats-input" type="text" value="${escapeAttr(lr.newName)}" placeholder="例如：伏安法测电阻" /></label>
          <label class="field-card input-grid--wide"><span class="field-label">数据列（逗号分隔）</span><input id="labNewFields" class="stats-input" type="text" value="${escapeAttr(lr.newFields)}" placeholder="例如：测量次数, 电压 U/V, 电流 I/A" /></label>
        </div>
        <div class="button-row" style="margin-top:10px">
          <button class="mode-action is-active" type="button" data-adv-action="labrec-create">创建项目</button>
        </div>
      ` : ""}
    </section>

    ${project ? renderLabProjectCard(project) : `<section class="module-card"><p class="mode-copy">还没有实验项目，点击「新建项目」创建一个。</p></section>`}
  `;
}

function renderLabProjectCard(project) {
  const lr = state.labrec;
  labClampCols(project);
  const rowsHtml = project.rows.map((row, ri) => `
    <tr>
      ${row.map((cell, ci) => `<td><input class="cell-input" type="text" value="${escapeAttr(String(cell ?? ""))}" data-lab-cell="${ri},${ci}" aria-label="第 ${ri + 1} 行 ${escapeHtml(project.fields[ci])}" /></td>`).join("")}
      <td><button class="ghost-btn ghost-btn--compact ghost-btn--danger" type="button" data-adv-action="labrec-del-row" data-row="${ri}">删除</button></td>
    </tr>`).join("");
  return `
    <section class="module-card">
      <h3>录入数据（${escapeHtml(project.date)}）</h3>
      <div class="input-grid">
        ${project.fields.map((f, ci) => `<label class="field-card"><span class="field-label">${escapeHtml(f)}</span><input class="stats-input" type="text" data-lab-new-col="${ci}" value="${escapeAttr(String(lr.rowDraft[ci] ?? ""))}" placeholder="输入${escapeHtml(f)}" /></label>`).join("")}
      </div>
      <div class="button-row" style="margin-top:10px">
        <button class="mode-action is-active" type="button" data-adv-action="labrec-add-row">添加记录</button>
        <button class="mode-action ${lr.confirmClear ? "is-active" : ""}" type="button" data-adv-action="labrec-clear">${lr.confirmClear ? "再点一次确认清空" : "清空记录"}</button>
      </div>
    </section>

    <section class="result-panel">
      <h3>记录表（自动生成）</h3>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>${project.fields.map((f) => `<th>${escapeHtml(f)}</th>`).join("")}<th>操作</th></tr></thead>
          <tbody>${project.rows.length ? rowsHtml : `<tr><td colspan="${project.fields.length + 1}" class="table-empty">暂无记录，在上方录入后点击「添加记录」。</td></tr>`}</tbody>
        </table>
      </div>
    </section>

    <section class="module-card">
      <h3>数据图表</h3>
      <div class="input-grid">
        <label class="field-card"><span class="field-label">图表类型</span><select id="labChartType" class="base-select">
          <option value="line" ${lr.chartType === "line" ? "selected" : ""}>折线图</option>
          <option value="scatter" ${lr.chartType === "scatter" ? "selected" : ""}>散点图</option>
          <option value="bar" ${lr.chartType === "bar" ? "selected" : ""}>柱状图</option>
        </select></label>
        <label class="field-card"><span class="field-label">横轴</span><select id="labXCol" class="base-select">
          <option value="-1" ${lr.xCol === -1 ? "selected" : ""}>记录序号</option>
          ${project.fields.map((f, ci) => `<option value="${ci}" ${lr.xCol === ci ? "selected" : ""}>${escapeHtml(f)}</option>`).join("")}
        </select></label>
        <label class="field-card"><span class="field-label">纵轴列</span><select id="labYCol" class="base-select">
          ${project.fields.map((f, ci) => `<option value="${ci}" ${lr.yCol === ci ? "selected" : ""}>${escapeHtml(f)}</option>`).join("")}
        </select></label>
      </div>
      <div class="chart-box"><canvas id="labChartCanvas" class="chart-canvas"></canvas></div>
      <p class="mode-copy" style="margin-top:8px">纵轴只绘制能解析为数字的记录；横轴选「记录序号」则按录入顺序绘制。</p>
    </section>

    <section class="module-card">
      <h3>实验现象照片</h3>
      <div class="button-row">
        <label class="mode-action mode-action--label">拍照<input id="labPhotoCamera" type="file" accept="image/*" capture="environment" class="hidden-file" /></label>
        <label class="mode-action mode-action--label">从相册选择<input id="labPhotoGallery" type="file" accept="image/*" multiple class="hidden-file" /></label>
      </div>
      ${project.photos.length ? `
        <div class="photo-grid">
          ${project.photos.map((p) => `
            <figure class="photo-card">
              <img src="${escapeAttr(p.dataUrl)}" alt="${escapeAttr(p.name)}" />
              <figcaption class="photo-meta">
                <span class="photo-name">${escapeHtml(p.name)}</span>
                <button class="ghost-btn ghost-btn--compact ghost-btn--danger" type="button" data-adv-action="labrec-del-photo" data-photo="${escapeAttr(p.id)}">删除</button>
              </figcaption>
            </figure>`).join("")}
        </div>` : `<p class="mode-copy" style="margin-top:8px">还没有照片。手机上点「拍照」可直接调起相机。</p>`}
      <p class="mode-copy" style="margin-top:8px">照片压缩后保存在浏览器中（每份项目最多 ${LAB_MAX_PHOTOS} 张）。</p>
    </section>
  `;
}

function drawLabChart() {
  const canvas = document.getElementById("labChartCanvas");
  if (!canvas) return;
  const project = labActiveProject();
  if (!project) return;
  labClampCols(project);
  const lr = state.labrec;
  const xs = [];
  const ys = [];
  project.rows.forEach((row, ri) => {
    const yv = Number(row[lr.yCol]);
    if (!Number.isFinite(yv) || String(row[lr.yCol] ?? "").trim() === "") return;
    if (lr.xCol >= 0) {
      const xv = Number(row[lr.xCol]);
      xs.push(String(row[lr.xCol] ?? "").trim() !== "" && Number.isFinite(xv) ? xv : ri + 1);
    } else {
      xs.push(ri + 1);
    }
    ys.push(yv);
  });
  drawChart(canvas, {
    type: lr.chartType,
    xs: lr.chartType === "bar" ? undefined : xs,
    ys,
    xLabel: lr.xCol >= 0 ? project.fields[lr.xCol] : "记录序号",
    yLabel: project.fields[lr.yCol] || "数值",
    title: project.name,
  });
}

function persistLabrec() {
  let payload = JSON.stringify(state.labrec);
  if (payload.length > 4200000) {
    for (const p of state.labrec.projects) {
      while (p.photos.length && payload.length > 4200000) p.photos.shift();
      payload = JSON.stringify(state.labrec);
      if (payload.length <= 4200000) break;
    }
    setHoverHint("浏览器存储空间不足，较早的照片已被移除");
  }
  persistDebounced(STORAGE_KEYS.labrec, payload);
}

function hydrateLabrec() {
  const stored = readStorage(STORAGE_KEYS.labrec);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed.projects)) {
        state.labrec.projects = parsed.projects
          .filter((p) => p && typeof p.name === "string" && Array.isArray(p.fields) && p.fields.length > 0)
          .map((p) => ({
            id: typeof p.id === "string" && p.id ? p.id : `p${Math.random().toString(36).slice(2, 9)}`,
            name: p.name,
            date: typeof p.date === "string" ? p.date : "",
            fields: p.fields.map((f) => String(f)),
            rows: Array.isArray(p.rows) ? p.rows.filter((r) => Array.isArray(r)) : [],
            photos: Array.isArray(p.photos) ? p.photos.filter((ph) => ph && typeof ph.dataUrl === "string") : [],
          }));
        state.labrec.activeId = typeof parsed.activeId === "string" ? parsed.activeId : "";
        state.labrec.chartType = ["line", "scatter", "bar"].includes(parsed.chartType) ? parsed.chartType : "line";
        state.labrec.xCol = Number.isFinite(parsed.xCol) ? parsed.xCol : -1;
        state.labrec.yCol = Number.isFinite(parsed.yCol) ? parsed.yCol : 1;
      }
    } catch {
      // keep defaults
    }
  }
  if (!state.labrec.projects.length) state.labrec.projects = [createDemoLabProject()];
  if (!labActiveProject()) state.labrec.activeId = state.labrec.projects[0].id;
}

/* ===================== 数据处理工具箱 ===================== */

const DATAPROC_DEMO = `电压 U/V,电流 I/mA
1.0,20.4
2.0,40.2
3.0,60.8
4.0,79.5
5.0,101.3
6.0,119.6`;

const DP_FIT_OPTIONS = [
  { value: "none", label: "不拟合", degree: 0 },
  { value: "linear", label: "线性拟合", degree: 1 },
  { value: "poly2", label: "二次多项式", degree: 2 },
  { value: "poly3", label: "三次多项式", degree: 3 },
  { value: "poly4", label: "四次多项式", degree: 4 },
];

function parseCsvTable(raw) {
  const lines = String(raw || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const probe = lines[0];
  const delim = probe.includes("\t") ? "\t" : probe.includes(";") ? ";" : probe.includes(",") ? "," : null;
  const split = (line) => (delim ? line.split(delim).map((s) => s.trim()) : line.trim().split(/\s+/));
  let table = lines.map(split).map((cells) => cells.map((s) => s.replace(/^"(.*)"$/, "$1").replace(/""/g, '"')));
  table = table.filter((cells) => cells.some((c) => c !== ""));
  if (!table.length) return null;
  const colCount = Math.max(...table.map((r) => r.length));
  table = table.map((r) => {
    const copy = r.slice();
    while (copy.length < colCount) copy.push("");
    return copy;
  });
  const firstRowNumeric = table[0].every((c) => c === "" || Number.isFinite(Number(c)));
  const headers = firstRowNumeric ? null : table[0];
  if (!firstRowNumeric) table = table.slice(1);
  const columns = [];
  for (let ci = 0; ci < colCount; ci += 1) {
    const name = headers ? (headers[ci] || `列${ci + 1}`) : `列${ci + 1}`;
    const cells = table.map((r) => r[ci] ?? "");
    const values = cells.map((c) => (c === "" ? NaN : Number(c)));
    const finiteCount = values.filter(Number.isFinite).length;
    const numeric = finiteCount >= 1 && cells.every((c) => c === "" || Number.isFinite(Number(c)));
    columns.push({ index: ci, name, values, numeric, stats: numeric ? computeColumnStats(values) : null });
  }
  return { headers, columns, rowCount: table.length };
}

function computeColumnStats(values) {
  const xs = values.filter(Number.isFinite);
  const n = xs.length;
  if (!n) return null;
  let sum = 0;
  for (const v of xs) sum += v;
  const mean = sum / n;
  let varSum = 0;
  for (const v of xs) varSum += (v - mean) * (v - mean);
  const variance = n > 1 ? varSum / (n - 1) : 0;
  const std = Math.sqrt(variance);
  const se = n > 1 ? std / Math.sqrt(n) : 0;
  let min = xs[0];
  let max = xs[0];
  for (const v of xs) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { n, mean, variance, std, se, err95: 1.96 * se, min, max, range: max - min };
}

function polyEvalAsc(coeffs, x) {
  let y = 0;
  for (let i = coeffs.length - 1; i >= 0; i -= 1) y = y * x + coeffs[i];
  return y;
}

function fitPolynomial(xs, ys, degree) {
  const n = degree + 1;
  const m = xs.length;
  const s = new Array(2 * degree + 1).fill(0);
  const t = new Array(n).fill(0);
  for (let i = 0; i < m; i += 1) {
    const x = xs[i];
    let xk = 1;
    for (let k = 0; k <= 2 * degree; k += 1) {
      s[k] += xk;
      xk *= x;
    }
    let yk = 1;
    for (let k = 0; k < n; k += 1) {
      t[k] += ys[i] * yk;
      yk *= x;
    }
  }
  const rows = [];
  for (let j = 0; j < n; j += 1) {
    const row = [];
    for (let k = 0; k < n; k += 1) row.push(s[j + k]);
    row.push(t[j]);
    rows.push(row);
  }
  let coeffs;
  try {
    coeffs = solveLinearSystem(rows);
  } catch {
    throw new Error("拟合失败：该阶数下矩阵奇异，请降低拟合阶数");
  }
  if (coeffs.some((c) => !Number.isFinite(c))) {
    throw new Error("拟合失败：数值不稳定，请降低拟合阶数");
  }
  let meanY = 0;
  for (const y of ys) meanY += y;
  meanY /= m;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < m; i += 1) {
    const yh = polyEvalAsc(coeffs, xs[i]);
    ssRes += (ys[i] - yh) * (ys[i] - yh);
    ssTot += (ys[i] - meanY) * (ys[i] - meanY);
  }
  const r2 = ssTot > 1e-15 ? 1 - ssRes / ssTot : (ssRes > 1e-15 ? 0 : 1);
  return { degree, coeffs, r2, formula: formatPolyFormula(coeffs), points: m };
}

function formatPolyFormula(coeffs) {
  const sup = { 2: "²", 3: "³", 4: "⁴" };
  const parts = [];
  for (let i = coeffs.length - 1; i >= 0; i -= 1) {
    const c = coeffs[i];
    if (Math.abs(c) < 1e-12 && coeffs.length > 1) continue;
    const absText = formatFitNumber(Math.abs(c));
    let term;
    if (i === 0) {
      term = absText;
    } else {
      const power = i === 1 ? "x" : `x${sup[i] || ("^" + i)}`;
      term = (absText === "1" ? "" : `${absText}·`) + power;
    }
    parts.push({ sign: c < 0 ? "−" : "+", term });
  }
  if (!parts.length) return "y = 0";
  let out = `${parts[0].sign === "−" ? "−" : ""}${parts[0].term}`;
  for (let i = 1; i < parts.length; i += 1) out += ` ${parts[i].sign} ${parts[i].term}`;
  return `y = ${out}`;
}

function formatFitNumber(v) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e6 || abs < 1e-4) return v.toExponential(3);
  return String(parseFloat(v.toPrecision(5)));
}

function analyzeDataprocData() {
  const dp = state.dataproc;
  dp.error = "";
  const parsed = parseCsvTable(dp.rawInput);
  if (!parsed) throw new Error("没有可解析的数据，请粘贴 CSV 或逐行输入数值");
  if (!parsed.columns.some((c) => c.numeric)) throw new Error("未找到数值列，请检查数据格式");
  dp.parsed = parsed;
  const numericCols = parsed.columns.filter((c) => c.numeric);
  if (!numericCols.some((c) => c.index === dp.xCol)) dp.xCol = numericCols[0].index;
  if (!numericCols.some((c) => c.index === dp.yCol)) dp.yCol = numericCols.length > 1 ? numericCols[1].index : numericCols[0].index;
  computeDataprocFit();
}

function computeDataprocFit() {
  const dp = state.dataproc;
  dp.fit = null;
  dp.fitError = "";
  if (!dp.parsed || dp.fitType === "none") return;
  const option = DP_FIT_OPTIONS.find((o) => o.value === dp.fitType);
  if (!option || option.degree < 1) return;
  const xCol = dp.parsed.columns.find((c) => c.index === dp.xCol);
  const yCol = dp.parsed.columns.find((c) => c.index === dp.yCol);
  if (!xCol || !yCol) return;
  const xs = [];
  const ys = [];
  yCol.values.forEach((yv, i) => {
    const xv = dp.xCol === dp.yCol ? i + 1 : xCol.values[i];
    if (Number.isFinite(xv) && Number.isFinite(yv)) {
      xs.push(xv);
      ys.push(yv);
    }
  });
  if (xs.length < option.degree + 1) {
    dp.fitError = `有效数据点不足（至少需要 ${option.degree + 1} 个）`;
    return;
  }
  try {
    dp.fit = fitPolynomial(xs, ys, option.degree);
  } catch (e) {
    dp.fitError = e.message || "拟合失败";
  }
}

function runDataprocAnalyze() {
  const dp = state.dataproc;
  dp.error = "";
  try {
    analyzeDataprocData();
  } catch (e) {
    dp.parsed = null;
    dp.fit = null;
    dp.error = e.message || "解析失败";
  }
  renderActiveWorkspace();
}

function runDataprocExportImage() {
  const canvas = document.getElementById("dpChartCanvas");
  if (!canvas) {
    setHoverHint("请先解析数据并生成图表");
    return;
  }
  downloadDataUrl("实验数据图.png", canvas.toDataURL("image/png"));
  setHoverHint("已导出图表 PNG 图片，可直接插入实验报告");
}

function renderDataprocWorkspace() {
  const dp = state.dataproc;
  const numericCols = dp.parsed ? dp.parsed.columns.filter((c) => c.numeric) : [];
  const colOption = (selected) => numericCols
    .map((c) => `<option value="${c.index}" ${c.index === selected ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");
  return `
    <div class="mode-banner">
      <h3 class="mode-title">数据处理工具箱</h3>
      <p class="mode-copy">粘贴 CSV 数据或手动输入，自动计算均值、方差、标准差与误差范围，一键绘制图表并做线性/多项式拟合，导出图片贴进实验报告。</p>
      <div class="mode-badges">
        <span class="mode-badge">支持逗号 / 分号 / 制表符 / 空格分隔</span>
        <span class="mode-badge">自动识别表头</span>
      </div>
    </div>

    <section class="module-card">
      <h3>1. 输入数据</h3>
      <textarea id="dpRawInput" class="stats-input dp-textarea" rows="8" spellcheck="false" placeholder="每行一条记录，用逗号分隔各列，例如：&#10;电压 U/V,电流 I/mA&#10;1.0,20.4&#10;2.0,40.2">${escapeHtml(dp.rawInput)}</textarea>
      <div class="button-row" style="margin-top:10px">
        <button class="mode-action is-active" type="button" data-adv-action="dp-analyze">分析数据</button>
        <button class="mode-action" type="button" data-adv-action="dp-demo">示例数据</button>
        <button class="mode-action" type="button" data-adv-action="dp-clear">清空</button>
      </div>
    </section>

    ${dp.error ? `<section class="module-card"><p class="mode-copy boolean-error">${escapeHtml(dp.error)}</p></section>` : ""}
    ${dp.parsed ? renderDataprocAnalysis() : ""}
  `;
}

function renderDataprocAnalysis() {
  const dp = state.dataproc;
  const numericCols = dp.parsed.columns.filter((c) => c.numeric && c.stats);
  const colOption = (selected) => numericCols
    .map((c) => `<option value="${c.index}" ${c.index === selected ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");
  const statsHtml = numericCols.map((c) => {
    const s = c.stats;
    return `
      <section class="module-card">
        <h3>统计：${escapeHtml(c.name)}</h3>
        <div class="summary-grid" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
          <div class="summary-card"><span class="summary-label">样本数 n</span><strong>${s.n}</strong></div>
          <div class="summary-card"><span class="summary-label">均值</span><strong>${formatFitNumber(s.mean)}</strong></div>
          <div class="summary-card"><span class="summary-label">方差 s²</span><strong>${formatFitNumber(s.variance)}</strong></div>
          <div class="summary-card"><span class="summary-label">标准差 s</span><strong>${formatFitNumber(s.std)}</strong></div>
          <div class="summary-card"><span class="summary-label">误差范围 (95%)</span><strong>±${formatFitNumber(s.err95)}</strong></div>
          <div class="summary-card"><span class="summary-label">极差</span><strong>${formatFitNumber(s.range)}</strong></div>
        </div>
      </section>`;
  }).join("");

  return `
    ${statsHtml}

    <section class="module-card">
      <h3>图表</h3>
      <div class="input-grid">
        <label class="field-card"><span class="field-label">图表类型</span><select id="dpChartType" class="base-select">
          <option value="line" ${dp.chartType === "line" ? "selected" : ""}>折线图</option>
          <option value="scatter" ${dp.chartType === "scatter" ? "selected" : ""}>散点图</option>
          <option value="bar" ${dp.chartType === "bar" ? "selected" : ""}>柱状图</option>
        </select></label>
        <label class="field-card"><span class="field-label">横轴列</span><select id="dpXCol" class="base-select">${colOption(dp.xCol)}</select></label>
        <label class="field-card"><span class="field-label">纵轴列</span><select id="dpYCol" class="base-select">${colOption(dp.yCol)}</select></label>
        <label class="field-card"><span class="field-label">拟合方式</span><select id="dpFitType" class="base-select">
          ${DP_FIT_OPTIONS.map((o) => `<option value="${o.value}" ${dp.fitType === o.value ? "selected" : ""}>${o.label}</option>`).join("")}
        </select></label>
      </div>
      <div class="chart-box"><canvas id="dpChartCanvas" class="chart-canvas"></canvas></div>
      <div class="button-row" style="margin-top:10px">
        <button class="mode-action" type="button" data-adv-action="dp-export-image">导出图片 PNG</button>
      </div>
      ${dp.fitError ? `<p class="validation-msg is-error" style="margin-top:8px">${escapeHtml(dp.fitError)}</p>` : ""}
      ${dp.fit ? `
        <div class="result-row result-row--standard" style="margin-top:10px">
          <span class="result-tag">拟合</span>
          <code>${escapeHtml(dp.fit.formula)}　R² = ${escapeHtml(formatFitNumber(dp.fit.r2))}</code>
          <button class="ghost-btn ghost-btn--compact" type="button" data-copy-text="${escapeAttr(`${dp.fit.formula}  R² = ${formatFitNumber(dp.fit.r2)}`)}">复制</button>
        </div>` : ""}
    </section>
  `;
}

function drawDataprocChart() {
  const canvas = document.getElementById("dpChartCanvas");
  if (!canvas || !state.dataproc.parsed) return;
  const dp = state.dataproc;
  const xCol = dp.parsed.columns.find((c) => c.index === dp.xCol);
  const yCol = dp.parsed.columns.find((c) => c.index === dp.yCol);
  if (!xCol || !yCol) return;
  const xs = [];
  const ys = [];
  yCol.values.forEach((yv, i) => {
    const xv = dp.xCol === dp.yCol ? i + 1 : xCol.values[i];
    if (Number.isFinite(xv) && Number.isFinite(yv)) {
      xs.push(xv);
      ys.push(yv);
    }
  });
  const legendLines = dp.fit ? [`${dp.fit.formula}   R² = ${formatFitNumber(dp.fit.r2)}`] : [];
  drawChart(canvas, {
    type: dp.chartType,
    xs: dp.chartType === "bar" ? undefined : xs,
    ys,
    xLabel: dp.xCol === dp.yCol ? "记录序号" : xCol.name,
    yLabel: yCol.name,
    fit: dp.fit && dp.chartType !== "bar" ? dp.fit : null,
    legendLines,
    title: "实验数据图",
  });
}

function persistDataproc() {
  const dp = state.dataproc;
  persistDebounced(STORAGE_KEYS.dataproc, JSON.stringify({
    rawInput: dp.rawInput,
    chartType: dp.chartType,
    xCol: dp.xCol,
    yCol: dp.yCol,
    fitType: dp.fitType,
  }));
}

function hydrateDataproc() {
  const stored = readStorage(STORAGE_KEYS.dataproc);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const dp = state.dataproc;
      if (typeof parsed.rawInput === "string") dp.rawInput = parsed.rawInput;
      dp.chartType = ["line", "scatter", "bar"].includes(parsed.chartType) ? parsed.chartType : dp.chartType;
      dp.fitType = ["none", "linear", "poly2", "poly3", "poly4"].includes(parsed.fitType) ? parsed.fitType : dp.fitType;
      if (Number.isFinite(parsed.xCol)) dp.xCol = parsed.xCol;
      if (Number.isFinite(parsed.yCol)) dp.yCol = parsed.yCol;
    } catch {
      // keep defaults
    }
  }
  if (!state.dataproc.rawInput.trim()) state.dataproc.rawInput = DATAPROC_DEMO;
  try {
    analyzeDataprocData();
  } catch {
    // 首屏保持空状态，用户点击「分析数据」时会看到错误提示
  }
}

/* ===================== 图表引擎（Canvas） ===================== */

const CHART_COLORS = {
  line: "#f3c56d",
  point: "#7fe0d0",
  bar: "#f0b55b",
  fit: "#ff9d76",
  grid: "rgba(255,255,255,0.07)",
  axis: "rgba(243,239,232,0.45)",
  text: "#a6aea8",
  bg: "#0a1214",
  title: "#f3efe8",
};

function niceTicks(min, max, targetCount = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const span = max - min;
  const step0 = span / Math.max(1, targetCount);
  const mag = 10 ** Math.floor(Math.log10(step0));
  let step = mag;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (step0 <= m * mag) {
      step = m * mag;
      break;
    }
  }
  const ticks = [];
  const start = Math.ceil(min / step - 1e-9) * step;
  for (let v = start; v <= max + step * 1e-9; v += step) {
    ticks.push(Number(v.toFixed(10)));
  }
  return ticks;
}

function formatTick(v) {
  if (v === 0) return "0";
  const abs = Math.abs(v);
  if (abs >= 1e6 || abs < 1e-4) return v.toExponential(1);
  return String(parseFloat(v.toPrecision(4)));
}

function drawChart(canvas, cfg) {
  if (!canvas || typeof canvas.getContext !== "function") return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(280, Math.round(canvas.clientWidth || 560));
  const cssHeight = Math.max(220, Math.round(Math.min(420, cssWidth * 0.55)));
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = CHART_COLORS.bg;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const legendLines = cfg.legendLines || [];
  const title = cfg.title || "";

  const points = [];
  const ysArr = cfg.ys || [];
  for (let i = 0; i < ysArr.length; i += 1) {
    const x = Array.isArray(cfg.xs) ? cfg.xs[i] : i + 1;
    const y = ysArr[i];
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  }

  ctx.textBaseline = "middle";
  ctx.font = "12px 'Segoe UI', 'Microsoft YaHei', sans-serif";
  if (!points.length) {
    ctx.fillStyle = CHART_COLORS.text;
    ctx.textAlign = "center";
    ctx.fillText("暂无可绘制的数据", cssWidth / 2, cssHeight / 2);
    return;
  }

  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }

  let fitSamples = null;
  if (cfg.fit && Array.isArray(cfg.fit.coeffs) && cfg.type !== "bar") {
    fitSamples = [];
    for (let i = 0; i <= 120; i += 1) {
      const x = xMin + (xMax - xMin) * (i / 120);
      const y = polyEvalAsc(cfg.fit.coeffs, x);
      fitSamples.push({ x, y });
      if (Number.isFinite(y)) {
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }

  if (xMax - xMin < 1e-12) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMax - yMin < 1e-12) {
    yMin -= 1;
    yMax += 1;
  }
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;

  const titleTop = 10;
  const legendStart = titleTop + (title ? 17 : 0) + 4;
  const marginTop = legendStart + legendLines.length * 16 + 6;
  const marginLeft = 58;
  const marginRight = 14;
  const marginBottom = 40;
  const plotW = Math.max(10, cssWidth - marginLeft - marginRight);
  const plotH = Math.max(10, cssHeight - marginTop - marginBottom);
  const px = (v) => marginLeft + ((v - xMin) / (xMax - xMin)) * plotW;
  const py = (v) => marginTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  ctx.font = "11px 'Segoe UI', 'Microsoft YaHei', sans-serif";
  ctx.lineWidth = 1;
  ctx.strokeStyle = CHART_COLORS.grid;
  ctx.fillStyle = CHART_COLORS.text;
  const xTicks = niceTicks(xMin, xMax, 6);
  const yTicks = niceTicks(yMin, yMax, 5);
  ctx.textAlign = "center";
  for (const t of xTicks) {
    const x = px(t);
    ctx.beginPath();
    ctx.moveTo(x, marginTop);
    ctx.lineTo(x, marginTop + plotH);
    ctx.stroke();
    ctx.fillText(formatTick(t), x, marginTop + plotH + 14);
  }
  ctx.textAlign = "right";
  for (const t of yTicks) {
    const y = py(t);
    ctx.beginPath();
    ctx.moveTo(marginLeft, y);
    ctx.lineTo(marginLeft + plotW, y);
    ctx.stroke();
    ctx.fillText(formatTick(t), marginLeft - 6, y);
  }
  ctx.strokeStyle = CHART_COLORS.axis;
  ctx.beginPath();
  ctx.moveTo(marginLeft, marginTop);
  ctx.lineTo(marginLeft, marginTop + plotH);
  ctx.lineTo(marginLeft + plotW, marginTop + plotH);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(marginLeft, marginTop, plotW, plotH);
  ctx.clip();

  if (cfg.type === "bar") {
    const slot = plotW / points.length;
    const bw = Math.max(3, slot * 0.6);
    const baseline = 0 >= yMin && 0 <= yMax ? 0 : yMin;
    const baseY = py(baseline);
    for (const p of points) {
      const cx = px(p.x);
      const topY = py(p.y);
      const grad = ctx.createLinearGradient(0, topY, 0, baseY);
      grad.addColorStop(0, CHART_COLORS.bar);
      grad.addColorStop(1, "rgba(240,181,91,0.35)");
      ctx.fillStyle = grad;
      ctx.fillRect(cx - bw / 2, Math.min(topY, baseY), bw, Math.max(1, Math.abs(baseY - topY)));
    }
  } else {
    if (cfg.type === "line" && points.length > 1) {
      ctx.strokeStyle = CHART_COLORS.line;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = px(p.x);
        const y = py(p.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    ctx.fillStyle = CHART_COLORS.point;
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(px(p.x), py(p.y), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (fitSamples) {
      ctx.strokeStyle = CHART_COLORS.fit;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      fitSamples.forEach((p, i) => {
        const x = px(p.x);
        const y = py(p.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();

  ctx.fillStyle = CHART_COLORS.text;
  ctx.font = "12px 'Segoe UI', 'Microsoft YaHei', sans-serif";
  ctx.textAlign = "center";
  if (cfg.xLabel) ctx.fillText(cfg.xLabel, marginLeft + plotW / 2, cssHeight - 12);
  if (cfg.yLabel) {
    ctx.save();
    ctx.translate(14, marginTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(cfg.yLabel, 0, 0);
    ctx.restore();
  }
  if (title) {
    ctx.fillStyle = CHART_COLORS.title;
    ctx.textAlign = "center";
    ctx.fillText(title, cssWidth / 2, titleTop + 8);
  }
  if (legendLines.length) {
    ctx.fillStyle = CHART_COLORS.fit;
    ctx.textAlign = "left";
    ctx.font = "12px Consolas, 'Microsoft YaHei', monospace";
    legendLines.forEach((line, i) => ctx.fillText(line, marginLeft + 6, legendStart + 8 + i * 16));
  }
}

/* ===================== 导出与剪贴板工具 ===================== */

function downloadDataUrl(filename, href) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadTextFile(filename, text) {
  const blob = new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copyTextToClipboard(text, button) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ok = document.execCommand("copy");
      ta.remove();
    } catch {
      ok = false;
    }
  }
  if (button) {
    const original = button.textContent;
    button.textContent = ok ? "已复制" : "复制失败";
    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }
  setHoverHint(ok ? "已复制到剪贴板" : "复制失败，请手动选择文本复制");
}

let chartResizeTimer = null;
function handleChartResize() {
  clearTimeout(chartResizeTimer);
  chartResizeTimer = setTimeout(() => {
    if (state.tool === "labrec") drawLabChart();
    if (state.tool === "dataproc") drawDataprocChart();
  }, 150);
}

// 在文件末尾启动应用，确保所有常量（如 DATAPROC_DEMO）已完成初始化
initialize();
