/**
 * snapshot.test.js — Snapshot Manager 屬性測試與單元測試
 *
 * 測試 src/lib/services/snapshotManager.js 的 autoSnapshot 與 filterSnapshotsByRange。
 * 使用 fast-check 進行屬性測試，驗證快照冪等性、數量上限與時間範圍篩選。
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  autoSnapshot,
  filterSnapshotsByRange,
} from '../src/lib/services/snapshotManager.js';

// ─── 輔助函式 ────────────────────────────────────────────────────────────────

/**
 * 取得今日本地日期字串（YYYY-MM-DD），與 snapshotManager 內部邏輯一致。
 * @returns {string}
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ─── 共用 Arbitrary 定義 ─────────────────────────────────────────────────────

/** 產生有效的快照物件（日期為 YYYY-MM-DD 格式） */
const snapshotArb = fc.record({
  date: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(d => d.toISOString().slice(0, 10)),
  netWorth: fc.double({ min: -1e8, max: 1e8, noNaN: true, noDefaultInfinity: true }),
});

/** 產生有效的淨資產數值 */
const netWorthArb = fc.double({ min: -1e8, max: 1e8, noNaN: true, noDefaultInfinity: true });

/** 產生不含今日日期的快照陣列（確保日期唯一） */
const uniqueSnapshotsArb = fc
  .uniqueArray(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .map(d => d.toISOString().slice(0, 10)),
    { minLength: 0, maxLength: 50, comparator: (a, b) => a === b }
  )
  .chain(dates => {
    // 移除今日日期，確保測試可控
    const today = getTodayString();
    const filtered = dates.filter(d => d !== today);
    return fc.tuple(
      fc.constant(filtered),
      fc.array(
        fc.double({ min: -1e8, max: 1e8, noNaN: true, noDefaultInfinity: true }),
        { minLength: filtered.length, maxLength: filtered.length }
      )
    ).map(([ds, nws]) => ds.map((date, i) => ({ date, netWorth: nws[i] })));
  });

// ─── 單元測試 ────────────────────────────────────────────────────────────────

describe('Snapshot Manager 單元測試', () => {
  it('空快照陣列呼叫 autoSnapshot 建立首筆快照', () => {
    const result = autoSnapshot([], 1000000);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe(getTodayString());
    expect(result[0].netWorth).toBe(1000000);
  });

  it('當日已有快照時覆蓋而非新增', () => {
    const today = getTodayString();
    const existing = [{ date: today, netWorth: 500000 }];
    const result = autoSnapshot(existing, 600000);
    expect(result).toHaveLength(1);
    expect(result[0].netWorth).toBe(600000);
  });

  it('不修改原始陣列（不可變性）', () => {
    const original = [{ date: '2025-01-01', netWorth: 100000 }];
    const frozen = [...original];
    autoSnapshot(original, 200000);
    expect(original).toEqual(frozen);
  });

  it('filterSnapshotsByRange "all" 回傳全部快照', () => {
    const snapshots = [
      { date: '2020-01-01', netWorth: 100 },
      { date: '2025-06-01', netWorth: 200 },
    ];
    const result = filterSnapshotsByRange(snapshots, 'all');
    expect(result).toHaveLength(2);
  });

  it('filterSnapshotsByRange 結果依日期升序排列', () => {
    const snapshots = [
      { date: '2025-06-15', netWorth: 200 },
      { date: '2025-06-01', netWorth: 100 },
      { date: '2025-06-10', netWorth: 150 },
    ];
    const result = filterSnapshotsByRange(snapshots, 'all');
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date >= result[i - 1].date).toBe(true);
    }
  });
});

// ─── Property-Based Tests（屬性測試）────────────────────────────────────────

