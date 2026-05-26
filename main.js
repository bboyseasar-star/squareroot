/**
 * 鬼リピ 〜平方根〜
 * アプリケーション制御ロジック (main.js)
 */

// --- 状態管理 ---
let currentLevel = 1;
let currentQuestionIndex = 0;
let questions = [];
let score = 0;
let combo = 0;
let mistakes = [];
let hintStep = 0;
let retryMode = false;

// 演出用の褒め言葉
const praiseWords = ["天才！✨", "いいね！👍", "素晴らしい！🎉", "その調子！🔥", "完璧！🌟"];

// メモリ履歴フォールバック用（localStorageがブロックされている環境用）
let memoryHistory = [];

// --- 音声効果 (Web Audio API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function playSound(type) {
    try {
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); 
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(250, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.25);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.25);
        } else if (type === 'clear') {
            // ファンファーレ（和音のアルペジオ）
            const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
            freqs.forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'sine';
                o.frequency.value = freq;
                o.connect(g);
                g.connect(audioCtx.destination);
                
                g.gain.setValueAtTime(0, audioCtx.currentTime + i * 0.12);
                g.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + i * 0.12 + 0.04);
                g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.12 + 0.5);
                
                o.start(audioCtx.currentTime + i * 0.12);
                o.stop(audioCtx.currentTime + i * 0.12 + 0.5);
            });
        }
    } catch (e) {
        console.warn("Web Audio API is not supported or blocked:", e);
    }
}

// --- MathJax 安全タイプセットラッパー ---
function safeTypeset(element) {
    const doTypeset = () => {
        try {
            if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
                // elementが指定されていればその要素、なければページ全体を安全にスキャン
                const target = element ? [element] : undefined;
                MathJax.typesetPromise(target).catch(err => console.error("MathJax typeset error:", err));
            }
        } catch (e) {
            console.error("MathJax invocation error:", e);
        }
    };

    if (window.MathJax && typeof MathJax.typesetPromise === 'function') {
        doTypeset();
    } else {
        // ロード完了を少し待って再試行
        setTimeout(doTypeset, 150);
    }
}

// --- 画面切り替え ---
function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
        // 画面切り替え時にアニメーションを適用
        target.classList.remove('animate-fade-in');
        void target.offsetWidth; // リフロー強制
        target.classList.add('animate-fade-in');
    }
}

function goHome() {
    updateBadges();
    loadHistory();
    switchScreen('start-screen');
}

// --- MathLive コマンド挿入の堅牢ラッパー ---
function insertCommand(cmd) {
    const mf = document.getElementById('answer-input');
    if (!mf) return;
    
    // 入力の型に応じて試行
    try {
        if (typeof mf.insert === 'function') {
            mf.insert(cmd);
        } else if (typeof mf.executeCommand === 'function') {
            mf.executeCommand(['insert', cmd]);
        } else {
            mf.value += cmd;
        }
    } catch (e) {
        console.error("Failed to insert command:", e);
    }
    mf.focus();
}

// --- LaTeX 正規化 & 正誤判定 ---
function normalizeLatex(latex) {
    if (!latex) return '';
    let s = latex;
    
    // 1. スペースと改行をすべて削除
    s = s.replace(/\s+/g, '');
    
    // 2. MathLive特有の余計なコマンド（サイズ調整や微調整コマンド）を削除
    s = s.replace(/\\left|\\right|\\mleft|\\mright/g, '');
    s = s.replace(/\\,/g, '');
    s = s.replace(/\\cdot/g, '');
    s = s.replace(/\\operatorname\{([^}]*)\}/g, '$1');
    
    // 3. プラスマイナスの表記を ± に統一
    s = s.replace(/\\pm/g, '±');
    
    // 4. 不等号の正規化
    s = s.replace(/\\lt/g, '<');
    s = s.replace(/\\gt/g, '>');
    s = s.replace(/\\le/g, '≤');
    s = s.replace(/\\ge/g, '≥');
    
    // 5. 分数やルートの中の不要なブレースを展開して統一
    //    \frac{a}{b} と \frac a b などの差異をなくす
    s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '\\frac<<$1>><<$2>>');
    s = s.replace(/\\frac\{([^}]+)\}([0-9a-zA-Z])/g, '\\frac<<$1>><<$2>>');
    s = s.replace(/\\frac([0-9a-zA-Z])\{([^}]+)\}/g, '\\frac<<$1>><<$2>>');
    s = s.replace(/\\frac([0-9a-zA-Z])([0-9a-zA-Z])/g, '\\frac<<$1>><<$2>>');
    s = s.replace(/\\sqrt\{([^}]+)\}/g, '\\sqrt<<$1>>');
    s = s.replace(/\\sqrt([0-9]+)/g, '\\sqrt<<$1>>');
    
    // 退避した << >> を {} に書き戻す
    s = s.replace(/<</g, '{').replace(/>>/g, '}');
    
    // 負の分数の表記揺れ対応: -\frac{a}{b} と \frac{-a}{b} を同等にする
    s = s.replace(/-\\frac\{([^}]+)\}\{([^}]+)\}/g, '\\frac{-$1}{$2}');
    
    return s;
}

