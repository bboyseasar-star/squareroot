/**
 * 鬼リピ 〜平方根〜
 * 問題生成エンジン (questions.js)
 * 
 * このファイルは、中学生向けにランダムで平方根の問題を生成するプログラムです。
 * レベル3の大小関係では、解説画面で表示する「数直線」の描画用データも一緒に作成します。
 */

// ユーティリティ：指定範囲のランダムな整数を返す
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ユーティリティ：ある数が平方数（何かの2乗）であるか判定
function isSquareNum(num) {
    let r = Math.round(Math.sqrt(num));
    return r * r === num;
}

/**
 * レベル1：平方根の基本（平方根を表す / 根号を外す）
 */
function generateLevel1() {
    let type = Math.random() < 0.5 ? 'express' : 'simplify';
    let isFraction = Math.random() < 0.3;
    let isDecimal = Math.random() < 0.2;
    
    let qInstruction = "";
    let qLatex = "";
    let ansVariations = [];
    let hints = [];
    
    if (type === 'express') {
        qInstruction = "次の数の平方根を表しなさい";
        if (isFraction) {
            let n1 = getRandomInt(2, 9);
            let n2 = getRandomInt(2, 9);
            if (n1 === n2) n2++;
            let num = n1;
            let den = n2;
            let isSq1 = isSquareNum(num);
            let isSq2 = isSquareNum(den);
            
            qLatex = `\\frac{${num}}{${den}}`;
            if (isSq1 && isSq2) {
                ansVariations = [`\\pm \\frac{${Math.sqrt(num)}}{${Math.sqrt(den)}}`];
                hints.push({text: "平方根は、2乗するとその数になるもののことだよ。", math: `\\pm\\sqrt{\\frac{${num}}{${den}}}`});
                hints.push({text: "分母も分子も、何かの2乗になっていないか確認しよう！", math: `${Math.sqrt(num)}^2 = ${num}, \\quad ${Math.sqrt(den)}^2 = ${den}`});
                hints.push({text: "根号を外して答えよう！プラスマイナスを忘れずに！", math: ansVariations[0]});
            } else {
                ansVariations = [`\\pm \\sqrt{\\frac{${num}}{${den}}}`];
                hints.push({text: "平方根を表すときは、根号（ルート）をつけて、プラスマイナスを忘れないようにしよう！", math: `\\pm\\sqrt{\\text{数}}`});
                hints.push({text: "そのままルートをかぶせるだけでOK！", math: ansVariations[0]});
            }
        } else if (isDecimal) {
            let nums = [0.1, 0.3, 0.7, 1.3, 2.5, 0.04, 0.09, 0.16];
            let val = nums[getRandomInt(0, nums.length - 1)];
            qLatex = `${val}`;
            if (val === 0.04 || val === 0.09 || val === 0.16) {
                let root = Math.sqrt(val);
                // 小数の2乗の浮動小数点誤差を防ぐためtoFixedを使用
                let rootStr = root.toFixed(1).replace(/\.0$/, '');
                ansVariations = [`\\pm ${rootStr}`];
                hints.push({text: "平方根は、2乗するとその数になるもののことだよ。", math: `\\pm\\sqrt{${val}}`});
                hints.push({text: "小数の2乗に気をつけて！", math: `(${rootStr})^2 = ${val}`});
                hints.push({text: "根号を外して答えよう！プラスマイナスを忘れずに！", math: ansVariations[0]});
            } else {
                ansVariations = [`\\pm \\sqrt{${val}}`];
                hints.push({text: "平方根を表すときは、根号（ルート）をつけて、プラスマイナスを忘れないようにしよう！", math: `\\pm\\sqrt{\\text{数}}`});
                hints.push({text: "そのままルートをかぶせるだけでOK！", math: ansVariations[0]});
            }
        } else {
            let nums = [2, 3, 5, 6, 7, 10, 13, 15, 17, 9, 16, 25, 36, 49, 64, 81];
            let val = nums[getRandomInt(0, nums.length - 1)];
            qLatex = `${val}`;
            if (isSquareNum(val)) {
                ansVariations = [`\\pm ${Math.sqrt(val)}`];
                hints.push({text: "平方根は、2乗するとその数になるもののことだよ。", math: `\\pm\\sqrt{${val}}`});
                hints.push({text: "九九を思い出して！何かの2乗になっていないかな？", math: `${Math.sqrt(val)}^2 = ${val}`});
                hints.push({text: "根号を外して答えよう！プラスマイナスを忘れずに！", math: ansVariations[0]});
            } else {
                ansVariations = [`\\pm \\sqrt{${val}}`];
                hints.push({text: "平方根を表すときは、根号（ルート）をつけて、プラスマイナスを忘れないようにしよう！", math: `\\pm\\sqrt{\\text{数}}`});
                hints.push({text: "そのままルートをかぶせるだけでOK！", math: ansVariations[0]});
            }
        }
    } else {
        qInstruction = "次の数を根号を使わずに表しなさい";
        let sign = Math.random() < 0.5 ? 1 : -1;
        let isSqType = Math.random() < 0.3; // \sqrt{(-3)^2} のような形
        
        if (isSqType && sign === 1) {
            let base = getRandomInt(2, 9) * (Math.random() < 0.5 ? 1 : -1);
            qLatex = `\\sqrt{(${base})^2}`;
            ansVariations = [`${Math.abs(base)}`];
            hints.push({text: "まず、根号の中を計算してみよう！", math: `(${base})^2 = ${base * base}`});
            hints.push({text: "根号を外すときは、中身が正の数になるようにしよう！", math: `\\sqrt{${base * base}} = ${Math.abs(base)}`});
        } else {
            let root = getRandomInt(1, 10);
            let sq = root * root;
            if (sign === 1) {
                qLatex = `\\sqrt{${sq}}`;
                ansVariations = [`${root}`];
                hints.push({text: "根号の中の数が、何かの2乗になっていないか考えよう！", math: `${root}^2 = ${sq}`});
                hints.push({text: "根号が外れるよ！", math: ansVariations[0]});
            } else {
                qLatex = `-\\sqrt{${sq}}`;
                ansVariations = [`-${root}`];
                hints.push({text: "根号の前のマイナスはそのまま残るよ！", math: `-\\sqrt{${sq}} = -(\\text{正の数})`});
                hints.push({text: "根号の中の数が、何かの2乗になっていないか考えよう！", math: `${root}^2 = ${sq}`});
                hints.push({text: "根号を外して答えよう！", math: ansVariations[0]});
            }
        }
    }
    
    return { qInstruction, qLatex, ansVariations, hints, type: 1 };
}

