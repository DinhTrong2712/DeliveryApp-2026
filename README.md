# Hệ thống Quản lý Giao hàng & Thu tiền

Ứng dụng quản lý quy trình giao hàng FMCG nội bộ: kế toán nhập đơn từ Excel → admin điều phối → shipper giao hàng và thu tiền → đối soát giao dịch ngân hàng tự động qua webhook SePay.

> Tài liệu kỹ thuật đầy đủ: [`DeliveryApp.md`](./DeliveryApp.md)

---

## Stack

- **Backend:** ASP.NET Core 8 (.NET 8), EF Core 8, Npgsql, JWT Bearer, SignalR, BCrypt, EPPlus, ImageSharp, AWSSDK.S3 (Cloudflare R2)
- **Frontend:** React 19 + Vite 8 + TypeScript, Tailwind CSS v4, React Router v7, Zustand, @tanstack/react-query, axios, @microsoft/signalr
- **Database:** PostgreSQL 14+ (`delivery_db`, 9 bảng, auto-migrate khi startup)
- **Tích hợp ngoài:** SePay (webhook), VietQR.io, Cloudflare R2 (ảnh), OpenRouter / OpenAI / Anthropic / Gemini (AI text-to-SQL)

---

## Yêu cầu

- .NET SDK 8.0
- Node.js 20+
- PostgreSQL 14+
- (Tuỳ chọn) ngrok — test webhook SePay từ máy local

---

## Cài đặt nhanh

### 1. Cấu hình database

Tạo database PostgreSQL `delivery_db`, sau đó tạo file `DeliveryApp.API/appsettings.Local.json` (đã gitignored) để override connection string:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=delivery_db;Username=postgres;Password=YOUR_PASSWORD"
  }
}
```

> File `appsettings.json` mặc định chỉ chứa placeholder; password thật để trong `appsettings.Local.json` (không commit). `Program.cs` tự load file Local nếu có.

Migrations + seed chạy tự động khi backend khởi động (`db.Database.Migrate()`).

### 2. Chạy backend

```bash
cd DeliveryApp.API
dotnet run
```

API: `http://localhost:5036`

### 3. Chạy frontend

```bash
cd shipper-frontend
npm install
npx vite --port 5173
```

Frontend: `http://localhost:5173` (Vite proxy `/api` → `http://localhost:5036`)

---

## Tài khoản mặc định

| Vai trò | Tài khoản | Mật khẩu |
|---|---|---|
| Admin | `admin` | `admin123` |
| Accountant | `ketoan` | `ketoan123` |
| Shipper | `giaohang` / `truong` / `hung` / `hieu` | (xem `DeliveryApp.md`) |

---

## Phân quyền & route chính

| Role | Trang chính |
|---|---|
| Shipper | `/shipper/orders`, `/shipper/routes`, `/shipper/transfers`, `/shipper/ai` |
| Accountant | `/accountant/dashboard`, `/accountant/orders`, `/accountant/import`, `/accountant/unmatched`, `/accountant/reports` |
| Admin | `/admin/users`, `/admin/routes`, `/admin/sepay`, `/admin/config`, `/admin/audit-logs` |

---

## Cấu hình production

Các giá trị nhạy cảm nên cập nhật qua UI Admin (lưu vào bảng `SystemConfigs`, mã hoá AES-256), không sửa `appsettings.json`:

- **JWT Secret** — `appsettings.Jwt.Secret`, ≥ 64 ký tự
- **SePay** — API key / HMAC secret (Admin → Cài đặt → SePay)
- **VietQR** — clientId + apiKey + thông tin tài khoản (Admin → Cài đặt → VietQR)
- **AI** — provider + model + API key (Admin → Cài đặt → AI)
- **Cloudflare R2** — `appsettings.R2.*` (BucketName, Endpoint, AccessKey, SecretKey)

### Deploy lên VPS (HTTPS qua Caddy + Let's Encrypt)

Stack production: `Caddy` (TLS, 80/443) → `web` (Nginx + SPA) → `api` (.NET) → `db` (Postgres).

1. **Trỏ domain về VPS:** tạo A record `delivery.example.com → <IP-VPS>`. Đợi DNS propagate (`dig +short delivery.example.com` phải trả IP đúng).
2. **Mở firewall** port `80` và `443` trên VPS (UFW/Security Group).
3. **Tạo `.env`** trên VPS từ `.env.example`, đặt:
   ```
   PUBLIC_DOMAIN=delivery.example.com
   ACME_EMAIL=you@example.com
   PUBLIC_ORIGIN=https://delivery.example.com
   ```
4. **Start stack:**
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   docker compose logs -f caddy   # xem Caddy issue cert
   ```
   Lần đầu Caddy sẽ chạy ACME HTTP-01 challenge và lấy cert (~10-30s). Cert auto-renew sau đó.
5. **Khai báo webhook SePay** ở https://my.sepay.vn → URL: `https://delivery.example.com/api/webhooks/sepay`.

### Test webhook SePay từ máy local (chưa có domain)

Dùng ngrok để có HTTPS URL tạm:
```bash
ngrok http 5036
# Khai trên SePay URL: https://<random>.ngrok-free.app/api/webhooks/sepay
```

---

## Build / Publish

```bash
# Backend → publish_out/
cd DeliveryApp.API && dotnet publish -c Release -o publish_out

# Frontend → dist/
cd shipper-frontend && npm run build
```

---

## Kiến trúc

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  shipper-frontend       │ ──HTTP──►  DeliveryApp.API        │
│  React 19 + Vite + TS   │ ◄─SignalR  ASP.NET Core 8         │
│  Tailwind v4 / Zustand  │         │  EF Core 8 + Npgsql     │
└─────────────────────────┘         │  JWT Bearer Auth        │
                                    └──────┬──────────────────┘
                                           │
                                  ┌────────▼────────┐
                                  │  PostgreSQL     │
                                  │  delivery_db    │
                                  └─────────────────┘
                                           ▲
                          ┌────────────────┴───────────────┐
                          │  SePay webhook (HMAC)          │
                          │  VietQR API                    │
                          │  OpenRouter/OpenAI/Anthropic   │
                          │  Cloudflare R2 (ảnh)           │
                          └────────────────────────────────┘
```

---

## Tính năng chính

- **Import Excel** — auto-detect cột, match shipper theo `XlsxName`, preview trước khi confirm, update đơn trùng OrderCode.
- **Quản lý đơn** — CRUD, override field có audit, lịch sử thay đổi, lock time (mặc định 23:59).
- **Đơn gộp (Routes)** — group đơn theo RouteCode, đổi NV cho cả route, Admin có thể xoá.
- **SePay auto-match** — webhook verify HMAC/static key, match theo OrderCode trong nội dung CK, dedup, emit SignalR.
- **SePay manual match** — kế toán gán giao dịch chưa khớp vào đơn.
- **AI Chat (text-to-SQL)** — hỏi đáp tiếng Việt, validate chỉ SELECT, multi-provider, retry 1 lần khi lỗi SQL.
- **Audit Log** — 17 action codes, filter theo action/username/orderCode.
- **Backup / Restore** — download/upload `.sql` (pg_dump), backup tự động 2:00 AM.
- **VietQR** — sinh QR thanh toán theo tài khoản cấu hình.
- **Real-time** — SignalR groups `shipper-{id}`, `accountants` cho cập nhật status / SePay matched / unmatched.

---

## Tài liệu

- [`DeliveryApp.md`](./DeliveryApp.md) — Tài liệu tổng hợp: kiến trúc, schema, API endpoints, luồng nghiệp vụ, bảo mật, vận hành.
