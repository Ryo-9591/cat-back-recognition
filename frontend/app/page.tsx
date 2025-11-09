"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Camera, Upload, Activity, AlertCircle, CheckCircle2, Square } from "lucide-react"

// APIのURL（環境変数から取得、デフォルトはlocalhost:5000）
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

interface PostureResult {
  detected: boolean
  score?: number
  is_slouched?: boolean
  vertical_distance?: number
  message?: string
  error?: string
}

export default function PostureDetectionApp() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [result, setResult] = useState<PostureResult | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastAnalysisTimeRef = useRef<number>(0)
  const ANALYSIS_INTERVAL = 500 // 500msごとに分析（よりリアルタイムに）

  // カメラを停止する
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraActive(false)
    setResult(null)
  }

  // カメラを開始する
  const startCamera = async () => {
    try {
      setIsCameraActive(false)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsCameraActive(true)
        
        // ビデオが再生可能になったらリアルタイム検出を開始
        const startAnalysis = () => {
          if (videoRef.current && videoRef.current.readyState >= 2 && 
              videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
            startRealtimeAnalysis()
          }
        }
        
        videoRef.current.addEventListener('loadedmetadata', startAnalysis, { once: true })
        videoRef.current.addEventListener('canplay', startAnalysis, { once: true })
        videoRef.current.addEventListener('playing', startAnalysis, { once: true })
        
        // タイムアウト処理（3秒後に再試行）
        setTimeout(() => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            startAnalysis()
          }
        }, 3000)
      }
    } catch (error) {
      console.error('カメラの取得に失敗しました:', error)
      setIsCameraActive(false)
      setResult({
        detected: false,
        message: 'カメラへのアクセスに失敗しました',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // リアルタイム姿勢検出を開始（requestAnimationFrameを使用）
  const startRealtimeAnalysis = () => {
    lastAnalysisTimeRef.current = 0
    
    const analyzeLoop = (timestamp: number) => {
      if (!streamRef.current || !isCameraActive) {
        return
      }

      // 指定間隔ごとに分析を実行
      if (timestamp - lastAnalysisTimeRef.current >= ANALYSIS_INTERVAL) {
        lastAnalysisTimeRef.current = timestamp
        if (!isAnalyzing) {
          analyzePosture()
        }
      }

      // 次のフレームをリクエスト
      animationFrameRef.current = requestAnimationFrame(analyzeLoop)
    }

    // 初回はすぐに実行
    analyzePosture()
    animationFrameRef.current = requestAnimationFrame(analyzeLoop)
  }

  // ビデオフレームをキャンバスに描画して画像データを取得
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) {
      return null
    }
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    
    if (!context || !video.videoWidth || !video.videoHeight) {
      return null
    }
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    return canvas.toDataURL('image/jpeg', 0.8)
  }

  // 画像ファイルをbase64に変換
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // 姿勢分析APIを呼び出す
  const analyzePosture = async (imageData: string | null = null) => {
    if (isAnalyzing) {
      return
    }
    
    setIsAnalyzing(true)
    
    try {
      // 画像データが提供されていない場合、カメラからキャプチャ
      if (!imageData) {
        if (!streamRef.current || !videoRef.current || 
            !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
          setIsAnalyzing(false)
          return
        }
        imageData = captureFrame()
        if (!imageData) {
          setIsAnalyzing(false)
          return
        }
      }
      
      // APIに送信
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageData
        })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data: PostureResult = await response.json()
      setResult(data)
      
    } catch (error) {
      console.error('姿勢分析エラー:', error)
      // エラー時は結果を更新しない（前回の結果を保持）
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 画像アップロード処理
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }
    
    // 画像ファイルかチェック
    if (!file.type.startsWith('image/')) {
      setResult({
        detected: false,
        message: '画像ファイルを選択してください'
      })
      return
    }
    
    try {
      // 画像をbase64に変換
      const imageData = await fileToBase64(file)
      
      // 姿勢分析を実行
      await analyzePosture(imageData)
    } catch (error) {
      console.error('画像の読み込みエラー:', error)
      setResult({
        detected: false,
        message: '画像の読み込みに失敗しました',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  // ヘルスチェック
  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/health`)
      if (!response.ok) {
        console.warn('APIサーバーへの接続に問題があります')
      }
    } catch (error) {
      console.error('APIサーバーに接続できません:', error)
    }
  }

  // クリーンアップ
  useEffect(() => {
    // ページ読み込み時にヘルスチェック
    checkHealth()

    // クリーンアップ関数
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const getStatusBadge = () => {
    if (!result || !result.detected) return null
    
    const score = result.score || 0
    const isGood = score >= 60
    
    return (
      <Badge
        variant={isGood ? "default" : "destructive"}
        className={isGood ? "bg-accent hover:bg-accent/90" : ""}
      >
        {isGood ? "正常" : "猫背"}
      </Badge>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-secondary/20 to-background overflow-hidden">
      {/* Header - コンパクトに */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold leading-none tracking-tight text-foreground">
                  猫背検知アプリ
                </h1>
                <p className="text-xs text-muted-foreground">
                  座っている姿勢をリアルタイムで検知
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              <Activity className="mr-1 h-3 w-3" />
              AI検知
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content - フレックスレイアウトで横並び */}
      <main className="flex-1 container mx-auto px-4 py-4 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Video/Analysis Area */}
          <Card className="overflow-hidden border-border/50 shadow-lg flex flex-col">
            <div className="flex-1 bg-muted/30 relative min-h-[300px]">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="h-full w-full object-cover" 
              />
              <canvas ref={canvasRef} className="hidden" />
              {!isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
                  <div className="text-center space-y-2">
                    <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Camera className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">カメラを開始してください</p>
                    <p className="text-xs text-muted-foreground">座った状態で全身が映るようにしてください</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="border-t border-border/50 bg-card p-3">
              <div className="flex gap-2">
                {!isCameraActive ? (
                  <Button onClick={startCamera} className="gap-2 flex-1">
                    <Camera className="h-4 w-4" />
                    カメラ開始
                  </Button>
                ) : (
                  <Button onClick={stopCamera} variant="destructive" className="gap-2 flex-1">
                    <Square className="h-4 w-4" />
                    カメラ停止
                  </Button>
                )}
                <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" />
                  画像
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>
          </Card>

          {/* Results - コンパクトに */}
          <Card className="border-border/50 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h2 className="text-base font-semibold text-foreground">分析結果</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {!result ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">カメラを開始すると</p>
                    <p className="text-sm text-muted-foreground">リアルタイムで姿勢を分析します</p>
                  </div>
                </div>
              ) : !result.detected ? (
                <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {result.message || '姿勢が検出できませんでした'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.error || '座った状態で全身が映るようにしてください'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      {result.score && result.score >= 60 ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 shrink-0">
                          <CheckCircle2 className="h-6 w-6 text-accent" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
                          <AlertCircle className="h-6 w-6 text-destructive" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {result.message || (result.score && result.score >= 60 ? '良好な姿勢です' : '猫背の可能性があります')}
                        </p>
                        {result.score !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            姿勢スコア: {result.score.toFixed(1)}点
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge()}
                  </div>

                  {result.score !== undefined && result.score < 60 && (
                    <div className="rounded-lg border border-border/50 bg-card p-3">
                      <h3 className="mb-2 text-sm font-medium text-foreground">改善のアドバイス</h3>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex gap-2">
                          <span className="text-primary">•</span>
                          <span>背筋を伸ばして、椅子に深く座りましょう</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-primary">•</span>
                          <span>画面の高さを調整して、目線が下がらないようにしましょう</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-primary">•</span>
                          <span>定期的にストレッチを行いましょう</span>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
