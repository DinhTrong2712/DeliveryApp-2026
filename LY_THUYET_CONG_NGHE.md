# LÝ THUYẾT CÔNG NGHỆ SỬ DỤNG TRONG ĐỒ ÁN

**Đề tài:** Hệ thống sổ ghi chép giao hàng tích hợp AI — doanh nghiệp Khương Phúc
**Mục đích file này:** Tóm tắt ngắn gọn, dễ hiểu mọi công cụ / công nghệ / giao thức dùng trong project: lý thuyết cơ bản, ưu – nhược điểm, và **lý do chọn dùng**. Dùng để ôn tập và trả lời hội đồng.

> Kiến trúc tổng thể: **Trình duyệt (React PWA) → Caddy (HTTPS) → Nginx → API (ASP.NET Core) → PostgreSQL**, cộng các dịch vụ ngoài: **SePay, LLM API, Cloudflare R2**.

---

## 1. FRONTEND (giao diện người dùng)

### React 19
- **Lý thuyết:** Thư viện JavaScript xây giao diện theo **component** (khối UI tái sử dụng); dùng **Virtual DOM** để cập nhật màn hình hiệu quả khi dữ liệu đổi.
- **Ưu:** Hệ sinh thái lớn, tái sử dụng tốt, cập nhật UI nhanh. **Nhược:** Chỉ lo phần View (phải ghép thêm router, state…); người mới hơi khó.
- **Vì sao dùng:** Giao diện nhiều trạng thái thay đổi liên tục (đơn hàng, dashboard real-time) → mô hình component + reactive của React rất hợp.

### TypeScript
- **Lý thuyết:** JavaScript có **kiểu dữ liệu tĩnh** — bắt lỗi ngay khi code, trước khi chạy.
- **Ưu:** Ít bug, gợi ý code thông minh, dễ bảo trì. **Nhược:** Phải khai báo kiểu, biên dịch thêm một bước.
- **Vì sao dùng:** Dự án nhiều màn hình & API → kiểu tĩnh giúp tránh sai sót dữ liệu giữa frontend và backend.

### Vite
- **Lý thuyết:** Công cụ **build & dev server** thế hệ mới, chạy cực nhanh nhờ ES modules + esbuild.
- **Ưu:** Khởi động/nạp lại tức thì, cấu hình tối giản. **Nhược:** Còn mới hơn Webpack nên một số plugin cũ chưa hỗ trợ.
- **Vì sao dùng:** Tăng tốc độ phát triển; build ra file tĩnh tối ưu để Nginx phục vụ.

### Tailwind CSS
- **Lý thuyết:** CSS theo hướng **utility-first** — ghép sẵn các class nhỏ (`flex`, `p-4`, `text-sm`) ngay trên HTML.
- **Ưu:** Làm UI nhanh, đồng nhất, responsive dễ, hỗ trợ dark mode. **Nhược:** HTML dài, nhiều class.
- **Vì sao dùng:** Cần giao diện responsive (ưu tiên điện thoại cho shipper) và dark mode → Tailwind làm nhanh, nhất quán.

### Zustand (quản lý state)
- **Lý thuyết:** Thư viện lưu **trạng thái dùng chung** toàn app (vd: thông tin đăng nhập, theme) gọn nhẹ.
- **Ưu:** Đơn giản, ít boilerplate hơn Redux. **Nhược:** Ít công cụ/quy ước cho dự án siêu lớn.
- **Vì sao dùng:** Chỉ cần chia sẻ vài state (user, dark mode) → giải pháp nhẹ là đủ, không cần Redux nặng nề.

### React Router
- **Lý thuyết:** Điều hướng **nhiều trang trong một ứng dụng (SPA)** mà không tải lại toàn trang.
- **Vì sao dùng:** Phân tách màn hình theo vai trò (Admin / Kế toán / Shipper) và bảo vệ route theo quyền.

### Axios
- **Lý thuyết:** Thư viện gọi **HTTP** (gọi REST API), hỗ trợ interceptor (tự gắn token, xử lý lỗi 401).
- **Vì sao dùng:** Tập trung logic gọi API + tự đính kèm JWT + tự đăng xuất khi hết hạn.

