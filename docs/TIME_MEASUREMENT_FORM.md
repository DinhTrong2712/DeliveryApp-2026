# FORM ĐO THỜI GIAN THAO TÁC — In ra cho kế toán điền

> **Hướng dẫn**: In 2 lần — một bản đo quy trình cũ (Excel + Zalo + app NH), một bản
> đo quy trình mới (DeliveryApp). Cùng 1 kế toán, cùng dữ liệu đầu vào, cùng 1 ngày.

---

## A. Thông tin chung

| Mục | Nội dung |
|---|---|
| Người đo | Đinh Trọng (sinh viên) |
| Người thao tác | ____________________ (kế toán) |
| Ngày đo | ____ / ____ / 2026 |
| Địa điểm | Văn phòng NPP Hương Cường |
| Dữ liệu đầu vào | File Excel ngày ______, ____ đơn, ____ CK |
| Thiết bị | Laptop _______________, mạng wifi NPP |

---

## B. Sổ ghi giờ — QUY TRÌNH CŨ (Excel + Zalo + app ngân hàng)

### T1 — Nhập đơn từ Excel master

| Mô tả thao tác | Bắt đầu (hh:mm:ss) | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Mở file Excel master | | | |
| Copy/paste 100 đơn | | | |
| Highlight đơn theo shipper | | | |
| Lưu file | | | |
| **TỔNG T1** | | | |

### T2 — Phân tuyến cho 4 shipper

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Lọc Excel theo shipper 1 (Mạnh) | | | |
| Chụp screen + gửi Zalo Mạnh | | | |
| Tương tự cho 3 shipper còn lại | | | |
| Chờ shipper xác nhận đã nhận | | | |
| **TỔNG T2** | | | |

### T3 — Đối soát chuyển khoản (30 CK)

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Mở app SeABank/MBBank | | | |
| Liệt kê 30 CK đến | | | |
| Đối chiếu nội dung CK với mã đơn (×30) | | | |
| Ghi vào Excel master từng đơn đã thu | | | |
| **TỔNG T3** | | | |

### T4 — Tổng hợp & xuất báo cáo cuối ngày

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Build pivot table doanh thu | | | |
| Format số tiền VND | | | |
| Tô màu, format header | | | |
| Lưu thành báo cáo .xlsx | | | |
| Soạn email gửi sếp | | | |
| **TỔNG T4** | | | |

### T5 — Tra cứu nhanh: "Doanh thu shipper Mạnh tuần này?"

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Mở file master 7 ngày | | | |
| Filter theo shipper | | | |
| Sum cột AmountPaid | | | |
| **TỔNG T5** | | | |

---

## C. Sổ ghi giờ — QUY TRÌNH MỚI (DeliveryApp)

### T1 — Nhập đơn từ Excel

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Mở /accountant/import | | | |
| Chọn file → Xem trước | | | |
| Bấm Xác nhận | | | |
| **TỔNG T1** | | | |

### T2 — Phân tuyến cho 4 shipper

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| (Tự động qua cột tên NV trong Excel) | | | **0** |
| **TỔNG T2** | | | **0** |

### T3 — Đối soát 30 CK

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Mở /accountant/unmatched | | | |
| Xử lý CK chưa tự khớp (~3 CK × 30s) | | | |
| (Còn lại tự động) | | | |
| **TỔNG T3** | | | |

### T4 — Xuất báo cáo cuối ngày

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Mở /accountant/reports | | | |
| Bấm "Xuất Excel" | | | |
| **TỔNG T4** | | | |

### T5 — Tra cứu: "Doanh thu shipper Mạnh tuần này?"

| Mô tả thao tác | Bắt đầu | Kết thúc | Thời gian (s) |
|---|---|---|---|
| Mở /accountant/ai-chat | | | |
| Gõ câu hỏi + Enter | | | |
| Đọc đáp án | | | |
| **TỔNG T5** | | | |

---

## D. Bảng so sánh tóm tắt (kế toán điền sau khi đo)

| Tác vụ | Cũ (s) | Mới (s) | Giảm (s) | Giảm (%) |
|---|---|---|---|---|
| T1 — Nhập Excel | | | | |
| T2 — Phân tuyến | | | | |
| T3 — Đối soát CK | | | | |
| T4 — Báo cáo ngày | | | | |
| T5 — Tra cứu nhanh | | | | |
| **TỔNG** | | | | |

---

## E. Xác nhận

Tôi (kế toán) xác nhận các số liệu thời gian ghi trong form này là tôi đã thực hiện
trực tiếp trên dữ liệu thật của NPP Hương Cường ngày _____ / _____ / 2026,
không phải số liệu giả lập.

```
Người thao tác đo                 Người ghi nhận
(Ký, ghi rõ họ tên)               (Ký, ghi rõ họ tên)

____________________              ____________________
Họ tên: ______________            Đinh Trọng — SV thực hiện luận văn
Chức vụ: Kế toán                  ĐT: __________________
NPP Hương Cường                   Email: ________________
```

> **Sau khi điền xong**: scan/chụp ảnh form đã ký, đính file vào Phụ lục A của
> luận văn. Bản gốc lưu tại NPP làm bằng chứng nếu hội đồng yêu cầu kiểm chứng.
