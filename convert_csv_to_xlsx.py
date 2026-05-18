"""
Chuyển đổi file CSV xuất từ phần mềm kế toán sang định dạng .xlsx
phù hợp với trang Import của DeliveryApp.

Cách dùng:
    python convert_csv_to_xlsx.py DG24007443.csv

Cột xlsx đầu ra (theo thứ tự app yêu cầu):
    1. Mã giao dịch
    2. Mã GD đơn gộp
    3. Tên khách hàng
    4. Tên nhân viên
    5. Số tiền
    6. Diễn giải
"""

import sys
import pandas as pd

# --- Mapping từ CSV gốc sang xlsx đầu ra ---
# CSV gốc có các cột (0-indexed):
#   0  Chọn
#   1  Mã giao dịch       → col 1 xlsx
#   2  Mã GD Đơn gộp      → col 2 xlsx
#   3  Mã khách hàng      (bỏ qua)
#   4  Tên khách hàng     → col 3 xlsx
#   5  Mã người nhận nợ   (bỏ qua)
#   6  Người nhận nợ      (bỏ qua)
#   7  Tên nhân viên      → col 4 xlsx
#   8  TK nợ              (bỏ qua)
#   9  TK có              (bỏ qua)
#  10  Công nợ            (bỏ qua)
#  11  Tiền trả lại       (bỏ qua)
#  12  Số tiền            → col 5 xlsx
#  13  Số tiền thanh toán (bỏ qua)
#  14  Còn phải TT        (bỏ qua)
#  15  Diễn giải          → col 6 xlsx

def convert(csv_path: str):
    # Thử đọc với các encoding phổ biến
    for enc in ('utf-8-sig', 'utf-8', 'cp1258', 'latin-1'):
        try:
            df = pd.read_csv(csv_path, encoding=enc, header=0, dtype=str)
            break
        except Exception:
            continue
    else:
        raise RuntimeError("Không thể đọc file CSV. Kiểm tra lại encoding.")

    # Bỏ dòng tổng cuối (dòng không có mã giao dịch hợp lệ)
    # Cột 1 = Mã giao dịch — phải bắt đầu bằng chữ hoặc số, không chứa dấu phẩy
    col_order_code = df.columns[1]
    df = df[df[col_order_code].str.match(r'^[A-Za-z0-9]', na=False)].copy()

    # Làm sạch cột Số tiền (bỏ dấu phẩy, dấu chấm ngàn)
    col_amount = df.columns[12]
    df[col_amount] = (
        df[col_amount]
        .str.replace(',', '', regex=False)
        .str.replace('.', '', regex=False)
        .str.strip()
    )

    output = pd.DataFrame({
        'Mã giao dịch':   df.iloc[:, 1].str.strip(),
        'Mã GD đơn gộp':  df.iloc[:, 2].str.strip(),
        'Tên khách hàng': df.iloc[:, 4].str.strip(),
        'Tên nhân viên':  df.iloc[:, 7].str.strip(),
        'Số tiền':        pd.to_numeric(df.iloc[:, 12], errors='coerce').fillna(0).astype(int),
        'Diễn giải':      df.iloc[:, 15].str.strip(),
    })

    out_path = csv_path.replace('.csv', '_import.xlsx')
    output.to_excel(out_path, index=False)

    print(f"Da tao: {out_path}")
    print(f"  Tong don : {len(output)}")
    print(f"  Tong tien: {output.iloc[:, 4].sum():,} VND")
    print(f"\nHoan tat!")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Dùng: python convert_csv_to_xlsx.py <file.csv>")
        sys.exit(1)
    convert(sys.argv[1])
