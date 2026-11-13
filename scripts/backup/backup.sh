#!/usr/bin/env bash
# 매일 별도 백업: DB(public·auth·storage 스키마)와 Storage 파일을 암호화해 S3 호환 저장소에 올린다.
# Supabase 의 자동 백업과 따로 둔다. 자동 백업에는 올린 파일이 들어가지 않고, 프로젝트가 지워지면 함께 사라진다.
# 복구 방법: docs/BACKUP.md
#
# 필요한 값 (GitHub Actions 비밀값):
#   BACKUP_DB_URL                운영 DB 접속 주소 (Session pooler)
#   BACKUP_PASSPHRASE            암호화 암호. 잃으면 백업을 열 수 없다
#   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
#   BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY   (없으면 올리지 않고 BACKUP_OUT 에 둔다)
# 선택: BACKUP_KEEP_DAYS(기본 30), PG_DUMP·PG_RESTORE(실행 파일 경로), BACKUP_OUT(결과 폴더)
#
# 실행 기록에는 개수와 크기만 적는다. 이름·내용·접속 주소는 적지 않는다.
set -euo pipefail

: "${BACKUP_DB_URL:?BACKUP_DB_URL 이 없어요}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE 가 없어요}"
: "${SUPABASE_URL:?SUPABASE_URL 이 없어요}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY 가 없어요}"
[ "${#BACKUP_PASSPHRASE}" -ge 20 ] || { echo "BACKUP_PASSPHRASE 는 20자 이상이어야 해요"; exit 2; }

PG_DUMP="${PG_DUMP:-pg_dump}"
PG_RESTORE="${PG_RESTORE:-pg_restore}"
KEEP="${BACKUP_KEEP_DAYS:-30}"
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP="$(date -u +%Y-%m-%dT%H%MZ)"
WORK="$(mktemp -d)"
OUT="${BACKUP_OUT:-$WORK/out}"
trap 'rm -rf "$WORK"' EXIT
umask 077
mkdir -p "$OUT"

enc() { gpg --batch --yes --quiet --symmetric --cipher-algo AES256 --pinentry-mode loopback --passphrase-fd 3 -o "$2" "$1" 3<<<"$BACKUP_PASSPHRASE"; }
dec() { gpg --batch --quiet --decrypt --pinentry-mode loopback --passphrase-fd 3 "$1" 3<<<"$BACKUP_PASSPHRASE"; }

# 1) DB. 계정(auth), 업무 데이터(public), 파일 목록(storage)
$PG_DUMP "$BACKUP_DB_URL" --format=custom --no-owner --no-privileges --schema=public --schema=auth --schema=storage -f "$WORK/db.dump"
TABLES="$($PG_RESTORE --list "$WORK/db.dump" | grep -c ' TABLE DATA ' || true)"
[ "$TABLES" -ge 10 ] || { echo "DB 백업에 표가 $TABLES 개뿐이라 멈춰요"; exit 1; }

# 2) 올린 파일
node "$HERE/storage-pull.mjs" "$WORK/files"
tar -C "$WORK" -cf "$WORK/files.tar" files

# 3) 암호화, 다시 풀어 확인
enc "$WORK/db.dump" "$OUT/$STAMP.db.dump.gpg"
enc "$WORK/files.tar" "$OUT/$STAMP.files.tar.gpg"
[ "$(dec "$OUT/$STAMP.db.dump.gpg" | sha256sum | cut -d' ' -f1)" = "$(sha256sum "$WORK/db.dump" | cut -d' ' -f1)" ] || { echo "DB 백업을 다시 풀 수 없어요"; exit 1; }
[ "$(dec "$OUT/$STAMP.files.tar.gpg" | sha256sum | cut -d' ' -f1)" = "$(sha256sum "$WORK/files.tar" | cut -d' ' -f1)" ] || { echo "파일 백업을 다시 풀 수 없어요"; exit 1; }
echo "db: 표 ${TABLES}개, $(du -h "$OUT/$STAMP.db.dump.gpg" | cut -f1) / files: $(du -h "$OUT/$STAMP.files.tar.gpg" | cut -f1)"

# 4) 올리기, 오래된 것 지우기
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  : "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT 가 없어요}"
  S3=(aws s3 --endpoint-url "$BACKUP_S3_ENDPOINT")
  export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-auto}" AWS_EC2_METADATA_DISABLED=true
  "${S3[@]}" cp --only-show-errors "$OUT/$STAMP.db.dump.gpg" "s3://$BACKUP_S3_BUCKET/daily/$STAMP.db.dump.gpg"
  "${S3[@]}" cp --only-show-errors "$OUT/$STAMP.files.tar.gpg" "s3://$BACKUP_S3_BUCKET/daily/$STAMP.files.tar.gpg"
  CUT="$(date -u -d "$KEEP days ago" +%Y-%m-%d)"
  # 새 백업이 올라간 뒤에만 지운다. 이름 앞의 날짜가 보관 기간보다 오래된 것만
  "${S3[@]}" ls "s3://$BACKUP_S3_BUCKET/daily/" | awk '{print $4}' | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{4}Z\.(db\.dump|files\.tar)\.gpg$' | while read -r k; do
    if [[ "${k:0:10}" < "$CUT" ]]; then "${S3[@]}" rm --only-show-errors "s3://$BACKUP_S3_BUCKET/daily/$k"; fi
  done
  echo "올림: $STAMP, 보관 ${KEEP}일, 지금 $("${S3[@]}" ls "s3://$BACKUP_S3_BUCKET/daily/" | wc -l)개"
else
  echo "BACKUP_S3_BUCKET 이 없어 올리지 않았어요: $OUT"
fi
