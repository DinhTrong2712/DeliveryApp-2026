# DeliveryApp — Tài liệu tổng hợp

> Hệ thống quản lý giao hàng nội bộ cho **Công ty TNHH Khương Phúc — NPP Hương Cường** (nhà phân phối FMCG khu vực Thái Nguyên).
> Tài liệu này tổng hợp toàn bộ kiến trúc, công nghệ, cấu trúc thư mục, dữ liệu, API, luồng nghiệp vụ và yêu cầu vận hành của dự án.

---

## 1. Tổng quan dự án

### 1.1 Mục tiêu nghiệp vụ
- Quản lý toàn bộ quy trình giao hàng FMCG: kế toán nhập đơn từ Excel → admin điều phối → shipper giao hàng và thu tiền → đối soát giao dịch ngân hàng tự động qua webhook SePay.
- Phục vụ 3 nhóm người dùng: **Admin**, **Accountant** (kế toán), **Shipper** (nhân viên giao hàng).
- Tự động khớp giao dịch chuyển khoản với đơn hàng theo nội dung CK (nội dung chứa OrderCode).
- Báo cáo doanh thu / công nợ theo ngày, tuyến, nhân viên.
- Trợ lý AI hỏi đáp dữ liệu bằng tiếng Việt (text-to-SQL).
- Lịch sử thao tác (Audit Log) đầy đủ phục vụ kiểm toán nội bộ.

### 1.2 Phạm vi
- Web app desktop + responsive mobile cho shipper.
- Single tenant (1 công ty), database PostgreSQL local.
- Triển khai on-premise (chạy bằng `dotnet run` + Vite dev server hoặc bundle ra `publish_out`).

### 1.3 Người dùng & vai trò
| Vai trò | Tài khoản mặc định | Quyền chính |
|---|---|---|
| **Admin** | `admin` / `admin123` | Quản lý người dùng, cấu hình hệ thống (VietQR, SePay, AI), audit logs, tất cả tính năng kế toán. |
| **Accountant** | `ketoan` / `ketoan123` | Import Excel, dashboard, danh sách đơn, đơn gộp, đối soát SePay, báo cáo, AI chat. |
| **Shipper** | `giaohang/Manh`, `truong/Trường`, `hung/Hùng`, `hieu/Hiệu` | Xem đơn được giao, cập nhật trạng thái thu tiền, chụp ảnh giao hàng, cập nhật ghi chú. |

---

## 2. Kiến trúc tổng thể

```
┌─────────────────────────┐         ┌─────────────────────────┐
│  shipper-frontend       │         │  DeliveryApp.API        │
│  React 19 + Vite + TS   │ ──HTTP─►│  ASP.NET Core 8 (.NET 8)│
│  Tailwind CSS v4        │ ◄─SignalR─ │  EF Core 8 + Npgsql  │
│  React Router v7        │         │  JWT Bearer Auth        │
│  Zustand store          │         └──────┬──────────────────┘
└─────────────────────────┘                │
            │                               │
   localhost:5173                  ┌────────▼────────┐
                                   │  PostgreSQL     │
                                   │  delivery_db    │
                                   └─────────────────┘
                                            ▲
                              ┌─────────────┴──────────────┐
                              │  External integrations     │
                              │  - SePay webhook (HMAC)    │
                              │  - VietQR API              │
                              │  - OpenRouter / OpenAI /   │
                              │    Anthropic / Gemini      │
                              │  - Cloudflare R2 (ảnh)     │
                              └────────────────────────────┘
```

### 2.1 Stack Backend
| Lớp | Công nghệ | Phiên bản |
|---|---|---|
| Runtime | .NET | 8.0 |
| Framework | ASP.NET Core (Web API) | 8.0 |
| ORM | Entity Framework Core | 8.0.* |
| DB driver | Npgsql.EntityFrameworkCore.PostgreSQL | 8.0.* |
| Auth | Microsoft.AspNetCore.Authentication.JwtBearer | 8.0.* |
| Realtime | SignalR Server + Client | 8.0.* / 10.0.0 |
| Hash mật khẩu | BCrypt.Net-Next | 4.0.3 |
| Excel | EPPlus | 7.5.3 |
| Image processing | SixLabors.ImageSharp | 3.1.* |
| Object storage | AWSSDK.S3 (compatible Cloudflare R2) | 3.7.* |

