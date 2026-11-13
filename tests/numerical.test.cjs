const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
// 执行真实应用代码，仅去掉末尾启动UI的一次调用；算法、解析器和常量均来自源码。
const source=fs.readFileSync(path.join(__dirname,'../app-cn.js'),'utf8').replace(/initialize\(\);\s*$/,'');
const calc={window:{localStorage:{getItem:()=>null}},document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}};
vm.createContext(calc);vm.runInContext(source,calc);
function roots(coeffs,expected){const actual=Array.from(calc.solvePolynomialRealOnly(coeffs),Number);assert.equal(actual.length,expected.length);expected.forEach((r,i)=>assert.ok(Math.abs(actual[i]-r)<1e-6,JSON.stringify({actual,expected})));}
test('无实根牛顿法在零初值和巨大初值都失败',()=>{for(const x of [0,1e5,-1e5])assert.equal(calc.solveByNewtonSimple('x^2+1',x).ok,false);});
test('牛顿法正确解普通、小尺度和重根方程',()=>{for(const [expr,x,expected] of [['x^2-2',1,Math.SQRT2],['1e-12*x+1e-12',0,-1],['(x-0.3)^2',1,0.3]]){const r=calc.solveByNewtonSimple(expr,x);assert.equal(r.ok,true,JSON.stringify(r));assert.ok(Math.abs(r.root-expected)<1e-6);}});
test('牛顿法拒绝非有限初值和无效表达式',()=>{assert.equal(calc.solveByNewtonSimple('x',Infinity).ok,false);assert.equal(calc.solveByNewtonSimple('unknown(x)',1).ok,false);});
test('多项式保留重根和相邻根',()=>{roots([1,-0.6,0.09],[0.3]);roots([1,-0.3,0.02],[0.1,0.2]);roots([1,-0.6,0.12,-0.008],[0.2]);});
test('多项式整体缩放不改变解集',()=>{for(const k of [1e-200,1,1e200])roots([k,-0.3*k,0.02*k],[0.1,0.2]);});
test('极小正极小值不能冒充实根',()=>{for(const c of [1,1e-10,1e-14,1e-200])roots([1,0,c],[]);roots([1,0,0],[0]);});
test('排列组合避免阶乘中间值溢出',()=>{assert.equal(calc.combinations(200,1),200);assert.equal(calc.combinations(200,199),200);assert.equal(calc.permutations(200,1),200);assert.ok(Number.isFinite(calc.combinations(100,50)));});