function isCorrect(userLatex, ansVariations) {
    const userNorm = normalizeLatex(userLatex);
    
    // デバッグログ
    console.log('=== 正誤判定 ===');
    console.log('ユーザー入力(生):', userLatex);
    console.log('ユーザー入力(正規化):', userNorm);
    
    return ansVariations.some((ans, index) => {
        const ansNorm = normalizeLatex(ans);
        console.log(`正解候補[${index}](生):`, ans);
        console.log(`正解候補[${index}](正規化):`, ansNorm);
        const match = userNorm === ansNorm;
        console.log('一致判定:', match);
        return match;
    });
}

// --- ドリル進行ロジック ---
function startDrill(level) {
    currentLevel = level;
    retryMode = false;
    questions = [];
    const generatedLatex = new Set();
    
    while (questions.length < 10) {
        let q;
        if (level === 1) q = generateLevel1();
        else if (level === 2) q = generateLevel2();
        else q = generateLevel3();
        
        // 重複問題を排除
        if (!generatedLatex.has(q.qLatex)) {
            generatedLatex.add(q.qLatex);
            questions.push(q);
        }
    }
    resetAndStart();
}

function retryMistakes() {
    if (mistakes.length === 0) return;
    questions = mistakes.map(m => m.originalQ);
    retryMode = true;
    resetAndStart();
}

function resetAndStart() {
    score = 0;
    combo = 0;
    mistakes = [];
    currentQuestionIndex = 0;
    
    document.getElementById('score').innerText = score;
    document.getElementById('combo-display').classList.remove('active');
    
    // 不等号ボタンはレベル3または復習モードに不等号問題がある場合のみ表示
    const hasInequality = (currentLevel === 3) || (retryMode && questions.some(q => q.type === 3));
    if (hasInequality) {
        document.getElementById('btn-less').style.display = 'inline-flex';
        document.getElementById('btn-greater').style.display = 'inline-flex';
    } else {
        document.getElementById('btn-less').style.display = 'none';
        document.getElementById('btn-greater').style.display = 'none';
    }
    
    switchScreen('drill-screen');
    showQuestion();
}

function showQuestion() {
    const q = questions[currentQuestionIndex];
    document.getElementById('q-num').innerText = currentQuestionIndex + 1;
    document.getElementById('progress-bar').style.width = `${(currentQuestionIndex / questions.length) * 100}%`;
    
    document.getElementById('question-instruction').innerText = q.qInstruction;
    
    const qDisplay = document.getElementById('question-display');
    qDisplay.innerHTML = `$$ ${q.qLatex} $$`;
    
    // 数式の再レンダリングとフォーカス
    safeTypeset(qDisplay);
    setTimeout(() => {
        const mf = document.getElementById('answer-input');
        if (mf) mf.focus();
    }, 150);
    
    // ヒント状態のリセット
    hintStep = 0;
    const hintContainer = document.getElementById('hint-container');
    hintContainer.innerHTML = '';
    hintContainer.style.display = 'none';
    
    // 「答えを見たため不正解」の警告メッセージ削除
    const existingMsg = document.getElementById('donmai-msg');
    if (existingMsg) existingMsg.remove();
    
    // UIを初期状態に復元
    document.getElementById('hint-btn').style.display = 'inline-flex';
    document.getElementById('input-area').style.display = 'flex';
    document.getElementById('math-field-wrapper').style.display = 'flex';
    document.getElementById('controls').style.display = 'flex';
    document.getElementById('next-btn').style.display = 'none';
    document.getElementById('feedback-overlay').style.display = 'none';
    
    // 入力欄をクリア
    const mf = document.getElementById('answer-input');
    if (mf) mf.value = '';
}

