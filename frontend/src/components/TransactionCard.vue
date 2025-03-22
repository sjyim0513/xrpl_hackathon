<template>
  <div class="card-container">
    <div class="address">
      <div class="account">Account</div>
      {{ effectiveTransactions[0].account }}
    </div>
    <v-window class="card-window" v-model="onboarding" show-arrows="hover">
      <v-window-item
        v-for="(transaction, index) in effectiveTransactions"
        :key="`card-${index}`"
        :value="index"
      >
        <v-card class="card-info" elevation="2" theme="dark">
          <div class="card22">{{ transaction.info.keyType }}</div>
          <a :href="`${baseurl}${transaction.tx.hash}/simple`" target="_blank"
            >Link</a
          >
          <div class="card22">{{ transaction.info.keyType }}</div>
        </v-card>
      </v-window-item>
    </v-window>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const onboarding = ref(0);
const baseurl = "https://livenet.xrpl.org/transactions/";
const props = defineProps<{
  transactions: any[];
}>();

const effectiveTransactions = computed(() => {
  if (props.transactions && props.transactions.length > 0) {
    console.log("props", props.transactions[0].tx);
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
</script>

<style>
.card-container {
  /* height: 100%; */
}

.account {
  font-size: 19px;
  font-weight: 1000;
}

.address {
  margin: 10px;
  height: 100px;
  border-radius: 10px;
  background: #cecece;
  padding: 10px;
}

.card-info {
  margin: 10px;
  min-width: 300px;
  height: 500px;
}

.card22 {
  background: #cecece;
  padding: 20px;
}
</style>
