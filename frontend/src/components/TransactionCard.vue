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
          <a :href="`${baseurl}${transaction.tx.hash}/simple`" target="_blank"
            >Link</a
          >
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
  margin-right: 10px;
}

.account {
  font-size: 19px;
  font-weight: 1000;
  margin-bottom: 5px;
}

.address {
  margin: 10px;
  border-radius: 10px;
  background: #212121;
  padding: 10px;
  color: #cecece;
}

.card-info {
  margin: 10px;
  min-width: 300px;
}

.card-plate {
  padding: 20px;
  font-size: 25px;
  font-weight: 500;
  color: #cecece;
}

.addressitem {
  background-color: #181818;
  border-radius: 15px;
  padding: 15px;
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
</style>
