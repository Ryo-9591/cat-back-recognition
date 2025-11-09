"""
猫背検知APIサーバー
MoveNet Lightningを使用して姿勢を検出し、猫背を判定する
"""

import os

# TensorFlowの警告とエラーを抑制（CPUモードで動作するため）
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import cv2
import numpy as np
import tensorflow as tf
import tensorflow_hub as hub
import base64

app = FastAPI(title="猫背検知API", version="1.0.0")

# CORSミドルウェアの設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切なオリジンを指定してください
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MoveNet Lightningモデルの読み込み
MODEL_URL = "https://tfhub.dev/google/movenet/singlepose/lightning/4"
print("MoveNet Lightningモデルを読み込み中...")
movenet = hub.load(MODEL_URL)
movenet = movenet.signatures["serving_default"]
print("MoveNet Lightningモデルの読み込みが完了しました")

# MoveNetの入力サイズ（Lightningは192x192）
INPUT_SIZE = 192


# リクエストモデル
class AnalyzeRequest(BaseModel):
    image: str  # base64エンコードされた画像データ


# レスポンスモデル
class HealthResponse(BaseModel):
    status: str


class PostureResult(BaseModel):
    detected: bool
    score: float | None = None
    is_slouched: bool | None = None
    vertical_distance: float | None = None
    message: str | None = None
    error: str | None = None


def preprocess_image(image, input_size=192):
    """
    画像をMoveNetの入力形式に前処理する

    Args:
        image: RGB画像（numpy配列）
        input_size: リサイズサイズ

    Returns:
        前処理された画像（tensor）
    """
    # 画像をTensorFlowテンソルに変換
    image_tensor = tf.convert_to_tensor(image, dtype=tf.uint8)
    # 画像をリサイズ（パディング付き）
    image_tensor = tf.image.resize_with_pad(image_tensor, input_size, input_size)
    # int32型に変換（MoveNetはint32を期待）
    image_tensor = tf.cast(image_tensor, dtype=tf.int32)
    # バッチ次元を追加
    image_tensor = tf.expand_dims(image_tensor, axis=0)
    return image_tensor


def calculate_posture_score(keypoints_with_scores):
    """
    姿勢スコアを計算する（猫背度を判定）

    Args:
        keypoints_with_scores: MoveNetの出力（y, x, confidence）

    Returns:
        dict: 姿勢スコアと判定結果
    """
    if keypoints_with_scores is None or len(keypoints_with_scores) == 0:
        return None

    # MoveNet Lightningのキーポイントインデックス
    # 0: nose, 1: left_eye, 2: right_eye, 3: left_ear, 4: right_ear
    # 5: left_shoulder, 6: right_shoulder
    NOSE = 0
    LEFT_EAR = 3
    RIGHT_EAR = 4
    LEFT_SHOULDER = 5
    RIGHT_SHOULDER = 6

    # 信頼度の閾値
    CONFIDENCE_THRESHOLD = 0.3

    try:
        # キーポイントを取得
        nose = keypoints_with_scores[NOSE]
        left_ear = keypoints_with_scores[LEFT_EAR]
        right_ear = keypoints_with_scores[RIGHT_EAR]
        left_shoulder = keypoints_with_scores[LEFT_SHOULDER]
        right_shoulder = keypoints_with_scores[RIGHT_SHOULDER]

        # 信頼度をチェック
        if (
            nose[2] < CONFIDENCE_THRESHOLD
            or left_shoulder[2] < CONFIDENCE_THRESHOLD
            or right_shoulder[2] < CONFIDENCE_THRESHOLD
        ):
            return None

        # 頭部の位置を計算（鼻と耳の平均、信頼度で重み付け）
        # MoveNetの出力形式: [y, x, confidence]
        head_y = nose[0]  # 鼻のy座標を主に使用
        if left_ear[2] > CONFIDENCE_THRESHOLD and right_ear[2] > CONFIDENCE_THRESHOLD:
            # 両方の耳が検出されている場合は平均を取る
            head_y = (nose[0] + left_ear[0] + right_ear[0]) / 3

        # 肩の中心位置を計算
        shoulder_y = (left_shoulder[0] + right_shoulder[0]) / 2

        # 頭部と肩の垂直距離を計算
        # MoveNetの座標系では、yが小さいほど上（良い姿勢）
        vertical_distance = head_y - shoulder_y

        # 猫背判定の閾値（調整可能）
        # 頭部が肩より上にある（y座標が小さい）ほど良い姿勢
        # 頭部が肩の位置より下にあると猫背
        threshold = -0.02  # 調整可能な閾値（負の値）

        # 姿勢スコアを計算（0-100）
        # 垂直距離が小さい（負の値が大きい）ほど良い姿勢
        base_score = 50
        # スケーリング（垂直距離をスコアに変換）
        score_adjustment = -vertical_distance * 500  # 負の値なので符号を反転
        posture_score = max(0, min(100, base_score + score_adjustment))

        # 猫背判定
        is_slouched = vertical_distance > threshold

        return {
            "score": round(posture_score, 2),
            "is_slouched": is_slouched,
            "vertical_distance": round(vertical_distance, 4),
            "message": "猫背です" if is_slouched else "良い姿勢です",
        }
    except Exception as e:
        print(f"姿勢計算エラー: {e}")
        return None


@app.get("/health", response_model=HealthResponse)
async def health():
    """ヘルスチェックエンドポイント"""
    return HealthResponse(status="ok")


@app.post("/analyze", response_model=PostureResult)
async def analyze_posture(request: AnalyzeRequest):
    """
    画像から姿勢を分析するエンドポイント

    Request Body:
        - image: base64エンコードされた画像データ
    """
    try:
        if not request.image:
            raise HTTPException(status_code=400, detail="画像データがありません")

        # base64デコード
        image_data = (
            request.image.split(",")[1] if "," in request.image else request.image
        )
        image_bytes = base64.b64decode(image_data)

        # 画像をnumpy配列に変換
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(status_code=400, detail="画像のデコードに失敗しました")

        # BGRからRGBに変換
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # 画像を前処理
        input_image = preprocess_image(image_rgb, INPUT_SIZE)

        # MoveNetで姿勢検出（キーワード引数inputを使用）
        outputs = movenet(input=input_image)
        keypoints_with_scores = outputs["output_0"].numpy()[0]

        # キーポイントが検出されたかチェック
        # 信頼度の合計が一定以上か確認
        total_confidence = np.sum(keypoints_with_scores[:, 2])
        if total_confidence < 5.0:  # 17個のキーポイント × 0.3程度の平均信頼度
            return PostureResult(detected=False, message="姿勢が検出できませんでした")

        # 姿勢スコアを計算
        posture_result = calculate_posture_score(keypoints_with_scores)

        if posture_result is None:
            return PostureResult(detected=True, error="姿勢スコアの計算に失敗しました")

        return PostureResult(
            detected=True,
            score=posture_result["score"],
            is_slouched=posture_result["is_slouched"],
            vertical_distance=posture_result["vertical_distance"],
            message=posture_result["message"],
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"エラー: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=5000)