### 2.2 Stack Frontend
| Lớp | Công nghệ | Phiên bản |
|---|---|---|
| UI library | React | 19.2.4 |
| Bundler | Vite | 8.0.4 |
| Language | TypeScript | ~6.0.2 |
| Styling | Tailwind CSS (v4 — CSS-only config) | 4.2.2 |
| Routing | react-router-dom | 7.14.1 |
| State | Zustand | 5.0.12 |
| Data fetching | @tanstack/react-query | 5.99.0 |
| HTTP | axios | 1.15.0 |
| Realtime | @microsoft/signalr | 10.0.0 |
| Date utils | date-fns | 4.1.0 |
| Linting | ESLint + typescript-eslint | 9.39.4 / 8.58.0 |

### 2.3 Database
- PostgreSQL (local), database `delivery_db`, user `postgres`, password `123` (dev).
- Charset UTF-8, hỗ trợ tiếng Việt có dấu.
- 9 bảng + auto migrations qua EF Core (`db.Database.Migrate()` chạy lúc startup).

---

## 3. Cấu trúc thư mục

```
C:\Projects\DeliveryApp\
├── DeliveryApp.sln                       — Visual Studio solution
├── DeliveryApp.md                        — (file này) tài liệu tổng hợp
├── README.md                             — README rút gọn
├── convert_csv_to_xlsx.py                — script tiện ích (dev tool)
├── DG24007443.csv / .xlsx                — file mẫu test import
├── test_sepay_secret.sh                  — script test HMAC SePay
│
├── DeliveryApp.API/                      — Backend ASP.NET Core
│   ├── Program.cs                        — Entry point + DI + middleware pipeline
│   ├── DeliveryApp.API.csproj            — Project file
│   ├── appsettings.json                  — Cấu hình mặc định
│   ├── appsettings.Development.json      — Override dev
│   │
│   ├── Controllers/                      — 10 REST controllers
│   │   ├── AuthController.cs             — login / logout
│   │   ├── AdminController.cs            — users, system config, audit logs
│   │   ├── OrdersController.cs           — CRUD đơn hàng + status update
│   │   ├── RoutesController.cs           — đơn gộp (group theo RouteCode)
│   │   ├── ImportController.cs           — preview + confirm import Excel
│   │   ├── SePayController.cs            — webhook + assign/unassign
│   │   ├── PhotosController.cs           — upload/xoá ảnh giao hàng
│   │   ├── DashboardController.cs        — số liệu tổng quan
│   │   ├── ReportsController.cs          — báo cáo doanh thu/shipper
│   │   └── AiController.cs               — AI chat endpoint
│   │
│   ├── Services/                         — 8 business services (DI scoped)
│   │   ├── AuthService.cs                — JWT + BCrypt verify
│   │   ├── AuditService.cs               — helper ghi AuditLog
│   │   ├── OrderService.cs               — UpdateStatus, Override, Note...
│   │   ├── ImportService.cs              — parse XLSX, detect cột, confirm
│   │   ├── SePayService.cs               — verify webhook (HMAC), match
│   │   ├── PhotoService.cs               — compress + upload R2
│   │   ├── ReportService.cs              — daily report
│   │   └── AiChatService.cs              — text-to-SQL multi-provider
│   │
│   ├── Models/                           — 9 entity classes
│   │   ├── User.cs                       — Username, PasswordHash, Role, XlsxName
│   │   ├── Order.cs                      — đơn hàng
│   │   ├── OrderPhoto.cs                 — ảnh giao hàng (URL R2)
│   │   ├── OrderHistory.cs               — lịch sử thay đổi field
│   │   ├── SePayTransaction.cs           — giao dịch CK
│   │   ├── ImportLog.cs                  — log import Excel
│   │   ├── WebhookLog.cs                 — raw payload SePay
│   │   ├── SystemConfig.cs               — key/value cấu hình
│   │   ├── AuditLog.cs                   — lịch sử thao tác hệ thống
│   │   └── Enums.cs                      — UserRole, OrderStatus, MatchStatus
│   │
│   ├── DTOs/                             — DTO group theo domain
│   │   ├── Admin/AdminDtos.cs
│   │   ├── Auth/AuthDtos.cs
│   │   ├── Dashboard/
│   │   └── Orders/
│   │
│   ├── Data/AppDbContext.cs              — DbContext + seed admin + system_config
│   │
│   ├── Migrations/                       — EF Core migrations (timestamped)
│   │   ├── 20260414062028_InitialCreate
│   │   ├── 20260414071724_AddAuditLogAndQrConfig
│   │   ├── 20260414125142_RenameToSePay
│   │   ├── 20260415101455_ResetAdminPassword
│   │   ├── 20260508141907_AddShipperNameXlsx
│   │   └── 20260508150238_AddUpdatedRowsToImportLog
│   │
│   └── Hubs/DeliveryHub.cs               — SignalR hub (groups: shipper-{id}, accountants)
│
└── shipper-frontend/                     — Frontend React + Vite
    ├── package.json
    ├── vite.config.ts                    — proxy /api → http://localhost:5036
    ├── tsconfig.json
    ├── eslint.config.js
    ├── index.html
    └── src/
        ├── main.tsx                      — ReactDOM render
        ├── App.tsx                       — BrowserRouter + RequireAuth wrapper
        ├── index.css                     — Tailwind import + global polish
        ├── App.css                       — (legacy, ít dùng)
        │
        ├── pages/
        │   ├── Home.tsx                  — landing marketing (orange brand)
        │   ├── Login.tsx                  — login + back to home
        │   ├── shipper/
        │   │   ├── OrderList.tsx
        │   │   ├── OrderDetail.tsx
        │   │   ├── UpdatePayment.tsx
        │   │   ├── NotePhoto.tsx
        │   │   ├── ShipperRoutes.tsx
        │   │   ├── ShipperTransfers.tsx
        │   │   └── AiChat.tsx
        │   ├── accountant/
        │   │   ├── Dashboard.tsx
        │   │   ├── OrderPool.tsx
        │   │   ├── OrderDetail.tsx
        │   │   ├── AccountantRoutes.tsx
        │   │   ├── ImportXlsx.tsx
        │   │   ├── UnmatchedTx.tsx
        │   │   ├── Reports.tsx
        │   │   └── AiChat.tsx
        │   └── admin/
        │       ├── Users.tsx
        │       ├── RouteManagement.tsx
        │       ├── SePayPage.tsx
        │       ├── Config.tsx
        │       └── AuditLogs.tsx
        │
        ├── components/
        │   ├── AdminLayout.tsx           — top nav cho Admin
        │   ├── AccountantLayout.tsx      — top nav cho Accountant
        │   ├── AccountantNav.tsx
        │   ├── ShipperLayout.tsx         — bottom nav mobile
        │   ├── OrderCard.tsx
        │   └── StatusBadge.tsx
        │
        ├── stores/authStore.ts           — Zustand: token + user, logout call API
        ├── lib/
        │   ├── api.ts                    — axios instance (auto-attach JWT)
        │   ├── formatters.ts             — formatVND, formatDate
        │   └── constants.ts              — ORDER_STATUS_LABELS / COLORS
        ├── hooks/                        — custom hooks
        └── assets/                       — static assets
```

