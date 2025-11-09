# 猫背検知アプリ - Pose Magic

MoveNet Lightningを使用した猫背検知Webアプリケーションです。

## 機能

- Webカメラを使用したリアルタイム姿勢検出
- MoveNet Lightningによる高精度な姿勢分析
- 猫背度のスコアリング（0-100点）
- Dockerコンテナによる簡単なデプロイ

## 構成

- **フロントエンド**: Next.js + React + TypeScript + shadcn/ui（モダンなUI）
- **バックエンド**: FastAPI + MoveNet Lightning（姿勢分析API）
- **コンテナ**: Docker + Docker Compose

## セットアップ

### 1. Dockerを使用する場合（推奨）

```bash
# バックエンドとフロントエンドを起動
docker-compose up --build

# バックグラウンドで起動する場合
docker-compose up -d --build
```

起動後、ブラウザで以下のURLにアクセスしてください：
- **フロントエンド**: http://localhost:8080
- **バックエンドAPI**: http://localhost:5000
- **APIドキュメント**: http://localhost:5000/docs

### 2. ローカルで実行する場合

#### バックエンド

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 5000
```

#### フロントエンド

Docker Composeを使用する場合は、自動的にフロントエンドも起動します。

ローカルで実行する場合：

```bash
cd frontend
npm install
npm run dev
```

その後、ブラウザで `http://localhost:3000` にアクセスしてください。

**注意**: ローカルで実行する場合、バックエンドAPIが `http://localhost:5000` で起動している必要があります。

## 使用方法

1. ブラウザでフロントエンドを開く（Docker使用時: http://localhost:8080、ローカル実行時: http://localhost:3000）
2. 「カメラ開始」ボタンをクリックしてカメラへのアクセスを許可
3. カメラの前に立ち、全身が映るようにする
4. リアルタイムで姿勢が分析され、結果が表示されます（1秒ごとに自動更新）
5. または「画像をアップロード」ボタンから画像ファイルを選択して分析することもできます
6. 姿勢スコアと猫背判定結果が表示されます

## API エンドポイント

FastAPIの自動生成ドキュメントは `http://localhost:5000/docs` で確認できます。

### GET /health
ヘルスチェック

### POST /analyze
姿勢分析

**リクエストボディ:**
```json
{
  "image": "data:image/jpeg;base64,..."
}
```

**レスポンス:**
```json
{
  "detected": true,
  "score": 75.5,
  "is_slouched": false,
  "vertical_distance": 0.1234,
  "message": "良い姿勢です"
}
```

## 注意事項

- カメラへのアクセスにはHTTPS環境が推奨されます（localhostは除く）
- 姿勢検出には全身が映る必要があります
- 照明が十分な環境で使用してください

## ライセンス

MIT

