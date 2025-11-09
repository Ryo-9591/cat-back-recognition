/**
 * 猫背検知アプリのフロントエンド
 * Webカメラから画像を取得し、バックエンドAPIに送信して姿勢を分析する（リアルタイム）
 * または画像ファイルをアップロードして分析する
 */

const API_URL = 'http://localhost:5000';

// DOM要素の取得
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startBtn');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const resultDiv = document.getElementById('result');

let stream = null;
let analysisInterval = null;
let isAnalyzing = false; // 分析中の重複実行を防ぐ

/**
 * カメラを開始する
 */
async function startCamera() {
    try {
        startBtn.disabled = true;
        resultDiv.innerHTML = '<p class="result-placeholder">カメラへのアクセスを要求しています...</p>';
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            }
        });
        
        video.srcObject = stream;
        
        // ビデオが再生可能になったらリアルタイム検出を開始
        const startAnalysis = () => {
            if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
                console.log('カメラが開始されました');
                resultDiv.innerHTML = '<p class="result-placeholder">姿勢検出を開始しています...</p>';
                startRealtimeAnalysis();
            }
        };
        
        // 複数のイベントで検出を開始（フォールバック）
        video.addEventListener('loadedmetadata', startAnalysis, { once: true });
        video.addEventListener('canplay', startAnalysis, { once: true });
        video.addEventListener('playing', startAnalysis, { once: true });
        
        // タイムアウト処理（3秒後に再試行）
        setTimeout(() => {
            if (!analysisInterval && video.readyState >= 2) {
                startAnalysis();
            }
        }, 3000);
        
    } catch (error) {
        console.error('カメラの取得に失敗しました:', error);
        startBtn.disabled = false;
    }
}

/**
 * リアルタイム姿勢検出を開始
 */
function startRealtimeAnalysis() {
    // 既存のインターバルをクリア
    if (analysisInterval) {
        clearInterval(analysisInterval);
    }
    
    // 初回はすぐに実行
    analyzePosture();
    
    // その後、1秒ごとに実行
    analysisInterval = setInterval(() => {
        if (!isAnalyzing && stream) {
            analyzePosture();
        }
    }, 1000);
}

/**
 * ビデオフレームをキャンバスに描画して画像データを取得
 */
function captureFrame() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * 画像ファイルをbase64に変換
 */
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * 姿勢分析APIを呼び出す
 */
async function analyzePosture(imageData = null) {
    if (isAnalyzing) {
        return;
    }
    
    isAnalyzing = true;
    
    try {
        // 画像データが提供されていない場合、カメラからキャプチャ
        if (!imageData) {
            if (!stream || !video.videoWidth || !video.videoHeight) {
                return;
            }
            imageData = captureFrame();
        }
        
        // ローディング表示
        resultDiv.innerHTML = `
            <div class="loading active">
                <div class="spinner"></div>
                <p>姿勢を分析中...</p>
            </div>
        `;
        
        // APIに送信
        const response = await fetch(`${API_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageData
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayResult(data);
        
    } catch (error) {
        console.error('姿勢分析エラー:', error);
        resultDiv.innerHTML = `
            <div class="result-content active">
                <p class="message" style="color: #f44336;">エラーが発生しました</p>
                <p class="details">${error.message}</p>
            </div>
        `;
    } finally {
        isAnalyzing = false;
    }
}

/**
 * 結果を表示する
 */
function displayResult(data) {
    if (!data.detected) {
        resultDiv.innerHTML = `
            <div class="result-content active">
                <p class="message" style="color: #FF9800;">${data.message || '姿勢が検出できませんでした'}</p>
                <p class="details">全身が映る画像をアップロードしてください</p>
            </div>
        `;
        return;
    }
    
    const score = data.score || 0;
    const isSlouched = data.is_slouched;
    const message = data.message || '分析完了';
    
    // スコアに応じたクラスを決定
    let scoreClass = 'score-good';
    let messageClass = 'message-good';
    
    if (score < 40) {
        scoreClass = 'score-bad';
        messageClass = 'message-bad';
    } else if (score < 60) {
        scoreClass = 'score-warning';
        messageClass = 'message-bad';
    }
    
    resultDiv.innerHTML = `
        <div class="result-content active">
            <div class="score-display ${scoreClass}">${score}</div>
            <p class="message ${messageClass}">${message}</p>
            <p class="details">垂直距離: ${data.vertical_distance || 'N/A'}</p>
        </div>
    `;
}

/**
 * 画像アップロード処理
 */
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    // 画像ファイルかチェック
    if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください');
        return;
    }
    
    try {
        // 画像をbase64に変換
        const imageData = await fileToBase64(file);
        
        // 姿勢分析を実行
        await analyzePosture(imageData);
    } catch (error) {
        console.error('画像の読み込みエラー:', error);
        resultDiv.innerHTML = `
            <div class="result-content active">
                <p class="message" style="color: #f44336;">画像の読み込みに失敗しました</p>
                <p class="details">${error.message}</p>
            </div>
        `;
    }
}

/**
 * ヘルスチェック
 */
async function checkHealth() {
    try {
        const response = await fetch(`${API_URL}/health`);
        if (response.ok) {
            console.log('APIサーバーに接続できました');
        } else {
            console.warn('APIサーバーへの接続に問題があります');
            resultDiv.innerHTML = `
                <div class="result-content active">
                    <p class="message" style="color: #f44336;">APIサーバーに接続できません</p>
                    <p class="details">バックエンドサーバーが起動しているか確認してください</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('APIサーバーに接続できません:', error);
        resultDiv.innerHTML = `
            <div class="result-content active">
                <p class="message" style="color: #f44336;">APIサーバーに接続できません</p>
                <p class="details">${error.message}</p>
            </div>
        `;
    }
}

// イベントリスナーの設定
startBtn.addEventListener('click', startCamera);

uploadBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', handleImageUpload);

// ページ読み込み時にヘルスチェック
window.addEventListener('load', () => {
    checkHealth();
});

// ページを離れる際にカメラを停止
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
    if (analysisInterval) {
        clearInterval(analysisInterval);
    }
});
