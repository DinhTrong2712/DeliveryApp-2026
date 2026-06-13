-- ─────────────────────────────────────────────────────────────────────────
-- EVIDENCE QUERIES — chạy trên DB production để lấy bằng chứng hiệu quả.
--
-- Cách chạy:
--   docker compose exec db psql -U postgres delivery_db -f /tmp/EVIDENCE_QUERIES.sql > evidence.txt
--   (hoặc mở pgAdmin / DBeaver kết nối thẳng)
--
-- Xuất kết quả ra CSV, đính kèm Phụ lục B luận văn.
-- ─────────────────────────────────────────────────────────────────────────

\echo '────── Q1: Tỷ lệ tự động khớp chuyển khoản 30 ngày gần nhất ──────'

SELECT
  COUNT(*) FILTER (WHERE "MatchStatus" = 'AutoMatched')   AS auto_matched,
  COUNT(*) FILTER (WHERE "MatchStatus" = 'ManualMatched') AS manual_matched,
  COUNT(*) FILTER (WHERE "MatchStatus" = 'Unmatched')     AS unmatched,
  COUNT(*)                                                AS total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "MatchStatus" = 'AutoMatched')
              / NULLIF(COUNT(*), 0), 2) AS auto_match_pct
FROM "SePayTransactions"
WHERE "CreatedAt" >= NOW() - INTERVAL '30 days';

\echo ''
\echo '────── Q2: Số đơn xử lý qua hệ thống theo ngày (14 ngày gần nhất) ──────'

SELECT
  DATE("CreatedAt")             AS ngay,
  COUNT(*)                      AS tong_don,
  COUNT(*) FILTER (WHERE "Status" IN ('PaidCash','PaidTransfer')) AS da_thu_du,
  COUNT(*) FILTER (WHERE "Status" = 'Partial')                    AS thu_1_phan,
  COUNT(*) FILTER (WHERE "Status" = 'Unpaid')                     AS chua_thu,
  SUM("Amount")                 AS tong_can_thu,
  SUM("AmountPaid")             AS tong_da_thu
FROM "Orders"
WHERE "CreatedAt" >= NOW() - INTERVAL '14 days'
GROUP BY DATE("CreatedAt")
ORDER BY ngay DESC;

\echo ''
\echo '────── Q3: Doanh thu phục hồi nhờ auto-match đúng (multi-CK summed) ──────'

SELECT
  DATE_TRUNC('week', t."MatchedAt")::date AS tuan_bat_dau,
  COUNT(DISTINCT o."Id")                  AS so_don_multi_ck,
  SUM(t."Amount")                         AS doanh_thu_phuc_hoi
FROM "SePayTransactions" t
JOIN "Orders" o ON o."Id" = t."OrderId"
WHERE t."MatchStatus" IN ('AutoMatched', 'ManualMatched')
  AND o."Id" IN (
    SELECT "OrderId" FROM "SePayTransactions"
    WHERE "OrderId" IS NOT NULL AND "MatchStatus" <> 'Unmatched'
    GROUP BY "OrderId" HAVING COUNT(*) >= 2
  )
GROUP BY 1
ORDER BY 1 DESC
LIMIT 8;

\echo ''
\echo '────── Q4: Số thao tác trung bình mỗi đơn (touches per order) ──────'

WITH per_order AS (
  SELECT
    o."OrderCode",
    COUNT(a."Id") AS touches
  FROM "Orders" o
  LEFT JOIN "AuditLogs" a ON a."EntityId" = o."Id"
  WHERE o."CreatedAt" >= NOW() - INTERVAL '7 days'
  GROUP BY o."OrderCode"
)
SELECT
  AVG(touches)                AS trung_binh_touches,
  PERCENTILE_CONT(0.5)
    WITHIN GROUP (ORDER BY touches) AS median_touches,
  MIN(touches)                AS min_touches,
  MAX(touches)                AS max_touches,
  COUNT(*)                    AS tong_don_tuan
FROM per_order;

\echo ''
\echo '────── Q5: Thời gian từ IMPORT đến DELIVERED của 1 chu kỳ ngày ──────'

SELECT
  DATE(i."CreatedAt")                              AS ngay,
  MIN(i."CreatedAt")                               AS import_luc,
  MAX(d."CreatedAt")                               AS delivered_cuoi,
  ROUND(EXTRACT(EPOCH FROM
    (MAX(d."CreatedAt") - MIN(i."CreatedAt"))) / 3600, 2) AS gio_tron_chu_ky
FROM "AuditLogs" i
JOIN "AuditLogs" d
  ON DATE(d."CreatedAt") = DATE(i."CreatedAt")
 AND d."Action" IN ('DELIVERED', 'COLLECT_CASH')
WHERE i."Action" = 'IMPORT'
GROUP BY DATE(i."CreatedAt")
ORDER BY ngay DESC
LIMIT 14;

\echo ''
\echo '────── Q6: Phân loại lỗi đăng nhập (security audit) ──────'

SELECT
  DATE_TRUNC('week', "CreatedAt")::date AS tuan,
  COUNT(*) FILTER (WHERE "Action" = 'LOGIN')         AS login_thanh_cong,
  COUNT(*) FILTER (WHERE "Action" = 'LOGIN_FAILED')  AS login_that_bai
FROM "AuditLogs"
WHERE "Action" IN ('LOGIN', 'LOGIN_FAILED')
  AND "CreatedAt" >= NOW() - INTERVAL '60 days'
GROUP BY 1
ORDER BY 1 DESC;

\echo ''
\echo '────── Q7: Top action trong AuditLog — chứng minh hệ thống thực sự được dùng ──────'

SELECT
  "Action",
  COUNT(*)                          AS so_lan,
  COUNT(DISTINCT "Username")        AS so_nguoi_dung,
  MIN("CreatedAt")                  AS lan_dau,
  MAX("CreatedAt")                  AS lan_cuoi
FROM "AuditLogs"
GROUP BY "Action"
ORDER BY so_lan DESC;
