# 백업과 복구

단추의 데이터는 두 곳에 있다. 계정과 업무 데이터는 Supabase DB, 올린 파일(견적서 PDF, 요청 첨부)은 Supabase Storage.

| 장치 | 범위 | 주기 | 보관 | 비고 |
|---|---|---|---|---|
| Supabase 자동 백업 | DB | 매일 | 7일 | 파일은 들어가지 않는다. 프로젝트가 지워지면 함께 사라진다 |
| 매일 별도 백업 (이 문서) | DB + 파일 | 매일 03:30 | 30일 | 암호화해 별도 저장소에 둔다 |
| 분 단위 복구 (PITR) | DB | 2분 | 7일 | 시범 운영 전에 켠다. 켜면 Supabase 매일 백업은 멈춘다 |

## 매일 별도 백업

`.github/workflows/backup.yml` 이 `scripts/backup/backup.sh` 를 돌린다.

1. `pg_dump` 로 `public`, `auth`, `storage` 스키마를 받는다.
2. Storage 의 모든 버킷 파일을 받아 `tar` 로 묶는다.
3. 둘 다 `gpg` 대칭 암호화(AES256)하고, 다시 풀어 원본과 같은지 확인한다.
4. S3 호환 저장소의 `daily/` 에 올리고, 30일이 지난 것을 지운다.

파일 이름: `2026-11-13T1830Z.db.dump.gpg`, `2026-11-13T1830Z.files.tar.gpg`

### 등록할 비밀값 (GitHub 저장소 Settings → Secrets and variables → Actions)

| 이름 | 값 |
|---|---|
| `BACKUP_DB_URL` | Supabase Connect → Session pooler 주소 (비밀번호 포함) |
| `BACKUP_PASSPHRASE` | 20자 이상 암호. 비밀번호 관리자에도 따로 적어 둔다. 잃으면 백업을 열 수 없다 |
| `BACKUP_SUPABASE_URL` | `https://<프로젝트>.supabase.co` |
| `BACKUP_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role 키 |
| `BACKUP_S3_ENDPOINT` | 저장소의 S3 주소 |
| `BACKUP_S3_BUCKET` | 비공개 버킷 이름 |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | 그 버킷에만 쓰는 키 |

비밀값이 없으면 작업은 경고만 남기고 건너뛴다. 등록한 뒤 Actions → 매일 백업 → Run workflow 로 한 번 돌려 확인한다.

저장소는 운영 Supabase 프로젝트 밖의 비공개 버킷이어야 한다. 이 깃허브 저장소는 공개이므로 백업 파일을 Actions 산출물이나 릴리스로 올리지 않는다.

## 복구

```bash
# 1) 받기
aws s3 --endpoint-url "$BACKUP_S3_ENDPOINT" cp s3://$BACKUP_S3_BUCKET/daily/<날짜>.db.dump.gpg .
aws s3 --endpoint-url "$BACKUP_S3_ENDPOINT" cp s3://$BACKUP_S3_BUCKET/daily/<날짜>.files.tar.gpg .

# 2) 풀기 (암호를 묻는다)
gpg --decrypt -o db.dump <날짜>.db.dump.gpg
gpg --decrypt -o files.tar <날짜>.files.tar.gpg

# 3) DB: 새 Supabase 프로젝트(또는 빈 DB)에 넣는다. 운영 DB 에 바로 덮어쓰지 않는다
pg_restore --no-owner --no-privileges --data-only --disable-triggers -d "<새 DB 주소>" db.dump
#    빈 PostgreSQL 에 구조까지 넣을 때는 --data-only 를 뺀다

# 4) 파일: files/<버킷>/<경로> 그대로 Storage 에 올린다
tar -xf files.tar
```

일부 행만 되살릴 때는 새 DB 에 복구한 뒤 필요한 행만 운영 DB 로 옮긴다.

## 확인한 것 (2026-11-13, 로컬 Supabase)

- 백업 실행, 암호화, S3 호환 저장소에 올리기, 30일 지난 파일만 지우기.
- 받은 파일을 풀어 빈 DB 에 복구했을 때 계정·요청·견적·기관 건수가 원본과 같음. 파일 10개 모두 들어 있음.
- 틀린 암호로는 열리지 않음. DB 주소가 틀리면 올리기 전에 멈춤.

운영 환경에서의 첫 실행은 비밀값을 등록한 뒤 확인한다.
