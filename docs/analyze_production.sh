#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# analyze_production.sh
#
# Chạy trên VPS để rút bằng chứng hiệu quả từ DB thực tế.
# Output: thư mục evidence_<date>/ chứa CSV + report.txt.
#
# Cách dùng:
#   chmod +x analyze_production.sh
#   ./analyze_production.sh
#
# Hoặc chạy từ máy local qua SSH:
#   scp docs/analyze_production.sh user@vps:/srv/deliveryapp/
#   ssh user@vps "cd /srv/deliveryapp && ./analyze_production.sh"
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

OUTPUT_DIR="evidence_$(date +%Y-%m-%d_%H%M)"
mkdir -p "$OUTPUT_DIR"

DB_CONTAINER="${DB_CONTAINER:-deliveryapp-db-1}"
DB_NAME="${DB_NAME:-delivery_db}"
DB_USER="${DB_USER:-postgres}"

echo "─── Phân tích DB production: $DB_NAME ──────"
echo "Output: $OUTPUT_DIR/"

run_query() {
  local name="$1"
  local sql="$2"
  echo "  • $name..."
  docker compose exec -T "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -F ',' -A -P pager=off \
    -c "$sql" > "$OUTPUT_DIR/${name}.csv"
}

# ─────────────────────────────────────────────────────────────────
# Q1: Tỷ lệ tự động khớp CK
# ─────────────────────────────────────────────────────────────────
run_query "01_automatch_rate" "
SELECT
  COUNT(*) FILTER (WHERE \"MatchStatus\" = 'AutoMatched')   AS auto_matched,
  COUNT(*) FILTER (WHERE \"MatchStatus\" = 'ManualMatched') AS manual_matched,
  COUNT(*) FILTER (WHERE \"MatchStatus\" = 'Unmatched')     AS unmatched,
  COUNT(*) AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE \"MatchStatus\" = 'AutoMatched')
              / NULLIF(COUNT(*), 0), 2) AS auto_match_pct
FROM \"SePayTransactions\"
WHERE \"CreatedAt\" >= NOW() - INTERVAL '30 days';
"

# ─────────────────────────────────────────────────────────────────
# Q2: Doanh thu theo ngày 14 ngày gần nhất
# ─────────────────────────────────────────────────────────────────
run_query "02_daily_revenue" "
SELECT
  DATE(\"CreatedAt\")             AS ngay,
  COUNT(*)                        AS tong_don,
  COUNT(*) FILTER (WHERE \"Status\" IN ('PaidCash','PaidTransfer')) AS da_thu_du,
  COUNT(*) FILTER (WHERE \"Status\" = 'Partial')                    AS thu_1_phan,
  COUNT(*) FILTER (WHERE \"Status\" = 'Unpaid')                     AS chua_thu,
  SUM(\"Amount\")                 AS tong_can_thu,
  SUM(\"AmountPaid\")             AS tong_da_thu
FROM \"Orders\"
WHERE \"CreatedAt\" >= NOW() - INTERVAL '14 days'
GROUP BY DATE(\"CreatedAt\")
ORDER BY ngay DESC;
"

# ─────────────────────────────────────────────────────────────────
# Q3: Số thao tác trung bình/đơn (touches)
# ─────────────────────────────────────────────────────────────────
run_query "03_touches_per_order" "
WITH per_order AS (
  SELECT o.\"OrderCode\", COUNT(a.\"Id\") AS touches
  FROM \"Orders\" o
  LEFT JOIN \"AuditLogs\" a ON a.\"EntityId\" = o.\"Id\"
  WHERE o.\"CreatedAt\" >= NOW() - INTERVAL '7 days'
  GROUP BY o.\"OrderCode\"
)
SELECT
  ROUND(AVG(touches), 2) AS avg_touches,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY touches) AS median_touches,
  MIN(touches) AS min_touches,
  MAX(touches) AS max_touches,
  COUNT(*) AS total_orders
FROM per_order;
"

# ─────────────────────────────────────────────────────────────────
# Q4: Chu kỳ ngày làm việc — từ IMPORT đến đơn cuối được xử lý
# ─────────────────────────────────────────────────────────────────
run_query "04_daily_cycle_time" "
WITH cycles AS (
  SELECT
    DATE(i.\"CreatedAt\") AS ngay,
    MIN(i.\"CreatedAt\") AS import_at,
    MAX(d.\"CreatedAt\") AS last_at
  FROM \"AuditLogs\" i
  LEFT JOIN \"AuditLogs\" d
    ON DATE(d.\"CreatedAt\") = DATE(i.\"CreatedAt\")
   AND d.\"Action\" IN ('UPDATE_STATUS', 'COLLECT_CASH', 'AUTO_MATCH', 'DELIVERED')
  WHERE i.\"Action\" = 'IMPORT'
  GROUP BY DATE(i.\"CreatedAt\")
)
SELECT
  ngay,
  ROUND(EXTRACT(EPOCH FROM (last_at - import_at)) / 3600, 2) AS gio_chu_ky
FROM cycles
WHERE last_at IS NOT NULL
ORDER BY ngay DESC LIMIT 14;
"

# ─────────────────────────────────────────────────────────────────
# Q5: Top action - bằng chứng system thực sự được dùng
# ─────────────────────────────────────────────────────────────────
run_query "05_action_breakdown" "
SELECT
  \"Action\",
  COUNT(*) AS so_lan,
  COUNT(DISTINCT \"Username\") AS so_nguoi_dung,
  MIN(\"CreatedAt\") AS lan_dau,
  MAX(\"CreatedAt\") AS lan_cuoi
FROM \"AuditLogs\"
GROUP BY \"Action\"
ORDER BY so_lan DESC;
"

# ─────────────────────────────────────────────────────────────────
# Q6: Tỷ lệ thu được công nợ theo shipper
# ─────────────────────────────────────────────────────────────────
run_query "06_shipper_collection_rate" "
SELECT
  u.\"FullName\" AS shipper,
  COUNT(o.\"Id\") AS tong_don,
  SUM(o.\"Amount\") AS tong_can_thu,
  SUM(o.\"AmountPaid\") AS tong_da_thu,
  ROUND(100.0 * SUM(o.\"AmountPaid\") / NULLIF(SUM(o.\"Amount\"), 0), 2) AS ty_le_thu_pct
FROM \"Users\" u
JOIN \"Orders\" o ON o.\"ShipperId\" = u.\"Id\"
WHERE o.\"CreatedAt\" >= NOW() - INTERVAL '30 days'
  AND u.\"Role\" = 'Shipper'
GROUP BY u.\"FullName\"
ORDER BY tong_da_thu DESC;
"

# ─────────────────────────────────────────────────────────────────
# Q7: Doanh thu phục hồi nhờ multi-CK matching
# ─────────────────────────────────────────────────────────────────
run_query "07_multi_ck_recovered" "
WITH multi AS (
  SELECT \"OrderId\"
  FROM \"SePayTransactions\"
  WHERE \"OrderId\" IS NOT NULL AND \"MatchStatus\" <> 'Unmatched'
  GROUP BY \"OrderId\"
  HAVING COUNT(*) >= 2
)
SELECT
  COUNT(*) AS so_don_multi_ck,
  SUM(o.\"AmountPaid\") AS tong_doanh_thu_phuc_hoi
FROM \"Orders\" o
WHERE o.\"Id\" IN (SELECT \"OrderId\" FROM multi);
"

# ─────────────────────────────────────────────────────────────────
# Tổng kết — sinh report.txt
# ─────────────────────────────────────────────────────────────────
{
  echo "═════════════════════════════════════════════════════════════════"
  echo "BÁO CÁO PHÂN TÍCH HIỆU QUẢ HỆ THỐNG — DỮ LIỆU SẢN XUẤT"
  echo "Sinh tự động ngày: $(date '+%d/%m/%Y %H:%M:%S')"
  echo "Database: $DB_NAME @ $(hostname)"
  echo "═════════════════════════════════════════════════════════════════"
  echo
  echo "── Q1: TỶ LỆ TỰ ĐỘNG KHỚP CHUYỂN KHOẢN ──"
  cat "$OUTPUT_DIR/01_automatch_rate.csv"
  echo
  echo "── Q2: DOANH THU THEO NGÀY (14 ngày gần nhất) ──"
  cat "$OUTPUT_DIR/02_daily_revenue.csv"
  echo
  echo "── Q3: SỐ THAO TÁC TRUNG BÌNH/ĐƠN ──"
  cat "$OUTPUT_DIR/03_touches_per_order.csv"
  echo
  echo "── Q4: CHU KỲ NGÀY LÀM VIỆC ──"
  cat "$OUTPUT_DIR/04_daily_cycle_time.csv"
  echo
  echo "── Q5: PHÂN BỔ HOẠT ĐỘNG ──"
  cat "$OUTPUT_DIR/05_action_breakdown.csv"
  echo
  echo "── Q6: TỶ LỆ THU CÔNG NỢ THEO SHIPPER ──"
  cat "$OUTPUT_DIR/06_shipper_collection_rate.csv"
  echo
  echo "── Q7: DOANH THU PHỤC HỒI NHỜ MULTI-CK ──"
  cat "$OUTPUT_DIR/07_multi_ck_recovered.csv"
  echo
  echo "═════════════════════════════════════════════════════════════════"
  echo "→ 7 file CSV đã xuất tại: $OUTPUT_DIR/"
  echo "→ Đính kèm vào Phụ lục B của luận văn."
} > "$OUTPUT_DIR/report.txt"

cat "$OUTPUT_DIR/report.txt"
echo
echo "✓ Hoàn tất. Bằng chứng đã lưu tại: $OUTPUT_DIR/"
