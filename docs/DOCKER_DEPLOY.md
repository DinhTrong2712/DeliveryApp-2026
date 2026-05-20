# CI/CD Docker — Hướng dẫn triển khai

Tài liệu này mô tả pipeline: **push lên `main` → GitHub Actions build & push image lên `ghcr.io` → SSH vào VPS, chạy `docker compose pull && up -d`**.

## Kiến trúc deploy

```
┌───────────────┐    push main    ┌────────────────────┐
│  Dev (local)  │ ──────────────► │  GitHub Actions    │
└───────────────┘                 │  Build 2 images:   │
                                  │  - api  (.NET 8)   │
                                  │  - web  (nginx)    │
                                  └────────┬───────────┘
                                           │ push
                                           ▼
                                   ┌──────────────────┐
                                   │   ghcr.io        │
                                   │   (private)      │
                                   └────────┬─────────┘
                                            │ SSH + pull
                                            ▼
                              ┌──────────────────────────────┐
                              │  VPS Linux (Ubuntu 22.04+)   │
                              │  docker compose:              │
                              │   ├ db  (postgres:16-alpine) │
                              │   ├ api (port 8080 internal) │
                              │   └ web (nginx, port 80)     │
                              └──────────────────────────────┘
```

---

## 1. Chuẩn bị VPS

### 1.1 Cài Docker Engine + compose plugin (Ubuntu/Debian)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER     # logout/login lại để áp dụng
docker compose version            # kiểm tra: phải >= v2.20
```

### 1.2 Tạo thư mục app + copy file compose + env

```bash
sudo mkdir -p /srv/deliveryapp
sudo chown $USER:$USER /srv/deliveryapp
cd /srv/deliveryapp

# Copy 2 file compose từ repo về máy chủ
# (hoặc git clone repo rồi chỉ giữ 2 file này)
scp docker-compose.yml      user@vps:/srv/deliveryapp/
scp docker-compose.prod.yml user@vps:/srv/deliveryapp/
scp .env.example            user@vps:/srv/deliveryapp/.env

# Sửa .env: điền POSTGRES_PASSWORD, JWT_SECRET, GHCR_OWNER, etc.
nano .env
```

> `JWT_SECRET` nên sinh bằng `openssl rand -hex 32` (64 ký tự hex).

### 1.3 Mở port

Mở **80** (HTTP) và **22** (SSH) trong firewall VPS / cloud provider.

> Khuyến nghị đặt Caddy/Traefik/Cloudflare Tunnel trước nginx để có HTTPS tự động — phần này nằm ngoài tài liệu này.

---

## 2. Tạo Personal Access Token cho GHCR

VPS cần token để `docker login ghcr.io` và pull image.

1. Vào https://github.com/settings/tokens → **Generate new token (classic)**
2. Scope: chỉ cần `read:packages`
3. Lưu lại token (chỉ hiện 1 lần)

---

## 3. Cấu hình GitHub repository secrets

Vào **repo Settings → Secrets and variables → Actions → New repository secret**, tạo 7 secret:

| Secret | Giá trị | Ghi chú |
|---|---|---|
| `VPS_HOST` | `123.45.67.89` hoặc `vps.example.com` | IP/domain máy chủ |
| `VPS_USER` | `ubuntu` / `root` / tên user trên VPS | User có quyền chạy docker |
| `VPS_PORT` | `22` (tuỳ chọn — mặc định 22) | Nếu đổi SSH port |
| `VPS_SSH_KEY` | private key (`-----BEGIN OPENSSH PRIVATE KEY-----...`) | Sinh `ssh-keygen -t ed25519`, copy public key vào `~/.ssh/authorized_keys` trên VPS |
| `VPS_APP_DIR` | `/srv/deliveryapp` | Thư mục chứa `docker-compose*.yml` + `.env` |
| `GHCR_USERNAME` | GitHub username (lowercase) | Để VPS đăng nhập GHCR |
| `GHCR_TOKEN` | PAT vừa tạo ở mục 2 | scope `read:packages` |

---

## 4. Chạy thử trên VPS lần đầu

Trước khi để Actions tự deploy, build & chạy 1 lần thủ công để chắc DB migration OK:

```bash
cd /srv/deliveryapp