// --- 段階的ヒントシステム & 数直線描画 ---
function showHint() {
    const q = questions[currentQuestionIndex];
    const hintContainer = document.getElementById('hint-container');
    
    if (hintStep < q.hints.length) {
        const hintObj = q.hints[hintStep];
        const currentNum = hintStep + 1;
        hintStep++;
        
        const isLastHint = (hintStep === q.hints.length);
        const isSecondToLast = (hintStep === q.hints.length - 1);
        
        // ヒント領域を表示
        hintContainer.style.display = 'block';
        
        // ヒント用 HTML 生成
        const stepDiv = document.createElement('div');
        stepDiv.className = "hint-step animate-fade-in";
        stepDiv.id = `hint-step-${currentNum}`;
        
        // 最後のヒントの前に警告を出す
        let alertHTML = "";
        if (isSecondToLast) {
            alertHTML = `<div style="color:var(--secondary); font-weight:900; font-size:0.85rem; margin-top:5px;"><i class="fas fa-exclamation-triangle"></i> 注意：次のヒントは「答え」そのものだよ！</div>`;
        }
        
        stepDiv.innerHTML = `
            <p class="hint-text"><i class="fas fa-magic"></i> ヒント${currentNum}: ${hintObj.text}</p>
            <div class="hint-math">$$${hintObj.math}$$</div>
            ${alertHTML}
        `;
        
        hintContainer.appendChild(stepDiv);
        
        // レベル3で数直線データがある場合は、最初のヒント表示時に数直線を描画
        if (q.type === 3 && q.numberLineData && currentNum === 1) {
            const lineDiv = document.createElement('div');
            lineDiv.className = "number-line-container animate-fade-in";
            lineDiv.innerHTML = `
                <div style="position: relative; width:100%; max-width:700px;">
                    <canvas id="number-line-canvas" class="number-line-canvas"></canvas>
                    <div id="number-line-labels" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
                </div>
            `;
            hintContainer.appendChild(lineDiv);
            
            // 少しラグを置いてCanvasが描画可能になってから描画
            setTimeout(() => {
                drawNumberLine('number-line-canvas', 'number-line-labels', q.numberLineData);
            }, 50);
        }
        
        // スムーズスクロール
        safeTypeset(stepDiv);
        setTimeout(() => {
            hintContainer.scrollTo({
                top: stepDiv.offsetTop - 15,
                behavior: 'smooth'
            });
        }, 100);
        
        // 最後のヒント（答え）を表示した場合は、ギブアップ扱いとして入力を無効化
        if (isLastHint) {
            document.getElementById('hint-btn').style.display = 'none';
            document.getElementById('math-field-wrapper').style.display = 'none';
            document.getElementById('controls').style.display = 'none';
            
            playSound('wrong');
            combo = 0;
            mistakes.push({
                originalQ: q,
                qLatex: q.qLatex,
                ansLatex: q.ansVariations[0],
                userLatex: "ギブアップ（答えを見た）"
            });
            
            document.getElementById('next-btn').style.display = 'inline-flex';
            
            const msgEl = document.createElement('div');
            msgEl.id = 'donmai-msg';
            msgEl.innerText = "答えまで見たので不正解になります！ドンマイ！";
            msgEl.style.color = "var(--secondary)";
            msgEl.style.fontWeight = "900";
            msgEl.style.marginTop = "15px";
            msgEl.style.fontSize = "1.2rem";
            msgEl.className = "animate-pop";
            document.getElementById('input-area').appendChild(msgEl);
        }
    }
}