---

## 4. Mô hình dữ liệu (Entity / Schema)

### 4.1 `Users` — người dùng
| Field | Type | Note |
|---|---|---|
| Id | uuid (PK) | |
| Username | varchar(100) UNIQUE | |
| PasswordHash | text | BCrypt |
| FullName | varchar(200) | |
| Role | varchar (enum) | `Admin` / `Accountant` / `Shipper` |
| XlsxName | varchar(200) NULL | Tên trong file Excel để match khi import (vd `"Kho - Mạnh giao hàng"`) |
| IsActive | bool | |
| CreatedAt / UpdatedAt | timestamp | |

### 4.2 `Orders` — đơn hàng
| Field | Type | Note |
|---|---|---|
| Id | uuid (PK) | |
| OrderCode | varchar(50) UNIQUE | Mã đơn từ file Excel |
| RouteCode | varchar(50) NULL | Mã đơn gộp (nhiều đơn cùng tuyến) |
| CustomerName | varchar(300) | |
| Amount | decimal(18,0) | Tổng cần thu |
| AmountPaid | decimal(18,0) | Đã thu |
| AmountRemaining | computed (NotMapped) | = Amount - AmountPaid |
| Status | varchar (enum) | xem 4.7 |
| ShipperId | uuid FK → Users (SetNull) | |
| ShipperNameXlsx | varchar(200) NULL | Tên gốc trong Excel (giữ nguyên text) |
| ImportId | uuid FK → ImportLogs (SetNull) | |
| OriginNote | varchar(500) NULL | Diễn giải từ Excel |
| UnpaidReason | varchar(500) NULL | |
| ScheduledDate | timestamp NULL | Hẹn lại |
| DeliveredAt | timestamp NULL | |
| ShipperNote | varchar(1000) NULL | |
| AccountantNote | varchar(1000) NULL | Chỉ Accountant/Admin xem |
| LockedAt | timestamp NULL | |
| CreatedAt / UpdatedAt | timestamp | |

