# PostureGuard 🧘

Webカメラを使用してリアルタイムで姿勢を監視し、猫背（Cat-back）を検知して通知するアプリケーションです。
採用ポートフォリオとして、コード品質とDocker環境での再現性を重視して設計されています。

## 🚀 特徴

- **ブラウザ完結 (WebRTC)**: Dockerコンテナの設定に関わらず、ブラウザ経由でカメラにアクセス可能。
- **リアルタイム姿勢推定**: MediaPipe Poseを使用し、耳と肩のベクトルから姿勢の傾きを算出。
- **キャリブレーション機能**: ユーザーごとの「良い姿勢」を基準に判定。
- **Antigravity UI**: Pythonの`antigravity`（Streamlit alias）を使用したモダンなWebインターフェース。

## 🛠 技術スタック

- **言語**: Python 3.10
- **GUI**: Streamlit (as `antigravity`)
- **WebRTC**: streamlit-webrtc (Client-side Camera)
- **画像処理**: OpenCV, MediaPipe
- **環境**: Docker, Docker Compose

## 📦 起動方法

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd cat-back-recognition
```

### 2. コンテナのビルドと起動
以下のコマンドを実行してアプリケーションを起動します。

```bash
docker-compose up --build
```

### 3. アプリへのアクセス
ブラウザで以下のURLを開いてください。
http://localhost:8501

## 📖 使い方

1. ブラウザが **カメラの使用許可** を求めてくるので「許可」してください。
2. **Start** ボタンをクリックします。
3. **最初の3秒間**はキャリブレーション（基準設定）フェーズです。背筋を伸ばして良い姿勢を保ってください。
4. 3秒経過後、監視が始まります。
5. 姿勢が悪くなる（基準値から閾値以上ズレる）と、映像上に **"BAD POSTURE!"** と表示されます。

## ⚙️ 設定

サイドバーから以下のパラメータを調整可能です：
- **Threshold**: 判定の厳しさ（許容角度）。デフォルトは15度。
- **Smoothing Window**: ノイズ除去の強度。

## 📂 ディレクトリ構成

```
.
├── Dockerfile
├── docker-compose.yml
├── README.md
├── requirements.txt
└── src
    ├── main.py          # アプリケーションエントリーポイント (WebRTC対応)
    └── pose_detector.py # 姿勢推定ロジッククラス
```