// --- Canvas と HTML ハイブリッドによる「動く数直線」描画 ---
function drawNumberLine(canvasId, labelContainerId, data) {
    const canvas = document.getElementById(canvasId);
    const container = document.getElementById(labelContainerId);
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // 解像度合わせ
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    
    // 描画設定
    ctx.clearRect(0, 0, width, height);
    
    const padding = 45; // 左右の余白
    const yLine = height - 25; // 軸のY座標
    const min = data.min;
    const max = data.max;
    
    // 座標変換関数
    function getX(val) {
        return padding + ((val - min) / (max - min)) * (width - 2 * padding);
    }
    
    // 1. メインの軸線を描く
    ctx.beginPath();
    ctx.moveTo(padding - 15, yLine);
    ctx.lineTo(width - padding + 15, yLine);
    ctx.strokeStyle = '#7F8C8D';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 矢印の先端を描く（右側が正の場合）
    ctx.beginPath();
    if (data.type === 'positive') {
        ctx.moveTo(width - padding + 8, yLine - 6);
        ctx.lineTo(width - padding + 18, yLine);
        ctx.lineTo(width - padding + 8, yLine + 6);
    } else {
        // 左側がマイナスの極限
        ctx.moveTo(padding - 8, yLine - 6);
        ctx.lineTo(padding - 18, yLine);
        ctx.lineTo(padding - 8, yLine + 6);
    }
    ctx.fillStyle = '#7F8C8D';
    ctx.fill();
    
    // 2. 整数の目盛りを描画
    ctx.fillStyle = '#7F8C8D';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    
    const step = 1;
    for (let v = Math.ceil(min); v <= Math.floor(max); v += step) {
        const x = getX(v);
        
        // 目盛り線
        ctx.beginPath();
        ctx.moveTo(x, yLine - 5);
        ctx.lineTo(x, yLine + 5);
        ctx.strokeStyle = '#7F8C8D';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 目盛り数字
        ctx.fillText(v.toString(), x, yLine + 20);
    }
    
    // 3. 各値を表す「ピン」と「HTML数式ラベル」の描画
    container.innerHTML = ''; // ラベルコンテナをクリア
    
    // ピンの重なりを避けるためのY軸オフセット調整用
    // Xが近い点同士は高さを変える
    const sortedPoints = [...data.points].sort((a, b) => a.val - b.val);
    const pinHeights = new Array(sortedPoints.length).fill(0);
    
    for (let i = 0; i < sortedPoints.length; i++) {
        let heightLevel = 0;
        // 過去のピンと比較して、距離が近ければ上にずらす
        for (let j = 0; j < i; j++) {
            const dist = Math.abs(getX(sortedPoints[i].val) - getX(sortedPoints[j].val));
            if (dist < 65 && pinHeights[j] === heightLevel) {
                heightLevel++;
                // ずらした先でもまた比較するためループを戻す
                j = -1;
            }
        }
        pinHeights[i] = heightLevel;
    }
    
    sortedPoints.forEach((pt, index) => {
        const x = getX(pt.val);
        const heightOffset = pinHeights[index] * 28; // ピンの高さのズレ
        const yPinTop = yLine - 22 - heightOffset;
        
        // 3.1 Canvasにピンの柱を描画
        ctx.beginPath();
        ctx.moveTo(x, yLine);
        ctx.lineTo(x, yPinTop + 5);
        ctx.strokeStyle = 'var(--secondary)';
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 2]); // 点線にする
        ctx.stroke();
        ctx.setLineDash([]); // 点線リセット
        
        // Canvasにピンの頭（小さな赤丸）を描画
        ctx.beginPath();
        ctx.arc(x, yLine, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'var(--secondary)';
        ctx.fill();
        
        // 3.2 HTMLの絶対配置ラベルを作成（MathJaxでレンダリングするため）
        const labelDiv = document.createElement('div');
        labelDiv.style.position = 'absolute';
        labelDiv.style.left = `${(x / width) * 100}%`;
        labelDiv.style.top = `${((yPinTop - 12) / height) * 100}%`;
        labelDiv.style.transform = 'translate(-50%, -50%)';
        labelDiv.style.background = 'var(--secondary)';
        labelDiv.style.color = 'var(--white)';
        labelDiv.style.padding = '3px 8px';
        labelDiv.style.borderRadius = '6px';
        labelDiv.style.fontSize = '0.85rem';
        labelDiv.style.fontWeight = 'bold';
        labelDiv.style.boxShadow = '0 3px 6px rgba(0,0,0,0.15)';
        labelDiv.style.whiteSpace = 'nowrap';
        labelDiv.style.zIndex = 10 + pinHeights[index];
        labelDiv.innerHTML = '\\(' + pt.label + '\\)';
        
        // 小さな下矢印（吹き出し風）をCSS擬似要素の代わりに追加
        const arrow = document.createElement('div');
        arrow.style.position = 'absolute';
        arrow.style.bottom = '-6px';
        arrow.style.left = '50%';
        arrow.style.transform = 'translateX(-50%)';
        arrow.style.width = '0';
        arrow.style.height = '0';
        arrow.style.borderLeft = '6px solid transparent';
        arrow.style.borderRight = '6px solid transparent';
        arrow.style.borderTop = '6px solid var(--secondary)';
        labelDiv.appendChild(arrow);
        
        container.appendChild(labelDiv);
    });
    
    // 生成した数式ラベルをMathJaxで綺麗にする
    safeTypeset(container);
}