### 4.3 `OrderPhotos` — ảnh giao hàng
- Id, OrderId FK, Url (Cloudflare R2), Caption, CreatedAt.
- Tối đa 5 ảnh/đơn, nén ≤ 1920px, JPEG quality 80, ≤ 10MB input.

### 4.4 `OrderHistories` — lịch sử thay đổi field
- Id, OrderId FK, ChangedBy (username), FieldChanged, OldValue, NewValue, Reason, CreatedAt.
- Ghi mỗi khi status đổi hoặc Override field.

### 4.5 `SePayTransactions` — giao dịch chuyển khoản
| Field | Type | Note |
|---|---|---|
| Id | uuid PK | |
| TransactionCode | varchar UNIQUE | Mã từ SePay |
| Amount | decimal | |
| Content / Gateway / AccountNumber | varchar | |
| TransactionDate | timestamp | UTC |
| OrderId | uuid FK NULL | |
| MatchStatus | enum | `Unmatched` / `AutoMatched` / `ManualMatched` |
| MatchedBy / MatchedAt | varchar / timestamp | |
| ReferenceCode | varchar | |
| RawPayload | text | JSON gốc |

### 4.6 `WebhookLogs` — raw webhook
- Id, RawBody, Headers (string flatten), ResponseCode (`00`/`02`/`09`/`xx`), ErrorMessage, CreatedAt.
- Mọi webhook (kể cả lỗi auth) đều được ghi để debug.

### 4.7 `ImportLogs` — log import Excel
- Id, FileName, TotalRows, ImportedRows, SkippedRows, **UpdatedRows**, ImportedBy, CreatedAt.

### 4.8 `SystemConfigs` — cấu hình động (admin chỉnh nóng)
Key/Value uniqueness. Các key dùng:
- `lock_time` — giờ khoá đơn hàng (vd `23:59`)
- `sepay_apikey` — API key/HMAC secret SePay
- `vietqr_clientid`, `vietqr_apikey`
- `vietqr_bank_1` / `_2`, `vietqr_account_number_1` / `_2`, `vietqr_account_name_1` / `_2`
- `qr_bank_name`, `qr_account_number`, `qr_account_name` (legacy)
- `ai_api_key`, `ai_provider`, `ai_model`

### 4.9 `AuditLogs` — lịch sử thao tác
| Field | Type |
|---|---|
| Id | uuid PK |
| UserId | uuid NULL |
| Username | varchar(200) |
| Action | varchar(100) |
| EntityType | varchar(50) |
| EntityId | uuid NULL |
| OldValue / NewValue | text NULL |
| Description | varchar(500) NULL |
| CreatedAt | timestamp (indexed) |

**Action codes:**
`LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `UPDATE_STATUS`, `COLLECT_CASH`, `DELIVERED`, `UPDATE_ORDER`, `OVERRIDE_FIELD`, `IMPORT`, `UPDATE_ROUTE`, `DELETE_ROUTE`, `AUTO_MATCH`, `MANUAL_MATCH`, `UNMATCH`, `NOTE_PHOTO`, `UPDATE_CONFIG`, `UPDATE_SEPAY_APIKEY`, `UPDATE_AI_KEY`.

### 4.10 Enum mappings
```csharp
UserRole    : Admin, Accountant, Shipper
OrderStatus : Unassigned, Pending, WaitingTransfer, PaidCash, PaidTransfer, Partial, Scheduled, Unpaid
MatchStatus : Unmatched, AutoMatched, ManualMatched
```

---

## 5. API endpoints (REST)

> Base URL: `http://localhost:5036/api`. Tất cả endpoint trừ `/auth/login`, `/webhooks/sepay`, `/orders/{id}/qr` đều yêu cầu JWT Bearer.