/**
 * レベル2：根号を含む数の2乗
 */
function generateLevel2() {
    let qInstruction = "次の数を求めなさい";
    let isFraction = Math.random() < 0.2;
    let sign = Math.random() < 0.5 ? 1 : -1;
    
    let qLatex = "";
    let ansVariations = [];
    let hints = [];
    
    if (isFraction) {
        let num = getRandomInt(2, 7);
        let den = getRandomInt(2, 7);
        if (num === den) den++;
        let signStr = sign < 0 ? "-" : "";
        qLatex = `(${signStr}\\sqrt{\\frac{${num}}{${den}}})^2`;
        ansVariations = [`\\frac{${num}}{${den}}`];
        
        hints.push({text: "2乗の計算を展開してみよう！", math: `(${signStr}\\sqrt{\\frac{${num}}{${den}}}) \\times (${signStr}\\sqrt{\\frac{${num}}{${den}}})`});
        if (sign < 0) {
            hints.push({text: "マイナス × マイナス はプラスになるよ！", math: `+ \\left( \\sqrt{\\frac{${num}}{${den}}} \\right)^2`});
        }
        hints.push({text: "ルートのついた数を2乗すると、ルートが外れる性質があるよ！", math: ansVariations[0]});
    } else {
        let val = getRandomInt(2, 19);
        let signStr = sign < 0 ? "-" : "";
        qLatex = `(${signStr}\\sqrt{${val}})^2`;
        ansVariations = [`${val}`];
        
        hints.push({text: "2乗の計算を展開してみよう！", math: `(${signStr}\\sqrt{${val}}) \\times (${signStr}\\sqrt{${val}})`});
        if (sign < 0) {
            hints.push({text: "マイナス × マイナス はプラスになるよ！", math: `+ (\\sqrt{${val}})^2`});
        }
        hints.push({text: "ルートのついた数を2乗すると、ルートが外れる性質があるよ！", math: ansVariations[0]});
    }
    
    return { qInstruction, qLatex, ansVariations, hints, type: 2 };
}

/**
 * レベル3：平方根の大小（解説用の数直線メタデータ付き）
 */
