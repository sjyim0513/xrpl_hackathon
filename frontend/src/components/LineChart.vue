<template>
  <div>
    <h2>라인 차트 예제</h2>
    <!-- ApexChart 컴포넌트를 사용하여 차트 렌더링 -->
    <apexchart
      type="line"
      height="350"
      :options="chartOptions"
      :series="series"
    />
  </div>
</template>

<script setup>
import { ref } from "vue";
import ApexChart from "vue3-apexcharts";

// 차트에 사용될 데이터 시리즈
const series = ref([
  {
    name: "Sales",
    data: [30, 40, 35, 50, 49, 60, 70, 91, 125],
  },
]);

// 차트 옵션 (X축, 제목 등 설정)
const chartOptions = ref({
  chart: {
    id: "vuechart-example",
  },
  xaxis: {
    categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"],
  },
  title: {
    text: "Monthly Sales",
    align: "center",
  },
});
</script>

<style scoped>
/* 필요에 따라 스타일 추가 */
</style>