### 5.1 Auth (`/auth`)
| Method | Path | Role | Mô tả |
|---|---|---|---|
| POST | `/login` | — | Body: `{username, password}`, trả `{token, expiresAt, user}` |
| POST | `/logout` | Authenticated | Ghi audit `LOGOUT`, frontend tự xoá token |

### 5.2 Orders (`/orders`)
| Method | Path | Role | Mô tả |
|---|---|---|---|
| GET | `/` | Auth | Query: `status`, `shipperId`, `date`, `search`, `page`, `pageSize` |
| GET | `/{id}` | Auth | Detail (Shipper chỉ xem đơn của mình) |
| PATCH | `/{id}/status` | Shipper | Body: `{status, amountPaid?, unpaidReason?, scheduledDate?, note?}` |
| PATCH | `/{id}/delivered` | Shipper | Đánh dấu đã giao |
| PATCH | `/{id}/note` | Shipper | Cập nhật ghi chú shipper |
| PATCH | `/{id}/accountant-note` | Accountant/Admin | |
| PATCH | `/{id}/override` | Accountant/Admin | Body: `{field, value, reason}` — ghi đè Status / AmountPaid / ShipperNote |
| GET | `/{id}/history` | Accountant/Admin | |
| GET | `/{id}/qr?account=1` | Auth | Trả VietQR URL |

### 5.3 Routes (`/routes`) — đơn gộp
| Method | Path | Role |
|---|---|---|
| GET | `/` | Accountant/Admin |
| GET | `/{routeCode}` | Accountant/Admin — chi tiết đơn trong route |
| PUT | `/{routeCode}` | Accountant/Admin — đổi NV cho cả route |
| DELETE | `/{routeCode}` | **Admin** — xoá toàn bộ đơn trong route |

### 5.4 Import Excel (`/import`)
| Method | Path | Role |
|---|---|---|
| POST | `/` | Accountant/Admin — multipart file `.xlsx`, trả preview |
| POST | `/confirm` | Accountant/Admin — body: `{importId}`, ghi DB |
| GET | `/logs` | Accountant/Admin |

### 5.5 SePay (`/sepay`, `/webhooks/sepay`)
| Method | Path | Role |
|---|---|---|
| POST | `/webhooks/sepay` | **AllowAnonymous** — verify HMAC/static key |
| GET | `/sepay/unmatched` | Auth (có Shipper) |
| GET | `/sepay/stats` | Accountant/Admin |
| GET | `/sepay/transactions` | Accountant/Admin |
| GET | `/sepay/webhook-logs` | Accountant/Admin |
| POST | `/sepay/assign` | Accountant/Admin — body: `{transactionId, orderId}` |
| DELETE | `/sepay/transactions/{id}/match` | Accountant/Admin — bỏ khớp |

### 5.6 Photos (`/orders/{orderId}/photos`)
| Method | Path | Role |
|---|---|---|
| POST | `/` | Shipper |
| DELETE | `/{photoId}` | Shipper |

### 5.7 Admin (`/admin`)
| Method | Path | Mô tả |
|---|---|---|
| GET / POST / PUT / DELETE | `/users` | CRUD user |
| GET | `/config` | Lấy lock_time, qr_* |
| PUT | `/config` | Cập nhật |
| GET / PUT | `/config/vietqr` | Cấu hình VietQR + AES-256 cho API key |
| POST | `/config/vietqr/generate-qr` | Test tạo QR |
| PUT | `/config/sepay-apikey` | |
| GET / PUT | `/config/ai`, `/config/ai-key` | Provider + model + key |
| GET | `/audit-logs` | Query: `page`, `pageSize`, `search`, `action` |
| GET | `/backup/download` | SQL dump (.sql) |
| POST | `/backup/restore` | Upload .sql để restore |

### 5.8 Dashboard / Reports
| Method | Path | Mô tả |
|---|---|---|
| GET | `/dashboard` | Tổng quan hôm nay (đơn, doanh thu, % giao) |
| GET | `/reports/daily` | Báo cáo theo ngày + group shipper |

