<!--
  +page.svelte — 儀表板頁面

  組合 QuickStats、PieChart、TrendChart 元件。
  訂閱 derived stores（totals、growthRates、pieChartData）與 snapshots store。
  桌面雙欄網格佈局（由全域 CSS #page-dashboard 控制）。
-->
<script>
  import QuickStats from '../components/dashboard/QuickStats.svelte';
  import PieChart from '../components/dashboard/PieChart.svelte';
  import TrendChart from '../components/dashboard/TrendChart.svelte';
  import { totals, growthRates, pieChartData } from '$lib/stores/derived.js';
  import { snapshots } from '$lib/stores/snapshots.js';
</script>

<div id="page-dashboard">
  <!-- 四格快速數字卡片（跨雙欄） -->
  <QuickStats totals={$totals} growthRates={$growthRates} />

  <!-- 圓餅圖 -->
  <PieChart pieData={$pieChartData} totals={$totals} />

  <!-- 趨勢折線圖 -->
  <TrendChart snapshots={$snapshots} />
</div>