# Login GHCR (dùng cùng PAT)
echo $GHCR_TOKEN | docker login ghcr.io -u <github-username> --password-stdin

# Pull và start
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Theo dõi log
docker compose logs -f api web
```

Truy cập `http://<VPS_HOST>/` — nếu thấy màn login là OK. Đăng nhập `admin / admin123` (đổi mật khẩu ngay sau khi vào).

---

## 5. Pipeline tự động

Sau khi đã cấu hình xong: **mỗi `git push origin main`** sẽ kích hoạt `.github/workflows/deploy.yml`:

1. **`build-and-push` job**:
   - Build 2 image (`api`, `web`) song song với layer cache GHA.
   - Push lên `ghcr.io/<owner>/deliveryapp-{api,web}` với 2 tag: `latest` + `<sha-7-chars>`.
2. **`deploy` job** (chỉ chạy nếu branch là `main`):
   - SSH vào VPS, `docker login ghcr.io`, `docker compose pull && up -d` với `IMAGE_TAG=<sha>`.
   - Prune image cũ.

Build mất ~3–5 phút sau lần đầu (lần đầu ~8 phút do chưa có cache).

---

## 6. Rollback

Mỗi build đều push tag `<sha>`. Để quay về bản cũ:

```bash
cd /srv/deliveryapp
export IMAGE_TAG=<sha-cũ-7-chars>     # ví dụ: d87490c
docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## 7. Vận hành thường ngày

| Tác vụ | Lệnh |
|---|---|
| Xem log realtime | `docker compose logs -f api` |
| Restart 1 service | `docker compose restart api` |
| Vào shell container | `docker compose exec api bash` |
| Backup DB thủ công | `docker compose exec db pg_dump -U postgres delivery_db > backup_$(date +%F).sql` |
| Restore DB | `cat backup.sql \| docker compose exec -T db psql -U postgres delivery_db` |
| Xem dung lượng volume | `docker system df -v` |
| Cập nhật Postgres | đổi tag `postgres:16-alpine` → `postgres:17-alpine` trong `docker-compose.yml`, test trên staging trước |

---

## 8. Persistence

3 volume Docker được tạo:

- `db_data` — PostgreSQL data files (mất → mất toàn bộ DB).
- `api_wwwroot` — ảnh giao hàng do shipper upload (nếu chưa bật R2).
- `api_backups` — output của `BackupScheduler` (nightly `pg_dump`).

**Khuyến nghị**: Cron job ngoài Docker rsync `api_backups` lên storage khác (S3, R2, NAS) hằng đêm.

---

## 9. Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Giải pháp |
|---|---|---|
| `502 Bad Gateway` ở web | API chưa khởi động xong / crash | `docker compose logs api` |
| `relation "Users" does not exist` | Migration chưa chạy | Program.cs đã có `db.Database.Migrate()` lúc start — kiểm tra log API |
| GitHub Actions fail `unauthorized` ở push | Repo Settings → Actions → Workflow permissions chưa bật `Read and write` | Bật permission đó |
| VPS pull `denied` | Token thiếu scope `read:packages` | Tạo lại token với scope đúng |
| SignalR cứ disconnect | nginx thiếu Upgrade/Connection header | Đảm bảo dùng `nginx.conf` trong repo (đã có) |
| Container không lấy được env mới | `.env` đổi nhưng chưa restart | `docker compose up -d` (Compose tự nhận diện đổi env và recreate) |

---

## 10. Bổ sung nếu muốn HTTPS

Cách nhanh nhất: dùng **Caddy** ngoài compose, hoặc thêm 1 service `caddy` proxy port 443 → `web:80`. Mẫu Caddyfile:

```caddyfile
your-domain.example.com {
    reverse_proxy web:80
}
```

Caddy tự xin Let's Encrypt cert, auto-renew, không cần config thêm.