### 5.9 AI (`/ai`)
| Method | Path | Mô tả |
|---|---|---|
| POST | `/chat` | Body: `{question, sessionId?}` — text-to-SQL |

### 5.10 SignalR Hub (`/hubs/delivery`)
- Auth qua query string `?access_token=...`.
- Groups: `shipper-{userId}`, `accountants`.
- Events emit:
  - `OrderStatusUpdated` `{id, orderCode, newStatus, amountPaid, updatedBy}`
  - `SePayMatched` `{id, orderCode, transactionCode, amount}`
  - `UnmatchedTransaction` `{transactionCode, amount, content, gateway}`

---

## 6. Luồng nghiệp vụ chính

### 6.1 Import Excel (kế toán)
1. Upload `.xlsx` → server detect cột tự động (alias: "Mã đơn", "Mã giao dịch", "Order Code"...).
2. Header có thể nằm ở row 1–5; chuẩn hoá tên shipper bỏ dấu + gộp space quanh `-` để match (`"Kho - Mạnh giao hàng"` ≡ `"Kho-Mạnh giao hàng"` ≡ `User.XlsxName`).
3. Trả preview + summary (matched/unmatched/total amount) + warnings.
4. User confirm → server insert đơn mới, **update đơn trùng OrderCode** (chỉ update Status nếu đơn đang `Pending`/`Unassigned`, giữ nguyên dữ liệu shipper đã thu).
5. Audit `IMPORT` ghi số liệu.

### 6.2 Cập nhật trạng thái đơn (shipper)
- Status flow:
  - `Unassigned` → (admin gán shipper) → `Pending`
  - `Pending` → `PaidCash` (thu tiền mặt) / `WaitingTransfer` (chờ CK) / `Unpaid` (không thu được, có lý do) / `Scheduled` (hẹn lại)
  - `WaitingTransfer` → `PaidTransfer` (auto qua SePay) / `Partial` (CK 1 phần)
- Lock time mặc định `23:59` — sau giờ này shipper không sửa được đơn.
- Mỗi lần đổi status ghi `OrderHistories` + `AuditLogs (UPDATE_STATUS / COLLECT_CASH)` + emit SignalR.

### 6.3 SePay webhook (auto-match)
1. SePay POST raw JSON đến `/api/webhooks/sepay`.
2. Verify bằng **1 trong 2** cách:
   - Static API key: header `Authorization: Apikey ...` hoặc `x-api-key`.
   - HMAC SHA256: header `X-Sepay-Signature: sha256=<hex>` của `HMAC(secret, rawBody)`.
3. Bỏ qua nếu `transferType != "in"` (chỉ tiền vào).
4. Dedup theo `referenceCode` (hoặc `id`).
5. Match: tìm đơn có `Status = WaitingTransfer` mà `Content` chứa `OrderCode` (uppercase).
6. Match thành công → cập nhật Status (`PaidTransfer` nếu đủ, `Partial` nếu thiếu), ghi `OrderHistories`, ghi audit `AUTO_MATCH`, emit SignalR `SePayMatched` cho shipper + accountants.
7. Không match → vẫn lưu transaction với `MatchStatus = Unmatched`, emit `UnmatchedTransaction`.

### 6.4 SePay manual match (kế toán)
- Bảng "Khớp giao dịch" (`/accountant/unmatched`): list giao dịch chưa khớp + chọn đơn để gán.
- POST `/sepay/assign` → cập nhật Status đơn + ghi audit `MANUAL_MATCH`.
- DELETE `/sepay/transactions/{id}/match` → trả đơn về `WaitingTransfer`, audit `UNMATCH`.

