# 猫背検知アプリ - Pose Magic

MoveNet Lightningを使用した猫背検知Webアプリケーションです。

## 機能

- Webカメラを使用したリアルタイム姿勢検出
- MoveNet Lightningによる高精度な姿勢分析
- 猫背度のスコアリング（0-100点）
- Dockerコンテナによる簡単なデプロイ

## 構成

- **フロントエンド**: HTML + CSS + JavaScript（Webカメラ取得）
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
# Pythonの簡易サーバーを使用する場合
cd frontend
python -m http.server 8080
```

その後、ブラウザで `http://localhost:8080` にアクセスしてください。

## 使用方法

1. ブラウザでフロントエンドを開く
2. 「カメラ開始」ボタンをクリックしてカメラへのアクセスを許可
3. カメラの前に立ち、全身が映るようにする
4. 「姿勢を分析」ボタンをクリック
5. 姿勢スコアと猫背判定結果が表示される

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