// --- 回答チェック ---
function checkAnswerBtn() {
    const mf = document.getElementById('answer-input');
    if (!mf) return;
    
    const q = questions[currentQuestionIndex];
    const userLatex = mf.value;
    if (!userLatex || userLatex.trim() === '') return;
    
    const correct = isCorrect(userLatex, q.ansVariations);
    
    if (correct) {
        playSound('correct');
        score++;
        combo++;
        document.getElementById('score').innerText = score;
        
        const praise = praiseWords[Math.floor(Math.random() * praiseWords.length)];
        showFeedbackOverlay(true, praise, "");
        
        // 合格用紙吹雪のカラーテーマをランダム化
        const confettiThemes = [
            ['#4facfe', '#00f2fe', '#f093fb', '#f5576c'], // カラフルパステル
            ['#FFE082', '#FFD54F', '#FFCA28', '#FFB300'], // ゴールドラッシュ
            ['#81C784', '#66BB6A', '#4CAF50', '#81D4FA'], // フォレスト＆スカイ
            ['#FF8A80', '#FF5252', '#FF1744', '#EA80FC']  // ネオンピンク＆レッド
        ];
        const selectedTheme = confettiThemes[Math.floor(Math.random() * confettiThemes.length)];
        
        confetti({
            particleCount: 100,
            spread: 75,
            origin: { y: 0.62 },
            colors: selectedTheme
        });
        
        if (combo > 1) {
            const cText = document.getElementById('combo-display');
            cText.innerText = `${combo} COMBO! 🔥`;
            cText.classList.remove('active');
            void cText.offsetWidth; // リフロー強制
            cText.classList.add('active');
        }
    } else {
        playSound('wrong');
        combo = 0;
        mistakes.push({
            originalQ: q,
            qLatex: q.qLatex,
            ansLatex: q.ansVariations[0],
            userLatex: userLatex
        });
        
        const correctMath = q.type === 3 
            ? q.qLatex.replace(',\\quad', ' ' + q.ansVariations[0] + ' ')
            : q.ansVariations[0];
        showFeedbackOverlay(false, "惜しい！復習しよう！", `正しい答え: $$ ${correctMath} $$`);
    }
}

function showFeedbackOverlay(isCorrect, msg, mathMsg) {
    document.getElementById('input-area').style.display = 'none';
    const overlay = document.getElementById('feedback-overlay');
    const icon = document.getElementById('feedback-icon');
    const msgEl = document.getElementById('feedback-msg');
    const mathEl = document.getElementById('feedback-math');
    
    overlay.style.display = 'flex';
    icon.className = 'feedback-text animate-pop ' + (isCorrect ? 'feedback-correct' : 'feedback-wrong');
    icon.innerHTML = isCorrect ? '⭕️' : '❌';
    msgEl.innerText = msg;
    msgEl.style.color = isCorrect ? 'var(--success)' : 'var(--secondary)';
    mathEl.innerHTML = mathMsg;
    
    safeTypeset(mathEl);
}

function nextQuestion() {
    // ギブアップ警告メッセージがある場合は消去
    const pop = document.getElementById('donmai-msg');
    if (pop) pop.remove();
    
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        showResult();
    }
}