### 6.5 AI Chat (text-to-SQL)
- Endpoint `/ai/chat` nhận `{question, sessionId}`.
- 3 bước trong service:
  1. Build prompt SQL với schema DB + lịch sử hội thoại 6 turn cuối.
  2. Gọi LLM (4 provider: OpenRouter / OpenAI / Anthropic / Gemini), regex extract block ```sql.
  3. Validate **chỉ SELECT** (chặn INSERT/UPDATE/DELETE/DROP/...), execute với timeout 15s.
  4. Nếu lỗi SQL → tự retry 1 lần với error message.
  5. Build prompt summary để LLM trả lời tự nhiên + trả `{answer, sqlQuery, tableData}`.
- Session in-memory `ConcurrentDictionary`, idle 2h auto-purge, giữ 20 turn gần nhất.

### 6.6 Audit log
Tự động ghi 17 loại action (xem 4.9). `AuditService.LogAsync()` lấy username từ `HttpContext`, `Add()` cho phép gắn vào transaction service. Filter UI theo action + search theo orderCode/username.

---

## 7. Cấu hình & môi trường

### 7.1 `appsettings.json` (key chính)
```json
{
  "ConnectionStrings": { "DefaultConnection": "Host=localhost;Database=delivery_db;Username=postgres;Password=123" },
  "Jwt": { "Secret": "...64chars...", "Issuer": "DeliveryApp", "Audience": "DeliveryApp" },
  "App": { "LockTime": "23:59" },
  "Cors": { "Origins": ["http://localhost:5173"] },
  "SePay": { "ApiKey": "" },
  "AI": { "Provider": "openrouter", "Model": "deepseek/deepseek-chat-v3.1", "ApiKey": "" },
  "R2": { "BucketName": "", "Endpoint": "", "AccessKey": "", "SecretKey": "" }
}
```

### 7.2 SystemConfigs (chỉnh nóng từ UI Admin)
- Tất cả setting nhạy cảm (API key, secret) lưu vào `SystemConfigs.Value` thay vì `appsettings`.
- Service load theo thứ tự: **DB → appsettings → default**.

### 7.3 Frontend env
- Vite proxy `/api` → `http://localhost:5036` (cấu hình trong `vite.config.ts`).
- Không cần `.env` cho dev — token và session lưu `localStorage`.

### 7.4 ngrok (test webhook SePay với máy local)
- Đã cài ở `C:\Users\LOQ\ngrok\`.
- `ngrok http 5036` → SePay webhook URL = `https://<id>.ngrok-free.dev/api/webhooks/sepay`.
- URL đổi mỗi lần restart (gói free).

---

## 8. Vận hành

### 8.1 Khởi động dev
```bash
# Backend
cd C:/Projects/DeliveryApp/DeliveryApp.API
dotnet run                                # http://localhost:5036

# Frontend (terminal khác)
cd C:/Projects/DeliveryApp/shipper-frontend
npx vite --port 5173                      # http://localhost:5173
```

### 8.2 Build / Publish
```bash
# Backend → publish_out/
cd DeliveryApp.API
dotnet publish -c Release -o publish_out

# Frontend → dist/
cd shipper-frontend
npm run build                             # tsc -b && vite build
```

### 8.3 Migrations
```bash
cd DeliveryApp.API
dotnet ef migrations add <Name>
dotnet ef database update
```
> ⚠ Khi tạo migration, **xoá phần `UpdateData PasswordHash`** auto-generate (do BCrypt seed gây hash khác nhau mỗi lần) trước khi commit.

### 8.4 Backup / Restore
- UI Admin → Cài đặt → Sao lưu: tải `.sql` (pg_dump) hoặc upload restore (ghi đè).
- Backup tự động chạy hàng đêm 2:00 AM, lưu tại `~/backups/`.

### 8.5 Test smoke
- Login admin → `/admin/users`.
- Import file `.xlsx` test.
- Tạo đơn → đổi status → xem audit log có ghi không.
- Test webhook SePay qua ngrok.

---

## 9. Bảo mật

| Lớp | Cơ chế |
|---|---|
| Auth | JWT 24h, secret trong `appsettings.Jwt.Secret` (≥ 64 ký tự production) |
| Password | BCrypt (`.Net-Next` v4) |
| API key | Lưu mã hoá AES-256 trong `SystemConfigs` (VietQR / SePay / AI) |
| Webhook SePay | Static key **hoặc** HMAC SHA256 |
| AI SQL | Whitelist `SELECT` + blacklist 11 keywords (`INSERT/UPDATE/DELETE/DROP/...`), timeout 15s |
| RBAC | `[Authorize(Roles = "...")]` ở controller + `<RequireAuth roles>` frontend |
| CORS | `Cors:Origins` whitelist (mặc định `http://localhost:5173`) |
| Audit | Ghi mọi thao tác có ảnh hưởng (login, fail login, edit, delete, match...) |
| Lock time | Đơn không sửa được sau giờ cấu hình |

