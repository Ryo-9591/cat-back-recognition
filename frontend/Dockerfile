# nginxを使用してフロントエンドを配信
FROM nginx:alpine

# フロントエンドファイルをコピー
COPY . /usr/share/nginx/html

# ポート80を公開
EXPOSE 80

# nginxを起動
CMD ["nginx", "-g", "daemon off;"]