// --- 結果画面の表示 & 履歴保存 ---
function showResult() {
    switchScreen('result-screen');
    document.getElementById('final-score').innerText = `${score} / ${questions.length}`;
    
    const ratio = score / questions.length;
    const msgEl = document.getElementById('result-msg');
    const isPassed = ratio >= 0.8;
    
    if (isPassed) {
        msgEl.innerText = "合格！君はルートマスターだ！🎉";
        msgEl.style.color = "var(--success)";
        playSound('clear');
        
        // ダイナミックな合格用紙吹雪（両端発射）
        const duration = 1.5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
        
        function randomInRange(min, max) { return Math.random() * (max - min) + min; }
        
        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
        
        // 履歴に合格記録を保存
        if (!retryMode) {
            saveHistory(currentLevel, score, questions.length, true);
        }
    } else {
        msgEl.innerText = "あともう少し！間違えた問題を復習しよう💪";
        msgEl.style.color = "var(--text)";
        
        // 履歴にがんばろう記録を保存
        if (!retryMode) {
            saveHistory(currentLevel, score, questions.length, false);
        }
    }
    
    // 誤答リストの生成
    const ml = document.getElementById('mistakes-list');
    if (mistakes.length === 0) {
        ml.innerHTML = '<div style="text-align:center; padding: 40px; font-weight:900; font-size:1.8rem; color:var(--success); font-family:\'M PLUS Rounded 1c\'">🌟 全問正解！カンペキ！ 🌟</div>';
        document.getElementById('retry-mistakes-btn').style.display = 'none';
    } else {
        document.getElementById('retry-mistakes-btn').style.display = 'inline-block';
        let html = '';
        mistakes.forEach(m => {
            const userDisp = m.userLatex === "ギブアップ（答えを見た）" 
                ? `<span style="font-size:1rem; font-weight:normal; color:var(--gray);">${m.userLatex}</span>` 
                : `\\( ${m.userLatex} \\)`;
                
            const ansDisp = m.originalQ.type === 3
                ? m.originalQ.qLatex.replace(',\\quad', ' ' + m.ansLatex + ' ')
                : m.ansLatex;
                
            html += `
                <div class="mistake-item">
                    <div class="mistake-q">\\( ${m.qLatex} \\)</div>
                    <div class="mistake-u"><span style="font-size:0.8rem;color:var(--gray);font-weight:normal;">あなたの解答:</span><br> ${userDisp}</div>
                    <div class="mistake-a"><span style="font-size:0.8rem;color:var(--gray);font-weight:normal;">正しい答え:</span><br> \\( ${ansDisp} \\)</div>
                </div>
            `;
        });
        ml.innerHTML = html;
        safeTypeset(ml);
    }
}

// --- localStorage による学習履歴ダッシュボード ---
function getHistoryKey() {
    return 'oniripi-squareroot-history';
}

function loadHistory() {
    const listEl = document.getElementById('history-list');
    if (!listEl) return;
    
    let history = [];
    try {
        const stored = localStorage.getItem(getHistoryKey());
        if (stored) {
            history = JSON.parse(stored);
        }
    } catch (e) {
        console.warn("Unable to access localStorage, falling back to memory:", e);
        history = memoryHistory;
    }
    
    if (history.length === 0) {
        listEl.innerHTML = '<div class="history-empty"><i class="fas fa-history" style="font-size:1.5rem;margin-bottom:5px;"></i><br>まだ履歴がないよ。<br>ドリルに挑戦してみよう！</div>';
        return;
    }
    
    let html = '';
    history.forEach(item => {
        const statusIcon = item.isPassed ? '💮' : '❌';
        html += `
            <div class="history-item">
                <div class="history-item-info">
                    <div class="history-level">レベル${item.level}：${getLevelName(item.level)}</div>
                    <div class="history-date">${item.date}</div>
                </div>
                <div class="history-score-badge">
                    <span class="history-score">${item.score} / ${item.total}</span>
                    <span class="history-status">${statusIcon}</span>
                </div>
            </div>
        `;
    });
    listEl.innerHTML = html;
}

function getLevelName(level) {
    if (level === 1) return "基本";
    if (level === 2) return "2乗の計算";
    return "大小関係";
}