---

## 10. Yêu cầu hệ thống

### 10.1 Phần cứng đề xuất
- CPU: 2 core+
- RAM: 4 GB+ (server) / 2 GB+ (client)
- Disk: 10 GB cho DB + ảnh

### 10.2 Phần mềm cần cài
- **.NET SDK 8.0**
- **Node.js 20+** (cho Vite)
- **PostgreSQL 14+**
- **ngrok** (chỉ khi cần test webhook SePay từ máy local)
- Git, IDE (VS Code / Rider)

### 10.3 Tài khoản dịch vụ ngoài (tuỳ chọn)
- **OpenRouter** / **OpenAI** / **Anthropic** / **Google AI Studio** — cho AI chat.
- **VietQR.io** — clientId + apiKey để generate QR thanh toán.
- **SePay** — webhook auto-match giao dịch.
- **Cloudflare R2** — lưu ảnh giao hàng (tuỳ chọn; nếu không có, server trả URL placeholder).

---

## 11. Quy ước code (đã thống nhất)

### 11.1 Backend
- DTO theo domain (`DTOs/Auth/`, `DTOs/Orders/`...).
- Service inject vào controller; nghiệp vụ phức tạp → service.
- Audit dùng `AuditService.Add()` (trong transaction) hoặc `LogAsync()` (commit độc lập).
- Migration: **không commit phần UpdateData PasswordHash** auto-generated.
- SQL trả về dùng `o.ShipperNameXlsx ?? o.Shipper?.FullName` để ưu tiên tên gốc Excel.

### 11.2 Frontend
- Trang admin dùng `<AdminLayout>` (top nav desktop, max-w-screen-2xl).
- Bảng dữ liệu desktop (không card mobile cho admin).
- Modal `fixed inset-0 flex items-center justify-center` (giữa màn).
- Dùng `import type { ReactNode }` thay vì `import React`.
- Color brand: `#F26B2C` (orange-500) → `#D9521A` gradient — áp dụng Login + Home + accent toàn app.
- Animation: chỉ animate những gì *mount mới* (modal/toast); tránh transform trên element re-render.
- Tôn trọng `prefers-reduced-motion`.

---

## 12. Vấn đề đã biết / lưu ý

- **BCrypt.HashPassword trong HasData** là antipattern — sinh hash khác mỗi lần `migrations add`. Đã cố định bằng cách bỏ phần auto-gen UpdateData.
- **Vite v8 + React 19** mới ra, nếu gặp lỗi HMR thử restart server.
- **ngrok free URL đổi mỗi lần restart** — cần update lại trong SePay dashboard.
- **OpenRouter model `gemini-2.0-flash-exp:free` đã 404** — default đổi sang `deepseek/deepseek-chat-v3.1`.
- **R2 chưa cấu hình** → ảnh trả URL `/photos/placeholder/...` (không upload thật).

---

## 13. Roadmap (đề xuất)

### Đã làm gần đây (session 08–09/05/2026)
- Audit log đầy đủ 17 action (login/logout/match/edit/...)
- Refactor & clean code 7 file lớn
- AI Chat đa provider (OpenRouter / OpenAI / Anthropic / Gemini)
- Quản lý đơn gộp + import update (không skip)
- SePay HMAC verify
- UI polish + brand color cam đồng bộ
- Login có nút quay về Home

### Có thể làm tiếp
- [ ] Tách thành module: `Services/Ai/Providers/`, `Services/Import/`, `DTOs/Ai/`, `DTOs/SePay/` (đã có plan, chưa làm)
- [ ] Push notification mobile cho shipper
- [ ] Multi-tenant (nhiều công ty)
- [ ] Export báo cáo Excel
- [ ] Dark mode

---

## 14. Liên hệ & maintainer

- **Repo**: `C:\Projects\DeliveryApp\` (local)
- **Database**: PostgreSQL `delivery_db` @ `localhost:5432`
- **Người dùng dự án**: dtrongh27122004@gmail.com
- **Khách hàng**: Công ty TNHH Khương Phúc — NPP Hương Cường (Thái Nguyên)

---

*Tài liệu được cập nhật ngày 2026-05-09. Cập nhật lại khi schema/API/luồng nghiệp vụ thay đổi đáng kể.*
