# Manaboard

Manaboardは、基本情報技術者試験の学習に特化したローカル学習支援アプリです。ログインせずに、学習時間の記録、AI問題演習、単語復習、教材画像の解説を利用できます。

## 主な機能

- ポモドーロタイマーによる学習時間の自動記録
- 日付別の学習履歴、削除、ページ送り
- 科目A・科目Bに対応したAI問題の3問演習
- 正答率と進行状況の表示
- AIが作成した基本情報技術者試験向け単語帳
- 未習得・復習・習得による単語の管理
- Geminiの画像認識を中心にした教材・プリントの画像解説
- 画像認識を補助するTesseract OCR
- 学習記録、AI問題、単語帳の状況をまとめたホーム画面

## 使用技術

- フロントエンド: Next.js、React、TypeScript、Tailwind CSS
- バックエンド: FastAPI、SQLAlchemy
- データベース: PostgreSQL
- AI: Google Gemini API
- OCR: Tesseract
- 実行環境: Docker Compose

## 必要なもの

- Docker Desktop
- Google Gemini APIキー

## セットアップ

1. `.env.example`を複製して、プロジェクト直下に`.env`を作成します。
2. `.env`にGemini APIキーを設定します。

```env
GEMINI_API_KEY=ここにAPIキーを設定
GEMINI_MODEL=gemini-3.5-flash
```

3. プロジェクト直下で次のコマンドを実行します。

```bash
docker compose up -d --build
```

4. ブラウザで[http://localhost:3000](http://localhost:3000)を開きます。

## Docker構成

- `app`: Next.jsフロントエンドとFastAPIバックエンド
- `db`: PostgreSQLデータベース

## URL

- アプリ: [http://localhost:3000](http://localhost:3000)
- APIドキュメント: [http://localhost:8000/docs](http://localhost:8000/docs)

## 停止と再起動

```bash
docker compose stop
docker compose start
```

コンテナを削除して停止する場合は、次を実行します。データベースのボリュームは保持されます。

```bash
docker compose down
```

## 注意事項

- `.env`やAPIキーをGitHubへコミットしないでください。
- Gemini APIキーはバックエンドコンテナからのみ使用されます。
- 対応画像形式はJPEG、PNG、WebPです。
- アップロードできる画像は5MBまでです。