function saveHistory(level, score, total, isPassed) {
    const now = new Date();
    const dateString = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    
    const record = {
        date: dateString,
        level: level,
        score: score,
        total: total,
        isPassed: isPassed
    };
    
    let history = [];
    try {
        const stored = localStorage.getItem(getHistoryKey());
        if (stored) {
            history = JSON.parse(stored);
        }
        history.unshift(record); // 先頭に追加
        if (history.length > 20) history.pop(); // 最大20件に制限
        localStorage.setItem(getHistoryKey(), JSON.stringify(history));
    } catch (e) {
        console.warn("Unable to write to localStorage:", e);
        memoryHistory.unshift(record);
        if (memoryHistory.length > 20) memoryHistory.pop();
        history = memoryHistory;
    }
    
    // クリアルール：直近で合格があればレベルごとに合格フラグを保存
    if (isPassed) {
        try {
            localStorage.setItem(`math-drill-squareroot-L${level}`, "cleared");
        } catch (e) {
            console.warn(e);
        }
    }
}

function resetHistory() {
    if (confirm("これまでの学習履歴とクリア記録をすべて消去します。本当によろしいですか？")) {
        try {
            localStorage.removeItem(getHistoryKey());
            for (let i = 1; i <= 3; i++) {
                localStorage.removeItem(`math-drill-squareroot-L${i}`);
            }
        } catch (e) {
            console.warn(e);
        }
        memoryHistory = [];
        loadHistory();
        updateBadges();
    }
}

function updateBadges() {
    for (let i = 1; i <= 3; i++) {
        const card = document.getElementById(`card-level${i}`);
        if (!card) continue;
        
        let cleared = false;
        try {
            cleared = localStorage.getItem(`math-drill-squareroot-L${i}`) === "cleared";
        } catch (e) {
            // メモリ履歴から合格実績を探す
            cleared = memoryHistory.some(h => h.level === i && h.isPassed);
        }
        
        if (cleared) {
            card.classList.add('cleared');
        } else {
            card.classList.remove('cleared');
        }
    }
}

// --- IME（日本語入力）全角→半角強制ロジック ---
function forceHalfWidthInput(mathFieldId) {
    const mf = document.getElementById(mathFieldId);
    if (!mf) return;
    
    mf.setAttribute('inputmode', 'latin');
    
    // 日本語のIME入力確定（compositionend）時に全角英数記号を半角に変換
    mf.addEventListener('compositionend', (ev) => {
        const data = ev.data;
        if (data) {
            const converted = data
                .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                .replace(/[ａ-ｚ]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                .replace(/[Ａ-Ｚ]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
                .replace(/[＋]/g, '+')
                .replace(/[－ー−]/g, '-')
                .replace(/[×]/g, '\\times ')
                .replace(/[÷]/g, '\\div ')
                .replace(/[＝]/g, '=')
                .replace(/[（]/g, '(')
                .replace(/[）]/g, ')')
                .replace(/[＜]/g, '<')
                .replace(/[＞]/g, '>');
            
            mf.value = ''; // 一旦クリアして半角化したものを挿入
            
            try {
                if (typeof mf.insert === 'function') {
                    mf.insert(converted);
                } else {
                    mf.value = converted;
                }
            } catch (e) {
                console.error(e);
            }
        }
    });
    
    // フォーカス取得時にも強制的に latin をセットし、IMEによる入力を抑止する
    mf.addEventListener('focus', () => {
        mf.setAttribute('inputmode', 'latin');
        
        // MathLiveのShadow DOM内部のtextareaにも強制適用
        const shadow = mf.shadowRoot;
        if (shadow) {
            const textarea = shadow.querySelector('textarea');
            if (textarea) {
                textarea.setAttribute('inputmode', 'latin');
                textarea.setAttribute('autocorrect', 'off');
                textarea.setAttribute('lang', 'en');
            }
        }
    });
}

// --- 初期化 ---
window.onload = () => {
    // 履歴・バッジの読み込み
    loadHistory();
    updateBadges();
    
    const mf = document.getElementById('answer-input');
    if (mf) {
        // エンターキーで回答チェック
        mf.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                checkAnswerBtn();
            }
        });
        
        // IME半角強制化
        forceHalfWidthInput('answer-input');
    }
    
    // ロード直後に画面全体の未変換TeX数式を一網打尽にスキャンして美しく変換
    safeTypeset(document.body);
};