### PWA (Progressive Web App)
- **Lý thuyết:** Web có thể **cài như app** trên điện thoại, mở toàn màn hình.
- **Ưu:** Không cần lên store, một codebase cho mọi thiết bị. **Nhược:** Một số tính năng nền (thông báo đẩy) hạn chế hơn app native.
- **Vì sao dùng:** Shipper dùng điện thoại ngoài đường → PWA tiện, không phải cài app từ store.

---

## 2. BACKEND & API

### ASP.NET Core 8 (ngôn ngữ C# / .NET 8)
- **Lý thuyết:** Framework xây **máy chủ web & API** đa nền tảng, hiệu năng cao của Microsoft.
- **Ưu:** Nhanh, bảo mật tốt, tích hợp sẵn DI, EF Core, SignalR. **Nhược:** Hệ sinh thái Microsoft, file build hơi lớn.
- **Vì sao dùng:** Một framework lo trọn: REST API + real-time (SignalR) + tác vụ nền (sao lưu) + bảo mật.

### REST API
- **Lý thuyết:** **Kiểu thiết kế API** dùng HTTP với các phương thức GET/POST/PUT/PATCH/DELETE trên "tài nguyên" (orders, photos…), dữ liệu JSON.
- **Ưu:** Đơn giản, phổ biến, dễ test. **Nhược:** Có thể trả thừa/thiếu dữ liệu (so với GraphQL).
- **Vì sao dùng:** Frontend ↔ backend giao tiếp rõ ràng, chuẩn mực, dễ debug.

### Entity Framework Core (EF Core) — ORM
- **Lý thuyết:** **ORM** ánh xạ **class C# ↔ bảng database**; viết truy vấn bằng C# thay vì SQL tay; quản lý **migration** (thay đổi cấu trúc DB theo phiên bản).
- **Ưu:** Code gọn, an toàn kiểu, ít lỗi SQL injection, migration tự động. **Nhược:** Truy vấn phức tạp đôi khi kém tối ưu hơn SQL thuần.
- **Vì sao dùng:** Tăng tốc phát triển, quản lý thay đổi schema gọn gàng, an toàn.

### Npgsql
- **Lý thuyết:** Trình điều khiển (driver) để EF Core nói chuyện với **PostgreSQL**.
- **Vì sao dùng:** Cầu nối bắt buộc giữa .NET và Postgres.

### BCrypt (băm mật khẩu)
- **Lý thuyết:** Thuật toán **băm mật khẩu** một chiều, có "salt" và cố tình chậm để chống dò mật khẩu.
- **Ưu:** Chống brute-force, lộ DB cũng không lộ mật khẩu gốc. **Nhược:** Chậm (đó là mục đích).
- **Vì sao dùng:** Lưu mật khẩu an toàn — không bao giờ lưu mật khẩu dạng thô.

---

## 3. CƠ SỞ DỮ LIỆU

### PostgreSQL 16
- **Lý thuyết:** Hệ quản trị **CSDL quan hệ** (bảng, khóa, ràng buộc), truy vấn bằng **SQL**, hỗ trợ giao dịch ACID.
- **Ưu:** Mạnh, ổn định, miễn phí, hỗ trợ JSON, mở rộng tốt. **Nhược:** Cấu hình tối ưu cần kiến thức.
- **Vì sao dùng:** Dữ liệu đơn hàng – giao dịch cần **chính xác & nhất quán** (tiền bạc) → CSDL quan hệ + ACID là chuẩn mực.

### SQL & khóa chính UUID
- **SQL:** Ngôn ngữ truy vấn dữ liệu quan hệ.
- **UUID:** Khóa chính dạng mã 128-bit ngẫu nhiên (thay cho số tự tăng) → khó đoán, không lộ số lượng bản ghi, an toàn hơn khi để lộ ID.

---

## 4. REAL-TIME (thời gian thực)

