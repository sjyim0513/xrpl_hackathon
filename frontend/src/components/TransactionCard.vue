<template>
  <div class="card-container">
    <div class="address">
      <div class="account">Account</div>
      <div class="addressitem">{{ effectiveTransactions[0].account }}</div>
    </div>
    <v-window class="card-window" v-model="onboarding" show-arrows="hover">
      <v-window-item
        v-for="(transaction, index) in effectiveTransactions"
        :key="`card-${index}`"
        :value="index"
      >
        <v-card class="card-info" elevation="2" theme="dark">
          <div class="card-plate" :class="transaction.info.keyType">
            {{ transaction.info.keyType }}
          </div>

          <InfoComponent :info="omitAccount(transaction.info)" />
          &nbsp;&nbsp;&nbsp;&nbsp;

          <a :href="`${baseurl}${transaction.tx.hash}/simple`" target="_blank">
            <div class="link-container">
              <strong>Link</strong>
            </div>
          </a>
        </v-card>
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import InfoComponent from "./infoComponent.vue";

const onboarding = ref(0);
const baseurl = "https://livenet.xrpl.org/transactions/";
const props = defineProps<{
  transactions: any[];
}>();

const effectiveTransactions = computed(() => {
  if (props.transactions && props.transactions.length > 0) {
    console.log("props", props.transactions);
    return props.transactions;
  } else {
    return [
      {
        account: "Dummy Account",
        // 필요하다면 추가 필드를 넣을 수 있음
        info: { keyType: "" },
        tx: { hash: "" },
        value: { account: "Dummy Account" },
      },
    ];
  }
});

function omitAccount(info: Record<string, any>): Record<string, any> {
  const { account, ...rest } = info;
  return rest;
}
</script>

<style>
.card-container {
  margin-left: 0px;
  margin-top: -170px; /* 위로 올리기 */
  background: linear-gradient(90deg, #11111100, #0c5a8522);
  border-radius: 15px;
  transition: transform 0.3s ease;
}

.account {
  font-size: 19px;
  font-weight: 1000;
  margin-bottom: 5px;
  background: linear-gradient(90deg, #a0919100, #42424200);
  text-shadow: 2px 2px 4px rgba(119, 200, 26, 0.576); /* 텍스트 그림자 */
}

.address {
  margin: 10px;
  border-radius: 10px;
  background: linear-gradient(90deg, #a6121200, #000000);
  padding: 10px;
  color: #cecece;
}

.card-info {
  margin: 10px;
  min-width: 300px;
  border-radius: 15px !important;
  background: linear-gradient(90deg, #a6121200, #4b4b4b5b) !important;
}

.card-plate {
  padding: 10px;
  font-size: 25px;
  font-weight: 1000;
  color: #cecece !important;
  text-shadow: 3px 3px 5px rgba(0, 0, 0, 0.5); /* 텍스트 그림자 추가 */
}

.addressitem {
  background: linear-gradient(90deg, #00000000, #5f5f5f58);
  border-radius: 15px;
  padding: 0px;
}

.buy {
  background-color: #089981;
}

.sell {
  background-color: #f23645;
}

.offer {
  background-color: blue;
}

.send {
  background-color: #3f46ff;
}

.route {
  background-color: purple;
}

.trustLine {
  background-color: #d482ff;
}

.link-container {
  display: inline-block;
  padding: 15px;
  background: linear-gradient(
    90deg,
    rgba(7, 160, 38, 0),
    rgba(34, 211, 46, 0.635)
  );
  border-radius: 15px;
  margin-top: 10px;
  width: 100%;
  max-width: 300px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  text-align: center; /* 텍스트 가운데 정렬 */
  --shift-right: 10px; /* 오른쪽으로 밀 정도를 조정할 수 있는 변수 */
  transform: translateX(var(--shift-right)); /* 오른쪽으로 이동 */

  /* 텍스트 색상과 스타일 */
  color: #f2f2f289; /* 텍스트 색상 */
  font-family: Arial, Helvetica, sans-serif; /* 글꼴 */
  font-size: 26px; /* 글자 크기 */
  font-weight: bold; /* 글꼴 두께 */
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.576); /* 텍스트 그림자 */

  margin-left: auto; /* 좌측 여백 자동 설정 */
  margin-right: auto; /* 우측 여백 자동 설정 */
}

/* 링크에 마우스를 올렸을 때 스타일 변화 */
.link-container:hover {
  transform: translateX(var(--shift-right)) scale(1.05); /* 크기 살짝 증가 */
  box-shadow: 0px 8px 15px rgba(0, 0, 0, 0.2); /* 그림자 효과 */
}

.link-container:hover {
  transform: scale(1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
</style>
