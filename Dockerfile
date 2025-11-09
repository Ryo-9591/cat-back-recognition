# Python 3.11のベースイメージを使用
FROM python:3.11-slim

# 作業ディレクトリを設定
WORKDIR /app

# システムの依存関係をインストール
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Pythonの依存関係をコピーしてインストール
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY backend/ .

# ポート5000を公開
EXPOSE 5000

# TensorFlowの警告とエラーを抑制（CPUモードで動作するため）
ENV TF_CPP_MIN_LOG_LEVEL=3

# アプリケーションを起動
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "5000"]