### SignalR + WebSocket
- **Lý thuyết:** **WebSocket** là kết nối **hai chiều, luôn mở** giữa trình duyệt và server (khác HTTP hỏi-đáp một lần). **SignalR** là thư viện .NET bọc WebSocket cho dễ dùng, tự fallback nếu mạng không hỗ trợ.
- **Ưu:** Server **đẩy** dữ liệu xuống client tức thì, không cần tải lại trang. **Nhược:** Tốn kết nối giữ mở, phức tạp hơn REST.
- **Vì sao dùng:** Khi shipper cập nhật đơn / khi đối soát xong, **Dashboard kế toán đổi ngay lập tức** → trải nghiệm real-time.

### Webhook (so sánh với Polling)
- **Lý thuyết:** **Webhook** = "đừng gọi tôi, tôi gọi bạn" — khi có sự kiện (vd: có tiền về), bên ngoài (SePay) **chủ động gọi HTTP** đến server ta. Ngược với **Polling** (liên tục hỏi "có gì mới không?").
- **Ưu:** Gần như tức thì, tiết kiệm tài nguyên. **Nhược:** Cần endpoint công khai + phải xác thực để chống giả mạo.
- **Vì sao dùng:** Nhận thông báo chuyển khoản ngay khi khách CK, không phải dò sao kê liên tục.

---

## 5. BẢO MẬT (xác thực & mã hóa)

### JWT (JSON Web Token)
- **Lý thuyết:** "Vé thông hành" dạng chuỗi **đã ký số**, chứa thông tin người dùng + quyền; server **không cần lưu phiên**, chỉ cần kiểm tra chữ ký.
- **Ưu:** Không trạng thái (stateless), dễ mở rộng, gọn. **Nhược:** Khó thu hồi trước hạn; phải bảo vệ token.
- **Vì sao dùng:** Xác thực phiên đăng nhập gọn nhẹ cho 3 vai trò; token hết hạn 24h, sai 5 lần khóa 15 phút.

### RBAC (phân quyền theo vai trò)
- **Lý thuyết:** Gán **quyền theo vai trò** (Admin / Kế toán / Shipper); mỗi API chỉ cho vai trò phù hợp gọi.
- **Vì sao dùng:** Shipper không được xem báo cáo tài chính, không thấy giao dịch ngân hàng của đơn… → phân quyền rõ ràng.

### HMAC-SHA256 (xác thực webhook)
- **Lý thuyết:** Bên gửi và bên nhận **chung một secret**; bên gửi ký nội dung tạo "chữ ký" (hash), bên nhận tự ký lại và **so khớp** → biết dữ liệu có bị sửa/giả mạo không.
- **Ưu:** Chống giả mạo & sửa nội dung giữa đường. **Nhược:** Phải giữ bí mật secret, tính chữ ký đúng chuẩn.
- **Vì sao dùng:** Xác thực webhook SePay — chỉ tiền **thật** từ SePay mới được ghi nhận. *(SePay ký trên chuỗi `{timestamp}.{raw_body}`.)*

### AES-256 (mã hóa cấu hình nhạy cảm)
- **Lý thuyết:** Thuật toán **mã hóa đối xứng** (cùng khóa để mã hóa & giải mã), tiêu chuẩn công nghiệp.
- **Vì sao dùng:** Mã hóa các cấu hình nhạy cảm (khóa API…) lưu trong DB, lộ DB cũng không đọc được.

