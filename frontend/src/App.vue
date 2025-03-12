<template>
  <!-- 차트를 렌더링할 요소 -->
  <div ref="chartDom" style="width: 100%; height: 500px"></div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import * as echarts from "echarts";

const chartDom = ref<HTMLDivElement | null>(null);

const upColor = "#00da3c";
const downColor = "#ec0000";

// rawData의 타입을 (string|number)[][]로 변경
function splitData(rawData: (string | number)[][]) {
  const categoryData: (string | number)[] = [];
  const values: number[][] = [];
  const volumes: (number | string)[][] = [];
  for (let i = 0; i < rawData.length; i++) {
    // 날짜(문자열)는 첫번째 항목
    const row = [...rawData[i]]; // 원본 배열 변경 방지를 위해 복사
    categoryData.push(row.splice(0, 1)[0]);
    // 나머지는 숫자형 데이터라고 가정
    values.push(row as number[]);
    // 거래량 데이터: [index, volume, 조건 (open > close ? 1 : -1)]
    // row[4]는 high, row[0]는 open, row[1]는 close (splitData 호출 후 row 순서는 [open, close, low, high, volume])
    // 하지만 여기서는 dummyData 순서가 [date, open, close, low, high, volume]이므로
    // row[3]은 low, row[2]은 close, row[1]은 open, row[4]는 high, row[5]는 volume.
    // 조건을 간단하게 open > close 비교로 하겠습니다.
    const open = row[0] as number;
    const close = row[1] as number;
    volumes.push([i, row[5], open > close ? 1 : -1]);
  }
  return { categoryData, values, volumes };
}

function calculateMA(dayCount: number, data: { values: number[][] }) {
  const result: (number | string)[] = [];
  for (let i = 0, len = data.values.length; i < len; i++) {
    if (i < dayCount) {
      result.push("-");
      continue;
    }
    let sum = 0;
    for (let j = 0; j < dayCount; j++) {
      sum += data.values[i - j][1]; // 종가(close) 사용
    }
    result.push(+(sum / dayCount).toFixed(3));
  }
  return result;
}

onMounted(() => {
  if (!chartDom.value) return;
  const myChart = echarts.init(chartDom.value);

  // 30개의 임의 데이터 생성
  // 각 데이터 항목: [날짜, open, close, low, high, volume]
  const dummyData: (string | number)[][] = [];
  for (let i = 0; i < 30; i++) {
    const day = i + 1;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const date = `2023/01/${dayStr}`;
    const open = 100 + i;
    const close = open + 1; // 단순 증가
    const low = open - 1;
    const high = close + 1;
    const volume = 1000 + i * 10;
    dummyData.push([date, open, close, low, high, volume]);
  }

  // dummyData를 가공
  const data = splitData(dummyData);

  const option = {
    animation: false,
    legend: {
      bottom: 10,
      left: "center",
      data: ["Dow-Jones index", "MA5", "MA10", "MA20", "MA30"],
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      borderWidth: 1,
      borderColor: "#ccc",
      padding: 10,
      textStyle: {
        color: "#000",
      },
      position: function (
        pos: number[],
        params: any,
        el: any,
        elRect: any,
        size: any
      ) {
        const obj: Record<string, number> = { top: 10 };
        // 차트의 왼쪽/오른쪽에 따라 위치 지정
        obj[pos[0] < size.viewSize[0] / 2 ? "left" : "right"] = 30;
        return obj;
      },
    },
    axisPointer: {
      link: [
        {
          xAxisIndex: "all",
        },
      ],
      label: {
        backgroundColor: "#777",
      },
    },
    toolbox: {
      feature: {
        dataZoom: {
          yAxisIndex: false,
        },
        brush: {
          type: ["lineX", "clear"],
        },
      },
    },
    brush: {
      xAxisIndex: "all",
      brushLink: "all",
      outOfBrush: {
        colorAlpha: 0.1,
      },
    },
    visualMap: {
      show: false,
      seriesIndex: 5,
      dimension: 2,
      pieces: [
        {
          value: 1,
          color: downColor,
        },
        {
          value: -1,
          color: upColor,
        },
      ],
    },
    grid: [
      {
        left: "10%",
        right: "8%",
        height: "50%",
      },
      {
        left: "10%",
        right: "8%",
        top: "63%",
        height: "16%",
      },
    ],
    xAxis: [
      {
        type: "category",
        data: data.categoryData,
        boundaryGap: false,
        axisLine: { onZero: false },
        splitLine: { show: false },
        min: "dataMin",
        max: "dataMax",
        axisPointer: {
          z: 100,
        },
      },
      {
        type: "category",
        gridIndex: 1,
        data: data.categoryData,
        boundaryGap: false,
        axisLine: { onZero: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        min: "dataMin",
        max: "dataMax",
      },
    ],
    yAxis: [
      {
        scale: true,
        splitArea: {
          show: true,
        },
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: [0, 1],
        start: 0,
        end: 100,
      },
      {
        show: true,
        xAxisIndex: [0, 1],
        type: "slider",
        top: "85%",
        start: 0,
        end: 100,
      },
    ],
    series: [
      {
        name: "Dow-Jones index",
        type: "candlestick",
        data: data.values,
        itemStyle: {
          color: upColor,
          color0: downColor,
          borderColor: undefined,
          borderColor0: undefined,
        },
      },
      {
        name: "MA5",
        type: "line",
        data: calculateMA(5, data),
        smooth: true,
        lineStyle: {
          opacity: 0.5,
        },
      },
      {
        name: "MA10",
        type: "line",
        data: calculateMA(10, data),
        smooth: true,
        lineStyle: {
          opacity: 0.5,
        },
      },
      {
        name: "MA20",
        type: "line",
        data: calculateMA(20, data),
        smooth: true,
        lineStyle: {
          opacity: 0.5,
        },
      },
      {
        name: "MA30",
        type: "line",
        data: calculateMA(30, data),
        smooth: true,
        lineStyle: {
          opacity: 0.5,
        },
      },
      {
        name: "Volume",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: data.volumes,
      },
    ],
  };

  myChart.setOption(option, true);

  // 브러시(brush) 액션으로 특정 범위 강조 (예시: 임의의 날짜 범위)
  myChart.dispatchAction({
    type: "brush",
    areas: [
      {
        brushType: "lineX",
        coordRange: ["2023/01/10", "2023/01/20"],
        xAxisIndex: 0,
      },
    ],
  });
});
</script>