// Feature: sveltekit-spa-migration, Property 7: 快照冪等性
// **Validates: Requirements 9.2, 19.5**
describe('Property 7: 快照冪等性', () => {
  it('同一天重複呼叫 autoSnapshot 不增加快照數量', () => {
    fc.assert(
      fc.property(
        uniqueSnapshotsArb,
        netWorthArb,
        netWorthArb,
        (snapshots, netWorth1, netWorth2) => {
          // 第一次呼叫
          const after1 = autoSnapshot(snapshots, netWorth1);
          // 第二次呼叫（同一天，不同淨資產值）
          const after2 = autoSnapshot(after1, netWorth2);

          // 冪等性：第二次呼叫後長度不應增加
          expect(after2.length).toBe(after1.length);

          // 今日快照的 netWorth 應為第二次的值
          const today = getTodayString();
          const todaySnapshot = after2.find(s => s.date === today);
          expect(todaySnapshot).toBeDefined();
          expect(todaySnapshot.netWorth).toBe(netWorth2);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sveltekit-spa-migration, Property 8: 快照數量上限
// **Validates: Requirements 9.3**
describe('Property 8: 快照數量上限', () => {
  it('超過 365 筆的快照陣列呼叫 autoSnapshot 後長度不超過 365', () => {
    // 產生超過 365 筆的唯一日期快照
    const largeSnapshotsArb = fc
      .uniqueArray(
        fc.integer({ min: 0, max: 730 }).map(offset => {
          const d = new Date('2022-01-01');
          d.setDate(d.getDate() + offset);
          return d.toISOString().slice(0, 10);
        }),
        { minLength: 366, maxLength: 500, comparator: (a, b) => a === b }
      )
      .chain(dates => {
        // 移除今日日期以確保 autoSnapshot 會新增
        const today = getTodayString();
        const filtered = dates.filter(d => d !== today);
        // 確保仍超過 365 筆
        if (filtered.length < 366) {
          // 補充日期
          for (let i = 731; filtered.length < 366; i++) {
            const d = new Date('2022-01-01');
            d.setDate(d.getDate() + i);
            const ds = d.toISOString().slice(0, 10);
            if (ds !== today && !filtered.includes(ds)) {
              filtered.push(ds);
            }
          }
        }
        return fc.constant(
          filtered.map(date => ({ date, netWorth: 100000 }))
        );
      });

    fc.assert(
      fc.property(
        largeSnapshotsArb,
        netWorthArb,
        (snapshots, netWorth) => {
          // 確認輸入超過 365 筆
          expect(snapshots.length).toBeGreaterThan(365);

          const result = autoSnapshot(snapshots, netWorth);

          // 結果不應超過 365 筆
          expect(result.length).toBeLessThanOrEqual(365);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: sveltekit-spa-migration, Property 9: 快照時間範圍篩選
// **Validates: Requirements 9.7**
describe('Property 9: 快照時間範圍篩選', () => {
  it('篩選後所有快照日期在指定範圍截止日期之後', () => {
    const RANGE_DAYS = {
      '1w': 7,
      '1m': 30,
      '6m': 180,
      '1y': 365,
    };

    const rangeArb = fc.constantFrom('1w', '1m', '6m', '1y');

    fc.assert(
      fc.property(
        fc.array(snapshotArb, { minLength: 0, maxLength: 50 }),
        rangeArb,
        (snapshots, range) => {
          const result = filterSnapshotsByRange(snapshots, range);

          // 計算截止日期
          const days = RANGE_DAYS[range];
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const cutoff = new Date(today);
          cutoff.setDate(cutoff.getDate() - days);
          const cutoffStr = (() => {
            const y = cutoff.getFullYear();
            const m = String(cutoff.getMonth() + 1).padStart(2, '0');
            const d = String(cutoff.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
          })();

          // 所有篩選結果的日期應 >= 截止日期
          for (const snapshot of result) {
            expect(snapshot.date >= cutoffStr).toBe(true);
          }

          // 結果應依日期升序排列
          for (let i = 1; i < result.length; i++) {
            expect(result[i].date >= result[i - 1].date).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
