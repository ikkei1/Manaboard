import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.flashcard import Flashcard
from app.models.user import User
from app.schemas.common import SUBJECTS
from app.schemas.flashcard import FlashcardCreate, FlashcardList, FlashcardOut, FlashcardReview, FlashcardUpdate

router = APIRouter(prefix="/flashcards", tags=["Flashcards"])

STATUSES = {"new", "learning", "mastered"}

FE_DEFAULT_CARDS = [
    ("テクノロジ系", "2進数", "0と1だけで数を表す方法。コンピュータ内部の数値表現の基本。", "10進数との変換、ビット数、桁の重みを確認する。"),
    ("テクノロジ系", "補数", "負の数を表したり、減算を加算として扱ったりするための表現。", "2の補数はビット反転して1を足す。"),
    ("テクノロジ系", "論理演算", "AND、OR、NOT、XORなど、真偽値を扱う演算。", "真理値表で結果を追えるようにする。"),
    ("テクノロジ系", "稼働率", "システムが正常に使える割合。", "直列は掛け算、並列は 1 - 全停止率 で考える。"),
    ("テクノロジ系", "キャッシュメモリ", "CPUと主記憶の速度差を補う高速な記憶装置。", "ヒット率と実効アクセス時間がよく出る。"),
    ("アルゴリズム", "線形探索", "先頭から順に目的の値を探す探索方法。", "データが未整列でも使えるが、件数が増えると遅くなる。"),
    ("アルゴリズム", "二分探索", "整列済みデータの中央を見ながら探索範囲を半分にする方法。", "前提は整列済み。計算量は O(log n)。"),
    ("アルゴリズム", "バブルソート", "隣り合う値を比較して入れ替えながら整列する方法。", "交換回数や比較回数を追う問題に注意する。"),
    ("アルゴリズム", "計算量", "入力件数が増えたときの処理量の増え方。", "O(1)、O(log n)、O(n)、O(n^2)の違いを押さえる。"),
    ("アルゴリズム", "スタック", "後に入れたデータを先に取り出すデータ構造。", "LIFO、push、popをセットで覚える。"),
    ("データベース", "主キー", "表の行を一意に識別する列または列の組。", "NULL不可、重複不可。"),
    ("データベース", "外部キー", "別の表の主キーなどを参照する列。", "参照整合性と関連づけて出題される。"),
    ("データベース", "正規化", "データの重複や更新時の不整合を減らす設計手法。", "第1、第2、第3正規形の違いを確認する。"),
    ("データベース", "SQL SELECT", "表から条件に合うデータを取り出す命令。", "WHERE、GROUP BY、ORDER BY、JOINを重点確認する。"),
    ("データベース", "トランザクション", "複数の処理をひとまとまりとして扱う単位。", "ACID特性、commit、rollbackを覚える。"),
    ("ネットワーク", "IPアドレス", "ネットワーク上の機器を識別する番号。", "IPv4、ネットワーク部、ホスト部を押さえる。"),
    ("ネットワーク", "サブネットマスク", "IPアドレスのネットワーク部とホスト部を分ける値。", "CIDR表記と利用可能ホスト数が出やすい。"),
    ("ネットワーク", "DNS", "ドメイン名とIPアドレスを対応づける仕組み。", "名前解決の役割を答えられるようにする。"),
    ("ネットワーク", "HTTP", "WebブラウザとWebサーバが通信するときのプロトコル。", "HTTPSはTLSで暗号化される。"),
    ("ネットワーク", "TCP", "信頼性のある通信を行うトランスポート層のプロトコル。", "再送制御、順序制御、コネクションを押さえる。"),
    ("セキュリティ", "共通鍵暗号", "暗号化と復号に同じ鍵を使う方式。", "高速だが鍵配送が課題。"),
    ("セキュリティ", "公開鍵暗号", "公開鍵と秘密鍵のペアを使う暗号方式。", "暗号化、署名、鍵配送問題の解決で問われる。"),
    ("セキュリティ", "ハッシュ関数", "データから固定長の値を作る関数。", "改ざん検知、パスワード保存、電子署名で使われる。"),
    ("セキュリティ", "認証", "利用者や機器が本人であることを確認すること。", "知識、所持、生体の三要素を覚える。"),
    ("セキュリティ", "マルウェア", "不正な目的で作られたソフトウェアの総称。", "ウイルス、ワーム、トロイの木馬の違いに注意する。"),
    ("マネジメント系", "WBS", "作業を細かい単位に分解して整理したもの。", "スケジュールや見積りの前提になる。"),
    ("マネジメント系", "ガントチャート", "作業期間や進捗を横棒で表す図。", "作業順序や期間の読み取りで出る。"),
    ("マネジメント系", "SLA", "サービス提供者と利用者の間で合意するサービス水準。", "可用性、応答時間、復旧時間などを確認する。"),
    ("マネジメント系", "ITIL", "ITサービス管理のベストプラクティス集。", "サービス運用、インシデント管理と関連づける。"),
    ("マネジメント系", "リスク管理", "リスクを特定し、分析し、対応する活動。", "回避、軽減、転嫁、受容の違いを押さえる。"),
    ("ストラテジ系", "SWOT分析", "強み、弱み、機会、脅威で状況を分析する手法。", "内部環境と外部環境の分類が出やすい。"),
    ("ストラテジ系", "損益分岐点", "利益が0になる売上高。", "固定費、変動費、売上高の関係で計算する。"),
    ("ストラテジ系", "ROI", "投資に対してどれだけ利益が得られたかを示す指標。", "利益 ÷ 投資額 で考える。"),
    ("ストラテジ系", "著作権", "著作物を保護する権利。", "プログラム、引用、利用許諾に注意する。"),
    ("ストラテジ系", "個人情報保護法", "個人情報の適正な取り扱いを定める法律。", "利用目的、第三者提供、本人同意を押さえる。"),
]