### TLS/HTTPS
- **Lý thuyết:** Mã hóa dữ liệu **trên đường truyền** giữa trình duyệt và server bằng chứng chỉ số.
- **Vì sao dùng:** Bảo vệ mật khẩu, token, dữ liệu giao dịch khỏi bị nghe lén. *(Cấp tự động qua Let's Encrypt.)*

---

## 6. TRÍ TUỆ NHÂN TẠO (điểm nổi bật)

### LLM (Large Language Model)
- **Lý thuyết:** Mô hình ngôn ngữ lớn (vd **DeepSeek**, GPT, Gemini) được huấn luyện để hiểu & sinh văn bản tự nhiên.
- **Ưu:** Hiểu tiếng Việt, linh hoạt. **Nhược:** Có thể **"bịa" (hallucination)**; không biết dữ liệu riêng của doanh nghiệp; tốn phí gọi API.
- **Vì sao dùng:** Cho phép kế toán **hỏi dữ liệu bằng tiếng Việt** thay vì viết truy vấn.

### RAG (Retrieval-Augmented Generation)
- **Lý thuyết:** Kỹ thuật **"đưa dữ liệu thật cho LLM trước khi nó trả lời"**. Ở đây: nhúng **cấu trúc CSDL** vào prompt → LLM **sinh câu SQL** → chạy SQL lấy số liệu thật → LLM diễn giải thành câu trả lời.
- **Ưu:** Trả lời **chính xác theo dữ liệu thật**, real-time, kiểm chứng được, không cần huấn luyện lại mô hình. **Nhược:** Phụ thuộc chất lượng prompt & câu hỏi.
- **Vì sao dùng:** Giải quyết điểm yếu "bịa" của LLM → trợ lý AI đáng tin cho số liệu doanh thu/đơn hàng.

### Cơ chế an toàn cho AI
- **Chỉ cho phép SELECT** (chặn sửa/xóa dữ liệu), **validate** SQL trước khi chạy, **tự retry** nếu SQL lỗi, **ghi log** mọi câu lệnh → AI không thể phá dữ liệu.

### Multi-provider (qua OpenRouter)
- **Lý thuyết:** Một cổng (OpenRouter) gọi được nhiều nhà cung cấp LLM (DeepSeek/OpenAI/Anthropic/Gemini).
- **Vì sao dùng:** Linh hoạt đổi mô hình, không khóa cứng vào một hãng.

---

## 7. TÍCH HỢP DỊCH VỤ NGOÀI

### SePay
- **Lý thuyết:** Dịch vụ trung gian **theo dõi biến động số dư ngân hàng** và gửi **webhook** mỗi khi có giao dịch.
- **Vì sao dùng:** Tự động hóa **đối soát chuyển khoản** — khâu trước đây làm tay mất ~90 phút/ngày.

### Cloudflare R2 (qua chuẩn S3 / AWSSDK.S3)
- **Lý thuyết:** **Object storage** (lưu file/ảnh) tương thích giao thức **S3** của Amazon; R2 **miễn phí phí băng thông tải ra (egress)**.
- **Ưu:** Rẻ, mở rộng vô hạn, tách file khỏi server app. **Nhược:** Phụ thuộc nhà cung cấp ngoài.
- **Vì sao dùng:** Lưu **ảnh bằng chứng giao hàng (POD)** mà không phình dung lượng server; dùng SDK S3 chuẩn nên dễ đổi nhà cung cấp.

### VietQR
- **Lý thuyết:** Chuẩn tạo **mã QR chuyển khoản** ngân hàng VN; sinh ảnh QR kèm số tiền & nội dung.
- **Vì sao dùng:** Khách quét QR trả tiền nhanh, nội dung CK gắn sẵn mã đơn → dễ đối soát.

---

## 8. XỬ LÝ FILE & ẢNH

### SixLabors.ImageSharp
- **Lý thuyết:** Thư viện **xử lý ảnh** thuần .NET (resize, nén, đổi định dạng).
- **Vì sao dùng:** **Nén ảnh POD < 1MB** trước khi lưu → tiết kiệm băng thông & dung lượng (shipper chụp ảnh điện thoại rất nặng).

### EPPlus
- **Lý thuyết:** Thư viện **đọc/ghi file Excel (.xlsx)** trong .NET.
- **Vì sao dùng:** **Nhập đơn hàng loạt từ Excel** (kế toán quen Excel) và **xuất báo cáo** ra Excel.

---

## 9. HẠ TẦNG & DEVOPS

### Docker & Docker Compose
- **Lý thuyết:** **Container** đóng gói app + mọi thư viện vào một "hộp" chạy giống nhau ở mọi máy. **Compose** khai báo & chạy nhiều container cùng lúc (web, api, db).
- **Ưu:** "Chạy được trên máy tôi = chạy được mọi nơi", triển khai nhất quán, cô lập. **Nhược:** Thêm một lớp học tập & tài nguyên.
- **Vì sao dùng:** Triển khai 4 thành phần (frontend, backend, DB, proxy) đồng bộ, dễ deploy & nâng cấp.

### CI/CD bằng GitHub Actions
- **Lý thuyết:** **CI/CD** = tự động **build – kiểm thử – triển khai** mỗi khi đẩy code. GitHub Actions chạy quy trình này trên cloud.
- **Ưu:** Deploy nhanh, ít lỗi tay, lặp lại được. **Nhược:** Cần cấu hình pipeline & secret.
- **Vì sao dùng:** **Push code lên `main` → tự build image → SSH vào VPS cập nhật** trong vài phút, không thao tác tay.

### GHCR (GitHub Container Registry)
- **Lý thuyết:** Kho lưu **image Docker** đã build.
- **Vì sao dùng:** Nơi trung gian để VPS kéo image mới về chạy.

### Nginx
- **Lý thuyết:** **Web server / reverse proxy** hiệu năng cao.
- **Vai trò ở đây:** Phục vụ file tĩnh React (SPA) và **chuyển tiếp `/api`, `/hubs` về backend** trong mạng nội bộ container.

### Caddy + Let's Encrypt
- **Lý thuyết:** **Reverse proxy** tự động xin & gia hạn **chứng chỉ HTTPS** (Let's Encrypt) — bật HTTPS gần như không cấu hình.
- **Vì sao dùng:** Có HTTPS miễn phí, tự động cho domain `soghichep.id.vn`; đứng trước Nginx, kết thúc TLS.

### VPS Linux + Multi-arch (amd64/arm64)
- **VPS:** Máy chủ ảo chạy 24/7, có IP công khai → app online thật.
- **Multi-arch:** Build image cho cả chip **x86 (amd64)** và **ARM (arm64)** → chạy được trên nhiều loại VPS (kể cả Oracle ARM giá rẻ).

---

## 10. GIAO THỨC & CHUẨN (tổng hợp nhanh)

| Giao thức / chuẩn | Dùng để làm gì trong project |
|---|---|
| **HTTP/HTTPS** | Mọi giao tiếp web; HTTPS mã hóa đường truyền |
| **REST** | Phong cách thiết kế API |
| **WebSocket** | Kết nối real-time (qua SignalR) |
| **TLS/SSL** | Mã hóa & chứng thực kết nối |
| **JWT** | Mang thông tin xác thực phiên |
| **HMAC-SHA256** | Ký & xác thực webhook SePay |
| **BCrypt** | Băm mật khẩu |
| **AES-256** | Mã hóa cấu hình nhạy cảm |
| **S3 API** | Giao thức lưu trữ object (Cloudflare R2) |
| **Webhook** | Nhận sự kiện chủ động từ SePay |
| **JSON** | Định dạng trao đổi dữ liệu |
| **multipart/form-data** | Upload ảnh chứng từ |
| **SQL** | Truy vấn dữ liệu quan hệ |

---

## TÓM TẮT 1 CÂU CHO TỪNG NHÓM
- **Frontend:** React + TypeScript + Vite + Tailwind → giao diện nhanh, gọn, responsive, dark mode.
- **Backend:** ASP.NET Core 8 + EF Core → REST API + real-time + nền tảng, an toàn kiểu.
- **CSDL:** PostgreSQL → lưu dữ liệu tiền bạc chính xác, nhất quán.
- **Real-time:** SignalR/WebSocket + Webhook → cập nhật tức thì.
- **Bảo mật:** JWT + RBAC + HMAC + BCrypt + AES + HTTPS → nhiều lớp.
- **AI:** LLM + RAG → hỏi dữ liệu bằng tiếng Việt, trả lời từ dữ liệu thật.
- **Tích hợp:** SePay (đối soát), R2 (ảnh), VietQR (thu tiền).
- **DevOps:** Docker + GitHub Actions + Caddy/Nginx + VPS → triển khai tự động, HTTPS, 24/7.