function generateLevel3() {
    let qInstruction = "次の各組の数の大小を、不等号（ < または > ）を使って表しなさい";
    let pattern = getRandomInt(1, 3); // 3つの数の比較（パターン4）は除外し、2数の比較に絞る
    
    let qLatex = "";
    let ansVariations = [];
    let hints = [];
    let numberLineData = null; // 数直線描画用データ
    
    if (pattern === 1) { // 2つの正の平方根
        let a = getRandomInt(5, 20);
        let b = getRandomInt(5, 20);
        while (a === b) b = getRandomInt(5, 20);
        
        qLatex = `\\sqrt{${a}} , \\quad \\sqrt{${b}}`;
        
        let minVal = 0;
        let maxVal = 5; // √25 = 5
        
        hints.push({text: "ルートの中の数字の大きさを比べよう！", math: `${a} と ${b}`});
        if (a < b) {
            ansVariations = ['<'];
            hints.push({text: "ルートの中が大きい方が、数自体も大きくなるよ！", math: `\\sqrt{${a}} < \\sqrt{${b}}`});
        } else {
            ansVariations = ['>'];
            hints.push({text: "ルートの中が大きい方が、数自体も大きくなるよ！", math: `\\sqrt{${a}} > \\sqrt{${b}}`});
        }
        hints.push({text: "答えの不等号を入力しよう！", math: ansVariations[0]});
        
        numberLineData = {
            min: minVal,
            max: maxVal,
            points: [
                { val: Math.sqrt(a), label: `\\sqrt{${a}}` },
                { val: Math.sqrt(b), label: `\\sqrt{${b}}` }
            ],
            type: 'positive'
        };
        
    } else if (pattern === 2) { // 整数と正の平方根
        let n = getRandomInt(2, 6);
        let sq = n * n;
        let offset = Math.random() < 0.5 ? getRandomInt(1, 3) : -getRandomInt(1, 3);
        let m = sq + offset;
        if (m < 2) m = 2; // ルートの中は正
        
        let isLeftInteger = Math.random() < 0.5;
        if (isLeftInteger) {
            qLatex = `${n} , \\quad \\sqrt{${m}}`;
        } else {
            qLatex = `\\sqrt{${m}} , \\quad ${n}`;
        }
        
        hints.push({text: "比べやすくするために、整数をルートの形になおそう！", math: `${n} = \\sqrt{${sq}}`});
        
        if (isLeftInteger) {
            // n と \sqrt{m} の比較 => \sqrt{sq} と \sqrt{m} の比較
            if (sq < m) {
                ansVariations = ['<'];
                hints.push({text: "ルートの中の数字を比べて不等号の向きを決めよう！", math: `\\sqrt{${sq}} < \\sqrt{${m}}`});
            } else {
                ansVariations = ['>'];
                hints.push({text: "ルートの中の数字を比べて不等号の向きを決めよう！", math: `\\sqrt{${sq}} > \\sqrt{${m}}`});
            }
        } else {
            // \sqrt{m} と n の比較 => \sqrt{m} と \sqrt{sq} の比較
            if (m < sq) {
                ansVariations = ['<'];
                hints.push({text: "ルートの中の数字を比べて不等号の向きを決めよう！", math: `\\sqrt{${m}} < \\sqrt{${sq}}`});
            } else {
                ansVariations = ['>'];
                hints.push({text: "ルートの中の数字を比べて不等号の向きを決めよう！", math: `\\sqrt{${m}} > \\sqrt{${sq}}`});
            }
        }
        hints.push({text: "答えの不等号を入力しよう！", math: ansVariations[0]});
        
        // 数直線の描画範囲
        let val1 = n;
        let val2 = Math.sqrt(m);
        let minVal = Math.floor(Math.min(val1, val2)) - 1;
        let maxVal = Math.ceil(Math.max(val1, val2)) + 1;
        
        numberLineData = {
            min: Math.max(0, minVal),
            max: maxVal,
            points: [
                { val: val1, label: `${n} (\\sqrt{${sq}})` },
                { val: val2, label: `\\sqrt{${m}}` }
            ],
            type: 'positive'
        };
        
    } else { // 2つの負の平方根
        let a = getRandomInt(2, 15);
        let b = getRandomInt(2, 15);
        while (a === b) b = getRandomInt(2, 15);
        qLatex = `-\\sqrt{${a}} , \\quad -\\sqrt{${b}}`;
        
        hints.push({text: "まずはマイナスを取った正の数で大きさを比べよう！", math: a < b ? `\\sqrt{${a}} < \\sqrt{${b}}` : `\\sqrt{${b}} < \\sqrt{${a}}`});
        hints.push({text: "負の数（マイナス）は、絶対値が大きいほど小さくなるよ！", math: "数直線で考えると、0から遠い（左にある）方が小さいね"});
        
        // -\sqrt{a} と -\sqrt{b} の比較
        // a < b なら \sqrt{a} < \sqrt{b} => -\sqrt{a} > -\sqrt{b} なので答えは >
        // a > b なら \sqrt{a} > \sqrt{b} => -\sqrt{a} < -\sqrt{b} なので答えは <
        if (a < b) {
            ansVariations = ['>'];
            hints.push({text: "不等号の向きに注意して答えよう！", math: `-\\sqrt{${a}} > -\\sqrt{${b}}`});
        } else {
            ansVariations = ['<'];
            hints.push({text: "不等号の向きに注意して答えよう！", math: `-\\sqrt{${a}} < -\\sqrt{${b}}`});
        }
        hints.push({text: "答えの不等号を入力しよう！", math: ansVariations[0]});
        
        // マイナス側の数直線
        let minVal = -5; // -√25 = -5
        let maxVal = 0;
        
        numberLineData = {
            min: minVal,
            max: maxVal,
            points: [
                { val: -Math.sqrt(a), label: `-\\sqrt{${a}}` },
                { val: -Math.sqrt(b), label: `-\\sqrt{${b}}` }
            ],
            type: 'negative'
        };
    }
    
    return { qInstruction, qLatex, ansVariations, hints, numberLineData, type: 3 };
}