def validate_subject(subject: str):
    if subject not in SUBJECTS:
        raise HTTPException(422, "分野を確認してください")


def validate_status(value: str):
    if value not in STATUSES:
        raise HTTPException(422, "状態を確認してください")


def seed_default_cards(db: Session, user_id: uuid.UUID):
    exists = db.scalar(select(Flashcard.id).where(Flashcard.user_id == user_id).limit(1))
    if exists:
        return
    db.add_all(
        Flashcard(user_id=user_id, subject=subject, term=term, definition=definition, exam_point=exam_point)
        for subject, term, definition, exam_point in FE_DEFAULT_CARDS
    )
    db.commit()


def stats_for(cards: list[Flashcard]):
    return {
        "total": len(cards),
        "new": sum(1 for card in cards if card.status == "new"),
        "learning": sum(1 for card in cards if card.status == "learning"),
        "mastered": sum(1 for card in cards if card.status == "mastered"),
    }


@router.get("", response_model=FlashcardList)
def list_flashcards(
    subject: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    q: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    seed_default_cards(db, current_user.id)
    if subject:
        validate_subject(subject)
    if status_filter:
        validate_status(status_filter)

    query = select(Flashcard).where(Flashcard.user_id == current_user.id)
    if subject:
        query = query.where(Flashcard.subject == subject)
    if status_filter:
        query = query.where(Flashcard.status == status_filter)
    if q:
        like = f"%{q}%"
        query = query.where(or_(Flashcard.term.ilike(like), Flashcard.definition.ilike(like), Flashcard.exam_point.ilike(like)))
    items = db.scalars(query.order_by(Flashcard.subject, Flashcard.status, Flashcard.term)).all()
    all_cards = db.scalars(select(Flashcard).where(Flashcard.user_id == current_user.id)).all()
    return {"items": items, "stats": stats_for(all_cards)}


@router.post("", response_model=FlashcardOut, status_code=status.HTTP_201_CREATED)
def create_flashcard(payload: FlashcardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    validate_subject(payload.subject)
    row = Flashcard(user_id=current_user.id, **payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/{card_id}", response_model=FlashcardOut)
def update_flashcard(card_id: uuid.UUID, payload: FlashcardUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    validate_subject(payload.subject)
    validate_status(payload.status)
    row = db.get(Flashcard, card_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(404, "単語が見つかりません")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.patch("/{card_id}/review", response_model=FlashcardOut)
def review_flashcard(card_id: uuid.UUID, payload: FlashcardReview, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(Flashcard, card_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(404, "単語が見つかりません")
    row.review_count += 1
    row.correct_count += int(payload.remembered)
    row.last_reviewed_at = datetime.utcnow()
    row.status = "mastered" if payload.remembered else "learning"
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flashcard(card_id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.get(Flashcard, card_id)
    if not row or row.user_id != current_user.id:
        raise HTTPException(404, "単語が見つかりません")
    db.delete(row)
    db.commit()
    return None
